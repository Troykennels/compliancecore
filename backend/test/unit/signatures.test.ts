import { describe, it, expect } from 'vitest';
import {
  generateSignatureHash,
  verifySignatureHash,
} from '../../src/modules/signatures/signatures.repository';

// Regression tests for the B3 signature-forgery fix. The HMAC must be keyed on
// the server-only SIGNATURE_SECRET (set in test/setup.ts) and bind every
// identifying field, and verification must be tamper-evident and crash-safe.
describe('digital signature HMAC', () => {
  const base = ['approval_step', 'doc-1', 'hash-abc', 'user-1', '2026-07-05T00:00:00.000Z'] as const;

  it('is deterministic for identical inputs', () => {
    const a = generateSignatureHash(...base);
    const b = generateSignatureHash(...base);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it('changes when any bound field changes (tamper-evident)', () => {
    const original = generateSignatureHash(...base);
    expect(generateSignatureHash('policy', 'doc-1', 'hash-abc', 'user-1', base[4])).not.toBe(original);
    expect(generateSignatureHash('approval_step', 'doc-2', 'hash-abc', 'user-1', base[4])).not.toBe(original);
    expect(generateSignatureHash('approval_step', 'doc-1', 'hash-XXX', 'user-1', base[4])).not.toBe(original);
    expect(generateSignatureHash('approval_step', 'doc-1', 'hash-abc', 'user-2', base[4])).not.toBe(original);
    expect(generateSignatureHash('approval_step', 'doc-1', 'hash-abc', 'user-1', '2026-01-01T00:00:00.000Z')).not.toBe(original);
  });

  it('verifies a genuine signature', () => {
    const sig = generateSignatureHash(...base);
    expect(verifySignatureHash(sig, ...base)).toBe(true);
  });

  it('rejects a signature over altered content', () => {
    const sig = generateSignatureHash(...base);
    // Same signature hash, but the document hash claimed at verify time differs.
    expect(verifySignatureHash(sig, 'approval_step', 'doc-1', 'TAMPERED', 'user-1', base[4])).toBe(false);
  });

  it('returns false (does not throw) for a malformed/foreign hash', () => {
    expect(() => verifySignatureHash('not-hex', ...base)).not.toThrow();
    expect(verifySignatureHash('not-hex', ...base)).toBe(false);
    expect(verifySignatureHash('abcd', ...base)).toBe(false); // wrong length
    expect(verifySignatureHash('', ...base)).toBe(false);
  });
});
