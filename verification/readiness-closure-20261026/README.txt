ComplianceCore readiness corrections - 26 October 2026

The eight findings from Independent_Readiness_Audit have corresponding source corrections and local verification. Additional fixes cover fresh billing setup, stale membership authority on every authenticated route, disabled co-owner counting, report changes reopening completed audits, archived training assignments, named document selection and accessible search/filter fields.

Evidence:
- backend-tests.json: 131 passed; 0 failed. 40 existing database integration cases were skipped because TEST_DATABASE_URL was not set. Separate guarded real-PostgreSQL tests below verify the changed ownership and workflow paths.
- local-http-and-concurrency.json: 81 checks, actual eight-role accounts, fresh organisation, report review, proof verification, assignment preservation, concurrent ownership changes and stale membership access. Storage uses a local S3 protocol fixture; no external email or charge.
- local-browser-workflows.json: 55 checks, real identities, new audit through independent report review to completion; optional training numbers, participant assignment and proof link; permissions; focus/labels/Escape; phone layout; delayed people-list loading.
- local-all-pages.json: 37 main pages rendered, no browser runtime errors or API server errors, zero unlabelled native fields in the inspected main content.
- billing-bootstrap.json: new database setup, repeated setup preserves commercial records, new billing tables retain audit triggers.
- release-backup.json: consistent native PostgreSQL custom-format backup saved privately, with SHA-256 receipt.

Both builds passed; the final audit-owner adjustment also passed type checking and the delayed browser test. Live deployment and preservation receipts are added after promotion. Historical failed attempts are diagnostic evidence, not acceptance results.

Limits: Tests do not establish error-free software, independent certification or an organisation's legal compliance. Production mail delivery, live payment charges and object-store disaster recovery are separate operational checks. Planned integrations remain labelled as planned; framework editions and evidence quality require appropriate review.
