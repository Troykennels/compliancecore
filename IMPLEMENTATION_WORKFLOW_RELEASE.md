# Guided framework implementation and audit readiness

The framework catalogue now opens a guided implementation workspace instead of importing a framework with one click. Existing organisation records are retained; an imported control list is not labelled a completed or independently approved implementation.

The workspace explains thirteen steps in plain language, with examples, a next-action link and a compact step selector on phones:

1. Agree the organisational scope, intended outcome, owner and target date.
2. Assess the current position, gaps, risk priorities and treatment decisions.
3. Record the Statement of Applicability (SoA), including the reason for every inclusion or exclusion.
4. Assign the applicable controls to responsible people.
5. Independently approve and publish the linked policies.
6. Put the safeguards into practice and record how they operate.
7. Complete relevant training for the implementation and control owners.
8. Attach current evidence with completed uploads.
9. Record testing and current control reviews.
10. Complete a framework-linked internal audit and resolve or formally accept its findings; close implementation actions.
11. Record management review decisions.
12. Obtain independent implementation sign-off.
13. Arrange the relevant external certification/attestation assessment and retain the assessor's decision and issued documentation separately; schedule ongoing reviews and renewals.

The SoA is editable in the workspace and exportable as CSV. It preserves excluded requirements and their reasons. All published library requirements must remain represented. An all-excluded control set cannot manufacture implementation completion.

Policies follow draft → review → independent approval → publication. Authors, owners and last editors cannot approve their own policy. Publication preserves the approver; subsequent edits reset approval. Content revisions retain saved versions. Controls require an active owner, implementation/test notes and current uploaded evidence before being marked implemented. Generic updates cannot forge a review timestamp.

Starting an implementation prepares controls and generates assigned action tasks. Synchronisation is duplicate-safe, retains manual tasks and closes generated actions only when the underlying work is resolved. Readiness is recalculated from the actual records; changed evidence/SoA/policies, incomplete work or an expired review reopens readiness. Sign-off is tied to a content hash and a 90-day internal review date. The owner/submitter cannot sign off their own implementation. A certification assessment cannot be created through the API before a current independent implementation sign-off.

The organisation overview now leads with framework readiness, missing evidence, unassigned work, overdue controls and the next blocker. Navigation follows the sequence of work. The complete user guide explains the workflow with a backup-and-restore example. Framework-specific links keep the controls and policies registers filtered to the selected framework.

Internal workflow sign-off is not external certification, legal compliance or proof that all framework-specific requirements have been interpreted correctly. The organisation and its independent assessor must confirm scope, control interpretation, exclusions and external requirements. The reusable scope/current-state/target-state/action-plan pattern is informed by [NIST SP 1301](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1301.pdf); the software's internal approval gates are product rules, not a claim that every standard prescribes this identical workflow.

Deployment uses additive tenant template `014_framework_implementation.sql`. Existing business rows and prices are not migrated or relabelled. The prior idle-timeout component remains removed; app-page cache headers now require revalidation while versioned assets remain immutable. A tab already executing old JavaScript must be refreshed to load the new release.

Verification receipts are in `verification/framework-workflow-20261026/`. They distinguish isolated API/browser acceptance from read-only public checks. The pre-release PostgreSQL 18 row snapshot and fingerprints are stored privately outside Git; the local PostgreSQL 17 `pg_dump` attempt was version-incompatible and is not a valid backup. The consistent row snapshot includes column metadata and requires the matching schema/migration source for restoration; it is not represented as a native dump or a completed restore exercise.
