// Populate the required environment BEFORE any src module is imported. config/env
// validates process.env at import time (and process.exit(1)s on a miss), so these
// dummy-but-valid values let the modules under test import cleanly. Real secrets
// are never needed for the unit tests; the integration tests use TEST_DATABASE_URL.
const dummyKey = Buffer.from('test-only-not-a-real-key').toString('base64');

const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3002',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55432/compliancecore?schema=global',
  REDIS_URL: 'redis://localhost:6379',
  JWT_PRIVATE_KEY_BASE64: dummyKey,
  JWT_PUBLIC_KEY_BASE64: dummyKey,
  ENCRYPTION_KEY: 'a'.repeat(64), // 64 hex chars
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  COOKIE_SECRET: 'x'.repeat(48),
  SIGNATURE_SECRET: 'signature-secret-at-least-32-chars-long',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_S3_BUCKET: 'test-bucket',
  GROQ_API_KEY: 'test',
};

for (const [k, v] of Object.entries(defaults)) {
  if (!process.env[k]) process.env[k] = v;
}
