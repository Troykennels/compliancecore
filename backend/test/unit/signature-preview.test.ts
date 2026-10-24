import { describe, it, expect, vi, beforeEach } from 'vitest';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/lib/tenant', () => ({ withTenantSchema: (_schema: string, fn: (db: unknown) => unknown) => fn({ $queryRawUnsafe: query }) }));
import { previewSignableDocument, resolveDocumentHash } from '../../src/modules/signatures/document-hash';

describe('reviewed signature preview', () => {
  const policy = { id: 'policy-1', title: 'Fleet safety', description: 'Review before dispatch', document_type: 'policy', status: 'draft', content: 'Reviewed procedure', current_version: 2 };
  beforeEach(() => query.mockReset());
  it('binds the reviewed content and creation digest to the same canonical fields', async () => {
    query.mockResolvedValue([policy]);
    const preview = await previewSignableDocument('tenant_fixture', 'policy', 'policy-1');
    expect(preview.title).toBe('Fleet safety');
    expect(preview.fields).toContainEqual({ name: 'content', value: 'Reviewed procedure' });
    expect(preview.documentHash).toBe(await resolveDocumentHash('tenant_fixture', 'policy', 'policy-1'));
    query.mockResolvedValue([{ ...policy, content: 'Changed after review' }]);
    expect(await resolveDocumentHash('tenant_fixture', 'policy', 'policy-1')).not.toBe(preview.documentHash);
  });
  it('pins the completed evidence file version and checksum', async () => {
    query.mockResolvedValueOnce([{ id: 'e-1', title: 'Dispatch checklist', status: 'active' }]).mockResolvedValueOnce([{ checksum_sha256: 'a'.repeat(64), version_number: 2 }]);
    const preview = await previewSignableDocument('tenant_fixture', 'evidence', 'e-1');
    expect(preview.fields).toContainEqual({ name: 'file_checksum', value: 'a'.repeat(64) });
    expect(preview.fields).toContainEqual({ name: 'file_version', value: 2 });
  });
  it('rejects removed records and unknown or prototype document types', async () => {
    query.mockResolvedValue([]);
    await expect(previewSignableDocument('tenant_fixture', 'policy', 'missing')).rejects.toThrow('No policy found');
    for (const type of ['invoice', '__proto__', 'constructor']) await expect(previewSignableDocument('tenant_fixture', type, 'record')).rejects.toThrow('cannot be signed');
  });
});
