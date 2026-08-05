/**
 * Where customers are told to write.
 *
 * This was five different addresses across the app — support@, sales@,
 * billing@ and compliance@ on orionsoft.com, plus info@orionsoftlimited.com —
 * none of which matched the mailbox actually being read. A customer emailing a
 * dead address about a failed payment simply never gets an answer, and we never
 * learn they tried.
 *
 * One constant, so it is changed in one place when a real support domain is
 * set up.
 */
export const SUPPORT_EMAIL = 'orionsoftlimited@gmail.com';

/** Convenience for `mailto:` links that pre-fill a subject. */
export function supportMailto(subject?: string): string {
  return subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}
