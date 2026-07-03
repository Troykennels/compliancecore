import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId:     env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.AWS_S3_BUCKET;

// Maximum file size accepted: 200 MB
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

// Extensions → MIME types we accept for evidence
export const ACCEPTED_MIME_TYPES: Record<string, string> = {
  // Documents
  'application/pdf':                                                'pdf',
  'application/msword':                                            'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel':                                      'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       'xlsx',
  'application/vnd.ms-powerpoint':                                 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text':                       'odt',
  'application/vnd.oasis.opendocument.spreadsheet':                'ods',
  // Images
  'image/jpeg':  'jpg',
  'image/png':   'png',
  'image/gif':   'gif',
  'image/webp':  'webp',
  'image/svg+xml': 'svg',
  'image/tiff':  'tiff',
  'image/bmp':   'bmp',
  // Text
  'text/plain':  'txt',
  'text/csv':    'csv',
  'application/json': 'json',
  'application/xml':  'xml',
  'text/xml':         'xml',
  // Archives (download only, no preview)
  'application/zip':                'zip',
  'application/x-zip-compressed':  'zip',
};

// MIME types that support OCR via AWS Textract
export const OCR_SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
]);

// MIME types that can be previewed in-browser
export const PREVIEW_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/tiff', 'image/bmp',
  'text/plain', 'text/csv',
]);

// Office documents that can be previewed via Microsoft Office Online
export const OFFICE_PREVIEW_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// Derives the S3 key for an evidence file
export function evidenceFileKey(tenantId: string, evidenceId: string, versionId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  return `evidence/${tenantId}/${evidenceId}/${versionId}.${ext}`;
}

// Generate a presigned PUT URL for direct browser → S3 upload.
// Expires in 15 minutes — enough for any reasonable file size.
export async function generateUploadUrl(
  fileKey: string,
  mimeType: string,
): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         fileKey,
    ContentType: mimeType,
    // Server-side encryption at rest
    ServerSideEncryption: 'AES256',
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
  return { uploadUrl, expiresAt: new Date(Date.now() + 900_000) };
}

// Generate a presigned GET URL for temporary file access (preview/download).
export async function generateDownloadUrl(
  fileKey: string,
  fileName: string,
  disposition: 'inline' | 'attachment' = 'inline',
  expiresInSeconds = 3600,
): Promise<string> {
  const encodedName = encodeURIComponent(fileName);
  const command = new GetObjectCommand({
    Bucket:                     BUCKET,
    Key:                        fileKey,
    ResponseContentDisposition: `${disposition}; filename="${encodedName}"`,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

// Verify a file was actually uploaded by checking it exists and returning its metadata.
export async function verifyUpload(fileKey: string): Promise<{
  sizeBytes: number;
  mimeType: string;
  etag: string;
} | null> {
  try {
    const response = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    return {
      sizeBytes: response.ContentLength ?? 0,
      mimeType:  response.ContentType ?? 'application/octet-stream',
      etag:      response.ETag?.replace(/"/g, '') ?? '',
    };
  } catch {
    return null;
  }
}

// Hard-delete a file from S3 (called when evidence is permanently purged).
export async function deleteFile(fileKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
}

// Returns the public S3 base URL (used to construct Microsoft Office Online preview URLs).
export function getS3BaseUrl(): string {
  return `https://${BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
}
