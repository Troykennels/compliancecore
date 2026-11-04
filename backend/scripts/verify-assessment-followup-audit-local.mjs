import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55446');
assert.equal(url.pathname, '/compliance_renewal_task_workflow_20261026');
const { assessmentService, worksheetRiskSchema } = await import('../dist/modules/frameworks/assessment.service.js');
const { implementationService } = await import('../dist/modules/frameworks/implementation.service.js');
const { recordsService } = await import('../dist/modules/frameworks/compliance-records.service.js');
const { assessmentOutcomeService } = await import('../dist/modules/frameworks/assessment-outcome.service.js');
const { prisma } = await import('../dist/lib/prisma.js');
const access = JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA, 'OrionSoft/compliance-workflow-20261026/compliance-access.private.json'), 'utf8'));
const c = new pg.Client({ connectionString: url.href }); await c.connect();
try {
  const { rows: [tenant] } = await c.query('SELECT schema_name FROM global.tenants WHERE id=$1', [access.owner.tenantId]);
  const schema = tenant.schema_name, id = access.frameworkId;
  const data = await assessmentService.get(schema, id, access.owner);
  const r = data.risks.find(row => row.id === access.riskId);
  // The preceding lifecycle test intentionally changed this synthetic risk to
  // demonstrate stale approval. Reassess and review it using the normal services.
  await assessmentService.risk(schema, id, worksheetRiskSchema.parse({ id: r.id, assetName: r.asset_name, assetType: r.asset_type, title: r.title, threat: r.threat, vulnerability: r.vulnerability, consequence: r.consequence, assessmentBasis: 'The synthetic exposure was reassessed after its likelihood changed; this is isolated test data.', ownerId: r.owner_id, ratingConfirmed: true, inherentLikelihood: r.inherent_likelihood, inherentImpact: r.inherent_impact, treatment: r.treatment, mitigationPlan: r.mitigation_plan, controlIds: r.control_ids, treatmentDueDate: r.treatment_due_date?.toISOString().slice(0, 10), acceptanceNote: r.acceptance_note ?? '', residualLikelihood: 2, residualImpact: 4, residualBasis: 'Current synthetic access-review evidence supports the reviewed remaining exposure after the recorded treatment.', status: 'in_treatment' }), access.owner);
  await recordsService.reviewRisk(schema, { riskId: r.id, controlIds: r.control_ids, decision: 'approve', note: 'Independently rechecked the synthetic exposure, treatment evidence and current remaining risk after the recorded change.', expiresOn: '2027-01-01' }, access.reviewer);
  const state = await implementationService.get(schema, id, access.owner);
  assert.deepEqual(state.gates.filter(gate => !gate.done).map(gate => gate.key), []);
  await implementationService.review(schema, id, 'submit', 'Current synthetic assessment submitted after reassessment.', access.owner);
  await implementationService.review(schema, id, 'approve', 'Independently checked all current synthetic assessment records and recorded the internal conclusion.', access.reviewer);
  const { rows: [evidence] } = await c.query(`SELECT e.id FROM ${schema}.evidence e JOIN ${schema}.evidence_links l ON l.evidence_id=e.id WHERE l.linked_id=$1 LIMIT 1`, [access.controlId]);
  await assessmentOutcomeService.save(schema, id, { kind: 'recorded', authority: 'Isolated internal monitoring acceptance', reference: 'LOCAL-FOLLOWUP-20261104', note: 'Synthetic internal monitoring outcome from the fully reviewed local assessment. This is not an issued certificate.', issuedOn: new Date().toISOString().slice(0, 10), nextReviewOn: '2027-01-01', evidenceId: evidence.id }, access.owner);
  await assert.rejects(assessmentOutcomeService.review(schema, id, access.owner), /different reviewer/);
  await assessmentOutcomeService.review(schema, id, access.reviewer);
  await assessmentOutcomeService.review(schema, id, access.reviewer);
  const final = await implementationService.get(schema, id, access.owner);
  assert.ok(final.outcomeCurrent);
  const { rows } = await c.query(`SELECT assigned_to FROM ${schema}.compliance_calendar_events WHERE source_key=$1`, ['compliance:assessment_outcome:' + final.outcome.id]);
  assert.equal(rows.length, 1); assert.equal(rows[0].assigned_to, access.owner.id);
  const result = { passed: true, realServices: true, mockedReadiness: false, checks: ['Changed risk reassessed and independently reviewed', 'All actual readiness gates pass', 'Current assessment independently signed off', 'Outcome saved with pinned evidence', 'Outcome self-review refused', 'Outcome independently reviewed', 'Duplicate review creates exactly one owned calendar follow-up'] };
  await fs.writeFile('../verification/workflow-audit-20261104/followup-lifecycle-checks.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await c.end(); await prisma.$disconnect(); }
