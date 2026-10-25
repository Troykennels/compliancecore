# Session stability — 25 October 2026

The idle warning and its automatic sign-out timer have been removed at the owner's request. Users no longer need to click “Stay signed in” to keep the app open. Explicit logout, refresh cookies, access-token expiry, session revocation and API access checks retain their existing behaviour.

The old idle component recorded activity when the app mounted, including on the unauthenticated login page. Signing in did not reset that timestamp. A login page left open beyond its timeout could therefore sign a newly authenticated user out on the next timer tick. This was reproduced against the previous production demo with the browser clock advanced while the login page was open.

Application change: remove the `IdleTimeout` mount/import and its component. No backend or database code was changed. Other local workspace changes were excluded from the release.

The browser regression script is `frontend/scripts/verify-session-stability.mjs`. It reads the existing private demo credentials without logging them and checks desktop/mobile sign-in after a stale login page, simulated authenticated inactivity, refresh-cookie restoration, protected navigation, explicit logout and access denial after logout. It can test an unpromoted frontend under the production origin to preserve the API's existing CORS policy.

Verification and deployment receipts are retained locally in `verification/session-stability-20261025/`. Simulated browser time checks client inactivity handling; it does not represent a 35-minute real-time server-token soak test.

Released application commit: `0bfc347`. Vercel deployment `dpl_CcEo3Ca1PuUsBcmaPeP6gDP91yFW` is ready and the public `compliancecore-sand.vercel.app` alias was independently checked against that deployment. The public JavaScript bundle no longer contains the idle warning.

Validation passed: local TypeScript/production build, focused ESLint on `App.tsx`, Vercel production build, and real demo-account browser checks at 1440px and 390px. Both browser runs covered the stale-login-page case, simulated 35-minute inactivity, cookie-based restoration after reload, protected guide navigation, manual logout and protected-route denial after logout; neither reported a page error.

An initial cloud attempt used the wrong staging root and failed before promotion. The corrected frontend-root deployment passed. A pre-promotion browser attempt reached Vercel's protected preview login rather than the app and is not counted as a passing app check; the complete browser checks above ran against the promoted public app.
