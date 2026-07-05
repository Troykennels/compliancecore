import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3002),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_PRIVATE_KEY_BASE64: z.string().min(1),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),

  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (256-bit)'),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().default('ComplianceCore <noreply@compliancecore.io>'),

  COOKIE_SECRET: z.string().min(32),

  // Server-only HMAC key for digital-signature certificates. MUST be set and
  // secret — there is deliberately no default. Signatures are only tamper-proof
  // (non-repudiation) if this key never leaves the server.
  SIGNATURE_SECRET: z.string().min(32, 'SIGNATURE_SECRET must be at least 32 characters'),

  // AWS / S3 (required for evidence upload and OCR)
  AWS_ACCESS_KEY_ID:     z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION:            z.string().default('eu-west-1'),
  AWS_S3_BUCKET:         z.string().min(1),

  // OCR — if OCR_PROVIDER=textract (default) uses AWS Textract,
  // if OCR_PROVIDER=none disables OCR entirely
  OCR_PROVIDER: z.enum(['textract', 'none']).default('textract'),

  // Groq (free-tier AI)
  GROQ_API_KEY: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`\n[env] Missing or invalid environment variables:\n${missing}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const jwtPrivateKey = Buffer.from(env.JWT_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
export const jwtPublicKey = Buffer.from(env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf8');
