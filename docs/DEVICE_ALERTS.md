# Device alerts

Use the notification menu to enable device alerts and send a test. Install the Home Screen app first on iPhone/iPad. Sound depends on device notification and Focus settings.

The backend polls unread notifications every 15 seconds, even without an open frontend tab. Device delivery checks active user, tenant and tenant membership, keeps retry receipts, and removes expired subscriptions. Signing out unregisters this browser's device.

The backend database role needs permission to create private tables in `orion_push`. Stable VAPID keys are generated once. Deploy backend and frontend together. The frontend must serve `/sw.js` and the manifest/icons over HTTPS. This delivery worker runs independently of Redis; the existing reminder/report/billing jobs still require their normal Redis configuration.

Validation: backend/frontend production builds and type checks, all 48 tests passed against a disposable PostgreSQL database, four service-worker checks. bcrypt 6 verifies password hashes produced by bcrypt 5; the vulnerable proxy-address and legacy archive dependencies were upgraded/removed. Authenticated live workflows and deployed worker health still require separate verification.

Full disposable-database validation completed with 48 backend tests (none skipped), 117 successful API journey requests (two expected access/plan rejections, no server errors), 13 security checks and 11 admin deletion/recovery checks. GitHub CI and the production deployment both succeeded for eb188fd.
