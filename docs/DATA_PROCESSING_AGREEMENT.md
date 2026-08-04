# Data Processing Agreement

**ORION SOFT LIMITED — ComplianceCore**

> **This is a template, not executed legal advice.** It is drafted to reflect
> what ComplianceCore actually does, so the technical and organisational
> measures in Annex 2 are accurate rather than aspirational. Have it reviewed by
> a qualified lawyer in your jurisdiction before you send it to a customer, and
> expect enterprise customers to send you their own paper instead.

---

## Why this exists

Under **Article 28 of the UK/EU GDPR** and the **Nigeria Data Protection Act
2023**, a controller may only use a processor under a **written contract**
setting out the subject matter, duration, nature and purpose of the processing,
the type of personal data, the categories of data subject, and the obligations
of both parties.

When a customer stores their employees', auditors' or contacts' details in
ComplianceCore, **they are the controller and ORION SOFT LIMITED is the
processor**. Without this agreement in place, *their* use of the platform is
unlawful — which makes it a blocker for them, not merely paperwork for you.

---

## 1. Parties and roles

| | |
|---|---|
| **Controller** | The Customer — the organisation holding a ComplianceCore subscription |
| **Processor** | ORION SOFT LIMITED, Nigeria |
| **Agreement** | This DPA, forming part of the Customer's subscription terms |

The Customer determines the purposes and means of processing. ORION SOFT LIMITED
processes personal data **only on the Customer's documented instructions**, of
which use of the platform's features is itself an instruction.

## 2. Subject matter, duration, nature and purpose

**Subject matter.** Provision of the ComplianceCore governance, risk and
compliance platform.

**Duration.** For the term of the subscription, plus the retention period in
clause 9.

**Nature and purpose.** Hosting, storage, organisation, retrieval and display of
the Customer's compliance records so the Customer can manage and evidence its own
regulatory obligations.

## 3. Categories of data subject

- The Customer's employees and contractors who hold user accounts
- Individuals named as control owners, risk owners, policy owners or approvers
- The Customer's own auditors and assessors granted access
- Contacts at the Customer's vendors and suppliers
- Any individual referenced in evidence the Customer uploads

## 4. Types of personal data

**Processed by design:**

- Identity and contact data — name, work email address, job role
- Account data — credentials (hashed), MFA enrolment status, role assignments
- Usage data — IP address, user agent, session and audit-trail records
- Employment-related data — training assignments and completion records

**Processed incidentally**, because the Customer controls what it uploads:

- Any personal data contained in evidence documents, incident records, policies
  or free-text fields.

> The Customer is responsible for what it uploads. ComplianceCore is not
> designed for special category data under Article 9, and the Customer should not
> upload it without first agreeing additional safeguards in writing.

## 5. Processor obligations

ORION SOFT LIMITED shall:

1. Process personal data **only on documented instructions**, including for
   international transfers, unless required otherwise by law — in which case it
   will inform the Customer first unless the law forbids it.
2. Ensure everyone authorised to process the data is under a **binding duty of
   confidentiality**.
3. Implement the **technical and organisational measures** in Annex 2.
4. Respect the conditions in clause 6 for engaging a sub-processor.
5. **Assist the Customer** with data subject requests, taking into account the
   nature of the processing.
6. Assist the Customer with security, breach notification, impact assessments
   and prior consultation, taking into account the information available to it.
7. **Delete or return** personal data at the end of the service per clause 9.
8. Make available the information needed to demonstrate compliance and
   **allow for and contribute to audits**, per clause 10.
9. Immediately inform the Customer if, in its opinion, an instruction infringes
   applicable data protection law.

## 6. Sub-processors

The Customer grants **general written authorisation** for the sub-processors in
Annex 1. ORION SOFT LIMITED will give **at least 30 days' notice** before adding
or replacing one, during which the Customer may object on reasonable data
protection grounds; if the objection cannot be resolved, the Customer may
terminate the affected service without penalty.

Each sub-processor is bound by written terms offering **materially the same
protection** as this DPA, and ORION SOFT LIMITED remains **fully liable** for
their performance.

## 7. International transfers

The Customer's data is hosted in the regions listed in Annex 1. Where personal
data is transferred out of the UK, EEA or Nigeria, the transfer is made under an
appropriate safeguard: an adequacy decision, Standard Contractual Clauses, the
UK International Data Transfer Addendum, or a lawful basis under section 41 of
the NDPA, together with a transfer risk assessment where required.

