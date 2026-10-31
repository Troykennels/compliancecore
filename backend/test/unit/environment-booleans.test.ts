import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';

describe('boolean configuration after the validator upgrade', () => {
  it('keeps false configuration values as booleans instead of truthy strings', () => {
    expect(typeof env.ENABLE_REDIS).toBe('boolean');
    expect(typeof env.SMTP_SECURE).toBe('boolean');
    expect(typeof env.ALLOW_EXTERNAL_DOCUMENT_PREVIEW).toBe('boolean');
    expect(env.SMTP_SECURE).toBe(process.env.SMTP_SECURE === 'true');
    expect(env.ALLOW_EXTERNAL_DOCUMENT_PREVIEW).toBe(process.env.ALLOW_EXTERNAL_DOCUMENT_PREVIEW === 'true');
  });
});
