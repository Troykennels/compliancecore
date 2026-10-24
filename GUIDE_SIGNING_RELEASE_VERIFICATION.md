# Billing, guide and signature release — 24 October 2026

Application commit: `d8fcc4a`. Acceptance workflow commit: `a8a85d2`.

The one-time onboarding charge is now the primary amount at the top of every plan card. Recurring subscription charges and combined first-payment quotes remain separate and retain their existing amounts. Demo payments remain disabled.

The User Guide includes department views and a complete searchable, downloadable 16-chapter guide. Billing and signature pages link directly to their chapters.

Signatures now support selecting a saved record, reviewing the server-generated snapshot, optionally drawing with a mouse or touch, acknowledging intent, signing, verification and authorised revocation. Stale snapshots are rejected. Required approval signatures cannot be submitted blank. A signature records a snapshot; it does not replace a workflow approval.

Validation:

- Application CI run `40086294591` passed, including backend tests, frontend build and Docker checks.
- Local signature unit tests: 11 passed. Dedicated local signing API checks: 16 passed, including permissions, missing/unsupported records and stale snapshots.
- Isolated cloud acceptance run `40088245801`, job `120855461587`, passed every step. It used synthetic local PostgreSQL/object storage, with external delivery and payments disabled. Desktop and 390px touch browser checks covered guide navigation/search/download, fee prominence and quotes, actual drawn signatures, verification/revocation, and required approval signatures.
- Local browser attempts interrupted by exhausted C: space are not counted as passing. Cloud acceptance completed those checks independently.
- Live API readiness returned database/Redis up. Demo login and the document-preview endpoint passed live checks; no live signature was created.
- Vercel public alias `compliancecore-sand.vercel.app` was verified against promoted deployment `dpl_AVhmRNesQCC96ZqYA7Gqaz2M6mpJ`. The public guide route and its complete-guide bundle were checked.
- Railway API deployment `25cf447f-68fd-4d77-aaeb-81b61d358d86` succeeded.

The existing automatic deployment credentials remain unresolved; this release used authenticated provider CLIs. No customer subscription prices or existing contract records were changed. Local fixture API, preview and disposable PostgreSQL processes were stopped after verification. Unrelated workspace changes and private credentials were preserved.
