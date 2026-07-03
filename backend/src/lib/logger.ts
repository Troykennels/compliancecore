import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
      : undefined,
  base: { service: 'compliancecore-api' },
  redact: {
    paths: ['req.headers.authorization', 'body.password', 'body.passwordHash', 'body.token'],
    censor: '[REDACTED]',
  },
});

export function childLogger(context: Record<string, string | undefined>) {
  return logger.child(context);
}
