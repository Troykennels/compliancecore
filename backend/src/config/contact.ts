/**
 * The address customers are told to write to, on invoices and in email.
 *
 * This was spread across four different orionsoft.com addresses — billing@,
 * compliance@, sales@, support@ — none of which is the mailbox actually being
 * read. Someone whose card was declined replying to a dunning email would have
 * been writing into a void, and we would never have known they tried.
 *
 * Overridable per deployment so a real support domain can be introduced without
 * a code change.
 */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'orionsoftlimited@gmail.com';
