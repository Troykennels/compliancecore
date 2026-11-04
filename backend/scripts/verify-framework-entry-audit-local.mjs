import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '55446');
assert.equal(target.pathname, '/compliance_renewal_task_workflow_20261026');
const { implementationService } = await import('../dist/modules/frameworks/implementation.service.js');
const { assessmentService, engagementSchema } = await import('../dist/modules/frameworks/assessment.service.js');
const { frameworksService } = await import('../dist/modules/frameworks/frameworks.service.js');
const { prisma } = await import('../dist/lib/prisma.js');
const access = JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA, 'OrionSoft/compliance-workflow-20261026/fixture-access.private.json'), 'utf8'));
const client = new pg.Client({ connectionString: target.href });
await client.connect();
const results = [];
try {
  const { rows: [tenant] } = await client.query('SELECT schema_name FROM global.tenants WHERE id=$1', [access.owner.tenantId]);
  const { rows: frameworks } = await client.query("SELECT id,code FROM framework_data.frameworks WHERE is_active AND code NOT LIKE 'COMPLIANCE-%' ORDER BY code");
  for (const framework of frameworks) {
    await implementationService.save(tenant.schema_name, framework.id, { scope: 'Isolated acceptance assessment of payroll records, finance services, staff and applicable requirements.', objective: 'Assess the recorded compliance obligations using current evidence and independent review.', ownerId: access.owner.id, targetDate: '2027-01-01' }, access.owner);
    await frameworksService.adopt(tenant.schema_name, framework.id, access.owner);
    let state = await implementationService.get(tenant.schema_name, framework.id, access.owner);
    assert.ok(state.controls.length > 0, `${framework.code}: missing requirements`);
    const data = await assessmentService.get(tenant.schema_name, framework.id, access.owner);
    const draft = engagementSchema.parse({ stakeholder: 'Acceptance stakeholder', department: 'Finance', consultedOn: new Date().toISOString().slice(0, 10), status: 'draft', answers: {} });
    const saved = await assessmentService.engagement(tenant.schema_name, framework.id, draft, access.owner);
    assert.ok((await assessmentService.get(tenant.schema_name, framework.id, access.owner)).engagements.some(row => row.id === saved.id && row.status === 'draft'));
    await assessmentService.engagement(tenant.schema_name, framework.id, engagementSchema.parse({ ...draft, id: saved.id, status: 'confirmed', answers: Object.fromEntries(data.questions.map(question => [question.key, 'Synthetic acceptance information reviewed with the responsible stakeholder for this scoped assessment.'])) }), access.owner);
    state = await implementationService.get(tenant.schema_name, framework.id, access.owner);
    assert.ok(state.gates.find(gate => gate.key === 'scope').done, `${framework.code}: scope does not progress`);
    assert.ok(!state.gates.find(gate => gate.key === 'risk_assessment').done);
    assert.ok(!state.outcomeCurrent, 'Starting an assessment must not approve its outcome');
    assert.equal(new Set(state.gates.map(gate => gate.key)).size, state.gates.length);
    results.push({ framework: framework.code, requirements: state.controls.length, steps: state.gates.length + 2, scopeProgresses: true, incompleteDraftReopened: true, outcome: state.profile.outcome });
  }
  const folder = path.resolve('../verification/workflow-audit-20261104');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'framework-entry-checks.json'), JSON.stringify({ passed: true, results, scope: 'Entry, incomplete draft persistence, stakeholder confirmation and framework-specific progression. Final sign-off is covered by the separate lifecycle integration receipt.' }, null, 2));
  console.log(JSON.stringify({ passed: true, frameworks: results.length }));
} finally { await client.end(); await prisma.$disconnect(); }
