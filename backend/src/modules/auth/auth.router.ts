import { Router } from 'express';
import { makeRateLimiter } from '../../lib/rate-limit';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import * as schema from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

// ─── Rate Limiters (Redis-backed — consistent across instances/restarts) ─────

const loginLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.' } },
  skipSuccessfulRequests: true,
});

const registerLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many registration attempts.' } },
});

const passwordLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many password reset requests.' } },
});

const mfaLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many MFA attempts.' } },
});

// ─── Public Routes ────────────────────────────────────────────────────────────

// Registration & email verification
router.post('/register', registerLimiter, validate(schema.registerSchema), controller.register);
router.get('/verify-email', validate(schema.verifyEmailSchema, 'query'), controller.verifyEmail);

// Login
router.post('/login', loginLimiter, validate(schema.loginSchema), controller.login);

// MFA during login (challenge completion — no auth required yet)
router.post(
  '/mfa/challenge',
  mfaLimiter,
  validate(schema.mfaChallengeSchema),
  controller.completeMfaChallenge,
);
router.post(
  '/mfa/challenge/backup',
  mfaLimiter,
  validate(schema.mfaBackupCodeSchema),
  controller.completeMfaWithBackupCode,
);

// Token refresh (uses httpOnly cookie — no auth header needed)
router.post('/refresh', controller.refreshToken);

// Password recovery
router.post(
  '/forgot-password',
  passwordLimiter,
  validate(schema.forgotPasswordSchema),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  validate(schema.resetPasswordSchema),
  controller.resetPassword,
);

// ─── Protected Routes (require valid access token) ────────────────────────────

router.use(authenticate());

// Current user profile
router.get('/me', controller.me);

// Logout
router.post('/logout', controller.logout);
router.post('/logout-all', controller.logoutAll);

// Password change (when already logged in)
router.post('/change-password', validate(schema.changePasswordSchema), controller.changePassword);

// MFA management (authenticated)
router.post('/mfa/setup', controller.setupMfa);
router.post('/mfa/setup/confirm', validate(schema.mfaVerifySchema), controller.confirmMfaSetup);
router.delete('/mfa', controller.disableMfa);

// Switch the active organization for users who belong to more than one.
router.post('/switch-tenant', validate(schema.switchTenantSchema), controller.switchTenant);

// Session management
router.get('/sessions', controller.getSessions);
router.delete('/sessions/:sessionId', controller.revokeSessionById);

export { router as authRouter };
