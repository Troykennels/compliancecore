# ComplianceCore — User Manual

**A governance, risk and compliance (GRC) platform for organisations that need to
prove they are secure and lawful — not just claim it.**

Built by ORION SOFT LIMITED for international and African organisations, with
Nigerian regulation (NDPR/NDPA) treated as a first-class citizen alongside GDPR,
ISO 27001, SOC 2 and PCI DSS.

---

## Contents

1. [Who this is for](#1-who-this-is-for)
2. [The core idea](#2-the-core-idea)
3. [Getting started](#3-getting-started)
4. [Frameworks & Controls](#4-frameworks--controls)
5. [Evidence Hub](#5-evidence-hub)
6. [Policies](#6-policies)
7. [Risk Register](#7-risk-register)
8. [Incidents](#8-incidents)
9. [Vendors](#9-vendors)
10. [Audits & Training](#10-audits--training)
11. [Workflows: Tasks, Approvals, Signatures, Escalations](#11-workflows)
12. [Calendar & Expiry Tracker](#12-calendar--expiry-tracker)
13. [AI Hub](#13-ai-hub)
14. [Reports & Analytics](#14-reports--analytics)
15. [Organisation & Team](#15-organisation--team)
16. [Security](#16-security)
17. [Billing](#17-billing)
18. [Roles & permissions](#18-roles--permissions)
19. [Glossary](#19-glossary)

---

## 1. Who this is for

ComplianceCore is for any organisation that has been **asked to prove** it handles
information responsibly. In practice that means:

| Organisation | Typical trigger |
|---|---|
| **SaaS / technology companies** | An enterprise customer's security questionnaire, or a tender requiring ISO 27001 or SOC 2 |
| **Fintechs and lenders** | Regulator expectations, PCI DSS from taking card payments, NDPR/NDPA for customer data |
| **Health providers and health-tech** | HIPAA in the US; NDPR/GDPR for patient data elsewhere |
| **Any business holding personal data** | NDPR (Nigeria), GDPR (EU), UK GDPR, POPIA (South Africa), CCPA (California) |
| **Companies bidding for contracts** | RFPs that ask "are you certified?" and require evidence |
| **Businesses preparing for investment** | Technical due diligence during a raise or acquisition |

**You do not need to already understand compliance.** The platform asks about how
your business operates and works out which regulations apply to you.

### When you probably don't need it yet

A two-person business with no customer data, no card payments and no enterprise
customers has nothing to prove yet. Come back when someone sends you a security
questionnaire — that is the moment this pays for itself.

---

## 2. The core idea

Compliance frameworks are long lists of **controls** — things you must do, like
*"restrict access to information"* or *"notify the regulator within 72 hours of a
breach"*. An auditor's job is to ask: *do you actually do these, and can you prove
it?*

ComplianceCore is built around that loop:

```
Adopt a framework   →  you get its controls as a real checklist
Work the controls   →  mark them implemented, assign owners
Attach evidence     →  the proof an auditor will ask for
Score               →  see how ready you actually are
Report              →  hand the auditor or customer a document
```

Everything else in the product — policies, risks, incidents, vendors, training —
exists because auditors ask about those things specifically.

### Why the compliance score matters

The score is a **weighted** percentage, not a simple count. Each control carries a
criticality weight, so implementing a critical control moves the number more than a
low one. Partially implemented counts half. Controls marked *not applicable* are
excluded from the denominator entirely, so scoping out an irrelevant control
doesn't unfairly penalise you.

It answers one question: **if an auditor walked in today, how would we do?**

---

## 3. Getting started

### Step 1 — Create your account

Sign up with your work email. You'll receive a verification link — **you cannot log
in until you click it.** This prevents someone registering an account against an
address they don't control.

### Step 2 — Create your organisation

Name, industry, size. Behind the scenes this provisions a **dedicated database
schema** for your organisation, which is why it takes a moment. Your data is
physically separated from every other customer's — not merely filtered by an ID.

### Step 3 — Compliance scoping (the important one)

You'll be asked how your business actually operates:

- Where do you operate, and whose personal data do you hold?
- Do you take card payments? Handle health data? Financial data?
- Do you build software? Sell to large companies? Use third-party suppliers?
- Would downtime seriously damage the business?

**None of these questions mention a standard.** Answer them as a business owner.

The platform then tells you which frameworks apply, marked **Required**,
**Recommended** or **Optional**, each with a plain-language reason:

> **Required — NDPR.** You handle personal data of people in Nigeria, so the
> Nigeria Data Protection Act and NDPR apply.
>
> **Required — PCI DSS.** You take card payments, so PCI DSS is contractually
> required by your acquirer and the card schemes.

This is deliberately rule-based rather than a black-box score, because you must be
able to justify scope decisions to an auditor — *"the model said so"* is not a
defensible answer.

**You can revisit this any time** under *Settings → Organisation → Compliance
Scope*. Do so whenever the business changes: opening an EU office or starting to
take card payments changes what applies to you.

### Step 4 — Adopt your first framework

Click **Adopt**. Its full control set is copied into your account. ISO 27001 gives
you 93 controls; PCI DSS 63; SOC 2 51. These are real controls with real
references, not placeholders.

Adopting twice is safe — it adds nothing new rather than duplicating.

---

## 4. Frameworks & Controls

### Frameworks

The catalogue holds **18 frameworks, 532 controls**:

| Framework | Controls | Applies when |
|---|---|---|
| ISO 27001:2022 | 93 | The global baseline for information security |
| PCI DSS v4.0 | 63 | You take card payments |
| SOC 2 | 51 | North American enterprise customers ask for it |
| SAMA CSF | 32 | Saudi-regulated financial institutions |
| SOX | 32 | US-listed companies |
| NDPR / NDPA | 28 | You hold personal data of people in Nigeria |
| GDPR | 26 | You hold personal data of people in the EU |
| HIPAA | 25 | US health information |
| ISO 22301 | 24 | Business continuity |
| NIST CSF 2.0 | 22 | A free framework to structure a security programme |
| NIST SP 800-53 | 20 | US federal and contractors |
| UK GDPR | 19 | Personal data of people in the UK |
| CIS Controls v8 | 18 | Practical, prioritised security hygiene |
| CCPA / CPRA | 16 | California residents' data |
| DPDPA | 16 | India |
| POPIA | 16 | South Africa |
| UAE PDPL | 16 | United Arab Emirates |
| ISO 27701 | 15 | Privacy extension to ISO 27001 |

Each card shows how many controls adopting will give you.

### Controls

A control has an **implementation status**, an **owner**, a **criticality**, and a
**review date**.

**How to work them:**

1. Filter to `not_implemented` and sort by criticality — start where it matters
2. Assign an owner. An unowned control never gets done
3. Set the status honestly:
   - `implemented` — done and working
   - `partially_implemented` — started, gaps remain (counts half)
   - `planned` — committed, not started
   - `not_applicable` — genuinely out of scope. **Record why**; an auditor will ask
   - `not_implemented` — not done
4. Attach evidence
5. Set a review date — controls decay

> **Be honest with statuses.** Marking everything implemented gives you a lovely
> score and a failed audit. The score is for you, not for show.

---

## 5. Evidence Hub

**What it is:** the filing cabinet auditors actually care about. Screenshots,
policies, certificates, config exports, training records.

**How it works:**

- Files are stored in private cloud storage; nothing is publicly readable
- Downloads use short-lived presigned links
- Uploaded documents are **OCR-processed**, making their text searchable — and
  usable by the AI tools
- Every file is **versioned**; superseding one keeps the history
- Every view, download and share is recorded in an **audit trail**

**Sharing with an auditor:** generate a share link with an expiry date and an
optional password. The auditor sees only that item — no account needed.

**Linking:** attach evidence to a control, risk, policy, audit or vendor. When an
auditor asks *"show me proof for A.8.2"*, it's already attached.

---

## 6. Policies

Policies are the documented rules auditors ask for first. The module handles the
**lifecycle**: `draft → in_review → approved → published → archived`.

- Version numbers increment as you revise
- Review dates so policies don't silently go stale
- Route through **Approvals** for sign-off, with a digital signature
- Generate a first draft with the **AI Policy Generator**, then edit

> A policy nobody approved and nobody read is worse than none — it proves you knew
> what to do and didn't.

---

## 7. Risk Register

**What it is:** the record of what could go wrong, how bad it would be, and what
you're doing about it. ISO 27001 and almost every other framework require one.

**How it works** — a 5×5 matrix:

- **Inherent risk** = likelihood × impact *before* controls
- **Residual risk** = the same *after* your controls
- The gap between them is what your controls are actually buying you

**Treatment options:** mitigate (add controls), accept (document why), transfer
(insure/contract), avoid (stop doing it).

Set review dates. A risk register written once and never revisited is a document,
not a process.

---

## 8. Incidents

**What it is:** the register of things that went wrong — and proof you handled them
properly.

**Why it's built around a clock:** GDPR Article 33 gives you **72 hours** from
becoming aware of a personal data breach to notify the regulator. The NDPA imposes
its own deadline. So deadlines here are structured data, not notes:

- **Detected at** starts the clock (not when it happened — when you *knew*)
- **Notification deadline** defaults to 72 hours, adjustable per incident
- Overdue breaches are flagged in red at the top of the page

**How to use it:**

1. **Report** as soon as you're aware. Tick *"involves personal data"* if it might —
   you can correct it later, but you cannot recover lost hours
2. **Investigate** — every status and severity change writes itself to the timeline
3. **Contain**, then **resolve**
4. **Record notification** when you tell the regulator and affected individuals
5. **Capture root cause and lessons learned** — this is what an auditor reads

The timeline is **append-only**. That's deliberate: an incident log you can quietly
edit afterwards is worthless as evidence.

---

## 9. Vendors

Your suppliers' failures become your incidents. GDPR, NDPR and SOC 2 all hold you
responsible for processors acting on your behalf.

Track each vendor's risk level, what data they process, and your review dates. Run
**assessments** (security reviews, due diligence) and keep the results. When an
auditor asks *"how do you manage third-party risk?"*, this is the answer.

---

## 10. Audits & Training

**Audits** — plan and run internal or external audits, record **findings**, and
track each to closure with an owner and date. Findings that are logged but never
closed are the most common audit failure.

**Training** — security awareness training is explicitly required by ISO 27001
A.6.3, PCI DSS 12.6 and HIPAA. Define courses, assign to staff, track completion.
The completion record *is* your evidence.

---

## 11. Workflows

### Tasks
Compliance work broken into assignable pieces, with priorities, due dates,
subtasks, comments and overdue tracking.

### Approvals
Multi-step approval chains for anything needing formal sign-off. Steps run in
order; each can require a specific person, a role, or any one of a list.

Two safeguards worth knowing:
- **Separation of duties** — you cannot approve your own request unless the step
  explicitly allows it
- **Concurrency-safe** — two people deciding simultaneously cannot corrupt the chain

### Signatures
Tamper-evident digital signatures (HMAC-SHA256). The signed document's fingerprint
is computed **server-side** from the stored record — so if the document changes
afterwards, verification fails. For evidence files, the signature also binds the
file's checksum, meaning swapping the file breaks the signature.

Signatures can be revoked with a reason; the record is kept.

### Escalations
Rules that act when something is ignored: *"if a critical task is 2 days overdue,
notify the owner; after 4 days, notify their manager."* Compliance fails quietly —
escalations make it fail loudly.

---

## 12. Calendar & Expiry Tracker

**Calendar** — compliance dates in one place: reviews, audits, assessments,
deadlines.

**Expiry Tracker** — anything with an expiry date: ISO certificates, SOC 2 reports,
insurance, contracts, domains, API keys. Set reminder intervals (90/60/30/14/7 days)
and get notified before it lapses.

> An expired ISO certificate discovered by a customer is a bad day. This exists to
> prevent that.

---

## 13. AI Hub

Six tools, powered by a large language model. **All output is a starting point, not
a finished artefact.** Review everything before relying on it.

| Tool | What it does | Best used for |
|---|---|---|
| **Policy Generator** | Drafts a full policy for a chosen type and framework | Your first draft of a policy you don't have |
| **Contract Summariser** | Extracts key terms, obligations, risks and dates | Reviewing a vendor contract quickly |
| **Risk Analyser** | Scores a described risk and suggests mitigations | Populating your risk register |
| **Checklist Generator** | Produces a 25–35 point readiness checklist | Preparing for an audit |
| **Document Q&A** | Answers questions from an uploaded document | *"What's the notice period in this contract?"* |
| **AI Search** | Searches across your evidence and answers in context | Finding that thing you know you uploaded |

The document-based tools need the file to have finished **OCR processing** first.

> **Never publish AI-generated policy unread.** It's a competent first draft that
> saves hours — it is not a legal document, and it doesn't know your business.

---

## 14. Reports & Analytics

**Executive Dashboard** — the board-level view: overall score, controls by
criticality, framework coverage, trend over time. Export to **PDF or Excel** for a
board pack or a customer.

**Analytics** — operational breakdowns across controls, risks, policies and more.

**Scheduled Reports** — have a report generated and emailed automatically (daily,
weekly, monthly) to a list of recipients.

---

## 15. Organisation & Team

**Organisation profile** — name, industry, logo, and importantly **timezone and
date format**. All dates across the platform render in your organisation's
timezone, so an incident logged at 00:30 in Lagos doesn't read as the previous day
to a reviewer in London.

**Team** — invite colleagues by email and assign a role. Invitations expire.

**Branches & Departments** — model your structure so controls and tasks can be
assigned to the right part of the business.

**API Keys & Webhooks** — integrate with your own systems. Webhooks fire on events
like `control.created` and `incident.resolved`. Secrets can be rotated.

---

## 16. Security

**Two-factor authentication** — enable under *Settings → Security*. Scan the QR code
with any authenticator app, then **save your backup codes** — they're shown once,
and without them a lost phone means a lost account.

**Sessions** — see every active session with device and IP, and revoke any of them.
*Sign out everywhere* kills all sessions at once.

**Idle timeout** — you're signed out automatically after 30 minutes of inactivity,
with a warning first. This is a requirement of PCI DSS (8.2.8) and expected by
ISO 27001 and SOC 2.

**Tenant isolation** — each organisation gets its own database schema. Users
belonging to more than one organisation can switch between them from the sidebar;
switching is verified server-side.

---

## 17. Billing

**Free trial** starts automatically on signup. When it lapses you enter a grace
period, then the account becomes **read-only** — you can always view and export
your own compliance data. It is never held hostage.

**Plans** carry limits (users, evidence storage, frameworks). You're told which
limit you've hit and what upgrading gives you.

**Paying** — checkout runs through Paystack (card, bank transfer, USSD and more).
Payment is verified **server-side** before any plan is granted, so a redirect alone
never unlocks a paid plan.

**Invoices** are listed and downloadable.

---

## 18. Roles & permissions

| Role | Intended for | Can do |
|---|---|---|
| **Owner** | Founder / accountable executive | Everything, including billing and ownership transfer |
| **Admin** | Head of compliance / IT lead | Everything except ownership transfer |
| **Compliance Manager** | Whoever runs the programme day to day | Full compliance work; read-only settings |
| **Control Owner** | Engineers, dept heads | Their controls, evidence, tasks; raise incidents |
| **Auditor** | Internal or external auditor | **Read-only** across the platform, plus approval decisions |
| **Viewer** | Executives, observers | Read-only |
| **MSP Admin / Analyst** | Consultancies managing several clients | Cross-client access |

**Give the auditor role to your actual auditor.** They get everything they need to
review and nothing that lets them change your records — which is exactly what makes
their review credible.

---

## 19. Glossary

| Term | Meaning |
|---|---|
| **Control** | A specific thing you must do to be compliant |
| **Framework** | A published set of controls (ISO 27001, SOC 2, NDPR…) |
| **Evidence** | Proof a control is actually operating |
| **Inherent risk** | Risk before controls |
| **Residual risk** | Risk after controls |
| **Data subject** | A living person whose personal data you hold |
| **Data controller** | Decides why and how personal data is processed |
| **Data processor** | Processes personal data on a controller's behalf |
| **DPIA** | Data Protection Impact Assessment — required for high-risk processing |
| **Statement of Applicability** | Which controls apply to you, and why the rest don't |
| **Personal data breach** | Loss, alteration or unauthorised disclosure of personal data |
| **Separation of duties** | No single person controls a whole sensitive process |
| **Least privilege** | People get the minimum access needed to do their job |

---

## Where to start on day one

1. Complete the **scoping questionnaire** honestly
2. **Adopt** the one framework marked *Required* that scares you most
3. Filter controls to **critical + not implemented** — that's your real backlog
4. Assign owners. Unowned work doesn't happen
5. Upload evidence for the ones you *have* already done — most organisations are
   further along than they think
6. Set **review dates** so it stays true

Compliance is not a project with an end date. It's a habit the platform helps you
keep.

---

*ComplianceCore is a compliance management platform. It is not legal advice.
Regulations change and their application depends on your circumstances — take
professional advice on obligations specific to your organisation.*
