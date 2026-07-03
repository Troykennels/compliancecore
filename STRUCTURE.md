# ComplianceCore — Complete Folder Structure
### ORION SOFT LIMITED | Engineering Reference | Version 1.0 | June 2026

This document defines the canonical folder structure for ComplianceCore and explains why
every directory and file exists. Every decision is deliberate and tied to the architecture,
database design, and UI/UX specification already produced.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript
- ORM: Prisma
- Database: PostgreSQL 16 (schema-per-tenant multi-tenancy)
- Cache / Queues: Redis + BullMQ
- Auth: JWT RS256 + SAML 2.0 + OIDC
- Real-time: Server-Sent Events (SSE)
- Storage: AWS S3 (presigned URLs)
- AI: Python FastAPI service (separate process, called via HTTP)

---

## TABLE OF CONTENTS

1.  [Root — Monorepo](#1-root--monorepo)
2.  [Frontend — `/frontend`](#2-frontend--frontend)
    - 2.1  [Root config files](#21-root-config-files)
    - 2.2  [`public/`](#22-public)
    - 2.3  [`src/`](#23-src)
    - 2.4  [`src/assets/`](#24-srcassets)
    - 2.5  [`src/styles/`](#25-srcstyles)
    - 2.6  [`src/config/`](#26-srcconfig)
    - 2.7  [`src/lib/`](#27-srclib)
    - 2.8  [`src/types/`](#28-srctypes)
    - 2.9  [`src/hooks/`](#29-srchooks)
    - 2.10 [`src/stores/`](#210-srcstores)
    - 2.11 [`src/routes/`](#211-srcroutes)
    - 2.12 [`src/components/`](#212-srccomponents)
    - 2.13 [`src/features/`](#213-srcfeatures)
3.  [Backend — `/backend`](#3-backend--backend)
    - 3.1  [Root config files](#31-root-config-files)
    - 3.2  [`src/`](#32-src)
    - 3.3  [`src/config/`](#33-srcconfig)
    - 3.4  [`src/middleware/`](#34-srcmiddleware)
    - 3.5  [`src/modules/`](#35-srcmodules)
    - 3.6  [`src/lib/`](#36-srclib)
    - 3.7  [`src/jobs/`](#37-srcjobs)
    - 3.8  [`src/integrations/`](#38-srcintegrations)
    - 3.9  [`src/ai/`](#39-srcai)
    - 3.10 [`src/types/`](#310-srctypes)
    - 3.11 [`prisma/`](#311-prisma)
4.  [Database — `/database`](#4-database--database)
5.  [Docker — `/docker`](#5-docker--docker)
6.  [CI/CD — `/.github`](#6-cicd--github)

---

## 1. ROOT — Monorepo

```
ComplianceCore/
│
├── frontend/               # React + Vite SPA
├── backend/                # Express REST API
├── database/               # PostgreSQL schema, migrations, seeds (already exists)
├── docker/                 # Dockerfiles and compose configs
│
├── .github/
│   └── workflows/
│       ├── frontend-ci.yml
│       ├── backend-ci.yml
│       └── deploy.yml
│
├── PRD.md                  # Product Requirements Document
├── ARCHITECTURE.md         # Software architecture + Mermaid diagrams
├── DATABASE.md             # Database architecture document
├── DESIGN.md               # UI/UX design specification
├── STRUCTURE.md            # This document
│
├── docker-compose.yml      # Local development: postgres, redis, frontend, backend
├── docker-compose.prod.yml # Production compose override
├── .gitignore
└── README.md
```

**Why a monorepo root?**
Frontend and backend share no runtime code, but they share TypeScript type definitions,
environment variable naming conventions, and deployment pipelines. Keeping them in one
repository means a single PR can change a backend API response shape and update the
frontend type that consumes it simultaneously, making breaking changes impossible to miss
in code review. The `database/` folder lives at root because it is consumed by neither
the frontend nor the backend exclusively — it is the source of truth for the data layer
and belongs to the project, not to either application.

---

## 2. FRONTEND — `/frontend`

```
frontend/
│
├── public/
│   ├── favicon.ico
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── manifest.json
│   ├── robots.txt
│   └── icons/
│       ├── icon-192x192.png
│       └── icon-512x512.png
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── vite-env.d.ts
│   │
│   ├── assets/
│   ├── styles/
│   ├── config/
│   ├── lib/
│   ├── types/
│   ├── hooks/
│   ├── stores/
│   ├── routes/
│   ├── components/
│   └── features/
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.ts
├── components.json
├── .env
├── .env.example
├── .env.test
└── package.json
```

---

### 2.1 Root Config Files

```
frontend/
├── index.html              # Vite entry HTML. Sets <title>, <meta charset>, loads main.tsx
├── vite.config.ts          # Build tool config: path aliases, proxy rules, plugin list
├── tsconfig.json           # TypeScript config for src/ (strict mode, path aliases)
├── tsconfig.node.json      # TypeScript config for vite.config.ts itself (node-side)
├── tailwind.config.ts      # Design token integration: custom colours, fonts, spacing
├── postcss.config.ts       # PostCSS: autoprefixer + tailwindcss plugins
├── components.json         # shadcn/ui CLI config: style, base colour, alias paths
├── .env                    # Local env vars (gitignored)
├── .env.example            # Template for env vars (committed)
└── package.json            # Dependencies and scripts
```

**`vite.config.ts`** exists separately from `tsconfig.json` because Vite's config file
runs in a Node.js context (not browser), so it needs its own `tsconfig.node.json` with
different settings. The path aliases defined here (`@/` → `src/`) must mirror exactly
what is in `tsconfig.json` so IDE and build tooling agree.

**`components.json`** is the shadcn/ui configuration file. The shadcn CLI reads it to
know where to place generated component files (`src/components/ui/`), which design
system base to use, and which CSS variable naming convention to follow.

---

### 2.2 `public/`

```
public/
├── favicon.ico             # Browser tab icon
├── favicon-32x32.png       # Retina browser tab icon
├── apple-touch-icon.png    # iOS home screen icon (180×180)
├── manifest.json           # PWA manifest: name, icons, theme colour, start_url
├── robots.txt              # Block all crawlers (authenticated app — no indexing)
└── icons/
    ├── icon-192x192.png    # PWA install icon
    └── icon-512x512.png    # PWA splash screen icon
```

Files in `public/` are copied verbatim to the build output without processing. Anything
here is accessible at the root URL path (`/manifest.json`, `/favicon.ico`). ComplianceCore
is a Progressive Web App (PWA) — the `manifest.json` enables "Add to Home Screen" on
mobile devices, which is important for compliance managers who need quick access from
their phone. The `robots.txt` blocks all search engine crawling because this is an
authenticated enterprise application with no public content worth indexing.

---

### 2.3 `src/`

```
src/
├── main.tsx        # Vite entry point. Mounts React tree into <div id="root">
└── App.tsx         # Root React component: wraps all providers, renders the router
```

**`main.tsx`** is the single entry point Vite is configured to load. It wraps the entire
app in the `StrictMode` component (catches unsafe lifecycle patterns in development) and
mounts to `#root`. Nothing else goes in this file.

**`App.tsx`** is the provider tree root. It stacks all global providers in the correct
order: `QueryClientProvider` (TanStack Query) → `ThemeProvider` (dark mode) →
`AuthProvider` (current user context) → `RouterProvider` (React Router) →
`Toaster` (toast notifications). Provider order matters: the auth provider must be
inside the query client provider because it uses queries internally.

---

### 2.4 `src/assets/`

```
src/assets/
├── fonts/
│   ├── inter-variable.woff2    # Self-hosted Inter Variable font
│   └── jetbrains-mono.woff2    # Self-hosted JetBrains Mono font
├── images/
│   ├── logo.svg                # ComplianceCore SVG logo
│   ├── logo-white.svg          # White version for dark backgrounds
│   └── empty-states/           # Illustration SVGs for empty table/list states
│       ├── no-controls.svg
│       ├── no-evidence.svg
│       ├── no-risks.svg
│       └── no-results.svg
└── icons/
    └── frameworks/             # Framework logo SVGs (SOC 2, ISO, NDPR badges)
        ├── soc2.svg
        ├── iso27001.svg
        ├── ndpr.svg
        └── gdpr.svg
```

Assets in `src/assets/` are processed by Vite: they receive content-hash filenames
(e.g., `inter-variable.abc123.woff2`) for long-term cache busting. Fonts are self-hosted
— not loaded from Google Fonts — because many enterprise customers have strict network
egress policies or CSP headers that block third-party font CDNs. Empty state illustrations
live here because they are reused across many feature modules and belong to no single
feature.

---

### 2.5 `src/styles/`

```
src/styles/
├── globals.css     # Tailwind directives (@tailwind base/components/utilities)
│                   # CSS custom properties for all design tokens (light + dark)
│                   # Base resets and prose typography styles
└── fonts.css       # @font-face declarations for self-hosted Inter and JetBrains Mono
```

**`globals.css`** is the single CSS file imported into `main.tsx`. It contains:
1. Tailwind's three directive imports
2. The entire CSS custom property token set from `DESIGN.md § 14` (colours, spacing,
   typography, shadows) under `:root` and `[data-theme="dark"]` selectors
3. Base resets that Tailwind's preflight doesn't handle (e.g., `scrollbar-gutter: stable`)

All other styling is done via Tailwind utility classes directly in component files.
No additional CSS files are created per component — this eliminates the CSS cascade
ordering problem entirely.

---

### 2.6 `src/config/`

```
src/config/
├── env.ts          # Runtime environment variable validation and typed exports
└── constants.ts    # Compile-time application constants
```

**`env.ts`** uses Zod to parse and validate `import.meta.env` at startup. If a required
variable is missing, the app throws immediately with a clear error message rather than
failing silently at runtime. All references to environment variables across the app go
through this file — never `import.meta.env.VITE_X` directly in components.

```typescript
// env.ts pattern
const schema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']),
});
export const env = schema.parse(import.meta.env);
```

**`constants.ts`** holds values that are known at compile time and never change between
environments: pagination defaults, maximum file upload sizes, token expiry display
thresholds, supported MIME types, etc.

---

### 2.7 `src/lib/`

```
src/lib/
├── api-client.ts       # Axios instance: base URL, auth headers, token refresh interceptor
├── query-client.ts     # TanStack Query client: default staleTime, retry policy, error handler
├── date.ts             # Date formatting: relative time ("3 days ago"), deadline formatting
├── format.ts           # Number formatting: percentages, scores, file sizes, currency
├── permissions.ts      # Permission check helpers using JWT claims
├── tenant.ts           # Tenant-aware utilities: schema name sanitisation (client-side mirror)
└── utils.ts            # cn() (clsx + tailwind-merge), sleep(), debounce(), etc.
```

The `lib/` folder exists for code that is:
- **Shared** across multiple feature modules
- **Not a React component** (those live in `components/`)
- **Not a global state store** (those live in `stores/`)
- **Not a React hook** (those live in `hooks/`)

**`api-client.ts`** is the single Axios instance used by every API call in the app. It
attaches the `Authorization: Bearer <token>` header automatically, intercepts 401
responses to attempt a silent token refresh using the refresh token cookie, and retries
the original request with the new access token. Every feature's API module imports this
instance — no feature ever creates its own Axios instance.

**`query-client.ts`** configures TanStack Query's global defaults: `staleTime: 30_000`
(data is fresh for 30 seconds before a background refetch), `retry: 1` (retry failed
requests once), and a global `onError` handler that pipes query errors to the toast
notification system.

---

### 2.8 `src/types/`

```
src/types/
├── api.ts          # API response envelope: { data, error, meta, pagination }
├── auth.ts         # User, Session, JWTPayload, Permission, Role types
├── common.ts       # Shared value types: UUID, ISO8601Date, PaginatedResponse<T>
└── index.ts        # Re-exports everything for clean imports
```

This folder holds TypeScript types that are shared across **multiple feature modules**
and are not tied to any single domain. Feature-specific types (e.g., `Control`,
`ControlStatus`) live inside their feature's `types/` subfolder. The separation prevents
a "God types file" that becomes a dependency of every file in the project.

**`api.ts`** defines the API response envelope that the backend wraps every response in:
```typescript
interface ApiResponse<T> {
  data: T;
  error: null | { code: string; message: string; details?: unknown };
  meta: { requestId: string; timestamp: string };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Every TanStack Query hook unwraps this envelope automatically.

---

### 2.9 `src/hooks/`

```
src/hooks/
├── use-auth.ts             # Returns current user, isLoading, isAuthenticated from auth store
├── use-permissions.ts      # usePermission('controls:write') → boolean
├── use-tenant.ts           # Returns current tenant ID, name, plan, schema name
├── use-debounce.ts         # useDebounce(value, 300) → debounced value
├── use-local-storage.ts    # Type-safe localStorage with JSON serialisation
├── use-pagination.ts       # Table pagination state: page, limit, setPage, setLimit
├── use-table-filters.ts    # URL-synchronised filter state for data tables
└── use-sse.ts              # useSSE(url) → subscribes to Server-Sent Events stream
```

The `hooks/` folder holds **global hooks** — hooks that are domain-agnostic and used
in more than one feature. Feature-specific hooks (e.g., `useControlDetail`) live inside
their feature's `hooks/` subfolder.

**`use-sse.ts`** manages the SSE connection to `GET /api/notifications/stream`. It
handles connection establishment, automatic reconnection with exponential backoff on
disconnect, and cleanup on component unmount. When an event arrives, it dispatches
to the notification Zustand store. This hook is mounted once in `App.tsx` for the
lifetime of the authenticated session.

**`use-permissions.ts`** reads the JWT claims stored in the auth Zustand store and
checks whether the current user holds a given permission string. Used throughout the
UI to conditionally render action buttons:
```typescript
const canEdit = usePermission('controls:write');
return canEdit ? <Button>Edit</Button> : null;
```

---

### 2.10 `src/stores/`

```
src/stores/
├── auth.store.ts           # accessToken, user, tenant, login(), logout(), refreshToken()
├── ui.store.ts             # sidebarCollapsed, theme, commandPaletteOpen, aiPanelOpen
└── notification.store.ts   # notifications[], unreadCount, markRead(), dismiss()
```

Zustand stores hold **client state** — state that does not come from the server and
does not need to be cached or synchronised. Server data belongs in TanStack Query.

**`auth.store.ts`** is the single source of truth for authentication state. It stores
the decoded JWT payload (user ID, email, role, tenant ID, permissions) in memory and
persists the access token to `sessionStorage` (cleared on tab close, not on page
refresh). The refresh token is stored in an httpOnly cookie, set by the server.

**`ui.store.ts`** persists user UI preferences to `localStorage` so they survive page
refreshes: sidebar collapsed state, dark/light theme preference, table sort orders.

**`notification.store.ts`** maintains the in-app notification queue. Events arriving
over SSE are pushed into this store. The top bar bell icon reads `unreadCount` from
this store. The notification panel renders the `notifications[]` array.

---

### 2.11 `src/routes/`

```
src/routes/
├── index.tsx           # Root router: splits public routes from protected routes
├── public.routes.tsx   # Routes accessible without authentication (login, register)
├── protected.routes.tsx # Routes requiring auth + optional role guards
└── paths.ts            # Typed string constants for every route path
```

**`paths.ts`** prevents typos in route navigation:
```typescript
export const PATHS = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CONTROLS: '/controls',
  CONTROL_DETAIL: (id: string) => `/controls/${id}`,
  SETTINGS_TEAM: '/settings/team',
} as const;
```
Every `<Link to={...}>` and `navigate()` call uses `PATHS` — never a raw string.

**`protected.routes.tsx`** wraps all authenticated pages in a guard component that
checks `isAuthenticated` from the auth store. If the user is not authenticated, it
redirects to `/login` with the intended destination in state so it can redirect back
after login. It also handles onboarding redirection: if `user.onboardingComplete ===
false`, it redirects to `/onboarding` from any protected route.

---

### 2.12 `src/components/`

```
src/components/
├── ui/                     # shadcn/ui base components (generated + customised)
├── layout/                 # App shell: sidebar, top bar, page header
├── data-display/           # Generic display: table, empty state, skeleton, badge
├── charts/                 # Recharts wrappers: ring, heatmap, trend, gauge
├── forms/                  # Shared form primitives: rich text, file upload, user select
└── feedback/               # UX feedback: command palette, confirm dialog, AI panel
```

The `components/` folder holds components that are **reusable across feature modules**
and contain **no business logic**. A component here should be configurable via props
and know nothing about controls, risks, vendors, or any other domain concept. The moment
a component imports from a `features/` subfolder, it belongs in that feature instead.

#### `components/ui/`

```
ui/
├── button.tsx
├── input.tsx
├── textarea.tsx
├── select.tsx
├── checkbox.tsx
├── radio-group.tsx
├── switch.tsx
├── dialog.tsx              # Modal
├── sheet.tsx               # Drawer (slides from right)
├── popover.tsx
├── dropdown-menu.tsx
├── tooltip.tsx
├── table.tsx               # Primitive table elements (thead, tbody, tr, td)
├── badge.tsx
├── card.tsx
├── avatar.tsx
├── progress.tsx            # Progress bar
├── skeleton.tsx
├── separator.tsx
├── tabs.tsx
├── toast.tsx
├── toaster.tsx             # Toast container (mounts in App.tsx)
├── form.tsx                # React Hook Form + shadcn integration primitives
├── label.tsx
├── alert.tsx
├── alert-dialog.tsx        # Destructive confirm dialogs
├── calendar.tsx
├── command.tsx             # cmdk command palette primitive
├── scroll-area.tsx
└── collapsible.tsx
```

These are the shadcn/ui generated base components. They wrap Radix UI primitives with
Tailwind styles, accepting `className` for extension via `cn()`. They contain zero
business logic and no API calls. They form the design system foundation that all higher-
level components are built from. The shadcn CLI (`npx shadcn-ui@latest add button`) adds
components here — they are checked into version control and can be customised freely.

#### `components/layout/`

```
layout/
├── app-shell.tsx           # Top-level authenticated layout: sidebar + topbar + <main>
├── sidebar.tsx             # Sidebar container: logo, nav sections, subscription card
├── sidebar-nav.tsx         # Nav item list: icons, labels, badges, active state
├── sidebar-nav-item.tsx    # Single nav item component
├── top-bar.tsx             # Fixed header: hamburger, logo, search, dark mode, bell, avatar
├── page-header.tsx         # Per-page header: title, breadcrumb, subtitle, actions slot
├── breadcrumb.tsx          # Auto-built from current route using PATHS map
└── mobile-bottom-nav.tsx   # Bottom navigation bar shown on sm/xs screens
```

**`app-shell.tsx`** is the layout wrapper applied to every authenticated page. It
renders the sidebar on the left (240px), the top bar fixed at the top (56px), and a
`<main>` content area that fills the remaining space. Feature pages are rendered inside
`<main>`. The shell subscribes to `ui.store.ts` for sidebar collapsed state and applies
the appropriate CSS class to shift the main content area.

#### `components/data-display/`

```
data-display/
├── data-table/
│   ├── data-table.tsx              # Full table: TanStack Table + pagination + toolbar
│   ├── data-table-toolbar.tsx      # Search input + filter dropdowns + export button
│   ├── data-table-pagination.tsx   # Page size selector + page navigator
│   ├── data-table-column-header.tsx # Sortable column header with direction indicator
│   ├── data-table-row-actions.tsx  # Hover-revealed row action menu (edit, delete)
│   └── data-table-skeleton.tsx     # Shimmer skeleton for table loading state
├── empty-state.tsx                 # Illustration + heading + description + CTA for empty lists
├── error-boundary.tsx              # React error boundary: catches render errors, shows fallback
├── loading-spinner.tsx             # Inline spinner for button loading states
├── page-loading.tsx                # Full-page skeleton for initial page load
├── status-badge.tsx                # Maps ControlStatus enum → coloured badge
├── severity-badge.tsx              # Maps SeverityLevel enum → coloured badge
├── score-ring.tsx                  # SVG donut ring for compliance percentages
├── progress-bar.tsx                # Labelled progress bar with semantic colour
└── framework-badge.tsx             # Small coloured chip for framework names
```

**`data-table/`** is the most complex shared component. It wraps TanStack Table
(`@tanstack/react-table`) to provide: server-side pagination, column sorting, row
selection with bulk action bar, column visibility toggles, and row action menus. Every
list page in the app (`/controls`, `/vendors`, `/risks`, etc.) uses this component,
passing column definitions and a query function. The table manages its own state
(sorting, pagination, selection) and exposes it via callbacks to the parent page.

#### `components/charts/`

```
charts/
├── compliance-ring.tsx     # SVG donut chart: score percentage with colour zones
├── trend-line-chart.tsx    # Recharts LineChart: score over time, multiple framework lines
├── risk-heat-map.tsx       # 5×5 CSS grid: cells coloured by risk score zone
├── stacked-bar-chart.tsx   # Recharts BarChart: control status breakdown per framework
├── gauge-chart.tsx         # Half-circle SVG gauge: single score with colour zones
└── area-chart.tsx          # Recharts AreaChart: evidence collection over time
```

All chart components accept only primitive data (numbers, strings, arrays) and no domain
types. They are purely presentational. Data transformation (e.g., converting raw
control status counts into chart series) happens in the feature's API layer before
the data reaches the chart.

#### `components/forms/`

```
forms/
├── form-field.tsx          # Combines RHF Controller + shadcn FormItem + label + error
├── rich-text-editor.tsx    # TipTap editor: policy body, incident descriptions
├── file-upload.tsx         # Drag-drop zone → requests presigned URL → uploads to S3
├── date-picker.tsx         # Calendar popover with manual date input
├── user-select.tsx         # Async combobox: searches users by name/email via API
├── framework-select.tsx    # Multi-select for framework checkboxes with icons
└── control-select.tsx      # Async searchable select for linking controls
```

**`file-upload.tsx`** implements the presigned URL upload flow from `ARCHITECTURE.md`:
1. User drops a file → component validates type and size client-side
2. `POST /api/evidence/upload-url` returns a presigned S3 PUT URL
3. Component uploads the file directly to S3 using the presigned URL (bypasses API)
4. `POST /api/evidence/confirm` is called with the S3 key to create the DB record
Progress is shown via a native `XMLHttpRequest` with progress event tracking.

#### `components/feedback/`

```
feedback/
├── command-palette.tsx     # ⌘K global search: controls, policies, vendors, actions
├── notification-panel.tsx  # Bell dropdown: unread notifications, mark-as-read, view all
├── confirm-dialog.tsx      # Reusable destructive action confirm modal
├── ai-assistant-panel.tsx  # Right-side drawer: chat with AI about compliance posture
└── unsaved-changes-dialog.tsx  # Prevents navigating away with unsaved form data
```

**`ai-assistant-panel.tsx`** is a globally accessible Sheet component triggered by the
"AI Assistant" sidebar link or floating button. It maintains its own chat history in
local state (cleared on close). Messages are sent to `POST /api/ai/chat` which streams
the response from the Python AI service. The panel renders the streamed response token
by token using a `ReadableStream`. A disclaimer ("AI outputs are suggestions.
Always verify.") is fixed at the bottom of the panel per `DESIGN.md`.

---

### 2.13 `src/features/`

Each feature module owns everything related to its domain: components, hooks, API calls,
types, and pages. A feature may import from `src/components/`, `src/lib/`, `src/hooks/`,
and `src/stores/`, but it **never imports from another feature**. This enforces the
boundary that enables extracting features to separate packages or micro-frontends later.

```
src/features/
├── auth/
├── onboarding/
├── dashboard/
├── frameworks/
├── controls/
├── evidence/
├── policies/
├── risks/
├── vendors/
├── audits/
├── training/
├── incidents/
├── privacy/
├── analytics/
├── integrations/
├── settings/
└── msp/
```

Every feature follows the same internal structure:

```
features/{feature}/
├── components/     # UI components specific to this feature
├── hooks/          # Hooks wrapping TanStack Query calls for this feature
├── api/            # TanStack Query hooks and Axios calls for this feature's endpoints
├── pages/          # Route-level page components (imported into routes/)
└── types/          # TypeScript interfaces and enums for this domain
```

Detailed breakdown of each feature:

#### `features/auth/`
```
auth/
├── components/
│   ├── login-form.tsx          # Email + password form with RHF validation
│   ├── mfa-challenge.tsx       # 6-digit OTP input grid
│   ├── sso-button.tsx          # "Continue with SSO" trigger → SSO redirect
│   ├── reset-password-form.tsx
│   └── password-strength.tsx   # Visual password strength indicator
├── hooks/
│   └── use-login.ts            # Calls auth API, stores tokens, redirects
├── api/
│   └── auth.api.ts             # login(), logout(), refreshToken(), forgotPassword()
├── pages/
│   ├── login.page.tsx
│   ├── register.page.tsx
│   ├── forgot-password.page.tsx
│   ├── reset-password.page.tsx
│   ├── mfa.page.tsx
│   └── email-verification.page.tsx
└── types/
    └── auth.types.ts           # LoginRequest, LoginResponse, MFAChallenge, etc.
```

#### `features/onboarding/`
```
onboarding/
├── components/
│   ├── onboarding-wizard.tsx       # Stepper shell with step indicator
│   ├── step-org-profile.tsx        # Step 1: org name, industry, country
│   ├── step-framework-selection.tsx # Step 2: framework cards with AI recommendation
│   ├── step-invite-team.tsx        # Step 3: invite by email with role select
│   ├── step-integrations.tsx       # Step 4: connect AWS/Okta/GitHub (optional)
│   └── step-launch.tsx             # Step 5: roadmap summary, go to dashboard
├── hooks/
│   └── use-onboarding-state.ts     # Manages wizard step, form state across steps
├── api/
│   └── onboarding.api.ts
├── pages/
│   └── onboarding.page.tsx
└── types/
    └── onboarding.types.ts
```

#### `features/dashboard/`
```
dashboard/
├── components/
│   ├── metric-card.tsx             # KPI card: icon + number + trend
│   ├── compliance-score-card.tsx   # Per-framework score ring + progress bar
│   ├── priority-actions-list.tsx   # Urgent items needing attention
│   ├── compliance-trend-widget.tsx # Multi-framework line chart (last 6 months)
│   └── framework-posture-grid.tsx  # Grid of compliance-score-cards
├── hooks/
│   └── use-dashboard-data.ts       # Parallel TanStack Query calls for all dashboard widgets
├── api/
│   └── dashboard.api.ts            # GET /api/dashboard/summary
├── pages/
│   └── dashboard.page.tsx
└── types/
    └── dashboard.types.ts          # DashboardSummary, MetricCard, FrameworkPosture
```

#### `features/controls/`
```
controls/
├── components/
│   ├── control-table.tsx           # data-table instance with control column definitions
│   ├── control-table-columns.tsx   # TanStack Table column defs: status, name, owner, due
│   ├── control-status-filter.tsx   # Multi-select filter for control status
│   ├── control-detail-overview.tsx # Overview tab: description, owners, frameworks
│   ├── control-evidence-tab.tsx    # Evidence tab: list linked evidence, upload, unlink
│   ├── control-tests-tab.tsx       # Tests tab: manual and automated test results
│   ├── control-history-tab.tsx     # History tab: audit trail of changes
│   ├── control-form.tsx            # Create / edit control form
│   └── bulk-assign-owner.tsx       # Bulk action: assign owner to selected controls
├── hooks/
│   ├── use-controls.ts             # useQuery for paginated control list
│   ├── use-control.ts              # useQuery for single control by ID
│   ├── use-update-control.ts       # useMutation for status + owner changes
│   └── use-bulk-actions.ts         # useMutation for bulk operations
├── api/
│   └── controls.api.ts             # GET /api/controls, GET /api/controls/:id, PATCH, POST
├── pages/
│   ├── controls-list.page.tsx
│   └── control-detail.page.tsx
└── types/
    └── controls.types.ts           # Control, ControlStatus, ControlOwner, ControlFilter
```

#### `features/evidence/`
```
evidence/
├── components/
│   ├── evidence-table.tsx
│   ├── evidence-table-columns.tsx
│   ├── evidence-card.tsx           # Card view alternative to table row
│   ├── evidence-upload-modal.tsx   # Modal: upload + title + control links + expiry
│   ├── evidence-detail-sheet.tsx   # Right drawer: full evidence metadata + preview
│   ├── expiring-evidence-banner.tsx # Alert banner for evidence expiring soon
│   └── integration-sync-status.tsx # Per-integration last sync time + health
├── hooks/
│   ├── use-evidence.ts
│   ├── use-upload-evidence.ts      # Orchestrates presigned URL upload flow
│   └── use-expiring-evidence.ts
├── api/
│   └── evidence.api.ts
├── pages/
│   └── evidence-hub.page.tsx
└── types/
    └── evidence.types.ts           # Evidence, EvidenceSource, EvidenceStatus
```

#### `features/policies/`
```
policies/
├── components/
│   ├── policy-table.tsx
│   ├── policy-editor.tsx           # TipTap rich text editor + metadata sidebar
│   ├── policy-metadata-panel.tsx   # Right panel: owner, type, framework links, workflow
│   ├── approval-workflow.tsx       # Stage-by-stage approval status display
│   ├── acknowledgment-tracker.tsx  # Progress bar: X/Y acknowledged
│   ├── policy-version-history.tsx  # Table of past versions with diff link
│   └── policy-acknowledge-page-layout.tsx # Tokenised acknowledgment page (no auth)
├── hooks/
│   ├── use-policies.ts
│   ├── use-policy-editor.ts        # Manages editor state + auto-save + dirty tracking
│   └── use-acknowledgments.ts
├── api/
│   └── policies.api.ts
├── pages/
│   ├── policies-list.page.tsx
│   ├── policy-editor.page.tsx
│   ├── policy-version-history.page.tsx
│   └── policy-acknowledge.page.tsx # Public-ish page: accessed via signed token
└── types/
    └── policies.types.ts
```

#### `features/risks/`
```
risks/
├── components/
│   ├── risk-heat-map-view.tsx      # 5×5 grid view using charts/risk-heat-map
│   ├── risk-table.tsx              # List view with sortable risk score column
│   ├── risk-form.tsx               # Create/edit: title, category, likelihood, impact
│   ├── risk-score-calculator.tsx   # Live score preview as L × I sliders move
│   ├── risk-treatment-panel.tsx    # Treatment plan: type, actions, owners, dates
│   └── risk-detail-sheet.tsx       # Right drawer: full risk detail
├── hooks/
│   ├── use-risks.ts
│   └── use-risk-matrix.ts          # Transforms risk list into 5×5 matrix data
├── api/
│   └── risks.api.ts
├── pages/
│   ├── risk-register.page.tsx
│   └── risk-detail.page.tsx
└── types/
    └── risks.types.ts              # Risk, RiskCategory, RiskTreatmentType, RiskMatrix
```

#### `features/vendors/`
```
vendors/
├── components/
│   ├── vendor-table.tsx
│   ├── vendor-detail-overview.tsx
│   ├── vendor-assessment-form.tsx  # Assessment questionnaire form
│   ├── vendor-risk-gauge.tsx       # Half-circle gauge for vendor risk score
│   ├── vendor-document-list.tsx    # DPA, contracts, certs with expiry dates
│   └── vendor-assessment-history.tsx
├── hooks/
│   ├── use-vendors.ts
│   └── use-vendor-assessment.ts
├── api/
│   └── vendors.api.ts
├── pages/
│   ├── vendors-list.page.tsx
│   ├── vendor-detail.page.tsx
│   └── vendor-assessment.page.tsx
└── types/
    └── vendors.types.ts
```

#### `features/audits/`
```
audits/
├── components/
│   ├── audit-table.tsx
│   ├── audit-timeline.tsx          # 5-stage visual timeline: Planning → Closure
│   ├── evidence-request-table.tsx  # Requests raised by auditor, with status
│   ├── findings-table.tsx          # Audit findings: type, control, status
│   ├── invite-auditor-modal.tsx    # Email + scope + expiry date form
│   ├── finding-form.tsx            # Raise / respond to a finding
│   └── auditor-portal-layout.tsx   # Scoped layout for external auditor view
├── hooks/
│   ├── use-audits.ts
│   └── use-audit-findings.ts
├── api/
│   └── audits.api.ts
├── pages/
│   ├── audits-list.page.tsx
│   ├── audit-detail.page.tsx
│   ├── audit-findings.page.tsx
│   └── auditor-portal.page.tsx     # Rendered for external auditor via scoped token
└── types/
    └── audits.types.ts
```

#### `features/training/`
```
training/
├── components/
│   ├── course-table.tsx
│   ├── course-detail.tsx           # Video embed / PDF viewer / quiz
│   ├── completion-chart.tsx        # Bar chart by department
│   ├── assignment-modal.tsx        # Assign course to users/departments
│   └── training-reminder-modal.tsx # Send reminder to incomplete users
├── hooks/
│   ├── use-courses.ts
│   └── use-completions.ts
├── api/
│   └── training.api.ts
├── pages/
│   ├── training-list.page.tsx
│   └── course-detail.page.tsx
└── types/
    └── training.types.ts
```

#### `features/incidents/`
```
incidents/
├── components/
│   ├── incident-table.tsx
│   ├── incident-form.tsx           # Report new incident: type, severity, description
│   ├── breach-notification-timer.tsx # Countdown to regulatory deadline (72h GDPR)
│   ├── response-checklist.tsx      # Step-by-step response checklist with owners
│   ├── affected-data-subjects.tsx  # Count + categories + jurisdictions affected
│   └── regulatory-notification-form.tsx # Draft notification to ICO / NDPC / etc.
├── hooks/
│   ├── use-incidents.ts
│   └── use-breach-deadlines.ts     # Computes regulatory deadlines from discovery time
├── api/
│   └── incidents.api.ts
├── pages/
│   ├── incidents-list.page.tsx
│   └── incident-detail.page.tsx
└── types/
    └── incidents.types.ts
```

#### `features/privacy/`
```
privacy/
├── components/
│   ├── ropa-table.tsx              # ROPA register list
│   ├── ropa-form.tsx               # Create/edit processing activity
│   ├── dsar-table.tsx              # DSAR queue with deadline countdown
│   ├── dsar-detail.tsx             # DSAR detail: type, requester, response workflow
│   ├── dsar-response-form.tsx      # Upload response data, close request
│   ├── dpia-table.tsx
│   ├── dpia-form.tsx               # DPIA: risk assessment, mitigation, DPO sign-off
│   └── data-subject-rights-tracker.tsx # Visual tracker for DSAR workflow stages
├── hooks/
│   ├── use-ropa.ts
│   ├── use-dsars.ts
│   └── use-dsar-deadlines.ts       # Computes GDPR 30/90 day response deadlines
├── api/
│   └── privacy.api.ts
├── pages/
│   ├── ropa.page.tsx
│   ├── dsar-queue.page.tsx
│   ├── dsar-detail.page.tsx
│   └── dpia-list.page.tsx
└── types/
    └── privacy.types.ts
```

#### `features/analytics/`
```
analytics/
├── components/
│   ├── report-template-grid.tsx    # Grid of available report template cards
│   ├── report-builder.tsx          # Custom report builder (framework, date range, sections)
│   ├── scheduled-reports-table.tsx # Scheduled report jobs with next run time
│   └── report-preview.tsx          # In-app preview of generated report (iframe)
├── hooks/
│   ├── use-reports.ts
│   └── use-generate-report.ts      # Mutation: triggers report generation job
├── api/
│   └── analytics.api.ts
├── pages/
│   ├── analytics-overview.page.tsx
│   ├── report-builder.page.tsx
│   └── report-archive.page.tsx
└── types/
    └── analytics.types.ts
```

#### `features/integrations/`
```
integrations/
├── components/
│   ├── integration-grid.tsx        # Grid of connected + available integrations
│   ├── integration-card.tsx        # Single integration: status, last sync, configure
│   ├── integration-config-modal.tsx # Configure credentials / scopes per integration
│   ├── sync-history-table.tsx      # Log of sync runs with result and item count
│   └── integration-error-detail.tsx # Detailed error message when sync fails
├── hooks/
│   ├── use-integrations.ts
│   └── use-trigger-sync.ts         # Mutation: manually trigger a sync job
├── api/
│   └── integrations.api.ts
├── pages/
│   ├── integrations.page.tsx
│   └── integration-config.page.tsx
└── types/
    └── integrations.types.ts
```

#### `features/settings/`
```
settings/
├── components/
│   ├── settings-layout.tsx         # Left nav + content area split layout
│   ├── settings-left-nav.tsx       # Jump-nav to all settings sections
│   ├── org-profile-form.tsx        # Name, industry, logo, data residency
│   ├── team-table.tsx              # Member list with role badges
│   ├── invite-member-modal.tsx     # Email + role selection
│   ├── role-permissions-matrix.tsx # Read-only: what each role can do
│   ├── sso-config-form.tsx         # SAML 2.0 / OIDC setup: metadata URL, cert
│   ├── scim-config-panel.tsx       # SCIM token + endpoint URL display
│   ├── mfa-settings.tsx            # TOTP setup, backup codes download
│   ├── api-keys-table.tsx          # API key list: create, copy, revoke
│   ├── webhook-form.tsx            # Webhook URL + event selection
│   ├── billing-plan-card.tsx       # Current plan + usage + upgrade button
│   └── notification-rules.tsx      # Configure which events trigger notifications
├── hooks/
│   ├── use-org-settings.ts
│   └── use-team-members.ts
├── api/
│   └── settings.api.ts
├── pages/
│   ├── settings.page.tsx           # Redirects to /settings/organization by default
│   ├── settings-org.page.tsx
│   ├── settings-team.page.tsx
│   ├── settings-security.page.tsx
│   ├── settings-sso.page.tsx
│   ├── settings-api-keys.page.tsx
│   ├── settings-billing.page.tsx
│   └── settings-notifications.page.tsx
└── types/
    └── settings.types.ts
```

#### `features/msp/`
```
msp/
├── components/
│   ├── portfolio-overview-table.tsx    # All client orgs with aggregate scores
│   ├── client-health-summary.tsx       # Alert / healthy / at-risk breakdown
│   ├── client-switcher.tsx             # Top-bar dropdown to switch active client
│   ├── portfolio-action-items.tsx      # Cross-client items needing MSP attention
│   └── msp-settings-form.tsx           # MSP-specific settings: branding, defaults
├── hooks/
│   ├── use-portfolio.ts
│   └── use-client-switch.ts            # Switches active tenant in auth store + re-fetches
├── api/
│   └── msp.api.ts
├── pages/
│   ├── msp-portfolio.page.tsx
│   └── msp-client-detail.page.tsx
└── types/
    └── msp.types.ts
```

---

## 3. BACKEND — `/backend`

```
backend/
│
├── src/
│   ├── server.ts               # Entry point: creates HTTP server, starts listening
│   ├── app.ts                  # Express app factory: registers middleware + routers
│   │
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   ├── lib/
│   ├── jobs/
│   ├── integrations/
│   ├── ai/
│   └── types/
│
├── prisma/
│   ├── schema.prisma
│   └── client.ts
│
├── dist/                       # Compiled JavaScript output (gitignored)
├── logs/                       # Log files for local dev (gitignored)
├── .env
├── .env.example
├── tsconfig.json               # Compilation settings for src/
├── tsconfig.build.json         # tsconfig for production build (excludes test files)
└── package.json
```

---

### 3.1 Root Config Files

```
backend/
├── tsconfig.json               # paths aliases, strict mode, target: ES2022
├── tsconfig.build.json         # Extends tsconfig.json, excludes **/*.test.ts, **/*.spec.ts
└── package.json                # Dependencies and npm scripts: dev, build, start, test
```

**`tsconfig.build.json`** exists separately from `tsconfig.json` so that the production
build (`tsc -p tsconfig.build.json`) strips out test files, which do not need to be
compiled for deployment. The `dev` script uses `tsconfig.json` (includes tests for IDE
type-checking). The `start` script runs the compiled `dist/server.js`.

---

### 3.2 `src/`

```
src/
├── server.ts   # Creates the HTTP server from the Express app, attaches BullMQ workers
└── app.ts      # Constructs the Express app: global middleware stack, module routers
```

**`server.ts`** is the runtime entry point. It imports the Express app from `app.ts`,
creates an `http.Server`, and starts listening on `process.env.PORT`. It also initialises
BullMQ workers (which need the HTTP server to be running before starting to process jobs)
and sets up graceful shutdown: on `SIGTERM`, it stops accepting new connections, drains
in-flight requests, closes the database pool, and exits cleanly. This ensures Railway's
rolling deployments do not drop active requests.

**`app.ts`** is a factory function that returns a configured Express app without starting
it. This separation is critical for testing: test files can import `createApp()`, mount
it on a test server, and tear it down between test suites without managing port conflicts.

```typescript
// app.ts pattern
export function createApp(): Express {
  const app = express();
  app.use(requestId());        // Must be first — every other middleware reads the ID
  app.use(express.json());
  app.use(rateLimiter());
  app.use('/api/auth',        authRouter);
  app.use('/api/controls',    authenticate, tenantScope, controlsRouter);
  // ... remaining routers
  app.use(errorHandler);       // Must be last — catches all thrown errors
  return app;
}
```

---

### 3.3 `src/config/`

```
src/config/
├── env.ts              # Zod-validated process.env: all required vars with types
├── database.ts         # Prisma client singleton instantiation
├── redis.ts            # Redis client singleton (ioredis) for cache + BullMQ
└── constants.ts        # Non-environment constants: token expiry, rate limit windows
```

**`env.ts`** validates all environment variables at startup using Zod. If any required
variable is missing or the wrong type, the process exits immediately with a descriptive
error. This prevents the server from starting in a broken state:

```typescript
// env.ts pattern
const schema = z.object({
  DATABASE_URL:         z.string().url(),
  REDIS_URL:            z.string().url(),
  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH:  z.string(),
  S3_BUCKET:            z.string(),
  S3_REGION:            z.string(),
  ANTHROPIC_API_KEY:    z.string().startsWith('sk-ant-'),
  NODE_ENV:             z.enum(['development', 'test', 'production']),
  PORT:                 z.coerce.number().default(3002),
});
export const env = schema.parse(process.env);
```

**`database.ts`** exports a single Prisma client instance. Prisma recommends a singleton
because each instance holds a connection pool. Importing from multiple places without a
singleton would open multiple pools, exhausting database connections.

**`redis.ts`** exports two Redis client instances: one for caching (used in `lib/redis.ts`)
and one for BullMQ (BullMQ requires its own connection that it exclusively controls).
Using a single Redis connection for both would cause BullMQ to interfere with cache
operations.

---

### 3.4 `src/middleware/`

```
src/middleware/
├── auth.middleware.ts          # Verifies JWT RS256 signature, attaches user to req
├── tenant.middleware.ts        # Sets PostgreSQL search_path for current request
├── rbac.middleware.ts          # requirePermission('controls:write') factory
├── rate-limit.middleware.ts    # express-rate-limit: global + per-route limiters
├── error.middleware.ts         # Global Express error handler (must be last)
├── request-id.middleware.ts    # Attaches X-Request-ID header for distributed tracing
├── audit.middleware.ts         # Sets PostgreSQL session vars for audit log triggers
└── validate.middleware.ts      # Zod schema validation for req.body / req.params / req.query
```

**`auth.middleware.ts`** extracts the `Authorization: Bearer <token>` header, verifies
the JWT signature against the RSA public key, and attaches the decoded payload to
`req.user`. If the token is missing, expired, or invalid, it immediately returns a 401.
It also checks the `jti` (JWT ID) against the Redis token revocation list — if found,
the token has been invalidated (e.g., after logout) and is rejected even if not expired.

**`tenant.middleware.ts`** reads `req.user.tenantId`, calls `sanitizeSchemaName()` to
validate the format (`tenant_[a-f0-9-]{36}`), and then executes:
```sql
SET LOCAL search_path = tenant_abc123, framework_data, global, public;
```
using `SET LOCAL` (not `SET`) so the scope is the current transaction only, not the
session — which is required for PgBouncer in transaction mode. This is run as raw SQL
via Prisma's `$executeRaw` before any repository method touches tenant data.

**`audit.middleware.ts`** sets three PostgreSQL session variables that the audit log
trigger (`fn_write_audit_log`) reads:
```sql
SET LOCAL app.current_user_id = '...';
SET LOCAL app.current_user_email = '...';
SET LOCAL app.current_user_role = '...';
```
This is what makes every INSERT/UPDATE/DELETE automatically create an immutable audit
log entry without any repository code needing to call a logging function manually.

**`validate.middleware.ts`** is a factory that returns an Express middleware given a
Zod schema and a target (`body`, `params`, `query`). If validation fails, it returns
a 422 with structured field errors. Every route that accepts input uses this:
```typescript
router.post('/controls',
  validate(createControlSchema, 'body'),
  controlsController.create
);
```

**`error.middleware.ts`** is the global Express error handler. It must be registered
last in `app.ts`. It catches all errors passed to `next(err)`, maps them to appropriate
HTTP status codes using the custom error classes from `lib/errors.ts`, and returns a
consistent JSON error envelope. Validation errors (422), not-found errors (404), auth
errors (401/403), and unexpected errors (500 with a sanitised message) are all handled
here. In production, 500 error details are never leaked to the response — they are only
logged via Pino.

---

### 3.5 `src/modules/`

The `modules/` folder is the heart of the backend. Each module owns a complete vertical
slice of the API: routes, controller, service, repository, validation schemas, and types.
No module imports from another module's internals — cross-module communication goes
through the service layer only (a module can call another module's service, never its
repository or controller directly).

```
src/modules/
├── auth/
├── tenants/
├── users/
├── frameworks/
├── controls/
├── evidence/
├── policies/
├── risks/
├── vendors/
├── audits/
├── training/
├── incidents/
├── privacy/
├── analytics/
├── integrations/
├── notifications/
└── settings/
```

Each module follows this internal pattern:

```
modules/{module}/
├── {module}.router.ts      # Express Router: defines routes + attaches middleware
├── {module}.controller.ts  # Request handlers: parse input, call service, return response
├── {module}.service.ts     # Business logic: orchestrates repositories, enforces rules
├── {module}.repository.ts  # Database access: Prisma queries only, no business logic
├── {module}.schema.ts      # Zod schemas for request validation
└── {module}.types.ts       # TypeScript types for this module's domain objects
```

**Why this four-layer separation?**

| Layer | Responsibility | Knows About |
|---|---|---|
| **Router** | HTTP method + path + middleware wiring | Express, middleware |
| **Controller** | Input parsing, response formatting | HTTP, Service |
| **Service** | Business rules, orchestration, transactions | Repository, other Services |
| **Repository** | Database queries only | Prisma, Schema |

This separation means:
- A repository can be unit tested without starting Express
- A service can be tested by mocking the repository (no DB needed)
- Changing from PostgreSQL to another DB only changes repositories
- Changing response shapes only changes controllers

Detailed breakdown of key modules:

#### `modules/auth/`
```
auth/
├── auth.router.ts
│   POST   /api/auth/register
│   POST   /api/auth/login
│   POST   /api/auth/logout
│   POST   /api/auth/refresh
│   POST   /api/auth/forgot-password
│   PUT    /api/auth/reset-password
│   POST   /api/auth/mfa/setup
│   POST   /api/auth/mfa/verify
│   GET    /api/auth/sso/:provider/init
│   GET    /api/auth/sso/:provider/callback
│
├── auth.controller.ts
├── auth.service.ts         # Issues JWTs, validates passwords, manages MFA TOTP
├── auth.repository.ts      # Queries: users, sessions, refresh_tokens, mfa_credentials
├── auth.schema.ts          # Zod: LoginSchema, RegisterSchema, ResetPasswordSchema
└── auth.types.ts
```

#### `modules/tenants/`
```
tenants/
├── tenants.router.ts
│   POST   /api/tenants                        (Superadmin: create tenant)
│   GET    /api/tenants/:id                    (Admin: get own tenant)
│   PATCH  /api/tenants/:id                    (Admin: update org profile)
│   POST   /api/tenants/:id/provision          (Internal: trigger schema provisioning)
│
├── tenants.controller.ts
├── tenants.service.ts      # Calls fn_provision_tenant_schema, seeds default data
├── tenants.repository.ts
├── tenants.schema.ts
└── tenants.types.ts
```

#### `modules/controls/`
```
controls/
├── controls.router.ts
│   GET    /api/controls                       Paginated list, filterable
│   POST   /api/controls                       Create control
│   GET    /api/controls/:id                   Single control + linked evidence
│   PATCH  /api/controls/:id                   Update status, owner, notes
│   DELETE /api/controls/:id                   Soft delete
│   POST   /api/controls/import                Bulk import from framework library
│   PATCH  /api/controls/bulk                  Bulk status/owner update
│   GET    /api/controls/:id/history           Audit trail for control
│
├── controls.controller.ts
├── controls.service.ts     # Status transition rules, score recalculation trigger
├── controls.repository.ts  # Prisma queries under tenant search_path
├── controls.schema.ts
└── controls.types.ts
```

#### `modules/evidence/`
```
evidence/
├── evidence.router.ts
│   GET    /api/evidence                       Paginated, filterable by control/status
│   POST   /api/evidence/upload-url            Returns presigned S3 PUT URL
│   POST   /api/evidence/confirm               Confirms upload, creates DB record
│   GET    /api/evidence/:id
│   PATCH  /api/evidence/:id
│   DELETE /api/evidence/:id
│   POST   /api/evidence/:id/link              Link to additional controls
│   DELETE /api/evidence/:id/link/:controlId   Unlink from a control
│
├── evidence.controller.ts
├── evidence.service.ts     # Generates presigned S3 URLs via lib/storage.ts
├── evidence.repository.ts
├── evidence.schema.ts
└── evidence.types.ts
```

#### `modules/notifications/`
```
notifications/
├── notifications.router.ts
│   GET    /api/notifications                  Paginated list of user notifications
│   GET    /api/notifications/stream           SSE endpoint: persistent connection
│   PATCH  /api/notifications/:id/read         Mark single notification as read
│   PATCH  /api/notifications/read-all         Mark all as read
│   DELETE /api/notifications/:id
│
├── notifications.controller.ts    # GET /stream: sets SSE headers, subscribes to Redis channel
├── notifications.service.ts       # publish(): publishes to Redis pub/sub channel
├── notifications.repository.ts
├── notifications.schema.ts
└── notifications.types.ts
```

The SSE stream endpoint in `notifications.controller.ts` sets:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no     # Disables Nginx buffering so events arrive immediately
```
It then subscribes to `Redis.subscribe(channelName)` where `channelName` includes the
user's ID, so notifications are scoped per user. When the HTTP connection closes
(user navigates away or disconnects), the controller unsubscribes from Redis to prevent
memory leaks.

#### `modules/analytics/`
```
analytics/
├── analytics.router.ts
│   GET    /api/analytics/dashboard           Aggregated dashboard summary
│   GET    /api/analytics/compliance-trend    Score history for charts
│   GET    /api/analytics/control-breakdown   Status distribution per framework
│   POST   /api/reports/generate              Trigger report generation job
│   GET    /api/reports                       List generated reports
│   GET    /api/reports/:id/download          Returns presigned S3 GET URL
│   POST   /api/reports/schedule              Create scheduled report job
│
├── analytics.controller.ts
├── analytics.service.ts    # Aggregates data, calls fn_calculate_compliance_score
├── analytics.repository.ts # Reads compliance_score_snapshots (partitioned table)
├── analytics.schema.ts
└── analytics.types.ts
```

---

### 3.6 `src/lib/`

```
src/lib/
├── prisma.ts           # Extended Prisma client with withTenantSchema() helper
├── redis.ts            # Redis helper: get(), set(), del(), pub(), sub()
├── jwt.ts              # signAccessToken(), signRefreshToken(), verifyToken()
├── crypto.ts           # hashPassword(), verifyPassword(), generateSecureToken()
├── email.ts            # sendEmail(): wraps SMTP/Resend/SendGrid provider
├── storage.ts          # getPresignedUploadUrl(), getPresignedDownloadUrl()
├── pagination.ts       # parsePaginationParams(), buildPaginationMeta()
├── errors.ts           # Custom error classes: NotFoundError, ForbiddenError, etc.
└── logger.ts           # Pino logger with request context (requestId, userId, tenantId)
```

**`prisma.ts`** provides a `withTenantSchema(tenantId, fn)` wrapper that executes a
transaction after setting `search_path`:
```typescript
async function withTenantSchema<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const schemaName = sanitizeSchemaName(tenantId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL search_path = ${schemaName}, framework_data, global, public`;
    return fn(tx);
  });
}
```
Every repository method that queries tenant data calls this wrapper. It is the single
place in the codebase where the `search_path` is set — never scattered across individual
queries.

**`jwt.ts`** uses RSA key pairs (`RS256`). The private key signs tokens (backend only).
The public key verifies them (shared with any service that needs to verify JWTs). This
asymmetric approach means if a future microservice is extracted, it can verify tokens
without sharing a secret key.

**`errors.ts`** defines a hierarchy of typed errors:
```typescript
class AppError extends Error {
  constructor(public message: string, public statusCode: number, public code: string) {}
}
class NotFoundError extends AppError { /* 404 */ }
class ForbiddenError extends AppError { /* 403 */ }
class UnauthorizedError extends AppError { /* 401 */ }
class ValidationError extends AppError { /* 422 */ }
class ConflictError extends AppError { /* 409 */ }
```
The error middleware in `middleware/error.middleware.ts` catches these and maps them to
HTTP responses. Unexpected errors that are not `AppError` instances get a 500 response
with the message "An unexpected error occurred" (never the raw error) in production.

**`logger.ts`** creates a Pino logger with structured JSON output. Every log entry
automatically includes: `timestamp`, `level`, `requestId`, `userId`, `tenantId`, and
`module`. The request middleware attaches `requestId` to the logger context so every
log from within a request can be correlated in Datadog / CloudWatch.

---

### 3.7 `src/jobs/`

```
src/jobs/
│
├── queues.ts                       # Defines all BullMQ Queue instances
│
├── workers/
│   ├── evidence-collection.worker.ts  # Pulls from integrations, creates evidence items
│   ├── compliance-score.worker.ts     # Calls fn_calculate_compliance_score, caches result
│   ├── notification.worker.ts         # Publishes to Redis pub/sub for SSE delivery
│   ├── report-generation.worker.ts    # Generates PDF/Excel, uploads to S3
│   └── vendor-assessment.worker.ts    # Sends vendor assessment invitation emails
│
└── schedulers/
    ├── daily-evidence-sync.scheduler.ts   # Cron: 02:00 UTC — trigger evidence collection
    ├── expiry-reminder.scheduler.ts       # Cron: 09:00 UTC — notify about expiring evidence
    └── score-snapshot.scheduler.ts        # Cron: 00:00 UTC Sunday — snapshot all scores
```

**`queues.ts`** instantiates BullMQ `Queue` objects with their names and the shared
Redis connection. Queue names are string constants defined here and imported by both
the workers (which consume jobs) and the services (which enqueue jobs). Having them
in one file prevents typos where a service enqueues to `'evidence-collection'` but
the worker listens to `'evidenceCollection'`.

Workers run in the same Node.js process as the API in development and on Railway
(kept simple for a modular monolith). In `server.ts`, workers are started after the
HTTP server is listening. If the workload justifies it, workers can be extracted to
a separate Railway service by changing a single environment variable.

**`compliance-score.worker.ts`** is triggered by two events:
1. When a control's status changes (service enqueues a job after `PATCH /api/controls/:id`)
2. By the weekly snapshot scheduler

It calls `fn_calculate_compliance_score(frameworkId)` via Prisma `$queryRaw`, then
writes the result to Redis with `SET compliance:score:{tenantId}:{frameworkId} {score} EX 3600`
so the dashboard can read it in under 1ms.

---

### 3.8 `src/integrations/`

```
src/integrations/
│
├── base.integration.ts             # Abstract base class all integrations extend
│
├── aws/
│   ├── aws-cloudtrail.integration.ts  # Pulls IAM events and MFA logs
│   └── aws-s3.integration.ts          # Used by lib/storage.ts for presigned URLs
│
├── okta/
│   └── okta.integration.ts            # Pulls user provisioning events
│
├── github/
│   └── github.integration.ts          # Pulls branch protection, PR policies
│
├── bamboohr/
│   └── bamboohr.integration.ts        # Pulls employee records for training tracking
│
├── jira/
│   └── jira.integration.ts            # Syncs issues to risk / incident tracking
│
└── slack/
    └── slack.integration.ts            # Sends compliance alert notifications
```

**`base.integration.ts`** defines the interface every integration must implement:
```typescript
abstract class BaseIntegration {
  abstract name: string;
  abstract connect(credentials: Record<string, string>): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract collectEvidence(): Promise<EvidenceItem[]>;
  abstract getLastSyncTime(): Promise<Date | null>;
}
```
This contract means the `evidence-collection.worker.ts` can loop over any array of
active integrations and call `integration.collectEvidence()` without knowing which
specific integration it is calling. Adding a new integration only requires creating
a new file in this folder that extends `BaseIntegration`.

Credentials (API keys, client secrets) are stored in the tenant schema `integrations`
table, encrypted at rest using `crypto.ts` with AES-256-GCM. They are never stored
in environment variables because each tenant has different credentials.

---

### 3.9 `src/ai/`

```
src/ai/
│
├── ai-client.ts            # HTTP client calling the Python FastAPI AI service
│
└── prompts/
    ├── gap-analysis.prompt.ts       # System prompt for cross-framework gap analysis
    ├── control-explanation.prompt.ts # System prompt for explaining a control requirement
    ├── policy-draft.prompt.ts        # System prompt for drafting a policy section
    ├── chat.prompt.ts                # System prompt for the AI assistant chat
    └── incident-summary.prompt.ts    # System prompt for incident report summarisation
```

**`ai-client.ts`** is an Axios HTTP client that calls the Python FastAPI AI service
at its internal Railway private network URL (`http://ai-service:8000`). The backend
never calls the Anthropic API directly — all AI calls are proxied through the Python
service, which handles:
- RAG pipeline (pgvector similarity search for framework knowledge)
- PII filtering before sending content to the LLM
- Streaming response proxying back to the Express backend (which streams to the frontend)
- Token usage logging and cost tracking

**`prompts/`** contains typed template functions (not raw strings) that build system
prompts from structured inputs. Each prompt file exports a function:
```typescript
// gap-analysis.prompt.ts
export function buildGapAnalysisPrompt(params: {
  sourceFramework: string;
  targetFramework: string;
  existingControls: Control[];
}): string { ... }
```
This makes prompts testable and prevents SQL-injection-style prompt injection from
user inputs being concatenated directly into prompts.

---

### 3.10 `src/types/`

```
src/types/
├── express.d.ts    # Module augmentation: extends Express.Request with req.user, req.tenant
├── api.types.ts    # Shared request/response types used across multiple modules
└── index.ts        # Re-exports
```

**`express.d.ts`** is the most critical file in this folder:
```typescript
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: UserRole;
        tenantId: string;
        permissions: string[];
      };
      tenant: {
        id: string;
        schemaName: string;
        plan: SubscriptionPlan;
      };
      requestId: string;
    }
  }
}
```
Without this augmentation, TypeScript does not know that `req.user` exists after the
auth middleware runs, and every controller would need unsafe `as any` casts or optional
chaining. This file makes the augmented request shape available globally in all
TypeScript files without explicit imports.

---

### 3.11 `prisma/`

```
prisma/
├── schema.prisma           # Prisma schema for global + framework_data schemas
└── client.ts               # Prisma client singleton + tenant schema extension
```

**`schema.prisma`** uses the `multiSchema` preview feature to map models to the
`global` and `framework_data` schemas:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["global", "framework_data"]
}

model Tenant {
  @@schema("global")
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ...
}

model Framework {
  @@schema("framework_data")
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ...
}
```

**Tenant schema models are NOT in `schema.prisma`** because Prisma cannot model
dynamically named schemas at compile time. All tenant schema queries (controls, evidence,
policies, risks, etc.) use raw Prisma queries (`$queryRaw`, `$executeRaw`) within the
`withTenantSchema()` wrapper. The return types are defined manually in each module's
`*.types.ts` file. This is the deliberate trade-off documented in `ARCHITECTURE.md §
ADR-003`.

---

## 4. DATABASE — `/database`

```
database/                           # Already exists from Phase 3
├── schema.sql                      # Complete PostgreSQL schema (~1,200 lines)
├── migrations/
│   ├── 001_global_schema.sql       # Bootstrap: extensions, schemas, roles
│   └── runner.ts                   # Tenant schema migration runner (future)
└── seeds/
    ├── frameworks.sql              # 18 frameworks + SOC 2, ISO 27001, NDPR categories
    ├── controls_soc2.sql           # Full SOC 2 Trust Services Criteria control set
    ├── controls_iso27001.sql       # Full ISO 27001:2022 Annex A controls (93)
    ├── controls_gdpr.sql           # GDPR articles mapped to controls
    ├── controls_ndpr.sql           # NDPR 2019 controls
    ├── controls_hipaa.sql          # HIPAA Security Rule safeguards
    ├── controls_pci_dss.sql        # PCI-DSS v4.0 requirements
    └── ucf_mappings.sql            # UCF cross-framework control overlap mappings
```

The `database/` folder is intentionally separate from both `frontend/` and `backend/`.
It is the single source of truth for the data model, owned by the database team and
consumed by the backend through Prisma migrations and seed scripts. CI/CD pipelines
reference this folder directly when running database tests.

---

## 5. DOCKER — `/docker`

```
docker/
├── frontend.Dockerfile
└── backend.Dockerfile
```

```
docker-compose.yml          # Local development: all services
docker-compose.prod.yml     # Production overrides: no dev mounts, real secrets
```

#### `docker/frontend.Dockerfile`

```dockerfile
# Stage 1 — Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # Outputs to /app/dist

# Stage 2 — Serve
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

The multi-stage build ensures the production image contains only Nginx and the compiled
static assets — not the Node.js runtime, npm cache, or source files. The final image
is typically 15–25 MB.

#### `docker/backend.Dockerfile`

```dockerfile
# Stage 1 — Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # tsc → dist/

# Stage 2 — Production
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json .
USER 1001                      # Non-root uid as specified in ARCHITECTURE.md
EXPOSE 3002
HEALTHCHECK CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "dist/server.js"]
```

**Why non-root (uid 1001)?** If a vulnerability allows container escape, a non-root
user limits the blast radius — it cannot write to system directories or escalate
privileges. This is a security requirement from `ARCHITECTURE.md § Security`.

#### `docker-compose.yml`

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: compliancecore
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
      - ./database/seeds/frameworks.sql:/docker-entrypoint-initdb.d/02_seed.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: { context: ./backend, dockerfile: ../docker/backend.Dockerfile }
    ports: ["3002:3002"]
    depends_on: [postgres, redis]
    volumes:
      - ./backend/src:/app/src    # Hot reload in dev
    env_file: ./backend/.env

  frontend:
    build: { context: ./frontend, dockerfile: ../docker/frontend.Dockerfile }
    ports: ["5173:80"]
    depends_on: [backend]

volumes:
  pgdata:
```

The `pgvector/pgvector:pg16` image is used instead of the official PostgreSQL image
because it comes with the `vector` extension pre-installed, which is required for
the AI RAG pipeline's similarity search feature.

---

## 6. CI/CD — `/.github`

```
.github/
└── workflows/
    ├── frontend-ci.yml     # On PR: lint, type-check, test, build
    ├── backend-ci.yml      # On PR: lint, type-check, test (with Postgres service)
    └── deploy.yml          # On push to main: build images, push to registry, deploy to Railway
```

#### `frontend-ci.yml`
```yaml
on: pull_request
jobs:
  ci:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node 20)
      - run: npm ci
      - run: npm run lint           # ESLint
      - run: npm run type-check     # tsc --noEmit
      - run: npm run test           # Vitest
      - run: npm run build          # Verify the Vite build succeeds
```

#### `backend-ci.yml`
```yaml
on: pull_request
jobs:
  ci:
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_DB: test, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node 20)
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run db:migrate:test   # Apply schema.sql to test DB
      - run: npm run test              # Jest with real Postgres (no mocks)
```

Integration tests run against a real PostgreSQL + Redis service, not mocks. This is
the same approach documented in `ARCHITECTURE.md`: mock-based tests that pass while
production breaks are a known failure mode for data layer bugs.

---

## COMPLETE FILE TREE (Condensed Reference)

```
ComplianceCore/
├── .github/workflows/
│   ├── frontend-ci.yml
│   ├── backend-ci.yml
│   └── deploy.yml
│
├── frontend/
│   ├── public/                  favicon, manifest, PWA icons
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── assets/              fonts, images, svgs
│   │   ├── styles/              globals.css, fonts.css
│   │   ├── config/              env.ts, constants.ts
│   │   ├── lib/                 api-client, query-client, utils, date, format
│   │   ├── types/               api.ts, auth.ts, common.ts
│   │   ├── hooks/               use-auth, use-permissions, use-sse, use-tenant
│   │   ├── stores/              auth.store, ui.store, notification.store
│   │   ├── routes/              index, public, protected, paths
│   │   ├── components/
│   │   │   ├── ui/              30 shadcn/ui base components
│   │   │   ├── layout/          app-shell, sidebar, topbar, page-header
│   │   │   ├── data-display/    data-table, empty-state, status-badge, score-ring
│   │   │   ├── charts/          compliance-ring, heat-map, trend-line, gauge
│   │   │   ├── forms/           rich-text-editor, file-upload, user-select
│   │   │   └── feedback/        command-palette, confirm-dialog, ai-assistant-panel
│   │   └── features/
│   │       ├── auth/            components, hooks, api, pages, types
│   │       ├── onboarding/      components, hooks, api, pages, types
│   │       ├── dashboard/       components, hooks, api, pages, types
│   │       ├── frameworks/      components, hooks, api, pages, types
│   │       ├── controls/        components, hooks, api, pages, types
│   │       ├── evidence/        components, hooks, api, pages, types
│   │       ├── policies/        components, hooks, api, pages, types
│   │       ├── risks/           components, hooks, api, pages, types
│   │       ├── vendors/         components, hooks, api, pages, types
│   │       ├── audits/          components, hooks, api, pages, types
│   │       ├── training/        components, hooks, api, pages, types
│   │       ├── incidents/       components, hooks, api, pages, types
│   │       ├── privacy/         components, hooks, api, pages, types
│   │       ├── analytics/       components, hooks, api, pages, types
│   │       ├── integrations/    components, hooks, api, pages, types
│   │       ├── settings/        components, hooks, api, pages, types
│   │       └── msp/             components, hooks, api, pages, types
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts            HTTP server entry point
│   │   ├── app.ts               Express app factory
│   │   ├── config/              env, database, redis, constants
│   │   ├── middleware/          auth, tenant, rbac, validate, error, audit, rate-limit
│   │   ├── modules/
│   │   │   ├── auth/            router, controller, service, repository, schema, types
│   │   │   ├── tenants/         router, controller, service, repository, schema, types
│   │   │   ├── users/           router, controller, service, repository, schema, types
│   │   │   ├── frameworks/      router, controller, service, repository, schema, types
│   │   │   ├── controls/        router, controller, service, repository, schema, types
│   │   │   ├── evidence/        router, controller, service, repository, schema, types
│   │   │   ├── policies/        router, controller, service, repository, schema, types
│   │   │   ├── risks/           router, controller, service, repository, schema, types
│   │   │   ├── vendors/         router, controller, service, repository, schema, types
│   │   │   ├── audits/          router, controller, service, repository, schema, types
│   │   │   ├── training/        router, controller, service, repository, schema, types
│   │   │   ├── incidents/       router, controller, service, repository, schema, types
│   │   │   ├── privacy/         router, controller, service, repository, schema, types
│   │   │   ├── analytics/       router, controller, service, repository, schema, types
│   │   │   ├── integrations/    router, controller, service, repository, schema, types
│   │   │   ├── notifications/   router, controller, service, repository, schema, types
│   │   │   └── settings/        router, controller, service, repository, schema, types
│   │   ├── lib/                 prisma, redis, jwt, crypto, email, storage, errors, logger
│   │   ├── jobs/
│   │   │   ├── queues.ts
│   │   │   ├── workers/         evidence, score, notification, report, vendor
│   │   │   └── schedulers/      daily-sync, expiry-reminder, score-snapshot
│   │   ├── integrations/        aws, okta, github, bamboohr, jira, slack
│   │   ├── ai/                  ai-client.ts, prompts/
│   │   └── types/               express.d.ts, api.types.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── client.ts
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── package.json
│
├── database/
│   ├── schema.sql
│   ├── migrations/
│   └── seeds/
│
├── docker/
│   ├── frontend.Dockerfile
│   └── backend.Dockerfile
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── PRD.md
├── ARCHITECTURE.md
├── DATABASE.md
├── DESIGN.md
├── STRUCTURE.md
└── .gitignore
```

---

*Document Version: 1.0*
*Author: Engineering, ORION SOFT LIMITED*
*Classification: CONFIDENTIAL — Internal Engineering Reference*
*Last Updated: June 15, 2026*

*© 2026 ORION SOFT LIMITED. All rights reserved.*
