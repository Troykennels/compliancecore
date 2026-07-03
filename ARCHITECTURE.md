# ComplianceCore — Software Architecture Document
### ORION SOFT LIMITED | Principal Architect Review | Version 1.0 | June 2026

---

## TABLE OF CONTENTS

1. [High-Level Architecture](#1-high-level-architecture)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [PostgreSQL Architecture](#4-postgresql-architecture)
5. [Authentication Flow](#5-authentication-flow)
6. [Authorization Flow](#6-authorization-flow)
7. [File Storage Architecture](#7-file-storage-architecture)
8. [Notification Architecture](#8-notification-architecture)
9. [AI Architecture](#9-ai-architecture)
10. [Microservice Readiness](#10-microservice-readiness)
11. [Scalability Strategy](#11-scalability-strategy)
12. [Caching Strategy](#12-caching-strategy)
13. [Security Architecture](#13-security-architecture)
14. [Logging Architecture](#14-logging-architecture)
15. [Backup Strategy](#15-backup-strategy)
16. [Railway Deployment Architecture](#16-railway-deployment-architecture)
17. [Docker Architecture](#17-docker-architecture)
18. [Architectural Decision Records (ADRs)](#18-architectural-decision-records)

---

## ARCHITECTURAL PHILOSOPHY

Before any diagram, establish the principles that govern every decision in this document.

### Guiding Principles

**1. Boring Technology First**
We choose proven, well-understood technology over bleeding-edge alternatives. PostgreSQL over a distributed NoSQL cluster. Redis over an exotic cache. Fastify over a bespoke framework. Exotic choices increase operational risk, narrow the hiring pool, and introduce failure modes that are hard to diagnose. We adopt novelty only where proven technology cannot solve the problem.

**2. Tenant Isolation as a Non-Negotiable Invariant**
Every architectural layer — database, cache, file storage, logs, API responses, background jobs — must enforce tenant boundaries. A bug that leaks one tenant's data to another is not a bug, it is an existential event for a compliance SaaS company. The architecture provides defense-in-depth: tenant isolation at the application layer AND at the database layer.

**3. Design for the Day You Are Proven Right**
The MVP runs on Railway with a modest infrastructure footprint. The architecture must accommodate 100,000 tenants without a rewrite. This means: schema-based multi-tenancy that can be promoted to database-per-tenant, a service boundary design that can be split into independent microservices, and no tight coupling between services that would prevent independent scaling.

**4. Observability is a Feature, Not an Afterthought**
Every service emits structured JSON logs, Prometheus-compatible metrics, and OpenTelemetry distributed traces from the first commit. You cannot run a compliance platform and be blind about what it is doing. Observability also means the platform can audit itself.

**5. Security is Architecture, Not Configuration**
Security controls are baked into the architecture — mTLS between services, RLS at the database, WAF at the edge, secrets never in code. Security is not a checklist applied after the architecture is designed.

**6. Compliance-as-Code for the Platform Itself**
ComplianceCore is itself a SOC 2 and ISO 27001 customer. Every engineering decision is made with the platform's own compliance posture in mind. CI/CD pipelines run SAST/DAST. Infrastructure is defined as code. Access to production requires MFA and produces an audit trail.

---

## 1. HIGH-LEVEL ARCHITECTURE

### 1.1 System Context Diagram

```mermaid
C4Context
    title ComplianceCore — System Context

    Person(orgAdmin, "Organization Admin", "Configures the tenant, manages users and frameworks")
    Person(complianceMgr, "Compliance Manager", "Manages controls, evidence, risks, and audits")
    Person(employee, "Employee", "Acknowledges policies, completes training")
    Person(extAuditor, "External Auditor", "Reviews evidence via scoped portal")
    Person(vendor, "Vendor", "Responds to risk assessments")
    Person(mspConsultant, "MSP Consultant", "Manages multiple client tenants")

    System(complianceCore, "ComplianceCore", "Enterprise Compliance Management SaaS Platform")

    System_Ext(idp, "Identity Provider", "Okta / Entra ID / Google Workspace")
    System_Ext(cloudInfra, "Cloud Infrastructure", "AWS / Azure / GCP")
    System_Ext(hrSystem, "HR Systems", "BambooHR / Workday / Rippling")
    System_Ext(sourceControl, "Source Control", "GitHub / GitLab")
    System_Ext(claudeAI, "Anthropic Claude API", "AI reasoning and analysis")
    System_Ext(emailProvider, "Email Provider", "Resend / SendGrid")
    System_Ext(fileStorage, "Object Storage", "AWS S3 / Azure Blob (per region)")
    System_Ext(regulator, "Regulatory Bodies", "ICO / NDPC / ADGM")

    Rel(orgAdmin, complianceCore, "Administers tenant configuration")
    Rel(complianceMgr, complianceCore, "Manages compliance program")
    Rel(employee, complianceCore, "Acknowledges policies, completes training")
    Rel(extAuditor, complianceCore, "Reviews evidence via auditor portal")
    Rel(vendor, complianceCore, "Responds to questionnaires via vendor portal")
    Rel(mspConsultant, complianceCore, "Manages multiple client orgs via MSP console")

    Rel(complianceCore, idp, "SSO/SCIM provisioning")
    Rel(complianceCore, cloudInfra, "Automated evidence collection")
    Rel(complianceCore, hrSystem, "Employee lifecycle events")
    Rel(complianceCore, sourceControl, "Code security evidence")
    Rel(complianceCore, claudeAI, "AI gap analysis, risk scoring, document drafting")
    Rel(complianceCore, emailProvider, "Transactional emails and notifications")
    Rel(complianceCore, fileStorage, "Evidence artifact storage")
```

---

### 1.2 High-Level System Architecture

```mermaid
graph TB
    subgraph CLIENTS["Client Layer"]
        WEB["React SPA<br/>(Web Browser)"]
        MOBILE["Mobile Browser<br/>(Responsive PWA)"]
        API_CLIENT["API Clients<br/>(3rd Party / CLI)"]
    end

    subgraph EDGE["Edge Layer"]
        CDN["CDN<br/>(CloudFront / Cloudflare)"]
        WAF["WAF + DDoS<br/>(AWS Shield / CF Rules)"]
        APIGW["API Gateway<br/>(Rate Limiting / Auth / Routing)"]
    end

    subgraph SERVICES["Application Services Layer"]
        direction TB
        AUTH_SVC["Auth Service<br/>(Fastify)"]
        CORE_API["Core API<br/>(Fastify)"]
        INT_ENGINE["Integration Engine<br/>(Fastify + BullMQ)"]
        AI_SVC["AI Service<br/>(Python + FastAPI)"]
        REPORT_SVC["Report Service<br/>(Fastify + Puppeteer)"]
        NOTIFY_SVC["Notification Service<br/>(Fastify)"]
    end

    subgraph DATA["Data Layer"]
        PG[("PostgreSQL<br/>(Primary + Replicas)")]
        REDIS[("Redis<br/>(Cache + Queue)")]
        S3["Object Storage<br/>(S3 per region)"]
        VECTOR[("pgvector<br/>(Embeddings)")]
    end

    subgraph INFRA["Infrastructure Layer"]
        QUEUE["BullMQ<br/>(Job Queues)"]
        EVENTBUS["Event Bus<br/>(PostgreSQL LISTEN/NOTIFY)"]
        SCHEDULER["Job Scheduler<br/>(BullMQ Cron)"]
    end

    subgraph EXTERNAL["External Systems"]
        IDP["Identity Providers<br/>(Okta / Entra / Google)"]
        CLOUD_INFRA["Cloud Providers<br/>(AWS / Azure / GCP)"]
        CLAUDE["Anthropic Claude API"]
        EMAIL["Email<br/>(Resend / SendGrid)"]
    end

    WEB --> CDN
    MOBILE --> CDN
    API_CLIENT --> APIGW
    CDN --> WAF
    WAF --> APIGW

    APIGW --> AUTH_SVC
    APIGW --> CORE_API
    APIGW --> AI_SVC

    CORE_API --> PG
    CORE_API --> REDIS
    CORE_API --> S3
    CORE_API --> QUEUE
    CORE_API --> EVENTBUS

    AUTH_SVC --> PG
    AUTH_SVC --> REDIS
    AUTH_SVC --> IDP

    INT_ENGINE --> PG
    INT_ENGINE --> S3
    INT_ENGINE --> QUEUE
    INT_ENGINE --> CLOUD_INFRA

    AI_SVC --> VECTOR
    AI_SVC --> REDIS
    AI_SVC --> CLAUDE

    REPORT_SVC --> PG
    REPORT_SVC --> S3

    NOTIFY_SVC --> REDIS
    NOTIFY_SVC --> EMAIL
    NOTIFY_SVC --> PG

    QUEUE --> INT_ENGINE
    QUEUE --> REPORT_SVC
    QUEUE --> NOTIFY_SVC
    EVENTBUS --> NOTIFY_SVC
    SCHEDULER --> QUEUE

    style CLIENTS fill:#e8f4fd,stroke:#2196F3
    style EDGE fill:#fff3e0,stroke:#FF9800
    style SERVICES fill:#e8f5e9,stroke:#4CAF50
    style DATA fill:#fce4ec,stroke:#E91E63
    style INFRA fill:#f3e5f5,stroke:#9C27B0
    style EXTERNAL fill:#e0f2f1,stroke:#009688
```

**Decision:** The edge layer (CDN → WAF → API Gateway) is separate from the application layer. This allows the application services to be stateless and horizontally scalable without worrying about DDoS, rate limiting, or SSL termination — all handled at the edge.

---

### 1.3 Deployment Environment Overview

```mermaid
graph LR
    subgraph DEV["Development"]
        DEV_DOCKER["Docker Compose<br/>Local Stack"]
        DEV_DB["Local PostgreSQL"]
        DEV_REDIS["Local Redis"]
    end

    subgraph STAGING["Staging (Railway)"]
        STG_SERVICES["All Services<br/>(Single Railway Project)"]
        STG_DB["Railway PostgreSQL"]
        STG_REDIS["Railway Redis"]
    end

    subgraph PROD["Production (Railway → Cloud)"]
        PROD_US["US Region<br/>(Railway / AWS)"]
        PROD_EU["EU Region<br/>(Railway / AWS eu-central-1)"]
        PROD_AF["Africa Region<br/>(Railway / af-south-1)"]
        PROD_UAE["UAE Region<br/>(Railway / me-south-1)"]
    end

    DEV -->|"Git Push"| STAGING
    STAGING -->|"Approved Release"| PROD

    style DEV fill:#e3f2fd,stroke:#1565C0
    style STAGING fill:#fff8e1,stroke:#F57F17
    style PROD fill:#e8f5e9,stroke:#2E7D32
```

---

## 2. FRONTEND ARCHITECTURE

### 2.1 React Application Structure

```mermaid
graph TB
    subgraph APP["React Application (Vite + TypeScript)"]
        direction TB

        subgraph ROUTING["Routing Layer (React Router v6)"]
            PUBLIC_ROUTES["Public Routes<br/>(login, signup, reset, trust-center)"]
            PROTECTED_ROUTES["Protected Routes<br/>(auth-guarded)"]
            AUDITOR_ROUTES["Auditor Portal Routes<br/>(scoped token)"]
            VENDOR_ROUTES["Vendor Portal Routes<br/>(scoped token)"]
        end

        subgraph LAYOUT["Layout Layer"]
            APP_SHELL["App Shell<br/>(sidebar, topnav, notifications)"]
            MSP_SHELL["MSP Shell<br/>(client switcher, portfolio nav)"]
            PORTAL_SHELL["Portal Shell<br/>(minimal — auditor/vendor)"]
        end

        subgraph PAGES["Page Components (Route-level)"]
            direction LR
            DASHBOARD["Dashboard"]
            FRAMEWORKS["Frameworks"]
            CONTROLS["Controls"]
            EVIDENCE["Evidence Hub"]
            POLICIES["Policies"]
            RISKS["Risk Register"]
            VENDORS["Vendors"]
            AUDITS["Audits"]
            TRAINING["Training"]
            INCIDENTS["Incidents"]
            PRIVACY["Privacy"]
            REPORTS["Reports"]
            SETTINGS["Settings"]
        end

        subgraph FEATURES["Feature Modules (co-located logic)"]
            direction LR
            F_AUTH["auth/"]
            F_CONTROLS["controls/"]
            F_EVIDENCE["evidence/"]
            F_POLICY["policies/"]
            F_RISK["risks/"]
            F_VENDOR["vendors/"]
            F_AUDIT["audits/"]
            F_AI["ai-assistant/"]
        end

        subgraph STATE["State Management"]
            SERVER_STATE["TanStack Query<br/>(server state, caching, sync)"]
            CLIENT_STATE["Zustand<br/>(UI state, tenant context, user session)"]
            FORM_STATE["React Hook Form + Zod<br/>(form state + validation)"]
        end

        subgraph SHARED["Shared Layer"]
            UI_COMPONENTS["UI Components<br/>(shadcn/ui + custom)"]
            HOOKS["Custom Hooks<br/>(usePermission, useTenant, useAI)"]
            API_CLIENT["API Client<br/>(axios + interceptors)"]
            UTILS["Utilities<br/>(formatters, validators, constants)"]
            TYPES["TypeScript Types<br/>(shared DTOs)"]
        end
    end

    ROUTING --> LAYOUT
    LAYOUT --> PAGES
    PAGES --> FEATURES
    FEATURES --> STATE
    FEATURES --> SHARED
    STATE --> API_CLIENT
```

---

### 2.2 Frontend State Architecture

```mermaid
graph LR
    subgraph STORE["Zustand Store (Client State)"]
        AUTH_SLICE["authSlice<br/>(user, token, permissions)"]
        TENANT_SLICE["tenantSlice<br/>(tenantId, name, tier, features)"]
        UI_SLICE["uiSlice<br/>(sidebar, modals, toasts)"]
        MSP_SLICE["mspSlice<br/>(activeTenantId, tenantList)"]
    end

    subgraph QUERY["TanStack Query (Server State)"]
        QUERY_CLIENT["QueryClient<br/>(global config: staleTime, retry)"]
        QUERIES["Queries<br/>(useControls, useEvidence, useRisks...)"]
        MUTATIONS["Mutations<br/>(useCreateControl, useUploadEvidence...)"]
        PREFETCH["Prefetch on hover<br/>(sidebar navigation)"]
    end

    subgraph API["API Client Layer"]
        AXIOS_INSTANCE["Axios Instance<br/>(baseURL, timeout)"]
        REQ_INTERCEPTOR["Request Interceptor<br/>(attach Bearer token, X-Tenant-ID)"]
        RESP_INTERCEPTOR["Response Interceptor<br/>(401 → refresh token, 403 → redirect)"]
    end

    AUTH_SLICE --> REQ_INTERCEPTOR
    TENANT_SLICE --> REQ_INTERCEPTOR
    QUERY_CLIENT --> AXIOS_INSTANCE
    REQ_INTERCEPTOR --> AXIOS_INSTANCE
    RESP_INTERCEPTOR --> AXIOS_INSTANCE
    RESP_INTERCEPTOR --> AUTH_SLICE
```

**Decision:** TanStack Query is used for all server state because it provides automatic background refetching, request deduplication, stale-while-revalidate semantics, and optimistic updates — all critical for a dashboard-heavy application. Zustand handles only UI and session state that has no server counterpart.

---

### 2.3 Frontend Module Structure (File System)

```
src/
├── app/                          # App bootstrap, providers, global config
│   ├── App.tsx
│   ├── providers.tsx             # QueryClient, Router, Theme providers
│   └── routes.tsx                # All route definitions
│
├── features/                     # Feature-first organization
│   ├── auth/
│   │   ├── components/           # LoginForm, MFAChallenge, SSOButton
│   │   ├── hooks/                # useLogin, useLogout, useSession
│   │   ├── api/                  # authApi.ts (axios calls)
│   │   └── types.ts
│   │
│   ├── controls/
│   │   ├── components/           # ControlTable, ControlDetail, ControlForm
│   │   ├── hooks/                # useControls, useControlMutation
│   │   ├── api/                  # controlsApi.ts
│   │   └── types.ts
│   │
│   ├── evidence/
│   ├── policies/
│   ├── risks/
│   ├── vendors/
│   ├── audits/
│   ├── training/
│   ├── incidents/
│   ├── privacy/
│   ├── reports/
│   └── ai-assistant/
│
├── shared/
│   ├── components/               # DataTable, Modal, FileUpload, RichTextEditor
│   ├── hooks/                    # usePermission, useTenant, useDebounce
│   ├── lib/                      # axiosInstance, queryClient, utils
│   ├── types/                    # Global TypeScript types
│   └── constants/                # Framework IDs, permission keys, etc.
│
├── pages/                        # Route-level page components (thin wrappers)
│   ├── DashboardPage.tsx
│   ├── ControlsPage.tsx
│   └── ...
│
└── assets/                       # Fonts, icons, images
```

**Decision:** Feature-first folder structure (not layer-first) means all code related to "controls" — its components, API calls, types, and hooks — lives in one folder. This reduces cross-cutting changes when a feature is modified and makes it easy to reason about feature scope.

---

### 2.4 Frontend Rendering Strategy

```mermaid
graph TB
    subgraph RENDER["Rendering Decisions"]
        SPA["SPA (Client-Side Rendering)<br/>Core App Shell + Dashboard + All Modules"]
        SSR_CANDIDATES["Candidates for SSR/SSG (Future):<br/>Trust Center public page<br/>Marketing landing pages<br/>SEO-required audit portal"]
    end

    subgraph PERF["Performance Strategies"]
        CODESPLIT["Route-Level Code Splitting<br/>(React.lazy + Suspense)"]
        PREFETCH["Hover Prefetch<br/>(TanStack Query prefetchQuery on nav hover)"]
        VIRTUAL["Virtualised Lists<br/>(TanStack Virtual for 10k+ control rows)"]
        MEMOIZE["Selective Memoization<br/>(React.memo on expensive grid cells)"]
        SKELETON["Skeleton Loading<br/>(never blank screens)"]
    end

    SPA --> CODESPLIT
    SPA --> PREFETCH
    SPA --> VIRTUAL
    SPA --> MEMOIZE
    SPA --> SKELETON
```

---

## 3. BACKEND ARCHITECTURE

### 3.1 Service Decomposition

```mermaid
graph TB
    subgraph GATEWAY["API Gateway Layer"]
        GW["API Gateway<br/>(Railway Reverse Proxy / Kong)"]
    end

    subgraph SERVICES["Backend Services"]
        direction LR

        subgraph AUTH["Auth Service :3001"]
            AUTH_API["Fastify API"]
            AUTH_DB["PostgreSQL<br/>(auth schema)"]
            AUTH_CACHE["Redis<br/>(sessions, tokens)"]
        end

        subgraph CORE["Core API Service :3002"]
            CORE_API["Fastify API"]
            CORE_DB["PostgreSQL<br/>(tenant schemas)"]
            CORE_CACHE["Redis<br/>(query cache)"]
        end

        subgraph INTEGRATION["Integration Engine :3003"]
            INT_API["Fastify API<br/>(trigger + status)"]
            INT_WORKERS["BullMQ Workers<br/>(connector jobs)"]
            INT_DB["PostgreSQL<br/>(integration configs)"]
        end

        subgraph AI["AI Service :8000"]
            AI_API["FastAPI (Python)"]
            AI_CACHE["Redis<br/>(embedding cache)"]
            AI_VEC["pgvector<br/>(embeddings)"]
        end

        subgraph REPORT["Report Service :3004"]
            RPT_API["Fastify API"]
            RPT_WORKER["Puppeteer Worker<br/>(PDF generation)"]
        end

        subgraph NOTIFY["Notification Service :3005"]
            NTFY_API["Fastify API"]
            NTFY_WORKER["BullMQ Worker<br/>(email + webhook)"]
        end
    end

    GW -->|"/api/v1/auth/*"| AUTH_API
    GW -->|"/api/v1/*"| CORE_API
    GW -->|"/api/v1/integrations/*"| INT_API
    GW -->|"/api/v1/ai/*"| AI_API
    GW -->|"/api/v1/reports/*"| RPT_API

    CORE_API -->|"Internal HTTP"| NOTIFY_SVC_CALL["Notify Service"]
    CORE_API -->|"Internal HTTP"| AI_SVC_CALL["AI Service"]
    CORE_API -->|"Internal HTTP"| RPT_SVC_CALL["Report Service"]

    style AUTH fill:#e3f2fd,stroke:#1565C0
    style CORE fill:#e8f5e9,stroke:#2E7D32
    style INTEGRATION fill:#fff3e0,stroke:#E65100
    style AI fill:#f3e5f5,stroke:#6A1B9A
    style REPORT fill:#fce4ec,stroke:#880E4F
    style NOTIFY fill:#e0f2f1,stroke:#004D40
```

---

### 3.2 Core API Internal Architecture (Fastify)

```mermaid
graph TB
    subgraph FASTIFY["Core API Service (Fastify + TypeScript)"]
        direction TB

        subgraph LIFECYCLE["Request Lifecycle"]
            ROUTE["Route Definition<br/>(method, path, schema)"]
            PRE_HANDLER["Pre-Handlers<br/>(auth, permission, tenant resolution)"]
            HANDLER["Route Handler<br/>(thin — delegates to service)"]
            POST_HANDLER["Post-Handlers<br/>(audit log write, cache invalidation)"]
        end

        subgraph PLUGINS["Fastify Plugins (registered globally)"]
            P_AUTH["fastify-jwt<br/>(JWT validation)"]
            P_CORS["@fastify/cors<br/>(CORS policy)"]
            P_MULTIPART["@fastify/multipart<br/>(file upload)"]
            P_RATE["@fastify/rate-limit<br/>(per-tenant rate limiting)"]
            P_SWAGGER["@fastify/swagger<br/>(OpenAPI 3.0 spec gen)"]
            P_SENSIBLE["fastify-sensible<br/>(HTTP error helpers)"]
        end

        subgraph LAYERS["Application Layers"]
            CONTROLLERS["Controllers<br/>(route handlers — validate, call service, return)"]
            SERVICES["Services<br/>(business logic — pure functions where possible)"]
            REPOSITORIES["Repositories<br/>(database queries — all SQL here)"]
            DOMAIN["Domain Models<br/>(TypeScript classes / Zod schemas)"]
        end

        subgraph MIDDLEWARE["Cross-Cutting Concerns"]
            TENANT_MW["Tenant Middleware<br/>(set search_path per request)"]
            AUDIT_MW["Audit Middleware<br/>(log every mutation to audit_log)"]
            ERROR_MW["Error Handler<br/>(structured error responses)"]
        end
    end

    ROUTE --> PRE_HANDLER
    PRE_HANDLER --> HANDLER
    HANDLER --> POST_HANDLER
    PRE_HANDLER --> P_AUTH
    HANDLER --> CONTROLLERS
    CONTROLLERS --> SERVICES
    SERVICES --> REPOSITORIES
    REPOSITORIES --> DOMAIN
    TENANT_MW --> REPOSITORIES
    HANDLER --> AUDIT_MW
```

---

### 3.3 API Design Conventions

```
Base URL:     https://api.compliancecore.io/api/v1
Auth:         Authorization: Bearer <jwt>
Tenant:       X-Tenant-ID: <tenant_uuid>  (required on all protected endpoints)
Content-Type: application/json
Versioning:   URI versioning (/v1/, /v2/) — never break existing versions

Resource naming:  /api/v1/controls                  (collection)
                  /api/v1/controls/:id               (single resource)
                  /api/v1/controls/:id/evidence      (sub-resource)
                  /api/v1/controls/:id/evidence/:eid (nested resource)

Standard responses:
  200 OK              - successful GET / PUT / PATCH
  201 Created         - successful POST (resource created)
  204 No Content      - successful DELETE
  400 Bad Request     - validation failure (body includes field-level errors)
  401 Unauthorized    - missing or invalid token
  403 Forbidden       - valid token, insufficient permission
  404 Not Found       - resource does not exist in this tenant
  409 Conflict        - duplicate resource
  422 Unprocessable   - business logic rejection
  429 Too Many Req.   - rate limit exceeded
  500 Internal Error  - unexpected failure (generic message to client, full detail in logs)

Pagination:
  GET /api/v1/controls?page=1&limit=50&sort=created_at&order=desc
  Response: { data: [...], meta: { page, limit, total, totalPages } }

Filtering:
  GET /api/v1/controls?status=failing&framework_id=soc2&owner_id=uuid
```

---

### 3.4 Service-to-Service Communication

```mermaid
graph LR
    subgraph SYNC["Synchronous (HTTP)"]
        CORE_TO_AI["Core API → AI Service<br/>Gap analysis requests<br/>(user waits, max 10s timeout)"]
        CORE_TO_RPT["Core API → Report Service<br/>Report generation trigger<br/>(async — returns job ID)"]
    end

    subgraph ASYNC["Asynchronous (BullMQ)"]
        QUEUE_JOBS["Job Queue (Redis-backed)<br/>evidence:collect<br/>report:generate<br/>notification:send<br/>vendor:assess<br/>training:reminder"]
    end

    subgraph EVENTS["Internal Events (pg LISTEN/NOTIFY)"]
        PG_EVENTS["PostgreSQL Events<br/>control.status_changed<br/>evidence.expired<br/>audit.finding_raised<br/>policy.acknowledgment_overdue"]
    end

    SYNC --> QUEUE_JOBS
    PG_EVENTS --> QUEUE_JOBS
```

**Decision:** Internal service calls for user-facing, latency-sensitive operations use synchronous HTTP. Background operations (evidence collection, report generation, notifications) use BullMQ job queues. This ensures a user action like "run gap analysis" returns a meaningful response in under 2 seconds, while the compute-intensive parts run asynchronously.

---

## 4. POSTGRESQL ARCHITECTURE

### 4.1 Multi-Tenancy: Schema-Per-Tenant

```mermaid
graph TB
    subgraph PG_CLUSTER["PostgreSQL Cluster"]
        direction TB

        subgraph GLOBAL["global schema (shared across all tenants)"]
            T_TENANTS["tenants<br/>(id, name, tier, region, schema_name, created_at)"]
            T_USERS["users<br/>(id, email, name, tenant_id, role, mfa_secret)"]
            T_SESSIONS["sessions<br/>(id, user_id, token_hash, expires_at, ip)"]
            T_BILLING["subscriptions<br/>(id, tenant_id, plan, stripe_id, seats)"]
            T_AUDIT_GLOBAL["global_audit_log<br/>(schema-level admin events)"]
        end

        subgraph TENANT_A["tenant_a schema (Acme Corp)"]
            A_CONTROLS["controls"]
            A_EVIDENCE["evidence_items"]
            A_POLICIES["policies"]
            A_RISKS["risks"]
            A_VENDORS["vendors"]
            A_AUDIT["audit_log"]
        end

        subgraph TENANT_B["tenant_b schema (Zara Finance)"]
            B_CONTROLS["controls"]
            B_EVIDENCE["evidence_items"]
            B_POLICIES["policies"]
            B_RISKS["risks"]
            B_VENDORS["vendors"]
            B_AUDIT["audit_log"]
        end

        subgraph FRAMEWORK["framework schema (immutable — shared read-only)"]
            F_FRAMEWORKS["frameworks<br/>(soc2, iso27001, ndpr, gdpr, hipaa...)"]
            F_CONTROLS["framework_controls<br/>(all standard control requirements)"]
            F_MAPPINGS["control_mappings<br/>(UCF cross-framework map)"]
            F_VERSIONS["framework_versions<br/>(version history of each framework)"]
        end
    end

    T_TENANTS -->|"schema_name"| TENANT_A
    T_TENANTS -->|"schema_name"| TENANT_B
    TENANT_A --> F_FRAMEWORKS
    TENANT_B --> F_FRAMEWORKS

    style GLOBAL fill:#e3f2fd,stroke:#1565C0
    style TENANT_A fill:#e8f5e9,stroke:#2E7D32
    style TENANT_B fill:#fff3e0,stroke:#E65100
    style FRAMEWORK fill:#f3e5f5,stroke:#6A1B9A
```

**Decision: Schema-per-tenant over row-level-security-only or database-per-tenant.**

- **Row-level-security-only** (all tenants in one schema with a `tenant_id` column + RLS) is the simplest approach but carries catastrophic risk: a single misconfigured RLS policy exposes all tenant data. It also makes it impossible to offer dedicated database clusters to Enterprise customers without a data migration.
- **Database-per-tenant** is the most isolated but most operationally expensive — 1,000 tenants means 1,000 database clusters to manage, back up, and upgrade.
- **Schema-per-tenant** is the right balance: full logical isolation (schemas share nothing at the query level), easy promotion to database-per-tenant for Enterprise tier, PostgreSQL's `SET search_path = tenant_abc` ensures correct routing per request, and a single cluster handles thousands of tenants.

---

### 4.2 Core Table Schema (Within Each Tenant Schema)

```mermaid
erDiagram
    FRAMEWORK_CONTROLS ||--o{ TENANT_CONTROLS : "instantiated from"
    TENANT_CONTROLS ||--o{ CONTROL_EVIDENCE : "satisfied by"
    TENANT_CONTROLS ||--o{ CONTROL_RISKS : "linked to"
    TENANT_CONTROLS ||--o{ CONTROL_OWNERS : "assigned to"
    EVIDENCE_ITEMS ||--o{ CONTROL_EVIDENCE : "tagged to"
    USERS ||--o{ CONTROL_OWNERS : "is owner"
    POLICIES ||--o{ POLICY_ACKNOWLEDGMENTS : "acknowledged via"
    USERS ||--o{ POLICY_ACKNOWLEDGMENTS : "acknowledged by"
    RISKS ||--o{ CONTROL_RISKS : "linked via"
    VENDORS ||--o{ VENDOR_ASSESSMENTS : "assessed via"
    VENDORS ||--o{ VENDOR_DOCUMENTS : "documents uploaded"
    AUDIT_ENGAGEMENTS ||--o{ AUDIT_FINDINGS : "produces"
    INCIDENTS ||--o{ INCIDENT_ACTIONS : "tracked via"

    FRAMEWORK_CONTROLS {
        uuid id PK
        string framework_id FK
        string control_id
        string title
        text description
        jsonb framework_mappings
        string category
    }

    TENANT_CONTROLS {
        uuid id PK
        uuid framework_control_id FK
        string status
        string implementation_notes
        uuid owner_id FK
        date next_review_date
        int risk_score
        timestamptz last_tested_at
        timestamptz created_at
    }

    EVIDENCE_ITEMS {
        uuid id PK
        string title
        string source
        string storage_key
        string storage_bucket
        string file_type
        bigint file_size_bytes
        string sha256_hash
        uuid uploaded_by FK
        date expires_at
        jsonb metadata
        timestamptz created_at
    }

    POLICIES {
        uuid id PK
        string title
        int version
        string status
        text content_json
        uuid owner_id FK
        uuid approver_id FK
        date effective_date
        date review_due_date
        string[] framework_ids
        timestamptz published_at
    }

    RISKS {
        uuid id PK
        string title
        text description
        string category
        int inherent_likelihood
        int inherent_impact
        int inherent_score
        string treatment
        int residual_likelihood
        int residual_impact
        int residual_score
        uuid owner_id FK
        date review_date
        string status
    }

    VENDORS {
        uuid id PK
        string name
        string category
        string criticality_tier
        string data_access_level
        bool is_subprocessor
        date contract_renewal_date
        int risk_score
        uuid owner_id FK
    }

    AUDIT_ENGAGEMENTS {
        uuid id PK
        string title
        string type
        string status
        date start_date
        date end_date
        uuid lead_auditor_id FK
        string[] framework_ids
        jsonb scope
    }

    INCIDENTS {
        uuid id PK
        string title
        string type
        string severity
        date discovered_at
        int affected_data_subjects
        text description
        string status
        uuid reporter_id FK
        timestamptz regulatory_deadline
    }
```

---

### 4.3 Indexing Strategy

```sql
-- Within each tenant schema (applied via migration template)

-- Controls: most queried by status and framework
CREATE INDEX idx_controls_status ON controls(status);
CREATE INDEX idx_controls_owner ON controls(owner_id);
CREATE INDEX idx_controls_framework ON controls USING gin(framework_ids);
CREATE INDEX idx_controls_next_review ON controls(next_review_date)
  WHERE status != 'not_applicable';

-- Evidence: queried by expiry and control linkage
CREATE INDEX idx_evidence_expires ON evidence_items(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_evidence_source ON evidence_items(source);
CREATE INDEX idx_control_evidence_control ON control_evidence(control_id);
CREATE INDEX idx_control_evidence_evidence ON control_evidence(evidence_id);

-- Policies: queried by status and review due date
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_review_due ON policies(review_due_date);

-- Acknowledgments: queried by policy version and user
CREATE INDEX idx_acks_policy_user ON policy_acknowledgments(policy_id, user_id);
CREATE INDEX idx_acks_pending ON policy_acknowledgments(policy_id)
  WHERE acknowledged_at IS NULL;

-- Audit log: append-only, queried by user and timestamp range
CREATE INDEX idx_audit_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Risks: queried by score and owner
CREATE INDEX idx_risks_residual_score ON risks(residual_score DESC);
CREATE INDEX idx_risks_owner ON risks(owner_id);

-- Vendors: queried by criticality and risk score
CREATE INDEX idx_vendors_criticality ON vendors(criticality_tier);
CREATE INDEX idx_vendors_risk_score ON vendors(risk_score DESC);
```

---

### 4.4 Tenant Schema Provisioning Flow

```mermaid
sequenceDiagram
    participant CLIENT as Client (Sign-up)
    participant AUTH_SVC as Auth Service
    participant CORE_API as Core API
    participant PG as PostgreSQL
    participant REDIS as Redis
    participant EMAIL as Email Service

    CLIENT->>AUTH_SVC: POST /auth/register {org_name, email, password}
    AUTH_SVC->>AUTH_SVC: Validate input, hash password (bcrypt, cost=12)
    AUTH_SVC->>PG: INSERT INTO global.tenants {id, name, schema_name='tenant_<uuid>'}
    AUTH_SVC->>PG: CREATE SCHEMA tenant_<uuid>
    AUTH_SVC->>PG: Run schema migration (apply all table definitions to new schema)
    AUTH_SVC->>PG: INSERT INTO tenant_<uuid>.tenant_config (defaults)
    AUTH_SVC->>PG: INSERT INTO global.users {email, tenant_id, role='admin'}
    AUTH_SVC->>REDIS: Cache tenant config (key: tenant:<id>:config)
    AUTH_SVC->>EMAIL: Send welcome email with email verification link
    AUTH_SVC-->>CLIENT: 201 Created {tenant_id, user_id, verification_required: true}

    Note over PG: Schema fully provisioned in < 2 seconds
    Note over CLIENT: Guided onboarding wizard starts after email verification
```

---

### 4.5 Read Replica Strategy

```mermaid
graph LR
    subgraph PG_CLUSTER["PostgreSQL Cluster (per region)"]
        PRIMARY[("Primary\n(Read + Write)")]
        REPLICA_1[("Read Replica 1\n(Reports)")]
        REPLICA_2[("Read Replica 2\n(Analytics)")]
        REPLICA_3[("Read Replica 3\n(Search/AI)")]
    end

    subgraph APP["Application Routing"]
        WRITES["All Writes (INSERT/UPDATE/DELETE)"] --> PRIMARY
        REPORT_READS["Report Queries\n(heavy, long-running)"] --> REPLICA_1
        ANALYTICS_READS["Dashboard Analytics\n(aggregations)"] --> REPLICA_2
        AI_READS["AI Embedding Queries\n(pgvector)"] --> REPLICA_3
        STANDARD_READS["Standard CRUD Reads"] --> PRIMARY
    end

    PRIMARY -->|"Streaming Replication"| REPLICA_1
    PRIMARY -->|"Streaming Replication"| REPLICA_2
    PRIMARY -->|"Streaming Replication"| REPLICA_3
```

**Decision:** Standard CRUD reads hit the primary. Only explicitly heavy reads (reports, analytics aggregations, vector search) are routed to replicas. This keeps the implementation simple — the connection pool abstraction in the repository layer handles routing. Routing all reads to replicas adds distributed consistency complexity with minimal benefit for a compliance SaaS where 95% of reads are latency-tolerant by a few hundred milliseconds.

---

## 5. AUTHENTICATION FLOW

### 5.1 Standard Email/Password + MFA Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant GW as API Gateway
    participant AUTH as Auth Service
    participant PG as PostgreSQL
    participant REDIS as Redis
    participant EMAIL as Email Service

    B->>GW: POST /api/v1/auth/login {email, password}
    GW->>AUTH: Forward request (rate-limited: 5 attempts/15min per IP)

    AUTH->>PG: SELECT user WHERE email = ? AND tenant verified
    PG-->>AUTH: User record (hashed password, mfa_enabled, mfa_secret)

    AUTH->>AUTH: bcrypt.compare(password, hash)

    alt Password incorrect
        AUTH-->>B: 401 {error: "Invalid credentials"} (generic — no enumeration)
    end

    alt MFA disabled
        AUTH->>AUTH: Generate access_token (JWT, 15min) + refresh_token (opaque, 7 days)
        AUTH->>PG: INSERT INTO sessions {user_id, refresh_token_hash, expires_at, ip, user_agent}
        AUTH->>REDIS: SET session:<user_id>:<jti> {valid: true} EX 900
        AUTH-->>B: 200 {access_token, refresh_token, user, tenant}
    end

    alt MFA enabled
        AUTH->>AUTH: Generate short-lived mfa_challenge_token (5 min)
        AUTH->>REDIS: SET mfa_challenge:<token> {user_id, tenant_id} EX 300
        AUTH-->>B: 200 {mfa_required: true, challenge_token}

        B->>GW: POST /api/v1/auth/mfa/verify {challenge_token, totp_code}
        GW->>AUTH: Forward
        AUTH->>REDIS: GET mfa_challenge:<token> → user_id
        AUTH->>AUTH: TOTP.verify(code, user.mfa_secret) with 30s window ±1
        AUTH->>AUTH: Generate access_token + refresh_token
        AUTH->>PG: INSERT INTO sessions
        AUTH->>REDIS: SET session:<jti> {valid} EX 900
        AUTH->>REDIS: DEL mfa_challenge:<token>
        AUTH-->>B: 200 {access_token, refresh_token, user, tenant}
    end
```

---

### 5.2 Token Refresh Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as Core API
    participant AUTH as Auth Service
    participant REDIS as Redis
    participant PG as PostgreSQL

    Note over B: access_token expired (15 min)

    B->>API: GET /api/v1/controls (Authorization: Bearer <expired_token>)
    API->>API: JWT verify → TokenExpiredError
    API-->>B: 401 {error: "token_expired"}

    B->>AUTH: POST /api/v1/auth/refresh {refresh_token}
    AUTH->>PG: SELECT session WHERE token_hash = sha256(refresh_token) AND expires_at > NOW()
    AUTH->>REDIS: GET session:<old_jti> — check if invalidated (logout/revoke)

    alt Refresh token valid
        AUTH->>AUTH: Generate new access_token (new jti)
        AUTH->>AUTH: Rotate refresh_token (new opaque token)
        AUTH->>PG: UPDATE session SET token_hash = sha256(new_refresh) 
        AUTH->>REDIS: SET session:<new_jti> {valid} EX 900
        AUTH->>REDIS: DEL session:<old_jti>
        AUTH-->>B: 200 {access_token, refresh_token}
        B->>API: Retry original request with new access_token
    end

    alt Refresh token invalid/expired
        AUTH-->>B: 401 {error: "session_expired"} → redirect to login
    end
```

---

### 5.3 SSO Flow (SAML 2.0)

```mermaid
sequenceDiagram
    participant B as Browser
    participant CC as ComplianceCore (SP)
    participant IDP as Customer IDP (Okta / Entra)
    participant AUTH as Auth Service
    participant PG as PostgreSQL

    B->>CC: GET /auth/sso/login?tenant=acme-corp
    CC->>PG: Lookup tenant SSO config (IDP entity ID, SSO URL, x509 cert)
    CC->>CC: Generate SAML AuthnRequest (signed with SP private key)
    CC-->>B: 302 Redirect to IDP SSO URL with SAMLRequest param

    B->>IDP: GET sso_url?SAMLRequest=<encoded>
    IDP->>B: IDP Login Page (if not already authenticated)
    B->>IDP: User authenticates at IDP
    IDP->>IDP: Generate SAML Response (assertions signed with IDP cert)
    IDP-->>B: POST to ComplianceCore ACS URL with SAMLResponse

    B->>CC: POST /auth/sso/callback {SAMLResponse}
    CC->>AUTH: Validate SAML Response
    AUTH->>AUTH: Verify signature with tenant's stored IDP x509 cert
    AUTH->>AUTH: Parse assertions (email, groups, attributes)
    AUTH->>PG: UPSERT user (create if first SSO login, update last_sso_at)
    AUTH->>AUTH: Map IDP groups → ComplianceCore roles (via tenant SSO config)
    AUTH->>AUTH: Issue access_token + refresh_token
    AUTH-->>B: 302 Redirect to /dashboard with tokens set as httpOnly cookies

    Note over AUTH: SCIM 2.0 handles user provisioning separately
    Note over AUTH: SSO handles authentication only
```

---

### 5.4 JWT Token Structure

```json
// Access Token Payload (signed HS256 in dev, RS256 in production)
{
  "sub": "user_uuid",
  "jti": "unique_token_id",
  "tenant_id": "tenant_uuid",
  "tenant_schema": "tenant_abc123",
  "email": "user@acme.com",
  "role": "compliance_manager",
  "permissions": ["controls:read", "controls:write", "evidence:read", "evidence:write"],
  "tier": "professional",
  "iat": 1718400000,
  "exp": 1718400900,
  "iss": "https://auth.compliancecore.io"
}
```

**Decision:** Permissions are embedded in the JWT rather than fetched from the database on every request. This allows stateless permission checks in request handlers without a DB round-trip. The tradeoff (stale permissions for up to 15 minutes) is acceptable because: role changes are rare, access tokens are short-lived (15 min), and critical permission revocations (e.g., user terminated) flow through token invalidation in Redis, which is checked on every request.

---

## 6. AUTHORIZATION FLOW

### 6.1 RBAC Permission Matrix

```
Roles:
  super_admin         - ORION SOFT internal admin (cross-tenant visibility)
  tenant_admin        - Full control within their tenant
  compliance_manager  - Full compliance program management
  control_owner       - Write access to assigned controls only
  auditor_internal    - Read-only across all controls and evidence
  auditor_external    - Read-only, scoped to audit engagement only
  vendor_external     - Write to vendor portal only (questionnaire responses)
  employee            - Policy acknowledgment + training only
  executive           - Dashboard and reports read-only

Permission format: <resource>:<action>
Actions: read, write, delete, approve, export, admin
```

```mermaid
graph LR
    subgraph MATRIX["Permission Matrix (selected)"]
        direction TB

        subgraph RESOURCES["Resource: Controls"]
            R1["controls:read"]
            R2["controls:write"]
            R3["controls:delete"]
            R4["controls:export"]
        end

        subgraph ROLES_C["Roles"]
            TA["tenant_admin"]
            CM["compliance_manager"]
            CO["control_owner"]
            AI["auditor_internal"]
            AE["auditor_external"]
            EM["employee"]
            EX["executive"]
        end
    end

    TA -->|"ALL"| R1
    TA -->|"ALL"| R2
    TA -->|"ALL"| R3
    TA -->|"ALL"| R4
    CM -->|"YES"| R1
    CM -->|"YES"| R2
    CM -->|"YES"| R4
    CO -->|"ASSIGNED ONLY"| R1
    CO -->|"ASSIGNED ONLY"| R2
    AI -->|"YES"| R1
    AI -->|"YES"| R4
    AE -->|"SCOPED ONLY"| R1
    EX -->|"YES"| R1
    EX -->|"YES"| R4
```

---

### 6.2 Authorization Check Flow

```mermaid
sequenceDiagram
    participant H as Route Handler
    participant AUTH_HOOK as Auth Pre-Handler
    participant PERM_SVC as Permission Service
    participant RES_SVC as Resource Service (e.g., Controls)
    participant DB as PostgreSQL

    H->>AUTH_HOOK: Request arrives with Bearer token
    AUTH_HOOK->>AUTH_HOOK: Verify JWT signature + expiry
    AUTH_HOOK->>AUTH_HOOK: Extract {user_id, tenant_id, role, permissions[]}

    Note over AUTH_HOOK: Layer 1 — Role-based permission check (from JWT)
    AUTH_HOOK->>PERM_SVC: hasPermission(permissions, "controls:write")

    alt Permission denied at role level
        AUTH_HOOK-->>H: 403 Forbidden
    end

    Note over AUTH_HOOK: Layer 2 — Tenant isolation (set schema search_path)
    AUTH_HOOK->>DB: SET search_path = tenant_{tenant_id}, framework, global

    Note over RES_SVC: Layer 3 — Resource-level ownership check (control_owner role)
    H->>RES_SVC: getControl(control_id)
    RES_SVC->>DB: SELECT * FROM controls WHERE id = ? (RLS enforced by search_path)
    DB-->>RES_SVC: Control record

    alt User is control_owner role
        RES_SVC->>RES_SVC: Assert control.owner_id == user_id
        alt Not the owner
            RES_SVC-->>H: 403 Forbidden
        end
    end

    RES_SVC-->>H: Authorized — proceed with handler logic
```

**Decision: Three-layer authorization.** Layer 1 (JWT permissions) catches 95% of unauthorized requests before any DB query. Layer 2 (search_path) makes it physically impossible to query another tenant's schema even if application code is buggy. Layer 3 (resource ownership) enforces fine-grained access for the `control_owner` role without burdening every request.

---

### 6.3 Auditor Portal — Scoped Token Model

```mermaid
sequenceDiagram
    participant CM as Compliance Manager
    participant CORE as Core API
    participant DB as PostgreSQL
    participant AUDITOR as External Auditor

    CM->>CORE: POST /api/v1/audits/:id/invite {auditor_email, scope, expires_in_days}
    CORE->>DB: INSERT audit_invitations {audit_id, email, scoped_permissions, token_hash, expires_at}
    CORE->>AUDITOR: Email with unique portal link: https://app.compliancecore.io/auditor?token=<opaque>

    AUDITOR->>CORE: GET /auditor?token=<opaque>
    CORE->>DB: SELECT invitation WHERE sha256(token) = token_hash AND NOT expired
    CORE->>CORE: Issue scoped_access_token (JWT with auditor_external role + audit_engagement_id)
    AUDITOR-->>CORE: Auditor authenticated to scoped workspace

    Note over AUDITOR: Auditor can ONLY see:
    Note over AUDITOR: - Controls in audit scope
    Note over AUDITOR: - Evidence tagged to those controls
    Note over AUDITOR: - Policies linked to framework
    Note over AUDITOR: Cannot see: other tenants, billing, user list, other audits
```

---

## 7. FILE STORAGE ARCHITECTURE

### 7.1 Evidence Artifact Storage Design

```mermaid
graph TB
    subgraph UPLOAD["Upload Flow"]
        CLIENT["Browser Client"]
        CORE_API["Core API"]
        S3_BUCKET["S3 Bucket (per region)"]
        PG_META["PostgreSQL (evidence_items)"]
    end

    subgraph BUCKETS["S3 Bucket Structure (per region)"]
        BUCKET_US["cc-evidence-us-east-1"]
        BUCKET_EU["cc-evidence-eu-central-1"]
        BUCKET_AF["cc-evidence-af-south-1"]
        BUCKET_UAE["cc-evidence-me-south-1"]
    end

    subgraph PATH["Object Key Structure"]
        KEY["tenant_<uuid>/evidence/<year>/<month>/<evidence_uuid>/<filename>"]
    end

    subgraph SECURITY["Security Controls"]
        PRESIGNED["Pre-Signed URLs (15 min expiry)"]
        ENCRYPTION["Server-Side Encryption (SSE-KMS)"]
        VERSIONING["S3 Versioning (enabled)"]
        LIFECYCLE["Lifecycle Rules (GLACIER after 1yr, delete after 7yr)"]
        NOPUBLIC["Block All Public Access (enforced)"]
    end

    CLIENT -->|"1. Request upload URL"| CORE_API
    CORE_API -->|"2. Generate pre-signed PUT URL"| S3_BUCKET
    CORE_API -->|"3. Return pre-signed URL to client"| CLIENT
    CLIENT -->|"4. PUT file directly to S3 (bypasses API)"| S3_BUCKET
    CLIENT -->|"5. Confirm upload {storage_key, sha256}"| CORE_API
    CORE_API -->|"6. Verify sha256 matches, save metadata"| PG_META

    S3_BUCKET --> BUCKET_US
    S3_BUCKET --> BUCKET_EU
    S3_BUCKET --> BUCKET_AF
    S3_BUCKET --> BUCKET_UAE

    BUCKET_US --> KEY
    BUCKET_EU --> KEY
    BUCKET_AF --> KEY
    BUCKET_UAE --> KEY
```

**Decision: Pre-signed URL pattern for uploads.** Files never pass through the API server. The client receives a pre-signed S3 URL and uploads directly to S3. This: (1) eliminates API server memory pressure from large file uploads, (2) reduces API server bandwidth costs, (3) enables large files (up to 5GB multipart) without API timeout concerns. The API only stores metadata after confirming the upload.

---

### 7.2 File Download Security

```mermaid
sequenceDiagram
    participant USER as User (Browser)
    participant CORE as Core API
    participant PERM as Permission Check
    participant S3 as S3 Bucket

    USER->>CORE: GET /api/v1/evidence/:id/download
    CORE->>PERM: Check user has evidence:read for this tenant
    CORE->>CORE: Verify evidence_item belongs to user's tenant (tenant isolation)
    CORE->>S3: Generate pre-signed GET URL (10 minute expiry)
    CORE-->>USER: 302 Redirect to pre-signed URL

    Note over S3: S3 serves file directly to browser
    Note over CORE: No file data passes through API
    Note over CORE: URL expires in 10 minutes — cannot be shared for long-term access

    USER->>CORE: Audit log written: user X downloaded evidence Y at timestamp Z
```

---

### 7.3 Integration-Collected Evidence Storage

```mermaid
graph LR
    subgraph COLLECT["Integration Evidence Collection"]
        CONNECTOR["Connector (e.g., AWS)"]
        PROCESSOR["Evidence Processor"]
        NORMALIZER["Evidence Normalizer<br/>(standard schema)"]
        STORAGE["S3 Storage<br/>(JSON artifact)"]
        META["PostgreSQL<br/>(evidence_items record)"]
    end

    CONNECTOR -->|"Raw API response"| PROCESSOR
    PROCESSOR -->|"Extracted data"| NORMALIZER
    NORMALIZER -->|"Structured artifact (JSON/PDF)"| STORAGE
    NORMALIZER -->|"Metadata + storage_key"| META
    META -->|"Hash verification + control tagging"| META
```

---

## 8. NOTIFICATION ARCHITECTURE

### 8.1 Notification System Design

```mermaid
graph TB
    subgraph TRIGGERS["Notification Triggers"]
        MANUAL["Manual Triggers<br/>(user sends policy acknowledgment request)"]
        SCHEDULE["Scheduled Triggers<br/>(daily digest, weekly reminders)"]
        EVENTS["Event Triggers<br/>(control failed, evidence expired, audit finding raised)"]
        THRESHOLD["Threshold Triggers<br/>(compliance score drops below 80%)"]
    end

    subgraph ORCHESTRATOR["Notification Orchestrator (Notification Service)"]
        EVALUATOR["Preference Evaluator<br/>(user notification preferences)"]
        DEDUPER["Deduplication Engine<br/>(Redis — prevent spam)"]
        RENDERER["Template Renderer<br/>(Handlebars templates)"]
        ROUTER["Channel Router"]
    end

    subgraph CHANNELS["Delivery Channels"]
        EMAIL_CH["Email<br/>(Resend API)"]
        INAPP_CH["In-App<br/>(Server-Sent Events / WebSocket)"]
        WEBHOOK_CH["Webhook<br/>(customer HTTP endpoint)"]
        SLACK_CH["Slack<br/>(Slack Webhooks)"]
    end

    subgraph QUEUE["Queue Layer"]
        BULL_NOTIFY["BullMQ: notification:send<br/>(priority: email > in-app > webhook)"]
        RETRY["Retry with exponential backoff<br/>(3 attempts, 1min/5min/30min)"]
        DLQ["Dead Letter Queue<br/>(failed after all retries → alert)"]
    end

    MANUAL --> BULL_NOTIFY
    SCHEDULE --> BULL_NOTIFY
    EVENTS --> BULL_NOTIFY
    THRESHOLD --> BULL_NOTIFY

    BULL_NOTIFY --> ORCHESTRATOR
    ORCHESTRATOR --> EVALUATOR
    EVALUATOR --> DEDUPER
    DEDUPER --> RENDERER
    RENDERER --> ROUTER

    ROUTER --> EMAIL_CH
    ROUTER --> INAPP_CH
    ROUTER --> WEBHOOK_CH
    ROUTER --> SLACK_CH

    EMAIL_CH --> RETRY
    WEBHOOK_CH --> RETRY
    RETRY --> DLQ

    style TRIGGERS fill:#e3f2fd,stroke:#1565C0
    style ORCHESTRATOR fill:#e8f5e9,stroke:#2E7D32
    style CHANNELS fill:#fff3e0,stroke:#E65100
    style QUEUE fill:#f3e5f5,stroke:#6A1B9A
```

---

### 8.2 In-App Real-Time Notifications (Server-Sent Events)

```mermaid
sequenceDiagram
    participant B as Browser
    participant CORE as Core API
    participant REDIS as Redis (Pub/Sub)
    participant NOTIFY as Notification Service

    B->>CORE: GET /api/v1/notifications/stream (EventSource)
    CORE->>CORE: Validate JWT from query param (EventSource cannot send headers)
    CORE->>REDIS: SUBSCRIBE notifications:<tenant_id>:<user_id>

    Note over CORE,B: SSE connection held open

    NOTIFY->>REDIS: PUBLISH notifications:<tenant_id>:<user_id> {type, payload}
    REDIS-->>CORE: Message received
    CORE-->>B: data: {"type":"evidence_expired","control":"Access Review","days":3}

    Note over B: Browser shows toast notification
    Note over B: Notification bell badge increments

    B->>CORE: POST /api/v1/notifications/:id/read
    CORE->>CORE: Mark notification read in DB
```

**Decision: Server-Sent Events (SSE) over WebSockets.** SSE is sufficient for unidirectional server-to-client notifications. It works over HTTP/1.1, requires no special infrastructure (unlike WebSocket upgrade), auto-reconnects natively, and is far simpler to scale horizontally (each SSE connection is a stateless HTTP connection backed by Redis pub/sub).

---

### 8.3 Email Template Structure

```
Notification Templates (Handlebars):
  /templates/
  ├── base/
  │   ├── layout.hbs              # HTML email wrapper with branding
  │   └── text-layout.hbs         # Plain text fallback
  │
  ├── policy/
  │   ├── acknowledgment-request.hbs
  │   ├── acknowledgment-reminder.hbs
  │   └── acknowledgment-overdue.hbs
  │
  ├── evidence/
  │   ├── expiry-90-days.hbs
  │   ├── expiry-30-days.hbs
  │   └── expiry-7-days.hbs
  │
  ├── audit/
  │   ├── auditor-invitation.hbs
  │   ├── finding-raised.hbs
  │   └── audit-complete.hbs
  │
  ├── vendor/
  │   ├── assessment-request.hbs
  │   └── assessment-reminder.hbs
  │
  ├── training/
  │   ├── assignment.hbs
  │   └── overdue-reminder.hbs
  │
  ├── incident/
  │   ├── breach-notification-regulator.hbs
  │   └── breach-notification-subject.hbs
  │
  └── auth/
      ├── welcome.hbs
      ├── verify-email.hbs
      ├── password-reset.hbs
      └── mfa-setup.hbs
```

---

## 9. AI ARCHITECTURE

### 9.1 AI Service Overview

```mermaid
graph TB
    subgraph AI_SVC["AI Service (Python + FastAPI)"]
        direction TB

        subgraph CAPABILITIES["AI Capabilities"]
            GAP_ANALYSIS["Gap Analysis Engine<br/>(new framework → identify gaps)"]
            RISK_SCORING["Risk Scoring Engine<br/>(AI-augmented risk ratings)"]
            REMEDIATION["Remediation Advisor<br/>(step-by-step fix guidance)"]
            DOC_DRAFT["Document Drafter<br/>(policy / incident report generation)"]
            QA["Compliance Q&A<br/>(natural language queries over tenant data)"]
            ANOMALY["Anomaly Detector<br/>(unusual patterns in evidence/access)"]
        end

        subgraph ORCHESTRATION["LLM Orchestration (LangChain)"]
            ROUTER["Request Router<br/>(capability → chain selector)"]
            CHAINS["Capability Chains<br/>(prompt templates + output parsers)"]
            MEMORY["Conversation Memory<br/>(Redis — per session)"]
            GUARD["Output Guardrails<br/>(structured output validation)"]
        end

        subgraph RETRIEVAL["Retrieval Augmented Generation (RAG)"]
            EMBED["Embedding Service<br/>(Cohere Embed v3)"]
            VECTOR_STORE["pgvector Store<br/>(control + policy embeddings)"]
            RETRIEVER["Semantic Retriever<br/>(cosine similarity search)"]
            RERANKER["Result Reranker<br/>(cross-encoder reranking)"]
        end

        subgraph LLM["LLM Layer"]
            CLAUDE["Anthropic Claude API<br/>(claude-sonnet-4-6 default)"]
            CACHE_LLM["Prompt Cache<br/>(Anthropic prompt caching — 5min TTL)"]
            FALLBACK["Fallback Strategy<br/>(retry on 529 → queue for async)"]
        end
    end

    subgraph DATA_INPUTS["Data Inputs to AI"]
        TENANT_CONTEXT["Tenant Context<br/>(framework, controls, evidence status)"]
        FRAMEWORK_KB["Framework Knowledge Base<br/>(pre-embedded control requirements)"]
        POLICY_DOCS["Policy Documents<br/>(embedded for semantic search)"]
        INCIDENT_HIST["Incident History<br/>(for risk pattern analysis)"]
    end

    DATA_INPUTS --> RETRIEVAL
    RETRIEVAL --> ORCHESTRATION
    ORCHESTRATION --> CHAINS
    CHAINS --> CLAUDE
    CLAUDE --> CACHE_LLM
    CACHE_LLM --> GUARD
    GUARD --> CAPABILITIES
```

---

### 9.2 Gap Analysis AI Flow

```mermaid
sequenceDiagram
    participant CM as Compliance Manager
    participant CORE as Core API
    participant AI as AI Service
    participant VEC as pgvector
    participant CLAUDE as Anthropic Claude API
    participant DB as PostgreSQL

    CM->>CORE: POST /api/v1/ai/gap-analysis {new_framework: "iso27001"}
    CORE->>DB: Fetch tenant's current controls + evidence (existing framework data)
    CORE->>AI: POST /internal/gap-analysis {tenant_context, target_framework}

    AI->>VEC: Embed all target framework control requirements
    AI->>VEC: Cosine similarity search: existing controls vs. target controls
    AI->>AI: Score each target control: [fully_covered, partially_covered, gap]

    AI->>CLAUDE: Prompt with system context + partially_covered controls
    Note over CLAUDE: "Given this organization has these controls implemented<br/>for SOC 2, assess coverage for these ISO 27001 controls..."
    CLAUDE-->>AI: Structured JSON: [{control_id, coverage_level, gap_description, effort_estimate}]

    AI->>AI: Validate and structure output (Pydantic model)
    AI-->>CORE: Gap analysis results

    CORE->>DB: INSERT gap_analysis_results {tenant_id, framework, results, expires_at: +30 days}
    CORE-->>CM: 200 {covered: 42, partial: 15, gaps: 36, estimated_effort_days: 45}

    Note over CM: CM sees visual gap map with AI-generated remediation priorities
```

---

### 9.3 AI Data Segregation (Critical)

```mermaid
graph TB
    subgraph ISOLATION["AI Data Isolation Principles"]
        RULE1["Rule 1: Tenant data NEVER sent to Claude without explicit scope check"]
        RULE2["Rule 2: Prompts include ONLY the requesting tenant's data"]
        RULE3["Rule 3: All Claude API calls logged with tenant_id for audit"]
        RULE4["Rule 4: Claude API used with 'no training' data processing agreement"]
        RULE5["Rule 5: Sensitive fields (PII) stripped before sending to LLM"]
        RULE6["Rule 6: AI outputs tagged as AI-generated — never presented as authoritative"]
    end

    subgraph PII_FILTER["PII Filtering Layer"]
        DETECT["PII Detection<br/>(regex + NLP — emails, names, SSNs)"]
        REDACT["Redaction<br/>(replace PII with [REDACTED])"]
        RESTORE["Post-processing<br/>(restore redacted values in final output)"]
    end

    RULE1 --> PII_FILTER
    DETECT --> REDACT
    REDACT --> RESTORE
```

**Decision: Anthropic Claude as primary LLM.** Claude demonstrates superior instruction-following for structured JSON output — critical for gap analysis where we need deterministic, parseable responses. Claude's data processing agreements meet enterprise compliance requirements. Anthropic prompt caching reduces cost for the large system prompts (framework knowledge bases) that are consistent across requests.

---

### 9.4 Vector Embedding Architecture

```mermaid
graph LR
    subgraph EMBED_PIPELINE["Embedding Pipeline"]
        TRIGGER["Trigger Events:<br/>- New framework added<br/>- Policy updated<br/>- Control description changed"]
        CHUNKER["Text Chunker<br/>(semantic chunking, max 512 tokens)"]
        EMBED_MODEL["Cohere Embed v3<br/>(1024-dim embeddings)"]
        PG_VEC["pgvector<br/>(embeddings table, IVFFlat index)"]
    end

    subgraph SEARCH["Semantic Search"]
        QUERY["User Query / Control Text"]
        QUERY_EMBED["Query Embedding<br/>(same Cohere model)"]
        COSINE["Cosine Similarity Search<br/>(pgvector <=> operator)"]
        RESULTS["Top-K Results<br/>(k=10, then reranked)"]
    end

    TRIGGER --> CHUNKER
    CHUNKER --> EMBED_MODEL
    EMBED_MODEL --> PG_VEC
    QUERY --> QUERY_EMBED
    QUERY_EMBED --> COSINE
    PG_VEC --> COSINE
    COSINE --> RESULTS
```

---

## 10. MICROSERVICE READINESS

### 10.1 Current State: Modular Monolith

```mermaid
graph TB
    subgraph NOW["Phase 1: Modular Monolith (MVP)"]
        MONOLITH["Single Core API Process<br/>(Fastify, TypeScript)"]

        subgraph INTERNAL_MODULES["Internal Modules (in-process)"]
            M1["compliance/"]
            M2["evidence/"]
            M3["policies/"]
            M4["risks/"]
            M5["vendors/"]
            M6["audits/"]
            M7["training/"]
            M8["incidents/"]
            M9["privacy/"]
        end

        MONOLITH --> INTERNAL_MODULES
    end

    subgraph FUTURE["Phase 3: Microservices (when needed)"]
        COMPLIANCE_SVC["Compliance Service"]
        EVIDENCE_SVC["Evidence Service"]
        POLICY_SVC["Policy Service"]
        RISK_SVC["Risk Service"]
        VENDOR_SVC["Vendor Service"]
        AUDIT_SVC["Audit Service"]
    end

    NOW -->|"Extract when single service bottleneck is proven"| FUTURE
```

**Decision: Start with a modular monolith.** The industry has learned that premature microservices decomposition creates distributed system complexity before there is a need for it. We structure the code as independent modules with clear boundaries (no cross-module direct imports, all interaction via interfaces) so extraction is low-friction when the time comes. The Integration Engine, AI Service, and Notification Service are already separate processes because they have genuinely different scaling requirements.

---

### 10.2 Service Extraction Triggers

```
Extract a module into its own service ONLY when:

1. SCALING: The module has demonstrably different scaling requirements
   (e.g., Evidence collection spikes during quarterly audit seasons — extract Integration Engine)

2. DEPLOYMENT: The module needs independent deployment cadence
   (e.g., AI capabilities change weekly while core compliance logic is stable)

3. TECHNOLOGY: The module requires a different runtime
   (e.g., AI/ML workloads in Python — already separated as AI Service)

4. TEAM: The module is owned by a separate team with >5 engineers
   (e.g., Privacy module owned by a dedicated team after Series A)

5. PERFORMANCE: The module's load materially impacts other modules
   (proven by performance profiling — not assumed)

DO NOT extract for:
- Organizational reasons ("it feels like its own thing")
- Architectural purity
- Technology preference
```

---

### 10.3 Service Boundaries (Contracts)

```mermaid
graph LR
    subgraph CONTRACTS["Service Contracts (enforced today for future extraction)"]
        INTERFACE["TypeScript Interface:<br/>IComplianceService, IEvidenceService..."]
        EVENTS["Event Schema:<br/>control.status_changed v1<br/>evidence.linked v1"]
        DTOS["Shared DTOs:<br/>@compliancecore/types package"]
        API_SPEC["OpenAPI Spec:<br/>each module has its own spec section"]
    end

    NOTE["Enforced Rule:<br/>Module A cannot import Module B's internal classes.<br/>Only interfaces and DTOs are shared.<br/>All cross-module calls go through the interface."]
    CONTRACTS --> NOTE
```

---

## 11. SCALABILITY STRATEGY

### 11.1 Horizontal Scaling Architecture

```mermaid
graph TB
    subgraph LB["Load Balancer Layer"]
        LB1["Railway Load Balancer<br/>(or AWS ALB in cloud phase)"]
    end

    subgraph APP_TIER["Application Tier (Stateless)"]
        INST1["Core API Instance 1"]
        INST2["Core API Instance 2"]
        INST3["Core API Instance N"]
        NOTE_STATELESS["All state externalized to PostgreSQL + Redis<br/>Any instance can handle any request"]
    end

    subgraph WORKER_TIER["Worker Tier (Independently Scalable)"]
        W1["Integration Worker 1"]
        W2["Integration Worker 2"]
        W3["Integration Worker N"]
        NOTE_WORKER["Scaled separately during audit season<br/>BullMQ concurrency per worker is configurable"]
    end

    subgraph DATA_TIER["Data Tier (Scale-up + Scale-out)"]
        PG_P[("PostgreSQL Primary<br/>(scale-up for write capacity)")]
        PG_R1[("Read Replica 1")]
        PG_R2[("Read Replica 2")]
        REDIS_CLUSTER[("Redis Cluster<br/>(horizontal sharding)")]
    end

    LB1 --> INST1
    LB1 --> INST2
    LB1 --> INST3
    INST1 --> PG_P
    INST2 --> PG_P
    INST3 --> PG_P
    INST1 --> PG_R1
    INST2 --> PG_R2
    INST1 --> REDIS_CLUSTER
    INST2 --> REDIS_CLUSTER
    WORKER_TIER --> PG_P
    WORKER_TIER --> REDIS_CLUSTER

    style APP_TIER fill:#e8f5e9,stroke:#2E7D32
    style WORKER_TIER fill:#fff3e0,stroke:#E65100
    style DATA_TIER fill:#fce4ec,stroke:#E91E63
```

---

### 11.2 Tenant Growth Strategy

```mermaid
graph LR
    subgraph GROWTH["Tenant Scaling Strategy"]
        PHASE1["Phase 1 (0–500 tenants):<br/>All schemas in 1 PostgreSQL cluster<br/>per region"]

        PHASE2["Phase 2 (500–5,000 tenants):<br/>Shard clusters by tenant ID range<br/>(tenants 1–2500 on cluster A,<br/>2501–5000 on cluster B)"]

        PHASE3["Phase 3 (5,000+ tenants):<br/>Tenant-to-cluster mapping in<br/>global tenant registry<br/>API Gateway routes based on mapping"]

        ENTERPRISE["Enterprise Tier:<br/>Dedicated cluster option<br/>(highest isolation, premium price)"]
    end

    PHASE1 -->|"When primary cluster > 70% capacity"| PHASE2
    PHASE2 -->|"When 2-cluster approach > 70% capacity"| PHASE3
    PHASE3 -->|"For Enterprise customers"| ENTERPRISE
```

---

### 11.3 Compliance Score Calculation at Scale

```mermaid
graph LR
    subgraph SCORE_CALC["Compliance Score Architecture"]
        NAIVE["Naive Approach (DO NOT USE):<br/>Calculate score in real-time on<br/>every dashboard request"]
        PROBLEM["Problem: 10,000 controls × 50 frameworks<br/>= O(n²) query complexity per request"]

        CORRECT["Correct Approach:<br/>Pre-computed score cache"]
        TRIGGER["Trigger recalculation on:<br/>- Control status change<br/>- Evidence upload/expiry<br/>- Integration sync completion"]
        JOB["Background BullMQ job:<br/>score:recalculate:<tenant_id>"]
        CACHE["Redis cache:<br/>compliance_score:<tenant_id>:<framework_id><br/>TTL: until next invalidation event"]
        SERVE["Dashboard reads from cache<br/>(sub-millisecond response)"]
    end

    NAIVE --> PROBLEM
    PROBLEM -->|"Solution"| CORRECT
    TRIGGER --> JOB
    JOB --> CACHE
    CACHE --> SERVE
```

---

## 12. CACHING STRATEGY

### 12.1 Cache Layers

```mermaid
graph TB
    subgraph BROWSER["Layer 1: Browser Cache"]
        HTTP_CACHE["HTTP Cache-Control headers<br/>Static assets: max-age=31536000, immutable<br/>API responses: no-store (compliance data must be fresh)"]
        TANSTACK["TanStack Query Cache<br/>staleTime: 60 seconds for most queries<br/>staleTime: 0 for audit logs, evidence lists"]
    end

    subgraph CDN_CACHE["Layer 2: CDN Cache (CloudFront)"]
        STATIC_ASSETS["Static Assets (JS, CSS, fonts, images)<br/>Cache forever (content-hashed filenames via Vite)"]
        API_NO_CACHE["API Calls: NEVER cached at CDN<br/>(Cache-Control: no-cache, private)"]
    end

    subgraph APP_CACHE["Layer 3: Application Cache (Redis)"]
        SESSION["Session Data<br/>Key: session:<jti><br/>TTL: 15 min (access token lifetime)"]
        TENANT_CONFIG["Tenant Configuration<br/>Key: tenant:<id>:config<br/>TTL: 1 hour (invalidated on settings change)"]
        PERMISSIONS["User Permissions<br/>Key: user:<id>:permissions<br/>TTL: 15 min (same as JWT)"]
        COMP_SCORE["Compliance Score<br/>Key: score:<tenant_id>:<framework><br/>TTL: event-driven invalidation"]
        FRAMEWORK_DATA["Framework Data (read-only)<br/>Key: framework:<id>:controls<br/>TTL: 24 hours (frameworks rarely change)"]
        RATE_LIMIT["Rate Limit Counters<br/>Key: ratelimit:<ip or user_id>:<endpoint><br/>TTL: sliding window (15 min)"]
    end

    subgraph DB_CACHE["Layer 4: PostgreSQL Query Cache"]
        PG_CACHE["PostgreSQL shared_buffers<br/>(frequently-accessed pages stay in memory)"]
        PREP_STMT["Prepared Statements<br/>(query plan cache per connection)"]
    end

    BROWSER --> CDN_CACHE
    CDN_CACHE --> APP_CACHE
    APP_CACHE --> DB_CACHE
```

---

### 12.2 Cache Invalidation Strategy

```mermaid
graph LR
    subgraph EVENTS["Cache Invalidation Events"]
        CTRL_UPDATE["Control status updated"]
        EVD_UPLOAD["Evidence uploaded or expired"]
        POLICY_PUB["Policy published"]
        SETTINGS_CHG["Tenant settings changed"]
        USER_ROLE_CHG["User role changed"]
        FRAMEWORK_ADD["Framework added to tenant"]
    end

    subgraph INVALIDATION["Cache Keys Invalidated"]
        CTRL_UPDATE -->|"Invalidate"| K1["score:<tenant_id>:*<br/>controls:list:<tenant_id>"]
        EVD_UPLOAD -->|"Invalidate"| K2["evidence:list:<tenant_id><br/>score:<tenant_id>:*"]
        POLICY_PUB -->|"Invalidate"| K3["policies:list:<tenant_id><br/>acknowledgments:<policy_id>"]
        SETTINGS_CHG -->|"Invalidate"| K4["tenant:<tenant_id>:config"]
        USER_ROLE_CHG -->|"Invalidate"| K5["user:<user_id>:permissions<br/>Session revoked if role downgraded"]
        FRAMEWORK_ADD -->|"Invalidate + Recalculate"| K6["score:<tenant_id>:<new_framework>"]
    end

    subgraph PATTERN["Pattern"]
        RULE["Rule: Cache invalidation is event-driven, never time-based for mutable data.<br/>TTLs are maximum staleness guarantees, not primary invalidation mechanisms."]
    end
```

---

## 13. SECURITY ARCHITECTURE

### 13.1 Defense-in-Depth Model

```mermaid
graph TB
    subgraph LAYER1["Layer 1 — Network Edge"]
        DDOS["DDoS Mitigation<br/>(Cloudflare / AWS Shield)"]
        WAF_RULES["WAF Rules<br/>(OWASP CRS, rate limits, geo-block if needed)"]
        TLS["TLS 1.3 Termination<br/>(HSTS, no TLS 1.0/1.1)"]
    end

    subgraph LAYER2["Layer 2 — API Gateway"]
        RATELIMIT["Rate Limiting<br/>(per IP, per user, per tenant)"]
        BOT["Bot Detection<br/>(Cloudflare Turnstile on auth endpoints)"]
        INPUTVAL["Input Schema Validation<br/>(Fastify JSON Schema — reject malformed requests at gateway)"]
    end

    subgraph LAYER3["Layer 3 — Application"]
        AUTHN["Authentication<br/>(JWT RS256 + refresh token rotation)"]
        AUTHZ["Authorization<br/>(RBAC + tenant isolation + resource ownership)"]
        SQLI["SQL Injection Prevention<br/>(parameterized queries only — never string concatenation)"]
        XSS["XSS Prevention<br/>(Content-Security-Policy header, DOMPurify on rich text)"]
        CSRF["CSRF Prevention<br/>(SameSite=Strict cookies, CSRF token for state-changing forms)"]
        FILECHECK["File Upload Security<br/>(magic byte validation, virus scan via ClamAV, size limits)"]
    end

    subgraph LAYER4["Layer 4 — Data"]
        ENCRYPT_REST["Encryption at Rest<br/>(AES-256-GCM via KMS)"]
        ENCRYPT_TRANSIT["Encryption in Transit<br/>(TLS 1.3 for all connections, mTLS between services)"]
        RLS["Row-Level Security<br/>(PostgreSQL RLS as defense-in-depth below search_path)"]
        SECRETS["Secrets Management<br/>(Railway secrets / AWS Secrets Manager — never in code or env files)"]
        CMEK["Customer-Managed Keys<br/>(Enterprise tier — per-tenant KMS key)"]
    end

    subgraph LAYER5["Layer 5 — Operations"]
        PAM["Privileged Access Management<br/>(MFA required for all production access)"]
        PENTEST["Annual Penetration Testing<br/>(third-party — reports published to customers)"]
        VULN["Vulnerability Scanning<br/>(SAST: Semgrep in CI/CD; DAST: OWASP ZAP in staging)"]
        DEPS["Dependency Scanning<br/>(Snyk or Dependabot — critical CVEs patched within 24h)"]
        SIEM["SIEM Integration<br/>(all logs → Datadog / Splunk for anomaly detection)"]
    end

    LAYER1 --> LAYER2 --> LAYER3 --> LAYER4 --> LAYER5
```

---

### 13.2 Secrets Management Flow

```mermaid
graph LR
    subgraph NEVER["NEVER store secrets in:"]
        CODE["Source code"]
        ENV_FILE[".env files committed to git"]
        LOGS["Log output"]
        CLIENT["Client-side JavaScript"]
    end

    subgraph ALWAYS["ALWAYS store secrets in:"]
        RAILWAY_SECRETS["Railway Environment Variables<br/>(encrypted at rest by Railway)"]
        AWS_SM["AWS Secrets Manager<br/>(for cloud deployment)"]
        KMS["AWS KMS<br/>(for encryption keys)"]
    end

    subgraph ACCESS["Secret Access Pattern"]
        APP["Application Process"]
        FETCH["Fetch secret at startup<br/>(not at build time)"]
        MEMORY["Hold in memory only<br/>(never write to disk)"]
        ROTATE["Automatic rotation<br/>(KMS: 90 days, DB passwords: 30 days)"]
    end

    ALWAYS --> FETCH
    FETCH --> MEMORY
    MEMORY --> ROTATE
```

---

### 13.3 Security Headers (Applied to All Responses)

```
Strict-Transport-Security:  max-age=31536000; includeSubDomains; preload
Content-Security-Policy:    default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
                            img-src 'self' data: https://cdn.compliancecore.io;
                            connect-src 'self' https://api.compliancecore.io;
                            frame-ancestors 'none';
X-Content-Type-Options:     nosniff
X-Frame-Options:            DENY
Referrer-Policy:            strict-origin-when-cross-origin
Permissions-Policy:         camera=(), microphone=(), geolocation=()
Cache-Control:              no-store, no-cache, must-revalidate (for all API responses)
```

---

## 14. LOGGING ARCHITECTURE

### 14.1 Structured Logging Design

```mermaid
graph TB
    subgraph LOG_SOURCES["Log Sources"]
        APP_LOGS["Application Logs<br/>(Pino logger — JSON structured)"]
        ACCESS_LOGS["Access Logs<br/>(every API request/response)"]
        AUDIT_LOGS["Audit Logs<br/>(every data mutation — written to DB)"]
        ERROR_LOGS["Error Logs<br/>(with stack traces — Sentry)"]
        INFRA_LOGS["Infrastructure Logs<br/>(Docker container logs)"]
        SEC_LOGS["Security Logs<br/>(auth events, permission failures, anomalies)"]
    end

    subgraph LOG_PIPELINE["Log Pipeline"]
        PINO["Pino (Node.js)<br/>(fastest JSON logger — 5x faster than Winston)"]
        LOGRUS["Logrus (Python AI service)<br/>(structured JSON)"]
        COLLECTOR["Log Collector<br/>(Railway → stdout → external sink)"]
        AGGREGATOR["Log Aggregator<br/>(Datadog / Logtail)"]
    end

    subgraph LOG_SCHEMA["Standard Log Schema"]
        SCHEMA["Every log entry includes:<br/>timestamp (ISO 8601 UTC)<br/>level (debug/info/warn/error)<br/>service (core-api / auth / integration / ai)<br/>request_id (correlation ID)<br/>tenant_id (always — never log without tenant context)<br/>user_id (when available)<br/>action (what happened)<br/>duration_ms (for performance tracking)<br/>error (structured, never raw stack in production)"]
    end

    subgraph AUDIT_DB["Audit Log (PostgreSQL — Immutable)"]
        AUDIT_SCHEMA["audit_log table (per tenant schema):<br/>id, tenant_id, user_id, action,<br/>entity_type, entity_id, old_value (JSONB),<br/>new_value (JSONB), ip_address,<br/>user_agent, created_at (NOT updatable)"]
        AUDIT_POLICY["Retention: 7 years<br/>No UPDATE or DELETE permitted (revoke permission at DB level)<br/>Hash chain: each row hashes previous row's id + timestamp"]
    end

    APP_LOGS --> PINO
    ACCESS_LOGS --> PINO
    SEC_LOGS --> PINO
    LOGRUS --> COLLECTOR
    PINO --> COLLECTOR
    COLLECTOR --> AGGREGATOR
    AUDIT_LOGS --> AUDIT_DB
    ERROR_LOGS --> SENTRY["Sentry (error tracking)"]
```

---

### 14.2 Correlation ID Flow (Distributed Tracing)

```mermaid
sequenceDiagram
    participant B as Browser
    participant GW as API Gateway
    participant CORE as Core API
    participant AI as AI Service
    participant PG as PostgreSQL

    B->>GW: POST /api/v1/ai/gap-analysis
    GW->>GW: Generate request_id: "req_a3f9c2b1"
    GW->>CORE: Forward + X-Request-ID: req_a3f9c2b1

    CORE->>CORE: Extract X-Request-ID, attach to all logs
    CORE->>AI: POST /internal/gap-analysis + X-Request-ID: req_a3f9c2b1
    AI->>AI: Attach request_id to all Python logs
    AI->>PG: Query + set pg session variable: SET request.id = 'req_a3f9c2b1'
    PG->>PG: All PostgreSQL logs for this connection include request_id

    Note over CORE: Every log line: {"request_id": "req_a3f9c2b1", "tenant_id": "...", ...}
    Note over AI: Search "req_a3f9c2b1" in Datadog = full trace across all services
```

---

### 14.3 Log Levels and Alert Thresholds

```
DEBUG:   Local development only. NEVER in production (performance + information leakage risk)
INFO:    Successful operations, request completions, job completions
WARN:    Recoverable anomalies: retry #1 of 3, slow query (>500ms), approaching rate limit
ERROR:   Unrecoverable operation failures — triggers Sentry alert, PagerDuty for P1 errors
FATAL:   Process cannot continue — immediate PagerDuty alert, auto-restart via Docker

Alert Thresholds (Datadog Monitors):
  - Error rate > 1% over 5 minutes → P2 alert → Slack #alerts
  - P99 latency > 2s over 5 minutes → P2 alert
  - Failed auth attempts > 50/min per IP → P1 alert → automatic WAF block
  - Audit log write failure → P1 alert (data integrity critical)
  - Any 5xx on /auth/* → P1 alert
  - Database replication lag > 30 seconds → P1 alert
```

---

## 15. BACKUP STRATEGY

### 15.1 Database Backup Architecture

```mermaid
graph TB
    subgraph PRIMARY["Primary PostgreSQL"]
        PG_PRIMARY[("Primary Database<br/>(write + read)")]
    end

    subgraph BACKUPS["Backup Strategy"]
        CONTINUOUS["Continuous WAL Archiving<br/>(to S3 — Point-In-Time Recovery)<br/>RPO: < 1 minute"]
        DAILY["Daily Full Backup<br/>(pg_dump — compressed)<br/>Stored in S3 Glacier after 7 days"]
        WEEKLY["Weekly Full Backup<br/>(retained 30 days)"]
        MONTHLY["Monthly Full Backup<br/>(retained 1 year)"]
        ANNUAL["Annual Snapshot<br/>(retained 7 years — compliance requirement)"]
    end

    subgraph RESTORE["Restore Procedures"]
        RTO["RTO Target: < 15 minutes<br/>(automated restore from latest backup)"]
        PITR["PITR: Restore to any point<br/>within the last 30 days"]
        TEST["Monthly Restore Test:<br/>Restore to staging environment<br/>Validate data integrity<br/>Document restore time"]
    end

    subgraph ENCRYPTION_B["Backup Encryption"]
        ENC["All backups encrypted with AES-256<br/>(separate KMS key from production data key)<br/>Backup decryption key stored in HSM"]
    end

    PG_PRIMARY --> CONTINUOUS
    PG_PRIMARY --> DAILY
    DAILY --> WEEKLY
    WEEKLY --> MONTHLY
    MONTHLY --> ANNUAL
    CONTINUOUS --> PITR
    DAILY --> RTO
```

---

### 15.2 File Storage (S3) Backup

```mermaid
graph LR
    subgraph S3_BACKUP["S3 Evidence Artifact Backup"]
        VERSIONING["S3 Versioning<br/>(all versions retained — cannot be deleted<br/>via MFA-delete protection)"]
        CROSS_REGION["Cross-Region Replication<br/>(US → EU backup, EU → US backup)<br/>Disaster recovery — not data residency violation<br/>(encrypted with tenant key — unreadable without key)"]
        LIFECYCLE["S3 Lifecycle Policies:<br/>0–365 days: S3 Standard<br/>365–730 days: S3 Standard-IA<br/>730 days–7 years: S3 Glacier<br/>After 7 years: Delete (configurable per tenant)"]
        LOCK["S3 Object Lock (WORM)<br/>(Enterprise tier — evidence cannot be modified<br/>after upload — satisfies regulatory immutability)"]
    end
```

---

### 15.3 Disaster Recovery Plan

```
Recovery Scenarios and Procedures:

SCENARIO 1: Single service failure
  Detection: Health check failure → Railway auto-restart
  RTO: < 2 minutes (automatic)
  Procedure: Railway restarts container automatically
  
SCENARIO 2: Database primary failure
  Detection: Connection failure → Datadog alert
  RTO: < 15 minutes
  Procedure: Promote read replica to primary (Railway managed PostgreSQL handles this)
              Update connection strings in environment variables
              Verify application connectivity
              
SCENARIO 3: Full region failure (unlikely on Railway)
  Detection: All health checks failing for > 5 minutes
  RTO: < 2 hours
  Procedure: Provision new Railway project in secondary region
              Restore from latest cross-region S3 backup
              Update DNS (TTL 60 seconds — set low in advance)
              Notify customers per status page
              
SCENARIO 4: Data corruption (accidental bulk delete)
  Detection: Anomalous audit log patterns → alert
  RPO: < 1 minute (WAL archiving)
  Procedure: PITR restore to pre-corruption timestamp
              Validate restored data
              Replay any post-corruption valid events from audit log
              
SCENARIO 5: Security breach
  Procedure: Immediately revoke all active sessions (Redis FLUSHDB scoped)
              Rotate all secrets and API keys
              Enable read-only mode for all tenants pending investigation
              Notify affected tenants within 72 hours (GDPR/NDPR requirement)
              Engage third-party IR firm
              ComplianceCore uses its own Incident Manager module to track this
```

---

## 16. RAILWAY DEPLOYMENT ARCHITECTURE

### 16.1 Railway Project Structure

```mermaid
graph TB
    subgraph RAILWAY_PROJECT["Railway Project: compliancecore-production"]
        direction TB

        subgraph SERVICES_RAIL["Services"]
            FRONTEND_SVC["frontend<br/>(React SPA — Vite build served via nginx)"]
            CORE_API_SVC["core-api<br/>(Fastify — Node.js 22)"]
            AUTH_SVC_RAIL["auth-service<br/>(Fastify — Node.js 22)"]
            INT_ENGINE_RAIL["integration-engine<br/>(Fastify + BullMQ workers)"]
            AI_SVC_RAIL["ai-service<br/>(FastAPI — Python 3.12)"]
            REPORT_SVC_RAIL["report-service<br/>(Fastify + Puppeteer)"]
            NOTIFY_SVC_RAIL["notification-service<br/>(Fastify + BullMQ)"]
        end

        subgraph MANAGED_INFRA["Managed Infrastructure (Railway Add-ons)"]
            PG_RAIL[("PostgreSQL<br/>(Railway Managed — daily backups included)")]
            REDIS_RAIL[("Redis<br/>(Railway Managed — persistence enabled)")]
        end

        subgraph VOLUMES_RAIL["Persistent Volumes"]
            LOG_VOL["logs/<br/>(audit log buffer — flushed to S3 hourly)"]
            REPORT_VOL["reports/<br/>(temporary PDF generation)"]
        end

        subgraph ENV_RAIL["Environment Variables (Railway Secrets)"]
            SECRETS_RAIL["DATABASE_URL<br/>REDIS_URL<br/>JWT_PRIVATE_KEY<br/>JWT_PUBLIC_KEY<br/>ANTHROPIC_API_KEY<br/>RESEND_API_KEY<br/>S3_ACCESS_KEY + S3_SECRET<br/>ENCRYPTION_KEY_ID<br/>...all secrets injected at runtime"]
        end
    end

    SERVICES_RAIL --> MANAGED_INFRA
    SERVICES_RAIL --> VOLUMES_RAIL
    ENV_RAIL --> SERVICES_RAIL
```

---

### 16.2 Railway Service Configuration

```yaml
# railway.toml (project root)
[build]
  builder = "dockerfile"

# Per-service configuration (in each service directory):

# core-api/railway.toml
[deploy]
  startCommand = "node dist/server.js"
  healthcheckPath = "/health"
  healthcheckTimeout = 10
  restartPolicyType = "on_failure"
  restartPolicyMaxRetries = 5

[deploy.resources]
  memory = "1GB"    # Starter: 512MB, Production: 2-4GB
  cpu = "1"         # Starter: 0.5, Production: 2

# integration-engine/railway.toml
[deploy]
  startCommand = "node dist/worker.js"
  healthcheckPath = "/health"
  restartPolicyType = "always"   # Workers must always be running

[deploy.resources]
  memory = "2GB"    # Evidence collection can be memory-intensive
  cpu = "2"

# ai-service/railway.toml
[deploy]
  startCommand = "uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2"
  healthcheckPath = "/health"

[deploy.resources]
  memory = "2GB"    # Python + model inference
  cpu = "2"
```

---

### 16.3 Railway Networking Architecture

```mermaid
graph TB
    subgraph RAILWAY_NETWORK["Railway Private Network"]
        subgraph PUBLIC_SERVICES["Public (External URL)"]
            FRONTEND_PUBLIC["frontend → app.compliancecore.io"]
            CORE_API_PUBLIC["core-api → api.compliancecore.io"]
        end

        subgraph PRIVATE_SERVICES["Private (Internal Railway Network Only)"]
            AUTH_PRIVATE["auth-service → auth.railway.internal:3001"]
            INT_PRIVATE["integration-engine → integration.railway.internal:3003"]
            AI_PRIVATE["ai-service → ai.railway.internal:8000"]
            REPORT_PRIVATE["report-service → report.railway.internal:3004"]
            NOTIFY_PRIVATE["notify-service → notify.railway.internal:3005"]
        end

        subgraph DATA_PRIVATE["Data (Private — Never External)"]
            PG_PRIVATE["postgresql → postgres.railway.internal:5432"]
            REDIS_PRIVATE["redis → redis.railway.internal:6379"]
        end
    end

    FRONTEND_PUBLIC -->|"HTTPS API calls"| CORE_API_PUBLIC
    CORE_API_PUBLIC -->|"Internal HTTP"| AUTH_PRIVATE
    CORE_API_PUBLIC -->|"Internal HTTP"| AI_PRIVATE
    CORE_API_PUBLIC -->|"Internal HTTP"| REPORT_PRIVATE
    CORE_API_PUBLIC -->|"Internal HTTP"| NOTIFY_PRIVATE
    AUTH_PRIVATE --> PG_PRIVATE
    CORE_API_PUBLIC --> PG_PRIVATE
    CORE_API_PUBLIC --> REDIS_PRIVATE
```

**Decision: Minimize public endpoints.** Only the frontend and core API have external URLs. All internal services communicate over Railway's private network, which is not accessible from the internet. This dramatically reduces the attack surface — an attacker cannot directly reach the AI service, notification service, or database.

---

### 16.4 Railway CI/CD Pipeline

```mermaid
graph LR
    subgraph PIPELINE["GitHub Actions → Railway Deploy"]
        PR["Pull Request"]
        CHECKS["CI Checks<br/>(lint, typecheck, unit tests, SAST)"]
        PREVIEW["Railway Preview Environment<br/>(auto-created per PR)"]
        REVIEW["Code Review + QA"]
        MERGE["Merge to main"]
        STAGING_DEPLOY["Auto-deploy to Staging<br/>(Railway staging project)"]
        INT_TESTS["Integration Tests<br/>(run against staging)"]
        APPROVAL["Manual Approval<br/>(Prod deploy requires 1 engineer approval)"]
        PROD_DEPLOY["Deploy to Production<br/>(Railway rolling deployment — zero downtime)"]
        SMOKE["Smoke Tests<br/>(automated health checks post-deploy)"]
        ROLLBACK["Auto-rollback on health check failure<br/>(Railway previous image)"]
    end

    PR --> CHECKS
    CHECKS --> PREVIEW
    PREVIEW --> REVIEW
    REVIEW --> MERGE
    MERGE --> STAGING_DEPLOY
    STAGING_DEPLOY --> INT_TESTS
    INT_TESTS --> APPROVAL
    APPROVAL --> PROD_DEPLOY
    PROD_DEPLOY --> SMOKE
    SMOKE -->|"Failure"| ROLLBACK
    SMOKE -->|"Success"| DONE["Deploy complete"]
```

---

## 17. DOCKER ARCHITECTURE

### 17.1 Container Strategy

```mermaid
graph TB
    subgraph IMAGES["Docker Image Strategy"]
        BASE["Base Image Strategy:<br/>Node.js services: node:22-alpine (minimal attack surface)<br/>Python AI service: python:3.12-slim<br/>Frontend: nginx:1.27-alpine (serve static files)<br/>Report service: node:22 (full — Puppeteer needs Chromium)"]

        MULTI_STAGE["Multi-Stage Builds (mandatory):<br/>Stage 1: builder (installs all deps, compiles TypeScript)<br/>Stage 2: production (copies only dist/ + node_modules --omit=dev)<br/>Result: production image is 60-80% smaller, no dev tools or source code"]

        NONROOT["Non-Root User (mandatory):<br/>All containers run as uid=1001 (non-root)<br/>Read-only filesystem except explicitly writable volumes<br/>No --privileged flag ever"]
    end
```

---

### 17.2 Dockerfile — Core API (Reference)

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (layer cache optimization)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy database migrations
COPY --from=builder /app/src/db/migrations ./migrations

# Security: non-root ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O- http://localhost:3002/health || exit 1

EXPOSE 3002

CMD ["node", "dist/server.js"]
```

---

### 17.3 Docker Compose — Local Development

```yaml
# docker-compose.yml (development only)
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: compliancecore
      POSTGRES_PASSWORD: localdevonly
      POSTGRES_DB: compliancecore
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U compliancecore"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7.2-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  core-api:
    build:
      context: ./services/core-api
      target: builder            # Dev uses builder stage (hot reload)
    command: npm run dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://compliancecore:localdevonly@postgres:5432/compliancecore
      REDIS_URL: redis://redis:6379
      JWT_SECRET: local-dev-secret-not-for-production
      PORT: 3002
    ports:
      - "3002:3002"
    volumes:
      - ./services/core-api/src:/app/src  # Mount source for hot reload
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  auth-service:
    build:
      context: ./services/auth-service
      target: builder
    command: npm run dev
    environment:
      DATABASE_URL: postgresql://compliancecore:localdevonly@postgres:5432/compliancecore
      REDIS_URL: redis://redis:6379
      JWT_SECRET: local-dev-secret-not-for-production
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy

  ai-service:
    build:
      context: ./services/ai-service
    environment:
      DATABASE_URL: postgresql://compliancecore:localdevonly@postgres:5432/compliancecore
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}  # From .env.local — never hardcoded
      PORT: 8000
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./apps/web
      target: builder
    command: npm run dev -- --host
    environment:
      VITE_API_URL: http://localhost:3002
      VITE_AUTH_URL: http://localhost:3001
    ports:
      - "5173:5173"
    volumes:
      - ./apps/web/src:/app/src

volumes:
  postgres_data:
  redis_data:
```

---

### 17.4 Container Health Check Architecture

```mermaid
graph TB
    subgraph HEALTH["Health Check Endpoints"]
        LIVENESS["/health/live<br/>(is the process running?)<br/>Returns 200 immediately<br/>Used by Docker HEALTHCHECK"]
        READINESS["/health/ready<br/>(can it serve traffic?)<br/>Checks: DB connection, Redis connection<br/>Returns 503 if any dependency is down<br/>Used by Railway load balancer"]
        STARTUP["/health/startup<br/>(has it finished initializing?)<br/>Checks: migrations applied, caches warmed<br/>Used during container startup phase)"]
    end

    subgraph RESPONSE["Health Response Schema"]
        SCHEMA["{
  status: 'ok' | 'degraded' | 'unhealthy',
  version: '1.2.3',
  uptime_seconds: 3600,
  checks: {
    database: { status: 'ok', latency_ms: 2 },
    redis: { status: 'ok', latency_ms: 1 },
    disk: { status: 'ok', free_bytes: 10737418240 }
  }
}"]
    end

    LIVENESS --> RESPONSE
    READINESS --> RESPONSE
    STARTUP --> RESPONSE
```

---

### 17.5 Image Registry and Versioning

```
Image Registry: GitHub Container Registry (ghcr.io/orionsoft/compliancecore)

Image Tagging Strategy:
  ghcr.io/orionsoft/compliancecore/core-api:latest         ← Production (main branch)
  ghcr.io/orionsoft/compliancecore/core-api:v1.2.3         ← Semantic version tag
  ghcr.io/orionsoft/compliancecore/core-api:sha-a3f9c2b    ← Git commit SHA (precise)
  ghcr.io/orionsoft/compliancecore/core-api:pr-145         ← Preview environment

Railway always deploys by SHA — never by 'latest' tag in production.
This guarantees an exact, auditable record of what code is running.

Image Scanning:
  Trivy scans every image in CI before push to registry.
  Critical vulnerabilities block the build.
  High vulnerabilities create a ticket — must be resolved within 7 days.
```

---

## 18. ARCHITECTURAL DECISION RECORDS

### ADR-001: PostgreSQL as Primary Database

**Status:** Accepted  
**Decision:** Use PostgreSQL as the sole primary database for all structured data.  
**Rationale:** Compliance data is inherently relational (controls link to evidence, evidence links to frameworks, frameworks link to controls). ACID guarantees are non-negotiable for a compliance platform — a control status update and its audit log entry must be atomic. PostgreSQL's row-level security, schema isolation, JSONB support for flexible metadata, and pgvector extension for AI embeddings make it the only technology that satisfies all requirements with a single system.  
**Rejected alternatives:** MongoDB (no ACID across collections in older versions; no schema isolation for multi-tenancy), MySQL (weaker RLS support), CockroachDB (distributed — adds operational complexity not yet needed).

---

### ADR-002: Schema-Per-Tenant Multi-Tenancy

**Status:** Accepted  
**Decision:** Each tenant gets a dedicated PostgreSQL schema.  
**Rationale:** Detailed above in Section 4.1. The key insight is that a compliance SaaS must be able to demonstrate data isolation to auditors. Schema separation is visually and architecturally demonstrable. RLS-only isolation is harder to explain and has historically had catastrophic failure modes.  
**Consequence:** Schema migrations must be run against every tenant schema when the schema changes. This is handled by a migration runner that iterates all tenants at deployment time (< 100ms per tenant for typical migrations — acceptable up to ~5,000 tenants).

---

### ADR-003: Fastify over Express

**Status:** Accepted  
**Decision:** Use Fastify for all Node.js backend services.  
**Rationale:** Fastify is 2–3x faster than Express in benchmarks. Its JSON schema validation (via Ajv) rejects malformed requests before they reach handler code, which is both a performance and security win. The plugin architecture is superior to Express middleware. TypeScript support is first-class. Express is aging — its ecosystem is large but the core is unmaintained.  
**Rejected alternatives:** Express (slower, no built-in validation), Hono (newer, less ecosystem maturity), NestJS (too much abstraction and magic for a team that values explicitness).

---

### ADR-004: BullMQ over Direct Database Polling

**Status:** Accepted  
**Decision:** Use BullMQ (Redis-backed) for all background job processing.  
**Rationale:** Background jobs in ComplianceCore (evidence collection, report generation, email sending) are fan-out, long-running, and must be retried on failure. Database polling introduces unnecessary DB load and latency. BullMQ provides job priorities (send urgent breach notifications before weekly digest emails), rate limiting per queue (avoid hammering external APIs), dead letter queues for failed jobs, and a UI (Bull Board) for operational visibility.  
**Rejected alternatives:** PostgreSQL SKIP LOCKED (viable but more complex to implement priorities and retries), AWS SQS (cloud-specific lock-in, adds latency for Railway deployment).

---

### ADR-005: Server-Sent Events over WebSockets for Real-Time Notifications

**Status:** Accepted  
**Decision:** Use SSE for real-time in-app notifications, not WebSockets.  
**Rationale:** ComplianceCore's real-time requirements are unidirectional (server pushes to client) with low frequency (a few events per hour, not per second). WebSockets are bidirectional and require stateful connection management on the server. SSE works over standard HTTP/2, benefits from multiplexing, reconnects automatically, and requires no special infrastructure. The added complexity of WebSockets is not justified.  
**Rejected alternatives:** WebSockets (overkill for this use case), polling (wastes resources), long-polling (better than polling but SSE is cleaner).

---

### ADR-006: Anthropic Claude as Primary LLM

**Status:** Accepted  
**Decision:** Use Anthropic Claude API (claude-sonnet-4-6 default) as the primary LLM for all AI capabilities.  
**Rationale:** Claude demonstrates superior instruction-following and structured JSON output quality compared to alternatives — critical for gap analysis where we need deterministic, parseable JSON responses, not natural language. Claude's context window (200K tokens) allows including entire compliance framework control sets in a single prompt. Anthropic offers a data processing agreement that meets GDPR Article 28 requirements. Anthropic prompt caching reduces cost for large system prompts that are repeated across requests.  
**Consequence:** Vendor dependency on Anthropic. Mitigated by: abstraction layer in the AI service that allows swapping LLM providers, and failover to a secondary provider (to be determined) in case of outage.

---

### ADR-007: Pre-Signed URLs for File Operations

**Status:** Accepted  
**Decision:** All file uploads and downloads use pre-signed S3 URLs. Files never pass through the API server.  
**Rationale:** Routing large evidence files (PDFs, logs, screenshots — up to 500MB) through the API server would create memory pressure, bandwidth costs, and timeout risks. Pre-signed URLs offload this work to S3 entirely. The API only handles metadata. This also enables the client to show accurate upload progress (using the fetch/XHR upload progress event against S3 directly).  
**Security consideration:** Pre-signed URLs expire in 15 minutes (upload) and 10 minutes (download), significantly limiting the window of unauthorized access if a URL is intercepted.

---

### ADR-008: Modular Monolith First, Microservices Later

**Status:** Accepted  
**Decision:** Start with a modular monolith for the Core API; operate Integration Engine, AI Service, and Notification Service as separate processes from day one due to their distinct scaling requirements.  
**Rationale:** The startup team cannot afford the operational overhead of a full microservices architecture. Network latency, distributed tracing, service discovery, and failure cascades all add complexity that slows down a small team. A modular monolith with clear module boundaries gives 80% of the microservices benefits (team autonomy, clear domain boundaries) at 20% of the operational cost. The Integration Engine is already separate because evidence collection is CPU-intensive and bursty; the AI Service is separate because it requires Python; the Notification Service is separate because it has an independent outbox queue pattern.

---

*Document Version: 1.0*  
*Author: Principal Architect, ORION SOFT LIMITED*  
*Classification: CONFIDENTIAL — Internal Architecture Review*  
*Last Updated: June 15, 2026*  
*Next Review: September 15, 2026*

---

*© 2026 ORION SOFT LIMITED. All rights reserved.*
