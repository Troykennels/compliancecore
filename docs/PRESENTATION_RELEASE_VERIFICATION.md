# Presentation release verification — 23 October 2026

The release adds the managed `orionsoftlimited` demonstration workspace, Orion Soft Limited branding, first-payment onboarding plus subscription, annual ten-month pricing, clearer notification setup and browser sound opt-in. It repairs framework coverage queries, audit/training signing, inactive-member push delivery, legacy notification routes and misleading integration claims.

## Checks performed

- 67 backend unit/integration tests passed against isolated PostgreSQL, including real transactions, concurrent payment replay, ledger failure recovery, one-time onboarding, renewal consent amounts and existing contracted prices.
- The real HTTP journey passed 117 checks with no server errors, plus all 13 security checks. GitHub CI independently passed backend, frontend and Docker builds for the first release commit.
- The populated demo passed 74 desktop/mobile browser checks after dependency updates, including monthly/annual illustrative quotes with real checkout disabled and persisted sound preferences. Four session/onboarding/refresh recovery scenarios also passed.
- Downloaded evidence matched its recorded SHA-256 checksum. Executive PDF and spreadsheet exports downloaded successfully; audit and training signatures verified. The seeder was rerun with zero duplicate records inserted.
- Railway private object storage passed PUT, GET, HEAD, DELETE, signed download with attachment headers and browser upload CORS checks. Only the production frontend origin is allowed in the bucket CORS policy. The application omits the AWS-only SSE upload option for this compatible provider.
- Production database binding was checked and a private PostgreSQL archive saved and its archive index verified before deployment. Existing customer subscription amounts and periods were captured privately for comparison after rollout.

One local API run exceeded Prisma's default five-second transaction timeout while builds and browser checks ran concurrently on this workstation. The same checks passed when rerun after the build load finished. This does not establish a production-scale load rating.

## Dependency review

Backend and frontend **production dependency audits report zero advisories** after compatible updates, upgrading the router to its patched release and using UUID 11.1.1 (including ExcelJS's UUID dependency). UUID 11 preserves the CommonJS export required by this backend; Excel report generation was checked after the update. The Tailwind animation plugin belongs to build tooling and is now correctly classified as a development dependency.

The full development-tool audit still reports the Tailwind selector-parser chain and the braces chain. The [braces advisory was withdrawn on 23 October](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) as not practically exploitable. The [selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) concerns synchronous parsing of untrusted selectors; this application builds trusted repository CSS and serves static compiled output. These findings are retained rather than claiming a clean development-tool audit or forcing a disruptive Tailwind migration.

## Presentation boundaries

The demo contains synthetic data and non-payable draft invoices. Its sample webhook and scheduled report/escalation examples are disabled; its example API key is revoked. No customer email, SMS, supplier message or charge was sent by these checks. SSO and unconnected external integrations are described as setup/quotation requirements, not active connections. Physical phone sound/delivery needs the device acceptance steps in [the guide](PRESENTATION_AND_ALERTS_GUIDE.md); automated worker tests cannot establish a phone's volume or Focus settings.

Deployment completion and live acceptance are recorded in the operator's final handover checkpoint. A Git push alone is not evidence that both hosting providers have accepted the release.