**Data residency is a material consideration.** The current hosting region is
stated in Annex 1; a Customer with a strict residency requirement should confirm
it before subscribing.

## 8. Personal data breaches

ORION SOFT LIMITED will notify the Customer **without undue delay and in any
event within 24 hours** of becoming aware of a personal data breach affecting the
Customer's data, giving the nature of the breach, the categories and approximate
number of data subjects and records, the likely consequences, and the measures
taken or proposed.

The 24-hour commitment exists so the Customer can still meet its own **72-hour**
regulatory deadline, which runs from the moment *it* becomes aware.

The Customer remains responsible for notifying its supervisory authority and
data subjects.

## 9. Return and deletion

On termination the Customer may, for **30 days**, export its data in full using
the in-product export (Settings → Organisation → Download all your data), which
produces every record in JSON and CSV.

After that period ORION SOFT LIMITED will delete the Customer's personal data,
including from its systems and instructing sub-processors to do the same, except
where storage is required by law. Backups are purged on their normal rotation,
which does not exceed **35 days**.

## 10. Audit

ORION SOFT LIMITED will make available the information reasonably necessary to
demonstrate compliance with Article 28, and allow audits by the Customer or an
auditor it mandates, subject to:

- reasonable prior notice of at least 30 days;
- no more than once in any 12-month period, unless a breach has occurred or a
  supervisory authority requires it;
- the auditor accepting reasonable confidentiality obligations;
- audits being conducted so as not to disrupt the service or compromise the
  confidentiality of other customers' data.

## 11. Liability and precedence

This DPA forms part of the subscription agreement, and the limitations of
liability there apply. Where this DPA conflicts with the subscription agreement
on data protection matters, **this DPA prevails**.

---

# Annex 1 — Sub-processors and hosting

Complete this table for your actual deployment **before sending it to any
customer**. An inaccurate sub-processor list is itself an Article 28 failure.

| Sub-processor | Purpose | Location |
|---|---|---|
| Railway | Application hosting and managed database | *state your region* |
| Vercel | Frontend hosting and content delivery | Global edge |
| Amazon Web Services (S3) | Evidence file storage | *state your region* |
| Paystack | Payment processing | Nigeria |
| Brevo | Transactional email | European Union |
| Groq | AI features (policy drafting, document analysis) | United States |

> **Note on the AI sub-processor.** Text a user submits to the AI tools —
> including the content of an uploaded document — is sent to Groq for processing.
> Customers should be told this plainly, and any customer who cannot accept a US
> AI processor needs the AI features disabled for their tenant.

---

# Annex 2 — Technical and organisational measures

These are the measures actually implemented, not a wish list.

### Access control

- Role-based access control across eight roles, enforced per endpoint
- Passwords hashed with bcrypt (cost 12); never stored or logged in plain text
- Optional TOTP two-factor authentication; secrets encrypted at rest with
  AES-256-GCM, backup codes stored hashed
- Sessions expire after **30 minutes of inactivity**; users can view and revoke
  every active session
- Short-lived access tokens (15 minutes) with refresh-token rotation and
  reuse detection that revokes the whole session family on replay

### Tenant separation

- Each customer organisation is provisioned its own **dedicated database
  schema** — separation at the storage level, not a filter on a shared table
- The active tenant is carried in a signed token and re-verified server-side on
  every request

### Encryption

- TLS in transit for all traffic
- Encryption at rest for the managed database and object storage
- Evidence files held in private storage, never publicly readable, and served
  only through short-lived pre-signed URLs

### Integrity and accountability

- Append-only audit trail on evidence access and on incident timelines
- Digital signatures using HMAC-SHA256 over a digest **derived server-side** from
  the stored record, so a document altered after signing fails verification
- Immutable record of every framework, control and policy change with actor and
  timestamp

### Availability

- Managed database backups with point-in-time recovery
- Health and readiness monitoring on the application and its dependencies
- Rate limiting on authentication and AI endpoints

### Organisational

- Least-privilege access to production for personnel
- Confidentiality obligations in contracts of employment and engagement
- Secrets held in the hosting platform's secret store, never in source control
- Change management through version control with automated checks before deploy

---

*Last reviewed: August 2026 · ORION SOFT LIMITED*
