import { Queue, Worker, Job } from 'bullmq';
import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  Block,
} from '@aws-sdk/client-textract';
import { redisForQueues } from '../config/redis';
import { withTenantSchema } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// ── Queue definition ─────────────────────────────────────────────────────────

export const ocrQueue = new Queue('evidence-ocr', {
  connection: redisForQueues,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

export interface OcrJobData {
  schemaName:  string;
  evidenceId:  string;
  versionId:   string;
  fileKey:     string;
  mimeType:    string;
}

export async function enqueueOcrJob(data: OcrJobData): Promise<void> {
  await ocrQueue.add('extract-text', data, {
    jobId: `ocr:${data.versionId}`, // idempotent — won't duplicate on re-queue
  });
}

// ── Textract client ──────────────────────────────────────────────────────────

const textract = new TextractClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId:     env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

function blocksToText(blocks: Block[]): string {
  return blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => b.Text)
    .join('\n');
}

async function extractTextFromS3(fileKey: string, mimeType: string): Promise<string> {
  const document = {
    S3Object: {
      Bucket: env.AWS_S3_BUCKET,
      Name:   fileKey,
    },
  };

  // AnalyzeDocument supports both PDFs and images; DetectDocumentText is images only.
  // We use AnalyzeDocument with TABLES feature for richer extraction from documents.
  const command = mimeType === 'application/pdf'
    ? new AnalyzeDocumentCommand({ Document: document, FeatureTypes: ['TABLES', 'FORMS'] })
    : new DetectDocumentTextCommand({ Document: document });

  const response = await textract.send(command as never) as { Blocks?: Block[] };
  return blocksToText(response.Blocks ?? []);
}

// ── Worker ───────────────────────────────────────────────────────────────────

async function processOcrJob(job: Job<OcrJobData>): Promise<void> {
  const { schemaName, evidenceId, versionId, fileKey, mimeType } = job.data;

  if (env.OCR_PROVIDER === 'none') {
    logger.info({ versionId }, 'OCR disabled; skipping');
    return;
  }

  logger.info({ evidenceId, versionId, attempt: job.attemptsMade + 1 }, 'OCR job started');

  // Mark as processing
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRaw`
      UPDATE evidence SET ocr_status = 'processing' WHERE id = ${evidenceId}::uuid
    `;
  });

  let ocrText = '';
  let succeeded = false;

  try {
    ocrText = await extractTextFromS3(fileKey, mimeType);
    succeeded = true;
  } catch (err) {
    logger.error({ err, evidenceId, versionId }, 'Textract extraction failed');
    throw err; // BullMQ will retry
  }

  // Update evidence with extracted text and mark completed.
  // The search_vector trigger fires automatically on UPDATE.
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRaw`
      UPDATE evidence
      SET
        ocr_text   = ${ocrText},
        ocr_status = ${succeeded ? 'completed' : 'failed'},
        updated_at = NOW()
      WHERE id = ${evidenceId}::uuid
    `;

    // Log the event
    await tx.$executeRaw`
      INSERT INTO evidence_events (evidence_id, event_type, metadata)
      VALUES (
        ${evidenceId}::uuid,
        'ocr_completed',
        ${JSON.stringify({ versionId, textLength: ocrText.length })}::jsonb
      )
    `;
  });

  logger.info({ evidenceId, textLength: ocrText.length }, 'OCR completed');
}

// Start the worker. Called from server.ts after DB/Redis are connected.
export function startOcrWorker(): Worker {
  const worker = new Worker<OcrJobData>('evidence-ocr', processOcrJob, {
    connection: redisForQueues,
    concurrency: 4, // process up to 4 documents simultaneously
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'OCR job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'OCR job failed');
  });

  return worker;
}
