# ComplianceCore — UI/UX Design Specification
### ORION SOFT LIMITED | Product Design | Version 1.0 | June 2026

---

## TABLE OF CONTENTS

1.  [Design Philosophy](#1-design-philosophy)
2.  [Color System](#2-color-system)
3.  [Typography](#3-typography)
4.  [Spacing & Grid](#4-spacing--grid)
5.  [Component Library](#5-component-library)
6.  [Dark Mode](#6-dark-mode)
7.  [Navigation Architecture](#7-navigation-architecture)
8.  [Sidebar Design](#8-sidebar-design)
9.  [Mobile Responsiveness](#9-mobile-responsiveness)
10. [Page Inventory & Wireframes](#10-page-inventory--wireframes)
    - 10.1  Auth Pages
    - 10.2  Onboarding Wizard
    - 10.3  Main Dashboard
    - 10.4  Frameworks
    - 10.5  Controls
    - 10.6  Evidence Hub
    - 10.7  Policy Management
    - 10.8  Risk Register
    - 10.9  Vendor Management
    - 10.10 Audit Management
    - 10.11 Training
    - 10.12 Incidents
    - 10.13 Privacy Management
    - 10.14 Analytics & Reports
    - 10.15 Integrations
    - 10.16 AI Assistant
    - 10.17 Settings
    - 10.18 MSP Console
    - 10.19 External Portals
    - 10.20 Trust Center
11. [User Flows](#11-user-flows)
12. [Interaction Patterns](#12-interaction-patterns)
13. [Accessibility](#13-accessibility)
14. [Design Tokens](#14-design-tokens)

---

## 1. DESIGN PHILOSOPHY

### Core Design Principles

**1. Clarity Over Cleverness**
Compliance professionals are under pressure. Every screen must communicate the most important information first, without requiring inference. We never make the user hunt for a status, a deadline, or a gap. Labels are explicit. Status indicators are colour-coded and text-labelled — never colour-only.

**2. Confidence Through Density**
Enterprise compliance software must display a lot of information. We embrace appropriate information density — not sparse "marketing site" whitespace, but deliberate density with clear hierarchy. A compliance manager should see 20 controls on a screen, not 5.

**3. Progressive Disclosure**
Not everything needs to be visible at once. List views show the essential status. Clicking a row reveals the full detail. The AI assistant panel slides in from the right. Audit evidence requests expand inline. We surface the right information at the right moment.

**4. Status at a Glance**
The most important design constraint in ComplianceCore: a user should always know their compliance posture within 3 seconds of loading any screen. Colour, iconography, and numeric scores communicate status before text is read.

**5. Calm Under Pressure**
When a breach is being logged or an audit finding is due, the interface must stay calm. No jarring animations, no disorienting transitions. Controlled, professional, trustworthy. The UI is a partner in a stressful moment — not a source of additional stress.

**6. Built for Repetition**
Compliance managers use this software every working day. The design optimises for repeat users, not first-time visitors. Keyboard shortcuts, persistent sidebar state, remembered table sort orders, and dense table views prioritise the power user over the casual visitor.

### Design Personality

| Dimension | ComplianceCore |
|---|---|
| Tone | Professional, authoritative, calm |
| Density | Medium-high (data-forward) |
| Motion | Purposeful, subtle (100–200ms transitions) |
| Visual Language | Clean geometry, structured grids, minimal ornamentation |
| Trust Signals | Consistent iconography, clear status labels, visible audit trails |
| Anti-Patterns | Gamification, excessive celebration, vague "success" states |

---

## 2. COLOR SYSTEM

### Brand Philosophy
The ComplianceCore palette is built on **Indigo** as the primary brand colour — evoking trust, intelligence, and stability. The semantic palette (success, warning, danger) is clear and unambiguous because compliance decisions have real consequences.

---

### 2.1 Primary Palette

```
INDIGO — Primary Brand
────────────────────────────────────────────────────────────
indigo-50    #EEF2FF   Hover backgrounds, selected row tints
indigo-100   #E0E7FF   Light badge backgrounds
indigo-200   #C7D2FE   Borders on hover
indigo-300   #A5B4FC   Disabled primary elements
indigo-400   #818CF8   Secondary actions
indigo-500   #6366F1   ← Primary interactive (buttons, links)
indigo-600   #4F46E5   ← Primary brand (CTAs, active sidebar)
indigo-700   #4338CA   Primary hover state
indigo-800   #3730A3   Deep brand — headings, focus rings
indigo-900   #312E81   Dark backgrounds on white text
indigo-950   #1E1B4B   Darkest brand — hero sections
```

### 2.2 Neutral Palette (Slate)

```
SLATE — Structural & Text
────────────────────────────────────────────────────────────
slate-50     #F8FAFC   Page backgrounds (light mode)
slate-100    #F1F5F9   Card backgrounds, table stripes
slate-200    #E2E8F0   Borders, dividers
slate-300    #CBD5E1   Disabled text, placeholder borders
slate-400    #94A3B8   Placeholder text, secondary icons
slate-500    #64748B   Secondary text, captions
slate-600    #475569   ← Body text secondary
slate-700    #334155   ← Body text primary
slate-800    #1E293B   ← Headings, strong text
slate-900    #0F172A   Maximum contrast text
slate-950    #020617   Dark mode backgrounds
```

### 2.3 Semantic Colours

```
EMERALD — Success / Implemented / Pass
────────────────────────────────────────
emerald-50   #ECFDF5   Background for success states
emerald-100  #D1FAE5   Badge backgrounds
emerald-500  #10B981   Icons, borders
emerald-600  #059669   ← Primary success colour
emerald-700  #047857   Success hover
emerald-900  #064E3B   Dark mode success text


AMBER — Warning / In Progress / Due Soon
────────────────────────────────────────
amber-50     #FFFBEB   Background for warning states
amber-100    #FEF3C7   Badge backgrounds
amber-500    #F59E0B   Icons, borders
amber-600    #D97706   ← Primary warning colour
amber-700    #B45309   Warning hover
amber-900    #78350F   Dark mode warning text


ROSE — Danger / Failing / Overdue / Breach
────────────────────────────────────────────
rose-50      #FFF1F2   Background for danger states
rose-100     #FFE4E6   Badge backgrounds
rose-500     #F43F5E   Icons, borders
rose-600     #E11D48   ← Primary danger colour
rose-700     #BE123C   Danger hover
rose-900     #881337   Dark mode danger text


SKY — Info / Neutral Status / In Review
────────────────────────────────────────
sky-50       #F0F9FF   Background for info states
sky-100      #E0F2FE   Badge backgrounds
sky-500      #0EA5E9   Icons, borders
sky-600      #0284C7   ← Primary info colour
sky-700      #0369A1   Info hover
sky-900      #0C4A6E   Dark mode info text


VIOLET — AI Features / Assistant
────────────────────────────────────────
violet-50    #F5F3FF   AI panel background
violet-100   #EDE9FE   AI badge backgrounds
violet-500   #8B5CF6   AI icons
violet-600   #7C3AED   ← AI primary colour
violet-700   #6D28D9   AI hover
```

### 2.4 Control Status Colour Mapping

```
Status              Badge Colour    Icon Colour    Background
──────────────────────────────────────────────────────────────
Not Started         slate-500       slate-400      slate-50
In Progress         amber-600       amber-500      amber-50
Implemented         emerald-600     emerald-500    emerald-50
Not Applicable      slate-400       slate-300      slate-100
Failing             rose-600        rose-500       rose-50
```

### 2.5 Risk Heat Map Colour Scale

```
Risk Score    Colour          Label
────────────────────────────────────
1–4           emerald-500     Low
5–9           amber-500       Medium
10–16         orange-500      High
17–25         rose-600        Critical
```

### 2.6 Compliance Score Colour Scale

```
Score         Colour          Meaning
────────────────────────────────────
0–49%         rose-600        At Risk
50–69%        amber-600       Needs Attention
70–84%        sky-600         Progressing
85–94%        emerald-600     Good
95–100%       indigo-600      Excellent
```

---

## 3. TYPOGRAPHY

### Font Families

```
PRIMARY:     Inter Variable
             — All UI text, headings, labels, body copy
             — Source: Google Fonts / Fontsource (self-hosted)
             — Axes: wght (100–900)

MONOSPACE:   JetBrains Mono
             — API keys, code blocks, SHA hashes, technical values
             — Source: Google Fonts / Fontsource
```

### Type Scale

```
Token           Size      Line Height   Weight      Usage
─────────────────────────────────────────────────────────────────────
display-2xl     72px      90px          700         Landing page heroes (public)
display-xl      60px      72px          700         Not used in app
display-lg      48px      60px          700         Not used in app
display-md      36px      44px          700         Not used in app
display-sm      30px      38px          600         Page titles in reports
display-xs      24px      32px          600         Section headings (print)

text-xl         20px      30px          600         Page titles, modal headings
text-lg         18px      28px          500         Section headings, card titles
text-md         16px      24px          400/500     Body text, form labels
text-sm         14px      20px          400/500     Table content, metadata
text-xs         12px      18px          400         Captions, timestamps, badges
text-xxs        11px      16px          400/500     Legal footnotes, audit trail
```

### Font Weight Usage

```
400 (Regular)   — Body text, descriptions, table values
500 (Medium)    — Form labels, navigation items, card metadata
600 (SemiBold)  — Section headings, button labels, card titles
700 (Bold)      — Page titles, metric numbers, KPI values
800 (ExtraBold) — Dashboard score numbers (compliance %)
```

### Text Styles Reference

```
Page Heading:       text-xl  / 700 / slate-800  (dark: slate-100)
Section Heading:    text-lg  / 600 / slate-700  (dark: slate-200)
Card Title:         text-md  / 600 / slate-800  (dark: slate-100)
Body Primary:       text-md  / 400 / slate-700  (dark: slate-300)
Body Secondary:     text-sm  / 400 / slate-500  (dark: slate-400)
Table Header:       text-xs  / 600 / slate-500  (dark: slate-400) UPPERCASE
Table Cell:         text-sm  / 400 / slate-700  (dark: slate-300)
Label:              text-sm  / 500 / slate-700  (dark: slate-200)
Caption/Timestamp:  text-xs  / 400 / slate-400  (dark: slate-500)
Badge Text:         text-xs  / 500 / [semantic]
KPI Metric:         text-xl  / 700 / slate-900  (dark: white)
KPI Sub-label:      text-sm  / 400 / slate-500  (dark: slate-400)
Score Large:        48px     / 800 / indigo-600 (dark: indigo-400)
Score Label:        text-xs  / 600 / slate-500  UPPERCASE + TRACKING
Nav Item:           text-sm  / 500 / slate-600  (dark: slate-300)
Nav Item Active:    text-sm  / 600 / indigo-700 (dark: indigo-300)
```

---

## 4. SPACING & GRID

### Spacing Scale (4px base unit)

```
space-0    0px
space-1    4px
space-2    8px
space-3    12px
space-4    16px
space-5    20px
space-6    24px
space-8    32px
space-10   40px
space-12   48px
space-16   64px
space-20   80px
space-24   96px
space-32   128px
```

### Layout Grid

```
Sidebar:             240px (collapsed: 64px)
Top Bar:             56px height
Content Area:        calc(100vw - 240px) — fluid
Max content width:   1280px (centred on very wide screens)
Content padding:     24px (desktop), 16px (tablet), 12px (mobile)
Card gap:            16px (desktop), 12px (tablet)
Section gap:         24px (desktop), 16px (tablet)
```

### Border Radius

```
radius-none    0
radius-sm      4px    — Small badges, compact chips
radius-md      6px    — Form inputs, small cards, dropdowns
radius-lg      8px    — Standard cards, modals
radius-xl      12px   — Large cards, panels
radius-2xl     16px   — Feature callouts, hero cards
radius-full    9999px — Pills, avatar circles, toggle switches
```

### Elevation (Box Shadow)

```
shadow-none    none
shadow-xs      0 1px 2px 0 rgb(0 0 0 / 0.05)           — Subtle lift
shadow-sm      0 1px 3px 0 rgb(0 0 0 / 0.10)           — Cards
shadow-md      0 4px 6px -1px rgb(0 0 0 / 0.10)        — Dropdowns
shadow-lg      0 10px 15px -3px rgb(0 0 0 / 0.10)      — Modals
shadow-xl      0 20px 25px -5px rgb(0 0 0 / 0.10)      — Drawers, popovers
shadow-inner   inset 0 2px 4px 0 rgb(0 0 0 / 0.06)     — Inset inputs
```

---

## 5. COMPONENT LIBRARY

### 5.1 Buttons

```
VARIANTS:
  Primary      — indigo-600 bg, white text, indigo-700 hover
  Secondary    — white bg, slate-300 border, slate-700 text
  Danger       — rose-600 bg, white text, rose-700 hover
  Ghost        — transparent bg, indigo-600 text, indigo-50 hover
  Link         — no bg/border, indigo-600 text, underline on hover

SIZES:
  xs    — h-6  px-2   text-xs   (table inline actions)
  sm    — h-8  px-3   text-sm   (secondary actions)
  md    — h-9  px-4   text-sm   (default)
  lg    — h-10 px-5   text-md   (primary CTAs)
  xl    — h-12 px-6   text-md   (onboarding CTAs)

STATES:
  Default     — standard appearance
  Hover       — 5% darker background
  Focus       — 2px indigo-600 outline + 2px offset
  Active      — 10% darker + slight scale(0.98)
  Disabled    — 40% opacity, cursor-not-allowed
  Loading     — spinner replaces leading icon, text fades to 60%

ICON BUTTONS:
  — Square, radius-md
  — Leading icon: 16px (sm), 18px (md), 20px (lg)
  — Icon-only variant: equal width and height (square)
```

### 5.2 Form Inputs

```
TEXT INPUT:
  Height:      36px (sm), 40px (md — default)
  Border:      1px slate-300 (light) / slate-600 (dark)
  Background:  white (light) / slate-900 (dark)
  Radius:      radius-md (6px)
  Padding:     12px horizontal, 8px vertical
  Focus:       indigo-600 border, indigo-600/20 ring (2px)
  Error:       rose-500 border, rose-50 background
  Disabled:    slate-100 background, slate-400 text
  Placeholder: slate-400

TEXTAREA:
  Min height:  80px (sm), 120px (md)
  Resize:      vertical only
  Same states as text input

SELECT / DROPDOWN:
  Same height and border as input
  Chevron icon: trailing, slate-400
  Open state: shadow-lg, max-h-60, overflow-y-auto

CHECKBOX:
  Size: 16px × 16px, radius-sm
  Checked: indigo-600 fill, white checkmark
  Indeterminate: indigo-600 fill, white dash
  Focus: indigo-600 ring

RADIO:
  Size: 16px × 16px, radius-full
  Selected: indigo-600 dot on white background

TOGGLE SWITCH:
  Width: 44px, Height: 24px, radius-full
  Off: slate-300 track, white thumb
  On:  indigo-600 track, white thumb
  Animated: 150ms ease-out

SEARCH INPUT:
  Leading icon: MagnifyingGlass, slate-400
  Clear button: × appears when value is present
  Keyboard shortcut badge: (⌘K) displayed in empty state

RICH TEXT EDITOR (Policy Editor):
  Toolbar: Bold, Italic, Underline, H1/H2/H3, List, Quote, Link, Table, HR
  Content area: min-h-[400px], padding-16, prose typography
  Word count: bottom-right, text-xs slate-400
  Auto-save: "Saved X seconds ago" indicator
```

### 5.3 Tables

```
DATA TABLE ANATOMY:
  ┌─────────────────────────────────────────────────────────┐
  │  TOOLBAR: Search | Filters | Sort | [Actions] [Export]  │ 48px
  ├──────┬──────────────────┬──────────┬─────────┬──────────┤
  │  □   │  COLUMN HEADER ▲ │  HEADER  │  HDR    │  HDR     │ 40px — sticky
  ├──────┼──────────────────┼──────────┼─────────┼──────────┤
  │  □   │  Row value       │  Badge   │  text   │  action  │ 52px
  │  □   │  Row value       │  Badge   │  text   │  action  │ 52px (stripe)
  │  □   │  Row value       │  Badge   │  text   │  action  │ 52px
  ├──────┴──────────────────┴──────────┴─────────┴──────────┤
  │  Showing 1–50 of 247 results      [ < ] [1] [2] [3] [ > ]│ 48px
  └─────────────────────────────────────────────────────────┘

FEATURES:
  — Column sorting (click header): asc → desc → none cycle
  — Column resizing: drag handle between headers
  — Row selection: checkbox per row + header select-all
  — Bulk action bar: appears above table when rows selected
  — Row hover: slate-50 background (light), slate-800 (dark)
  — Alternate row striping: optional (every other row slate-50)
  — Sticky header: scrolls content, header remains
  — Sticky first column: for wide tables (name/title column)
  — Empty state: icon + heading + description + CTA
  — Loading state: skeleton rows (3 visible)
  — Inline row actions: visible on hover (edit, view, delete)
  — Expandable rows: click to see sub-detail inline
  — Pagination: 25 / 50 / 100 per page selector
  — Total count: always shown ("247 controls")
```

### 5.4 Cards

```
METRIC CARD (KPI):
  ┌──────────────────────────────┐
  │ Icon  Title                  │
  │                              │
  │       147                    │  ← Large metric number
  │       Controls total         │  ← Label
  │       ↑ 12 this month       │  ← Trend (emerald or rose)
  └──────────────────────────────┘
  Width: flexible (grid)
  Height: 120px minimum
  Border: 1px slate-200
  Radius: radius-lg

COMPLIANCE SCORE CARD:
  ┌──────────────────────────────┐
  │  ISO 27001                   │
  │  ┌────────┐                  │
  │  │ Circle │    87%           │  ← Ring progress chart
  │  │  87%   │    Progressing   │
  │  └────────┘                  │
  │  42 / 48 controls            │
  └──────────────────────────────┘

STATUS CARD (Alert/Info):
  ┌──────────────────────────────┐
  │ ⚠  3 evidence items expiring │
  │    within 7 days             │
  │    [View Evidence →]         │
  └──────────────────────────────┘
  Left border: 4px semantic colour
  Background: semantic-50

ENTITY CARD (List view alternative to table):
  ┌──────────────────────────────┐
  │ [●] Control Title            │  ← Status dot + title
  │     CC6.1 · ISO 27001        │  ← Framework ref
  │     Owner: M. Adeyemi        │  ← Metadata row
  │     Due: Jun 30, 2027  [···] │  ← Date + action menu
  └──────────────────────────────┘
```

### 5.5 Badges & Status Indicators

```
STATUS BADGE:
  ┌─────────────────┐
  │ ● Implemented   │  ← Dot + Label
  └─────────────────┘
  Height: 20px, Padding: 2px 8px, Radius: radius-full
  Dot: 6px circle, same colour as badge text
  Font: text-xs / 500

SEVERITY BADGE (Risk, Incident):
  Critical:  rose-100 bg / rose-700 text / rose-500 border
  High:      orange-100 bg / orange-700 text
  Medium:    amber-100 bg / amber-700 text
  Low:       emerald-100 bg / emerald-700 text

FRAMEWORK BADGE:
  Background: indigo-100, Text: indigo-700
  Used inline to show which framework a control maps to

SCORE RING:
  SVG circle, stroke-width 8px
  Track: slate-100 (light) / slate-700 (dark)
  Fill: semantic colour based on score
  Centre text: percentage (bold)
  Sizes: 40px (sm), 64px (md), 96px (lg), 128px (xl)

PROGRESS BAR:
  Track: slate-100, Height: 8px, Radius: radius-full
  Fill: semantic colour
  Label: left (title), right (percentage)
  Animated on mount: 600ms ease-out from 0
```

### 5.6 Navigation Components

```
BREADCRUMB:
  Home / Controls / CC6.1 — Logical Access Controls
  Separator: / (slate-300)
  Current: slate-700 (non-clickable)
  Parents: indigo-600, underline on hover

TABS:
  Underline tabs (not box tabs)
  Active: 2px indigo-600 bottom border, indigo-700 text
  Inactive: transparent border, slate-500 text
  Hover: slate-700 text
  Gap between tabs: 24px
  Full-width option for narrow contexts

PAGINATION:
  [ ← Prev ]  [1] [2] [3] ... [12]  [ Next → ]
  Current page: indigo-600 bg, white text
  Others: ghost buttons

STEPPER (Onboarding):
  ① Framework ──── ② Team ──── ③ Integrations ──── ④ Launch
  Completed step: indigo-600 circle with checkmark
  Current step: indigo-600 ring (outline)
  Future step: slate-300 circle with number
```

### 5.7 Feedback Components

```
TOAST NOTIFICATIONS (top-right stack):
  Success: emerald-600 left border, emerald-50 bg
  Warning: amber-600 left border, amber-50 bg
  Error:   rose-600 left border, rose-50 bg
  Info:    sky-600 left border, sky-50 bg
  Width: 380px, Auto-dismiss: 4s (error: manual dismiss)
  Stack: max 3 visible, older pushed down

EMPTY STATES:
  Centred in container
  Illustration: subtle, monochromatic SVG (80px × 80px)
  Heading: "No controls yet" (text-lg / 600 / slate-700)
  Description: one sentence explaining what this section does
  CTA: Primary button ("Add your first control")

LOADING STATES:
  Page load: Skeleton screens (animated shimmer)
  Data refresh: Spinner in top-right of section, data fades to 60%
  Button: Spinner replaces left icon, text stays
  Table: 3 skeleton rows with shimmer animation

MODAL / DIALOG:
  Overlay: black/50 backdrop, blur-sm
  Modal: white card, radius-xl, shadow-xl
  Max width: 480px (sm), 640px (md — default), 900px (lg — complex forms)
  Header: title + X close button
  Footer: Cancel (ghost) + Primary action, right-aligned
  ESC to close, click outside to close (unless unsaved changes)

DRAWER / SIDE PANEL:
  Slides from right, width: 480px (sm), 640px (md), 100% (mobile)
  Used for: control detail, evidence detail, AI assistant
  Overlay: black/30 backdrop
  Close: X button top-right or click outside

COMMAND PALETTE (⌘K):
  Full-width modal, top of viewport
  Search input (autofocused)
  Results grouped by type (Controls, Policies, Vendors, Actions)
  Keyboard navigation: arrow keys + Enter
  Recent searches shown when empty
```

### 5.8 Data Visualisation

```
RING CHART (Compliance Score):
  SVG-based donut chart
  Single segment showing % complete
  Centre: percentage + label
  Used on: Dashboard, Framework cards

STACKED BAR (Control Status):
  Horizontal bar, full-width
  Segments: Implemented (emerald) / In Progress (amber) /
            Failing (rose) / Not Started (slate) / N/A (slate-200)
  Tooltips on hover showing count + percentage
  Legend below bar

HEAT MAP (Risk Matrix):
  5×5 grid, cells coloured by risk level
  X-axis: Impact (1–5)
  Y-axis: Likelihood (1–5)
  Cell contains: count of risks in that score
  Click cell: filter risk register to those risks
  Tooltip on hover: list of risk titles

LINE CHART (Compliance Trend):
  Recharts LineChart
  X-axis: time (weeks/months)
  Y-axis: score (0–100%)
  Multiple lines: one per enabled framework
  Tooltip: date + score per framework
  Brush: drag to zoom into date range

AREA CHART (Evidence Collection):
  Shows automated vs manual evidence over time
  Stacked area chart

BAR CHART (Training Completion):
  Grouped bars: assigned vs completed per department
  Or: single bars showing completion % per course

GAUGE (Vendor Risk):
  Half-circle gauge for individual vendor risk score
  Colour zones match risk level colours
```

---

## 6. DARK MODE

### Dark Mode Design Decisions

- **Trigger:** System preference (`prefers-color-scheme: dark`) auto-applied, manual override stored in user settings
- **Implementation:** CSS custom properties (design tokens), class-based toggle on `<html data-theme="dark">`
- **No pure black backgrounds** — dark mode uses slate-950 (`#020617`) not `#000000`
- **Reduced contrast on decorative elements** — borders drop from slate-200 to slate-700; shadows are invisible and replaced by borders

### Dark Mode Token Mappings

```
Token                Light Mode         Dark Mode
────────────────────────────────────────────────────────────
bg-page              slate-50           slate-950
bg-card              white              slate-900
bg-card-hover        slate-50           slate-800
bg-sidebar           white              slate-900
bg-sidebar-active    indigo-50          indigo-950
bg-input             white              slate-900
bg-table-header      slate-50           slate-900
bg-table-row-hover   slate-50           slate-800
bg-table-stripe      slate-50           slate-800/50

border-default       slate-200          slate-700
border-strong        slate-300          slate-600
border-input         slate-300          slate-600
border-input-focus   indigo-600         indigo-400

text-primary         slate-900          slate-50
text-secondary       slate-600          slate-400
text-tertiary        slate-400          slate-500
text-disabled        slate-300          slate-600
text-link            indigo-600         indigo-400
text-brand           indigo-600         indigo-400

icon-primary         slate-700          slate-300
icon-secondary       slate-400          slate-500
icon-brand           indigo-600         indigo-400

score-ring-track     slate-100          slate-700
skeleton-base        slate-200          slate-800
skeleton-highlight   slate-100          slate-700
```

### Dark Mode Component Adjustments

```
SIDEBAR (dark):
  Background: slate-900
  Border: slate-800 (right border)
  Active item: indigo-950 background, indigo-300 text, indigo-600 left border
  Hover item: slate-800 background
  Logo area: indigo-600 logo on slate-900 background

CARDS (dark):
  Background: slate-900
  Border: slate-800
  Shadow replaced by border (shadows invisible on dark backgrounds)
  Metric numbers: white
  Labels: slate-400

BADGES (dark):
  Status badges use darker semantic colours:
  Implemented: emerald-900 bg / emerald-300 text
  Failing: rose-900 bg / rose-300 text
  In Progress: amber-900 bg / amber-300 text

CHARTS (dark):
  Background: slate-900
  Grid lines: slate-700
  Axis text: slate-500
  Tooltip: slate-800 bg / slate-200 text / slate-700 border
  Score ring track: slate-700

TOASTS (dark):
  Background: slate-800 (not semantic-50 — insufficient contrast)
  Border: semantic-500 (left)
  Text: slate-100
```

---

## 7. NAVIGATION ARCHITECTURE

### 7.1 Navigation Hierarchy

```
LEVEL 1: Primary Navigation (Sidebar)
  — Always visible on desktop
  — Collapses to icon-only on mobile / user toggle
  — Grouped into logical sections with section labels

LEVEL 2: Page-Level Navigation (Tabs)
  — Within a page (e.g., Control Detail: Overview | Evidence | History | Comments)
  — Rendered as underline tabs below the page header

LEVEL 3: Contextual Navigation (Breadcrumb)
  — Shows current location within hierarchy
  — Always visible below the top bar

LEVEL 4: In-Page Navigation (Jump links / Anchor tabs)
  — Long-form pages (e.g., Settings) use left-side jump nav
  — Scrollspy highlights current section
```

### 7.2 Top Bar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡]  ComplianceCore    [⌘K Search...]         [🌙] [🔔 3] [?] [Avatar ▾]  │
└──────────────────────────────────────────────────────────────────────────────┘

Elements (left to right):
  — Sidebar toggle: hamburger icon (collapses sidebar)
  — Logo + wordmark: "ComplianceCore" (links to dashboard)
  — Command palette trigger: "Search or press ⌘K" input appearance
  — Dark mode toggle: sun/moon icon
  — Notifications bell: badge count (unread in-app notifications)
  — Help: ? icon → opens documentation / support chat
  — User avatar: dropdown → Profile, Settings, Logout

TENANT SWITCHER (MSP users only):
  Appears between logo and search
  Shows: current client name + chevron → dropdown of all managed clients
  ┌───────────────────┐
  │ Acme Corp       ▾ │
  └───────────────────┘
  Opens portfolio switcher with search

NOTIFICATION PANEL (Bell → slide-down):
  Max height: 400px, scrollable
  Groups: Today / Yesterday / Earlier
  Each notification: icon + title + time + unread dot
  Footer: "Mark all read" | "View all"
```

---

## 8. SIDEBAR DESIGN

### 8.1 Sidebar Anatomy

```
┌────────────────────────────┐
│ ◈  ComplianceCore          │  ← Logo + wordmark (56px)
├────────────────────────────┤
│                            │
│  OVERVIEW                  │  ← Section label (text-xxs / 600 / slate-400 / uppercase)
│ ⬛  Dashboard              │  ← Nav item (active: indigo bg)
│ ◎  AI Assistant     ✨    │
│                            │
│  COMPLIANCE                │
│ ⊞  Frameworks         2  │  ← Badge: count of active frameworks
│ ☑  Controls         ⚠ 3  │  ← Warning badge: failing controls
│ 📁  Evidence Hub           │
│                            │
│  GOVERNANCE                │
│ 📄  Policies          2   │  ← Badge: pending acknowledgments
│ ⚠  Risk Register          │
│ 🏢  Vendors                │
│ 🔍  Audits                 │
│                            │
│  PEOPLE & CULTURE          │
│ 🎓  Training               │
│ 🚨  Incidents              │
│                            │
│  PRIVACY                   │
│ 🗂  ROPA                   │
│ 📬  DSAR Queue        4   │  ← Badge: open DSARs
│ 📋  DPIAs                  │
│                            │
│  ANALYTICS                 │
│ 📊  Reports                │
│ 🔗  Integrations      1   │  ← Badge: integration errors
│                            │
├────────────────────────────┤
│ ⚙  Settings               │  ← Always bottom, above fold
│ ?   Help                   │
│                            │
│ ┌────────────────────────┐ │
│ │ 🔵  Professional Plan  │ │  ← Subscription mini-card
│ │ 42/50 controls used    │ │
│ │ [Upgrade]              │ │
│ └────────────────────────┘ │
└────────────────────────────┘
Width: 240px (expanded), 64px (collapsed — icons only)
```

### 8.2 Sidebar States

```
EXPANDED (240px):
  Icon (20px) + Label + optional badge
  Section labels visible
  Logo + wordmark visible

COLLAPSED (64px — icon-only):
  Icon only (20px), centred
  Section labels hidden
  Logo reduced to icon mark only
  Hover on any icon: tooltip shows label
  Hover on badge item: tooltip shows label + count

MOBILE (< 768px):
  Sidebar hidden off-screen by default
  Open: slides in from left, full height, 280px wide
  Overlay: slate-900/50 backdrop
  Close: tap overlay or X button
  Does NOT collapse to icon mode on mobile — fully open or fully hidden

ACTIVE ITEM STYLING:
  Background: indigo-50 (light) / indigo-950 (dark)
  Left border: 3px solid indigo-600
  Text: indigo-700 (light) / indigo-300 (dark)
  Icon: indigo-600 (light) / indigo-400 (dark)
  Font weight: 600

HOVER ITEM STYLING:
  Background: slate-50 (light) / slate-800 (dark)
  Text: slate-900 (light) / slate-100 (dark)
  Transition: 100ms

BADGE STYLES:
  Alert badge (red): rose-100 bg / rose-700 text
  Count badge (neutral): slate-100 bg / slate-600 text
  New badge (blue): sky-100 bg / sky-700 text
```

### 8.3 MSP Sidebar Additions

```
┌────────────────────────────┐
│ ◈  ComplianceCore          │
│    [Acme Corp         ▾]  │  ← Client switcher (replaces subtitle)
├────────────────────────────┤
│  MSP CONSOLE               │  ← Shown above standard nav
│ ⊡  Portfolio Overview      │
│ 👥  All Clients        15  │
│                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Divider: "Acme Corp workspace"
│                            │
│ [All standard nav items    │
│  scoped to selected client]│
└────────────────────────────┘
```

---

## 9. MOBILE RESPONSIVENESS

### 9.1 Breakpoints

```
xs:   < 480px    — Small phones (iPhone SE)
sm:   480–767px  — Large phones (iPhone 15)
md:   768–1023px — Tablets (iPad portrait)
lg:   1024–1279px — Tablets landscape / Small laptops
xl:   1280–1535px — Laptops, desktops
2xl:  ≥ 1536px   — Wide screens
```

### 9.2 Layout Transformations by Breakpoint

```
SIDEBAR:
  xl+:   Always visible, 240px, pinned
  lg:    Collapsible (toggle), defaults to 64px icon-only
  md:    Hidden, accessible via top-bar hamburger
  sm/xs: Hidden, accessible via bottom nav (mobile) or hamburger

TOP BAR:
  xl+:   Full bar: logo + search + icons + avatar
  md:    Logo + icons + avatar (search hidden, accessible via icon)
  sm:    Logo + bell + avatar (simplified)
  xs:    Logo centred + hamburger left + avatar right

BOTTOM NAV BAR (sm and xs only):
  Fixed bottom, 56px height, 5 tabs:
  [Home] [Controls] [Evidence] [Alerts] [More]
  "More" opens a sheet with remaining navigation

CONTENT LAYOUT:
  xl+:   Multi-column (dashboard: 4 cols, controls: list with detail panel)
  lg:    2-column max, detail panels become drawers
  md:    Single column, detail panels become full-screen overlays
  sm/xs: Single column, simplified table views, cards replace tables

TABLES (mobile transformation):
  xl+:   Full data table with all columns
  lg:    Hide lowest-priority columns (metadata, timestamps)
  md:    Show only: name/title, status badge, owner, action
  sm/xs: Cards instead of table rows:
         ┌─────────────────────────┐
         │ ● CC6.1 Logical Access  │
         │   ISO 27001 · Failing   │
         │   Owner: M. Adeyemi     │
         │   Due: Jun 30  [Edit ›] │
         └─────────────────────────┘

DASHBOARD GRID (metric cards):
  xl+:   4 columns
  lg:    3 columns
  md:    2 columns
  sm/xs: 2 columns (smaller cards) → 1 column (score cards)

MODALS:
  xl+:   Centred overlay, defined max-width
  md:    Centred, wider (90vw)
  sm/xs: Full-screen bottom sheet (slides up from bottom)

SIDEBAR BEHAVIOUR ON MOBILE:
  — Hamburger in top-left opens full sidebar as overlay
  — Tapping any link closes sidebar automatically
  — Bottom nav bar provides quick access to 4 primary sections
```

### 9.3 Touch-Specific Adaptations

```
TOUCH TARGETS:
  Minimum: 44px × 44px (Apple HIG / WCAG 2.5.5)
  Table row height: 52px → 60px on mobile
  Checkbox: 24px → 32px touch zone on mobile
  Buttons: minimum height 44px on mobile

SWIPE GESTURES:
  Sidebar: swipe right from edge → open; swipe left → close
  Table rows: swipe left → reveal action buttons (Edit, Delete)
  Modals / bottom sheets: swipe down → close

LONG PRESS:
  Table row: long press → select mode (shows checkboxes)

SCROLL:
  Pull-to-refresh on list pages
  Infinite scroll option (alternative to pagination) on mobile
```

---

## 10. PAGE INVENTORY & WIREFRAMES

### 10.1 Auth Pages

#### Login Page

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    ◈ ComplianceCore                     │
│                   by ORION SOFT LIMITED                 │
│                                                         │
│              ┌───────────────────────────┐              │
│              │  Sign in to your account  │              │
│              │                           │              │
│              │  Email address            │              │
│              │  ┌─────────────────────┐  │              │
│              │  │ you@company.com     │  │              │
│              │  └─────────────────────┘  │              │
│              │                           │              │
│              │  Password         Forgot? │              │
│              │  ┌─────────────────────┐  │              │
│              │  │ ••••••••••••••      │  │              │
│              │  └─────────────────────┘  │              │
│              │                           │              │
│              │  [ Sign In                ]              │
│              │                           │              │
│              │  ─────────── or ──────────│              │
│              │                           │              │
│              │  [  🔐 Continue with SSO  ]              │
│              │                           │              │
│              │  Don't have an account?   │              │
│              │  Start your free trial →  │              │
│              └───────────────────────────┘              │
│                                                         │
│     © 2027 ORION SOFT LIMITED · Privacy · Terms         │
└─────────────────────────────────────────────────────────┘
```

#### MFA Challenge

```
              ┌───────────────────────────┐
              │  Two-factor verification  │
              │                           │
              │  Enter the 6-digit code   │
              │  from your authenticator  │
              │  app.                     │
              │                           │
              │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
              │  │  │ │  │ │  │ │  │ │  │ │  │  │
              │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │
              │                           │
              │  [ Verify Code            ]
              │                           │
              │  Lost access? Use backup  │
              │  code instead             │
              └───────────────────────────┘
```

---

### 10.2 Onboarding Wizard

```
PAGE: /onboarding

┌─────────────────────────────────────────────────────────────────┐
│ ◈ ComplianceCore                                    Step 2 of 4 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ①─────────②─────────③─────────④                              │
│  Setup     Frameworks   Team       Launch                       │
│                ↑ current                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Which compliance frameworks do you need?                 │  │
│  │  Select all that apply. You can add more later.           │  │
│  │                                                           │  │
│  │  ┌─────────────────┐ ┌─────────────────┐                │  │
│  │  │ ☑ SOC 2 Type I  │ │ ☑ ISO 27001     │                │  │
│  │  │   Most popular  │ │   International  │                │  │
│  │  └─────────────────┘ └─────────────────┘                │  │
│  │  ┌─────────────────┐ ┌─────────────────┐                │  │
│  │  │ □ GDPR          │ │ ☑ NDPR          │                │  │
│  │  │   EU / UK       │ │   Nigeria        │                │  │
│  │  └─────────────────┘ └─────────────────┘                │  │
│  │  ┌─────────────────┐ ┌─────────────────┐                │  │
│  │  │ □ HIPAA         │ │ □ PCI-DSS       │                │  │
│  │  └─────────────────┘ └─────────────────┘                │  │
│  │                                                           │  │
│  │  🤖 Based on your industry (FinTech) and region (Nigeria) │  │
│  │  we recommend: SOC 2, ISO 27001, NDPR                     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                         [← Back]  [Continue →]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 10.3 Main Dashboard

```
PAGE: /dashboard

┌──────┬───────────────────────────────────────────────────────────────────┐
│      │ [≡] ComplianceCore   [⌘K Search...]            [🌙][🔔3][?][●]  │
│ SIDE │─────────────────────────────────────────────────────────────────── │
│  B   │ Dashboard                                         Jun 15, 2027   │
│  A   │─────────────────────────────────────────────────────────────────── │
│  R   │                                                                   │
│      │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│  ⬛  │  │ Total        │ │ Failing      │ │ Evidence     │ │ Vendors  │ │
│  ⊞  │  │ Controls     │ │ Controls     │ │ Expiring     │ │ At Risk  │ │
│  ☑  │  │              │ │              │ │   Soon       │ │          │ │
│  📁  │  │    147       │ │     ⚠ 8     │ │    ⚡ 12    │ │   🔴 3  │ │
│      │  │ ↑ 4 added   │ │ ↑ 2 new     │ │  within 30d  │ │ critical │ │
│  📄  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
│  ⚠  │                                                                   │
│  🏢  │  COMPLIANCE POSTURE ─────────────────────────────────────────────  │
│  🔍  │                                                                   │
│      │  ┌──────────────────────────┐ ┌──────────────────────────────┐   │
│  🎓  │  │ SOC 2 Type II            │ │ ISO 27001:2022                │   │
│  🚨  │  │                          │ │                               │   │
│      │  │    ◉ 87%  Progressing   │ │    ◉ 72%  Needs Attention    │   │
│  🗂  │  │                          │ │                               │   │
│  📬  │  │   42/48 controls         │ │   34/48 controls              │   │
│  📋  │  │   ██████████░░ 87%       │ │   ███████░░░░░░ 72%           │   │
│      │  │   ↑ +5% from last month  │ │   → unchanged                 │   │
│  📊  │  │   Audit: Aug 12, 2027    │ │   Audit: Oct 3, 2027          │   │
│  🔗  │  └──────────────────────────┘ └──────────────────────────────┘   │
│      │                                                                   │
│──────│  ┌──────────────────────────┐ ┌──────────────────────────────┐   │
│  ⚙  │  │ NDPR 2019                │ │ COMPLIANCE TREND              │   │
│  ?   │  │                          │ │ Last 6 months                 │   │
│      │  │    ◉ 94%  Excellent     │ │  100%─────────────────────── │   │
│  ─── │  │                          │ │   80% ──────────SOC 2─────── │   │
│ Pro  │  │   NDPR audit-ready       │ │   60% ─ISO 27001──────────── │   │
│ Plan │  │   ↑ +12% this quarter    │ │   40% ─────────────────────  │   │
│ [↑]  │  └──────────────────────────┘ │  Jan Feb Mar Apr May Jun      │   │
│      │                               └──────────────────────────────┘   │
│      │                                                                   │
│      │  PRIORITY ACTIONS ────────────────────────────────────────────── │
│      │                                                                   │
│      │  ┌───┬────────────────────────────────┬───────────┬──────────┐   │
│      │  │ ⚠ │ CC6.1 — Logical Access failing │ ISO 27001 │ Due 7d ▶ │   │
│      │  │ ⚠ │ MFA policy not acknowledged    │ 8 pending │ Remind ▶ │   │
│      │  │ 📁 │ CloudTrail evidence expiring   │ Expires 3d│ Review ▶ │   │
│      │  │ 🏢 │ Acme Vendor assessment overdue │ 14d over  │ Send  ▶  │   │
│      │  └───┴────────────────────────────────┴───────────┴──────────┘   │
│      │                                       [View all action items →]  │
└──────┴───────────────────────────────────────────────────────────────────┘
```

---

### 10.4 Frameworks Page

```
PAGE: /frameworks

┌─────────────────────────────────────────────────────────────────────────┐
│ Frameworks                              [+ Add Framework]               │
│ 3 active · Last updated Jun 10, 2027                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────┬───────────────────┬───────────────────┐           │
│ │ SOC 2 Type II     │ ISO 27001:2022     │ NDPR 2019         │           │
│ │                   │                   │                   │           │
│ │   ◉ 87%          │   ◉ 72%           │   ◉ 94%           │           │
│ │   Progressing     │   Needs Attention  │   Excellent       │           │
│ │                   │                   │                   │           │
│ │  42/48 controls   │  34/47 controls   │  33/35 controls   │           │
│ │  ↑ +5%/mo         │  → stable         │  ↑ +12%/qtr       │           │
│ │                   │                   │                   │           │
│ │  Implementing  │  Failing            │  Not Started      │           │
│ │  ████████░░  │  ████████░░░░       │  ████████████     │           │
│ │  Audit: Aug 12  │  Audit: Oct 3      │  No audit set     │           │
│ │                   │                   │                   │           │
│ │  [View Controls]  │  [View Controls]  │  [View Controls]  │           │
│ └───────────────────┴───────────────────┴───────────────────┘           │
│                                                                         │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │  🤖 Gap Analysis Available                                          │  │
│ │  We detected 62% overlap between ISO 27001 and SOC 2 controls.     │  │
│ │  Adding HIPAA would require 31 additional controls.                 │  │
│ │                                [Run Gap Analysis →]                 │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ AVAILABLE FRAMEWORKS ─────────────────────────────────────────────────  │
│ [GDPR] [HIPAA] [PCI-DSS] [NIST CSF] [UAE PDPL] [POPIA] [+13 more]     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 10.5 Controls Pages

#### Controls List

```
PAGE: /controls

Controls                                    [Import] [+ Add Control]
SOC 2 Type II · ISO 27001 · NDPR                     147 controls
─────────────────────────────────────────────────────────────────────
[🔍 Search controls...]   [Framework ▾] [Status ▾] [Owner ▾] [···]
─────────────────────────────────────────────────────────────────────
  STATUS SUMMARY:  ▓ 42 Implemented  ░ 28 In Progress  ✕ 8 Failing
                   ○ 61 Not Started  — 8 Not Applicable
─────────────────────────────────────────────────────────────────────
□  STATUS          CONTROL             FRAMEWORK   OWNER        DUE
─────────────────────────────────────────────────────────────────────
□  ● Implemented  CC1.1 Control Env.  SOC 2       M. Adeyemi   —
□  ● Implemented  CC2.1 Communic.     SOC 2       M. Adeyemi   —
□  ⚠ Failing      CC6.1 Logical Acc.  SOC 2·ISO   P. Sharma    ⚠ 7d
□  ◐ In Progress  CC6.2 Access Rev.   SOC 2       C. Beaumont  Jun 30
□  ○ Not Started  A.5.1 Policies      ISO 27001   —            —
□  ● Implemented  SP-4.1 Encryption   NDPR        M. Adeyemi   —
─────────────────────────────────────────────────────────────────────
  Showing 1–50 of 147 · [< 1 2 3 >]        [25 ▾ per page]
```

#### Control Detail

```
PAGE: /controls/[id]

← Controls                                          [Edit] [···]
─────────────────────────────────────────────────────────────────
CC6.1 — Logical and Physical Access Controls
● Implemented                                       Risk Score: 12

[Overview] [Evidence (8)] [Tests (3)] [History] [Comments (2)]
─────────────────────────────────────────────────────────────────

FRAMEWORKS SATISFIED:                 OWNERS:
  [SOC 2 CC6.1]                       Primary:  Michael Adeyemi
  [ISO 27001 A.9.1.1]                 Secondary: Priya Sharma
  [NDPR SP-4.2]                       Reviewer:  Catherine B.

IMPLEMENTATION NOTES:                 NEXT REVIEW:
  Access control policy enforced        June 30, 2027  ⚠ 15 days
  via Okta. MFA required for           LAST TESTED:
  all users. Quarterly reviews          March 15, 2027 ● Pass
  via access review process.

DESCRIPTION (from SOC 2):
  The entity restricts logical access to information assets and
  member systems — including those for in-scope system components,
  information, and systems — to authorised individuals...

──────────────────── EVIDENCE (8 items) ────────────────────────
  □ Okta MFA Configuration Export    ● Current  Auto  Apr 2027
  □ Access Review — Q1 2027         ● Current  Manual Mar 2027
  □ Logical Access Policy v3.2       ● Current  Manual Jan 2027
  □ CloudTrail — IAM Events Log      ⚡ Expires Jun 30
  + 4 more  [View all evidence →]

──────────────────── AI RECOMMENDATIONS ────────────────────────
  🤖 This control has 3 uncollected evidence types. Connect
  your GitHub integration to automatically collect branch
  protection settings as evidence.  [Connect GitHub →]
```

---

### 10.6 Evidence Hub

```
PAGE: /evidence

Evidence Hub                          [Upload Evidence] [Run Collection]
147 artifacts · 8 integrations active · 12 expiring soon
─────────────────────────────────────────────────────────────────────────
[🔍 Search evidence...]  [Source ▾] [Status ▾] [Control ▾] [Expires ▾]

⚠ ATTENTION: 12 evidence items expire within 30 days
[View Expiring Evidence →]

─────────────────────────────────────────────────────────────────────────
□  TITLE                        SOURCE    EXPIRES     CONTROLS  STATUS
─────────────────────────────────────────────────────────────────────────
□  Okta MFA Config Export       🔌 Auto   Never       CC6.1, A9 ● Current
□  CloudTrail IAM Log (Apr 27)  🔌 Auto   ⚡ Jun 30   CC6.1     ● Current
□  Access Review Q1 2027        ✋ Manual  Dec 2027    CC6.1, A9 ● Reviewed
□  Logical Access Policy v3.2   ✋ Manual  Jan 2028    CC6.1     ● Reviewed
□  Pen Test Report 2027         ✋ Manual  ⚡ Jun 28   CC7.2     ⚠ Expiring
□  SOC 2 Bridge Letter 2026     ✋ Manual  ✕ Expired  Multiple  ✕ Expired
─────────────────────────────────────────────────────────────────────────

EVIDENCE COLLECTION STATUS ──────────────────────────────────────────────
  AWS CloudTrail     🔌 Last sync: 2h ago · 42 items · ● Healthy
  Okta               🔌 Last sync: 1h ago · 18 items · ● Healthy
  GitHub             🔌 Last sync: 4h ago ·  8 items · ⚠ 2 failed
  BambooHR           🔌 Last sync: 6h ago · 12 items · ● Healthy
```

---

### 10.7 Policy Management Pages

#### Policies List

```
PAGE: /policies

Policies                                          [+ New Policy]
23 policies · 2 pending approval · 8 pending acknowledgment
──────────────────────────────────────────────────────────────────
[🔍 Search...]  [Type ▾] [Status ▾] [Framework ▾]

□  TITLE                    TYPE       STATUS      ACK    REVIEW
──────────────────────────────────────────────────────────────────
□  Information Security     Policy     ● Published  48/50  Jul 27
□  Acceptable Use Policy    Policy     ● Published  ⚠42/50 Aug 27
□  Incident Response Plan   Procedure  ● Published  50/50  Sep 27
□  Data Retention Policy    Policy     ◐ In Review  —      —
□  Vendor Management Policy Policy     ✎ Draft      —      —
□  Business Continuity Plan Procedure  ✎ Draft      —      —
──────────────────────────────────────────────────────────────────
```

#### Policy Editor

```
PAGE: /policies/[id]/edit

← Policies                              [Save Draft] [Submit for Approval]
─────────────────────────────────────────────────────────────────────────
Information Security Policy                              Version 4 (Draft)

[B] [I] [U] [H1] [H2] [H3] [≡] ["] [🔗] [⊞] [—]       [Word count: 1,247]
─────────────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. PURPOSE AND SCOPE                                                │
│                                                                      │
│  This Information Security Policy establishes the framework for     │
│  protecting [Company Name]'s information assets...                  │
│                                                                      │
│  2. POLICY STATEMENT                                                 │
│                                                                      │
│  [Company Name] is committed to ensuring the confidentiality,       │
│  integrity, and availability of all information assets...           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                                      Saved 12 seconds ago

SIDEBAR (right):
┌────────────────────────┐
│ METADATA               │
│ Owner: M. Adeyemi      │
│ Type: Policy           │
│ Review: 365 days       │
│                        │
│ FRAMEWORKS LINKED      │
│ [SOC 2] [ISO 27001]   │
│                        │
│ CONTROLS LINKED        │
│ CC1.1, A5.1            │
│ [+ Link control]       │
│                        │
│ APPROVAL WORKFLOW      │
│ Stage 1: CISO ○        │
│ Stage 2: CEO  ○        │
│                        │
│ 🤖 AI ASSIST           │
│ [Draft section...]     │
│ [Check completeness]   │
└────────────────────────┘
```

---

### 10.8 Risk Register

```
PAGE: /risks

Risk Register                                     [+ Add Risk]
47 risks · 3 critical · 8 high · 18 medium · 18 low
──────────────────────────────────────────────────────────────────────
[🗺 Heat Map] [📋 List]                    [Owner ▾] [Category ▾]

RISK HEAT MAP VIEW:
                              IMPACT →
              1-Min   2        3-Mod   4        5-Max
        ┌──────────────────────────────────────────────────┐
  5-Max │  emerald│emerald │ amber  │ rose  │  rose   │
        │         │        │        │  [R7] │  [R1]  │
  4     │  emerald│ amber  │ amber  │ rose  │  rose   │
        │         │  [R12] │  [R3]  │       │         │
L 3-Mod │  emerald│ amber  │ amber  │ amber │  rose   │
I       │   [R22] │  [R8]  │  [R5]  │  [R6] │         │
K 2     │  emerald│ emerald│ amber  │ amber │  amber  │
E       │         │        │  [R11] │       │         │
  1-Min │  emerald│ emerald│ emerald│ emerald│ amber  │
        │         │        │        │       │         │
        └──────────────────────────────────────────────────┘

RISK LIST VIEW:
□  TITLE                   CATEGORY   SCORE  TREATMENT  OWNER   STATUS
──────────────────────────────────────────────────────────────────────
□  🔴 Unpatched Servers    Cyber      25     Mitigate   P.S.    Open
□  🔴 No BCP Tested        Operati.   20     Mitigate   M.A.    In Tx
□  🟠 NDPR Non-compliance  Regulat.   15     Mitigate   F.A.    Open
□  🟠 Single DB instance   Operati.   12     Transfer   C.B.    Open
□  🟡 Weak Password Policy Cyber       9     Mitigate   P.S.    Open
```

---

### 10.9 Vendor Management Pages

#### Vendor Registry

```
PAGE: /vendors

Vendors                                           [+ Add Vendor]
34 vendors · 4 critical · 2 overdue assessments
──────────────────────────────────────────────────────────────────────
[🔍 Search...]  [Criticality ▾] [Status ▾] [Assessment ▾]

□  VENDOR          CRITICALITY  RISK   DATA ACCESS  RENEWAL  STATUS
──────────────────────────────────────────────────────────────────────
□  AWS             🔴 Critical   72     Admin        Jan 28   ● Active
□  Okta            🔴 Critical   45     Elevated     Mar 28   ● Active
□  GitHub          🟠 High       38     Standard     Jun 27   ⚠ Review
□  Stripe          🔴 Critical   81     Standard     Aug 27   ● Active
□  BambooHR        🟡 Medium     29     Standard     Dec 27   ● Active
□  Zoom            🟢 Low        15     Limited      Apr 28   ● Active
```

#### Vendor Detail

```
PAGE: /vendors/[id]

← Vendors                                         [Edit] [···]
─────────────────────────────────────────────────────────────────
AWS (Amazon Web Services)                     Risk Score: 72 / 100
🔴 Critical · Elevated Data Access · Subprocessor

[Overview] [Assessments (3)] [Documents (5)] [Contacts] [History]
─────────────────────────────────────────────────────────────────
RISK GAUGE:                    CONTRACT:
  ┌──────────┐                   Renewal: January 15, 2028
  │  ◑  72   │                   DPA Signed: ● Yes
  │  HIGH    │                 COMPLIANCE CERTS:
  └──────────┘                   SOC 2 Type II: ● Valid (Oct 27)
                                 ISO 27001:    ● Valid (Dec 27)

DATA CATEGORIES:               SERVICES:
  PII, Financial, System Logs    Cloud Infrastructure, Storage,
                                 Compute, Identity

LATEST ASSESSMENT: ─────────────────────────────────────────────
  Security Assessment · Submitted Mar 2027 · Score: 76/100
  Reviewer: C. Beaumont · [View Assessment →]

RISK FACTORS:
  ⚠ Single point of failure for all production infrastructure
  ⚠ Cross-border data transfer to US region
  ✓ SOC 2 Type II report current
  ✓ Contractual data processing agreement in place
```

---

### 10.10 Audit Management Pages

#### Audit Engagements List

```
PAGE: /audits

Audit Management                                  [+ New Audit]
6 engagements · 1 in fieldwork · 1 in planning
─────────────────────────────────────────────────────────────────────
[🔍 Search...]  [Type ▾] [Status ▾] [Framework ▾]

□  TITLE                   TYPE      STATUS       DATES        LEAD
─────────────────────────────────────────────────────────────────────
□  SOC 2 Type II - 2027    External  ◐ Fieldwork  Aug 1-15 27  BDO
□  ISO 27001 Stage 1       External  ○ Planning   Oct 1-5 27   BSI
□  Q2 Internal Audit       Internal  ● Closed     Apr 2027     M.A.
□  Readiness Assessment    Readiness ● Closed     Feb 2027     P.S.
```

#### Audit Detail

```
PAGE: /audits/[id]

← Audits                                          [Edit] [Invite Auditor]
─────────────────────────────────────────────────────────────────────────
SOC 2 Type II Audit 2027                       ◐ Fieldwork
External · BDO Accountants LLP
Aug 1 – Aug 15, 2027  (planned)  ·  Controls in scope: 48

[Overview] [Controls (48)] [Evidence Requests (12)] [Findings (3)] [Timeline]
─────────────────────────────────────────────────────────────────────────────

AUDIT TIMELINE:
  ● Planning     June 1                  Complete
  ◐ Fieldwork    Aug 1 – Aug 15          In Progress  ← Now
  ○ Reporting    Aug 16 – Aug 30
  ○ Remediation  Sep 1 – Sep 30
  ○ Closure      Oct 1

FINDINGS SUMMARY:
  🔴 Major Non-conformity   0
  🟠 Minor Non-conformity   2
  🟡 Observation            1

EVIDENCE REQUESTS (12):
──────────────────────────────────────────────────────────────────
  TITLE                    CONTROL   ASSIGNED    DUE     STATUS
──────────────────────────────────────────────────────────────────
  IAM policy document      CC6.1     P. Sharma   Aug 5   ◐ Open
  MFA enforcement proof    CC6.1     M. Adeyemi  Aug 5   ● Done
  Quarterly access review  CC6.2     C. Beaumont Aug 6   ○ Open
──────────────────────────────────────────────────────────────────

AUDITOR PORTAL ACCESS:
  jane.smith@bdo.com      ● Accepted   Aug 1 – Sep 1
  [+ Invite Another Auditor]
```

---

### 10.11 Training Pages

```
PAGE: /training

Training & Awareness                              [+ New Course]
12 courses · 234 assignments · 89% completion rate
──────────────────────────────────────────────────────────────────
[Courses] [Assignments] [Completions] [Reports]

COURSES:
□  TITLE                 TYPE   MANDATORY  ASSIGNED  COMPLETED  DUE
──────────────────────────────────────────────────────────────────
□  Security Awareness    Video  ✓ Yes      50/50     ● 48/50   Jan 28
□  NDPR Data Protection  PDF    ✓ Yes      50/50     ⚠ 38/50   Dec 27
□  Phishing Awareness    Quiz   ✓ Yes      50/50     ⚠ 32/50   ⚠ 5 days
□  ISO 27001 Overview    Video  ○ No       12/50     ● 12/12   —
──────────────────────────────────────────────────────────────────

COMPLETION BY DEPARTMENT:
  Engineering       ██████████░  95%  (20/21)
  Sales             ██████░░░░░  62%  (13/21)
  Finance           ████████░░░  81%  (17/21)
  Operations        ████████████ 100% (12/12)
```

---

### 10.12 Incidents Pages

```
PAGE: /incidents

Incidents                                         [+ Report Incident]
8 incidents · 1 critical · 0 open breaches
──────────────────────────────────────────────────────────────────
[🔍 Search...]  [Severity ▾] [Type ▾] [Status ▾]

□  TITLE                  TYPE      SEVERITY  STATUS     DISCOVERED
──────────────────────────────────────────────────────────────────
□  🔴 DB Config Exposure  Security  Critical  ◐ Investig Jun 10 27
□  🟠 Policy Violation    Policy    High      ● Closed   May 28 27
□  🟡 Phishing Attempt    Security  Medium    ● Closed   May 15 27

──────────── BREACH NOTIFICATION TRACKER ────────────────────────
Active breach incidents will show a 72-hour countdown here.
Currently: No active breach incidents.  ✓ All clear
```

#### Incident Detail (Breach Mode)

```
PAGE: /incidents/[id]  (data breach)

← Incidents                                       [Edit] [Close]
─────────────────────────────────────────────────────────────────
🔴 Database Configuration Exposure
Data Breach · Critical · Under Investigation

┌─────────────────────────────────────────────────────────────┐
│  ⏱  REGULATORY NOTIFICATION DEADLINE                        │
│                                                             │
│        47 : 23 : 10                                         │
│        Hours  Mins  Secs                                    │
│                                                             │
│  GDPR (ICO) — Notify by: Jun 12, 2027 10:00 UTC            │
│  NDPR (NDPC) — Notify by: Jun 15, 2027 00:00 UTC           │
└─────────────────────────────────────────────────────────────┘

AFFECTED:  4,500 data subjects · PII, Email, Partial Card
ROOT CAUSE: Misconfigured S3 bucket ACL exposed config file

RESPONSE CHECKLIST:
  ● Breach contained (DB access revoked)
  ● Internal notification sent to DPO
  ◐ Root cause investigation in progress
  ○ Regulatory notification (ICO) — Due in 47h
  ○ Regulatory notification (NDPC) — Due in 72h
  ○ Data subject notification — Due in 30d
  ○ Post-incident review

[Draft Regulatory Notification →]
```

---

### 10.13 Privacy Management Pages

#### ROPA Register

```
PAGE: /privacy/ropa

Record of Processing Activities (ROPA)           [+ New Entry]
28 processing activities · 4 require DPIA
──────────────────────────────────────────────────────────────────
[🔍 Search...]  [Legal Basis ▾] [Risk ▾]

□  ACTIVITY              LEGAL BASIS   DATA CATEGORIES   DPIA   STATUS
──────────────────────────────────────────────────────────────────────
□  Customer Onboarding   Contract      PII, Financial    ○ No   ● Active
□  Employee Monitoring   Legitimate I. PII, Behaviour    ● Yes  ⚠ Review
□  Marketing Analytics   Consent       PII, Behaviour    ○ No   ● Active
□  Payroll Processing    Legal Obl.    PII, Financial    ○ No   ● Active
```

#### DSAR Queue

```
PAGE: /privacy/dsar

Data Subject Requests                             [+ New DSAR]
12 requests · 4 in progress · 1 approaching deadline
──────────────────────────────────────────────────────────────────
□  REF          TYPE      REQUESTER        STATUS       DEADLINE
──────────────────────────────────────────────────────────────────
□  DSAR-027-001 Access    John Obi         ◐ Progress   ⚠ Jun 20
□  DSAR-027-002 Deletion  Sarah K.         ○ ID Pending Jun 28
□  DSAR-027-003 Access    Ahmed M.         ● Complete   —
□  DSAR-027-004 Port.     Chidi U.         ◐ Progress   Jul 5
```

---

### 10.14 Analytics & Reports

```
PAGE: /reports

Analytics & Reports                          [+ Build Report] [Schedule]
──────────────────────────────────────────────────────────────────────────
[📊 Overview] [📋 Reports] [📅 Scheduled] [📁 Archive]

REPORT TEMPLATES:
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐
│ 📊 Board        │ │ 📋 Audit        │ │ 📁 Evidence     │ │ 🎓 Train │
│ Compliance      │ │ Readiness       │ │ Expiry          │ │ Complet. │
│ Summary         │ │ Report          │ │ Report          │ │ Report   │
│                 │ │                 │ │                 │ │          │
│ [Generate PDF]  │ │ [Generate PDF]  │ │ [Export CSV]    │ │ [Export] │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └──────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ⚠ Risk Register │ │ 🏢 Vendor Risk  │ │ 📄 Policy Ack.  │
│ Summary         │ │ Report          │ │ Status Report   │
│                 │ │                 │ │                 │
│ [Generate PDF]  │ │ [Generate PDF]  │ │ [Export CSV]    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

### 10.15 Integrations

```
PAGE: /integrations

Integration Hub                              [+ Add Integration]
8 active · 1 error · Last sync: 2 hours ago
──────────────────────────────────────────────────────────────────
CONNECTED INTEGRATIONS:
┌──────────────┬───────────┬──────────────┬──────────┬──────────┐
│ AWS          │ Okta      │ GitHub       │ BambooHR │ Jira     │
│ ● 42 items  │ ● 18 items│ ⚠ 2 failed  │ ● 12 itm │ ● 6 itm  │
│ 2h ago      │ 1h ago    │ 4h ago       │ 6h ago   │ 8h ago   │
│ [Configure] │[Configure]│ [Fix →]      │[Config.] │[Config.] │
└──────────────┴───────────┴──────────────┴──────────┴──────────┘

AVAILABLE INTEGRATIONS:
[Azure] [GCP] [GitLab] [Workday] [Jamf] [Intune]
[Slack] [CrowdStrike] [Qualys] [ServiceNow] [+14 more]
```

---

### 10.16 AI Assistant Panel

```
AI ASSISTANT — Slides in from right (480px drawer)

┌──────────────────────────────────────────────────┐
│ 🤖 ComplianceCore AI               [×]          │
│────────────────────────────────────────────────── │
│                                                  │
│ SUGGESTED ACTIONS:                               │
│  [Run gap analysis for ISO 27001]               │
│  [Explain CC6.1 requirement]                    │
│  [Draft Incident Response policy]               │
│  [What's my NDPR posture?]                      │
│                                                  │
│──────────────────────────────────────────────────│
│                                                  │
│  👤 What controls are failing right now?         │
│                                                  │
│  🤖 You have 8 failing controls across your     │
│     active frameworks:                          │
│                                                  │
│     SOC 2 (3 failing):                         │
│     · CC6.1 — Logical Access Controls          │
│     · CC7.2 — System Monitoring               │
│     · CC8.1 — Change Management               │
│                                                  │
│     ISO 27001 (5 failing):                     │
│     · A.9.1.1 — Access Control Policy         │
│     · A.12.6.1 — Vulnerability Management     │
│     · ...3 more                               │
│                                                  │
│     The highest priority is CC6.1, which is    │
│     also linked to an upcoming audit in 47 days.│
│                                                  │
│     [View CC6.1 →]  [Remediation guide →]      │
│                                                  │
│──────────────────────────────────────────────────│
│ ┌────────────────────────────────────────────┐  │
│ │ Ask anything about your compliance...  [↑] │  │
│ └────────────────────────────────────────────┘  │
│  ⚠ AI outputs are suggestions. Always verify.   │
└──────────────────────────────────────────────────┘
```

---

### 10.17 Settings Pages

#### Settings Navigation (left sidebar within settings)

```
PAGE: /settings

Settings
────────────────────────────────────────────────────────────

[LEFT NAV]                   [CONTENT AREA]
─────────────────────        ──────────────────────────────────
ACCOUNT                      Organization Profile
  Organization          ←    ───────────────────────────────────
  Profile & Avatar           Organization Name
  Preferences                ┌────────────────────────────────┐
                             │ Acme Corporation               │
SECURITY                     └────────────────────────────────┘
  Password
  MFA / 2FA                  Industry
  Active Sessions            ┌────────────────────────────────┐
                             │ Financial Services          ▾  │
ACCESS                       └────────────────────────────────┘
  Team Members
  Roles & Permissions        Country / HQ
  SSO Configuration          ┌────────────────────────────────┐
  SCIM Provisioning          │ Nigeria                     ▾  │
  API Keys                   └────────────────────────────────┘

COMPLIANCE                   Logo
  Frameworks                 ┌─────────────────────────────┐
  Notification Rules         │       Upload logo           │
  Evidence Settings          │       [Click to upload]     │
  Review Schedules           └─────────────────────────────┘

BILLING                      Data Residency Region
  Plan & Usage               ┌────────────────────────────────┐
  Payment Method             │ Africa (Lagos)              ▾  │
  Invoices                   └────────────────────────────────┘
  Upgrade Plan
                             [Save Changes]
DEVELOPER
  Webhooks
  Audit Log Export
```

#### Team Members

```
PAGE: /settings/team

Team Members                                     [+ Invite Member]
24 members · 18 active · 2 pending invitations
──────────────────────────────────────────────────────────────────
[🔍 Search by name or email]          [Role ▾] [Status ▾]

□  MEMBER                    ROLE                  STATUS    LAST LOGIN
──────────────────────────────────────────────────────────────────────
□  Michael Adeyemi      [●]  Compliance Manager    ● Active  Today
□  Priya Sharma         [●]  Tenant Admin          ● Active  Yesterday
□  Catherine Beaumont   [●]  Compliance Manager    ● Active  3 days ago
□  David Okonkwo        [●]  Control Owner         ● Active  Jun 12
□  jane@consultant.io        Auditor (Internal)    📧 Invite Pending
──────────────────────────────────────────────────────────────────────
[Change Role ▾] [Deactivate] [Resend Invite]   (when rows selected)
```

---

### 10.18 MSP Console Pages

#### Portfolio Overview

```
PAGE: /msp/portfolio

MSP Console — Portfolio Overview                 [+ Add Client]
15 client organizations
──────────────────────────────────────────────────────────────────────
PORTFOLIO HEALTH SUMMARY:
  ┌────────────────────────────────────────────────────────────────┐
  │  ● 11 Healthy  ⚠ 3 Needs Attention  🔴 1 At Risk             │
  │  Avg. compliance score: 78%  ↑ +4% from last month            │
  └────────────────────────────────────────────────────────────────┘

[🔍 Search clients...]   [Score ▾] [Tier ▾] [Framework ▾]

CLIENT           TIER     SOC2   ISO27001   NDPR   ALERTS  MANAGE
──────────────────────────────────────────────────────────────────
Acme Corp        Pro      87%    —          —      ⚠ 2   [Open ▶]
Zara Finance     Pro      72%    65%        91%    🔴 4   [Open ▶]
Tekton Systems   Starter  54%    —          —      ⚠ 6   [Open ▶]
HealthFirst NG   Enterprise 91%  88%        96%    ✓ 0   [Open ▶]
BuildCo Ltd      Starter  —      —          78%    ⚠ 1   [Open ▶]
──────────────────────────────────────────────────────────────────

ACTIONS NEEDED ACROSS PORTFOLIO:
  🔴 Zara Finance: 4 critical findings, audit in 12 days
  ⚠  Tekton Systems: 6 failing controls, no owner assigned
  ⚠  Acme Corp: 2 policies pending approval
```

---

### 10.19 External Portals

#### Auditor Portal

```
PAGE: /auditor?token=[scoped_token]

┌──────────────────────────────────────────────────────────────────────┐
│ ComplianceCore · Auditor Portal          Acme Corp · SOC 2 Audit 27 │
│ jane.smith@bdo.com                       Access expires: Sep 1, 2027 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ You have been granted read-only access to the following audit scope. │
│                                                                      │
│ CONTROLS IN SCOPE (48)          EVIDENCE REQUESTS (12)              │
│ ──────────────────────          ─────────────────────────           │
│ CC1.1 ● Implemented             [12 requests, 3 fulfilled]          │
│ CC6.1 ⚠ Failing                                                    │
│ CC7.2 ● Implemented             FINDINGS RAISED (3)                 │
│ ... 45 more                     ─────────────────────────           │
│                                 F-001 Minor NC · CC6.1              │
│ EVIDENCE LIBRARY                [+ Raise New Finding]               │
│ ──────────────────────                                              │
│ 42 artifacts available          [Download Audit Package (.zip)]     │
│                                                                      │
│ [Access controls →]   [View evidence →]   [Submit findings →]      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Vendor Portal

```
PAGE: /vendor?token=[scoped_token]

┌──────────────────────────────────────────────────────────────────────┐
│ ComplianceCore · Vendor Assessment Portal           Acme Corp        │
│ Completing: Security Risk Assessment · Due: Jul 15, 2027            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ SECURITY ASSESSMENT FOR: AWS (Amazon Web Services)                   │
│ Completed by: Sarah Johnson · security@aws.com                       │
│ Progress: ████████████████░░░░ 32 / 40 questions  (80%)            │
│                                                                      │
│ SECTION 4: Access Controls                    ──────── 4 of 8 ────  │
│                                                                      │
│ Q4.3 Does your organization enforce MFA for all privileged users?   │
│                                                                      │
│   ● Yes                                                              │
│   ○ No                                                               │
│   ○ Partial                                                          │
│   ○ Not Applicable                                                   │
│                                                                      │
│ Notes (optional):                                                    │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ MFA is enforced via AWS IAM Identity Center for all IAM users  │  │
│ │ with admin or privileged roles...                              │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│              [← Previous]    [Next →]    [Save & Exit]              │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 10.20 Trust Center

```
PUBLIC PAGE: https://trust.compliancecore.io/acme-corp

┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│           [ACME CORP LOGO]    Security & Compliance                  │
│                                                                      │
│  ──────────────────────────────────────────────────────────         │
│                                                                      │
│  CERTIFICATIONS                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ SOC 2 Type II    │ │ ISO 27001:2022    │ │ NDPR Compliant   │    │
│  │ ✓ Valid          │ │ ✓ Valid           │ │ ✓ Compliant      │    │
│  │ Oct 2026         │ │ Nov 2026          │ │ Jan 2027         │    │
│  │ [Download ↓]     │ │ [Download ↓]      │ │ [View Report ↓]  │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│                                                                      │
│  ──────────────────────────────────────────────────────────         │
│                                                                      │
│  UPTIME (last 90 days)                            99.97%            │
│  ██████████████████████████████████████████████░░ 99.97%            │
│                                                                      │
│  SUBPROCESSORS   (12 listed)                                         │
│  AWS · Stripe · Okta · Twilio · and 8 more  [View all →]           │
│                                                                      │
│  ──────────────────────────────────────────────────────────         │
│                                                                      │
│  SECURITY POSTURE                                                    │
│  ✓ Encryption at rest (AES-256)                                     │
│  ✓ Encryption in transit (TLS 1.3)                                  │
│  ✓ Annual penetration testing                                        │
│  ✓ MFA enforced for all staff                                        │
│  ✓ SOC 2 Type II audited infrastructure                             │
│                                                                      │
│              [Request Security Package]   [Contact Security Team]   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. USER FLOWS

### Flow 1 — First-Time SOC 2 Setup (New Customer)

```
[Sign Up Page]
     │  Fill org details + email + password
     ▼
[Email Verification]
     │  Click link in email
     ▼
[Onboarding Step 1: Org Profile]
     │  Company name, industry, size, country
     ▼
[Onboarding Step 2: Framework Selection]
     │  Select SOC 2 Type II (AI recommends based on industry)
     ▼
[Onboarding Step 3: Invite Team]
     │  Invite CISO, CTO, optional team members
     ▼
[Onboarding Step 4: Connect Integrations]
     │  Connect AWS / GitHub / Okta
     │  Skip → continue manually
     ▼
[Onboarding Step 5: Roadmap Generated]
     │  "Your 90-day compliance roadmap is ready"
     │  Shows: 48 controls, 8 policies needed, 5 integrations recommended
     ▼
[Dashboard — First Visit]
     │  Guided tour tooltip sequence (dismissible)
     │  Tooltip 1: "This is your compliance score. Let's get it to 100%."
     │  Tooltip 2: "These are your failing controls. Start here."
     ▼
[Controls Page — Empty State + Onboarding Banner]
     │  "You have 0 controls implemented. Import your SOC 2 control set to begin."
     │  [Import SOC 2 Controls] button
     ▼
[Controls auto-imported from SOC 2 library]
     │  48 controls created, all "Not Started"
     ▼
[Assign owners → Collect evidence → Implement controls → Pass audit]
```

---

### Flow 2 — Policy Acknowledgment (Employee)

```
[Employee receives email]
     │  "Action required: Please acknowledge the Information Security Policy"
     │  Link → /policies/[id]/acknowledge?token=[signed_token]
     ▼
[Policy Acknowledgment Page — No login required if token valid]
     │  Shows: Policy title, version, effective date
     │  Shows: Full policy content (scrollable)
     │  Shows: Scroll-to-bottom enforcement (button unlocks after full scroll)
     ▼
[Acknowledgment Confirmation]
     │  Checkbox: "I confirm I have read and understood this policy"
     │  [Acknowledge Policy] button
     ▼
[Success Screen]
     │  "Thank you. Your acknowledgment has been recorded."
     │  If employee is in ComplianceCore: redirects to dashboard
     │  If external/no account: shows simple success page
     ▼
[Compliance Manager dashboard updates]
     │  Acknowledgment count increases: 43/50 → 44/50
     │  If all acknowledged: control CC1.1 auto-moves to "Implemented"
```

---

### Flow 3 — Evidence Collection via Integration

```
[Integration Engine — Scheduled job: 02:00 UTC daily]
     │
     ▼
[Connect to AWS CloudTrail]
     │  Pull last 24h of API events
     ▼
[Evidence Processor normalises data]
     │  Extracts: IAM changes, MFA events, access grants
     ▼
[Auto-tag to controls]
     │  CloudTrail → CC6.1 (Logical Access)
     │  CloudTrail → CC7.1 (System Operations)
     ▼
[Evidence items created in DB]
     │  evidence_items record: title, hash, storage_key, expires_at
     │  control_evidence link created
     ▼
[Control status re-evaluated]
     │  CC6.1 had no evidence → now has evidence → status update check
     ▼
[Compliance score recalculated]
     │  SOC 2 score: 84% → 86%
     ▼
[Compliance Manager receives in-app notification]
     │  "2 new evidence items collected via AWS integration"
```

---

### Flow 4 — External Auditor Engagement

```
[Compliance Manager]
     │  Creates Audit Engagement (SOC 2, Aug 1–15)
     │  Selects 48 controls in scope
     ▼
[Invite Auditor]
     │  Enters: jane.smith@bdo.com
     │  Sets scope: SOC 2 controls only
     │  Sets expiry: Sep 1, 2027
     ▼
[System sends email to jane@bdo.com]
     │  "You have been invited to review Acme Corp's SOC 2 audit"
     │  Contains: scoped access link (one-time token)
     ▼
[Auditor clicks link → Auditor Portal]
     │  No account creation required
     │  Sees only: scoped controls + evidence + findings
     ▼
[Auditor reviews evidence]
     │  Opens control: CC6.1
     │  Reviews 4 evidence artifacts
     │  All evidence accepted
     ▼
[Auditor raises finding on CC7.2]
     │  Finding type: Observation
     │  Description: System monitoring logs not retained for 12 months
     │  Recommendation: Extend CloudWatch retention to 365 days
     ▼
[Compliance Manager receives alert]
     │  "1 new finding raised by BDO on CC7.2"
     ▼
[Compliance Manager submits management response]
     │  Action plan: Extend CloudWatch retention — P. Sharma — Aug 10
     ▼
[Finding status: Open → In Remediation → Resolved]
     │  Closes within platform before audit report is issued
```

---

### Flow 5 — Data Breach Response

```
[Security team detects breach at 09:00 UTC]
     │
     ▼
[DPO logs incident in ComplianceCore]
     │  Type: Data Breach, Severity: Critical
     │  Discovered: 09:00 UTC Jun 10, 2027
     │  Affected: 4,500 data subjects (PII + Email)
     ▼
[System calculates regulatory deadlines]
     │  GDPR (ICO): 72h → Jun 13, 09:00 UTC ← PRIORITY
     │  NDPR (NDPC): Immediate notification if >1,000 affected ← URGENT
     │  Countdown timer starts on incident detail page
     ▼
[Response workflow activated]
     │  Tasks auto-created:
     │  ○ Legal team notified (action: within 1h)
     │  ○ Contain breach (action: within 2h)
     │  ○ Impact assessment (action: within 4h)
     │  ○ Draft ICO notification (action: within 48h)
     │  ○ Notify affected users (action: within 30d)
     ▼
[DPO drafts notification using AI + template]
     │  Template pre-populated with incident data
     │  Reviews and approves
     ▼
[Notification sent to ICO — Hour 47]
     │  Notification body saved to incident record
     │  Status updated: ICO notified ✓
     ▼
[Incident closed at Hour 96]
     │  Post-incident review scheduled
     │  Root cause linked to CC7.2 control (system monitoring gap)
     │  Control marked "Failing" → triggers remediation workflow
```

---

## 12. INTERACTION PATTERNS

### 12.1 Loading States

```
PATTERN 1 — Skeleton Loading (preferred for lists and tables)
  Show skeleton immediately when navigating to a new page
  Skeleton mirrors the shape of the actual content (not generic blocks)
  Duration: match actual data fetch time (no minimum artificial delay)

PATTERN 2 — Stale-While-Revalidate (preferred for dashboards)
  Show cached/stale data immediately
  Show subtle "Updating..." spinner in top-right of section
  Replace with fresh data when available
  Never show blank/empty while data refreshes

PATTERN 3 — Progressive Loading (for heavy pages)
  Load above-the-fold content first (KPI cards)
  Load below-the-fold (tables, charts) after interaction
  Skeleton placeholder for deferred sections

NEVER:
  — Full-page spinner for navigations between already-loaded data
  — Blocking loaders that prevent interaction with other sections
  — "Loading..." text without visual skeleton
```

### 12.2 Confirmation Patterns

```
SOFT CONFIRM (low-risk, reversible):
  Inline undo toast: "Policy deleted. [Undo]" — 5s timeout
  No modal required
  Examples: soft-delete, unlinking evidence, removing framework

HARD CONFIRM (destructive, irreversible):
  Modal with red warning: "This cannot be undone."
  Requires typing the resource name to confirm
  Examples: permanently deleting a tenant, revoking an API key

SILENT AUTO-SAVE (forms, rich text):
  No modal, no toast for routine saves
  Indicator: "Saved 3 seconds ago" in corner of editor
  Unsaved changes: browser unload warning
```

### 12.3 Filtering & Search Pattern

```
SEARCH:
  Debounced 300ms, searches immediately within loaded data
  Falls back to server search after 300ms if not found client-side
  Results highlight matching text
  Clear search: × button in input

FILTERS:
  Filter pills appear below search when active: [Status: Failing ×]
  Multiple filters: AND logic by default
  Persistent across session (stored in URL params): /controls?status=failing&framework=soc2
  "Clear all filters" link when any filter is active

SORT:
  Click column header to sort: asc → desc → none
  Sort indicator: ▲ / ▼ next to column header
  Persisted per table across sessions (localStorage)

SAVED VIEWS (Phase 2):
  Allow users to save filter+sort combinations as named views
  Accessible from a "Views" dropdown above the table
```

### 12.4 Drag and Drop

```
USED FOR:
  — Dashboard widget reordering (future — Phase 3)
  — Policy approval stage reordering
  — Risk treatment plan step ordering
  — Sidebar custom ordering (future)

PATTERN:
  Drag handle icon (⠿) visible on hover, leftmost column
  Ghost preview shows where item will be dropped
  Drop zone highlighted on drag-over
  Animation: 150ms spring ease for other items moving aside
  Cancelled by: ESC key or release outside valid zone
```

---

## 13. ACCESSIBILITY

### WCAG 2.1 AA Compliance

```
COLOUR CONTRAST:
  Normal text: minimum 4.5:1 ratio
  Large text (18px+ or 14px+ bold): minimum 3:1
  All status colours tested against their backgrounds
  Dark mode contrast independently verified

KEYBOARD NAVIGATION:
  Tab order follows visual reading order (left→right, top→bottom)
  All interactive elements reachable via Tab
  Skip-to-content link: first focusable element on every page
  Modal trap focus within modal while open
  ESC closes modals, drawers, dropdowns
  Arrow keys navigate within menus, select dropdowns, table rows
  Enter/Space activates buttons and links

FOCUS INDICATORS:
  Visible focus ring: 2px solid indigo-600 with 2px offset
  Never hidden/removed (outline: none banned without replacement)
  High-visibility in dark mode: indigo-400

SCREEN READERS:
  All images have descriptive alt text
  Form inputs have associated labels (never placeholder-only)
  Status badges include hidden text: "Status: Implemented" not just "Implemented"
  Data table: <thead>, scope attributes, aria-sort on sortable columns
  Charts: aria-label on SVG elements + data table fallback
  Loading states: aria-live="polite" for dynamic content updates
  Modals: role="dialog", aria-modal="true", aria-labelledby, focus trap

MOTION:
  Respect prefers-reduced-motion: all transitions/animations disabled
  No content flashing at >3 Hz
  Skeleton animation uses fade not strobe

ICONS:
  Icon-only buttons: aria-label="Close modal" (not just the icon)
  Decorative icons: aria-hidden="true"
  Status dot + text (never colour alone for status)
```

---

## 14. DESIGN TOKENS

### Complete Token Reference (CSS Custom Properties)

```css
/* ── Color Tokens ─────────────────────────────────────────────── */

/* Brand */
--color-brand-50:   #EEF2FF;
--color-brand-100:  #E0E7FF;
--color-brand-500:  #6366F1;
--color-brand-600:  #4F46E5;   /* ← Primary interactive */
--color-brand-700:  #4338CA;
--color-brand-900:  #312E81;

/* Semantic */
--color-success:    #059669;   /* emerald-600 */
--color-warning:    #D97706;   /* amber-600 */
--color-danger:     #E11D48;   /* rose-600 */
--color-info:       #0284C7;   /* sky-600 */
--color-ai:         #7C3AED;   /* violet-600 */

/* Surface (light) */
--color-bg-page:        #F8FAFC;
--color-bg-card:        #FFFFFF;
--color-bg-sidebar:     #FFFFFF;
--color-bg-input:       #FFFFFF;

/* Surface (dark) */
--color-bg-page-dark:   #020617;
--color-bg-card-dark:   #0F172A;
--color-bg-sidebar-dark: #0F172A;
--color-bg-input-dark:  #0F172A;

/* Text (light) */
--color-text-primary:   #0F172A;
--color-text-secondary: #475569;
--color-text-tertiary:  #94A3B8;
--color-text-link:      #4F46E5;

/* Text (dark) */
--color-text-primary-dark:   #F1F5F9;
--color-text-secondary-dark: #94A3B8;
--color-text-link-dark:      #818CF8;

/* Borders */
--color-border:         #E2E8F0;
--color-border-strong:  #CBD5E1;
--color-border-dark:    #1E293B;

/* ── Typography Tokens ──────────────────────────────────────────── */

--font-family-sans:  'Inter Variable', 'Inter', system-ui, sans-serif;
--font-family-mono:  'JetBrains Mono', 'Fira Code', monospace;

--font-size-xxs:  0.6875rem;  /* 11px */
--font-size-xs:   0.75rem;    /* 12px */
--font-size-sm:   0.875rem;   /* 14px */
--font-size-md:   1rem;       /* 16px */
--font-size-lg:   1.125rem;   /* 18px */
--font-size-xl:   1.25rem;    /* 20px */
--font-size-2xl:  1.5rem;     /* 24px */

--font-weight-regular:   400;
--font-weight-medium:    500;
--font-weight-semibold:  600;
--font-weight-bold:      700;
--font-weight-extrabold: 800;

--line-height-tight:  1.25;
--line-height-snug:   1.375;
--line-height-normal: 1.5;
--line-height-relaxed: 1.625;

--letter-spacing-tight: -0.025em;
--letter-spacing-normal: 0em;
--letter-spacing-wide:  0.025em;
--letter-spacing-wider: 0.05em;
--letter-spacing-widest: 0.1em;  /* uppercase labels */

/* ── Spacing Tokens ─────────────────────────────────────────────── */

--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */

/* ── Layout Tokens ──────────────────────────────────────────────── */

--sidebar-width:           240px;
--sidebar-width-collapsed: 64px;
--topbar-height:           56px;
--content-max-width:       1280px;
--content-padding:         1.5rem;     /* 24px */
--content-padding-mobile:  0.75rem;   /* 12px */
--card-gap:                1rem;       /* 16px */

/* ── Border Radius Tokens ───────────────────────────────────────── */

--radius-sm:   0.25rem;  /* 4px */
--radius-md:   0.375rem; /* 6px */
--radius-lg:   0.5rem;   /* 8px */
--radius-xl:   0.75rem;  /* 12px */
--radius-2xl:  1rem;     /* 16px */
--radius-full: 9999px;

/* ── Shadow Tokens ──────────────────────────────────────────────── */

--shadow-xs:  0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm:  0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10);
--shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10);
--shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10);
--shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10);

/* ── Animation Tokens ───────────────────────────────────────────── */

--duration-fast:    100ms;
--duration-normal:  150ms;
--duration-slow:    200ms;
--duration-slower:  300ms;
--duration-slowest: 500ms;

--ease-default:  cubic-bezier(0.4, 0, 0.2, 1);  /* ease-in-out */
--ease-in:       cubic-bezier(0.4, 0, 1, 1);
--ease-out:      cubic-bezier(0, 0, 0.2, 1);
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);  /* for confirmations */

/* ── Z-Index Scale ──────────────────────────────────────────────── */

--z-base:       0;
--z-raised:     10;
--z-dropdown:   100;
--z-sticky:     200;
--z-sidebar:    300;
--z-overlay:    400;
--z-modal:      500;
--z-toast:      600;
--z-tooltip:    700;
```

---

## PAGE COUNT SUMMARY

| Section | Pages |
|---|---|
| Auth & Onboarding | 8 pages |
| Dashboard | 2 pages (main + MSP portfolio) |
| Frameworks | 2 pages (list + add) |
| Controls | 3 pages (list + detail + edit) |
| Evidence Hub | 3 pages (hub + detail + upload) |
| Policies | 4 pages (list + editor + version history + employee ack) |
| Risk Register | 3 pages (heat map + list + detail/edit) |
| Vendors | 4 pages (registry + detail + assessment + vendor portal) |
| Audits | 4 pages (list + detail + findings + auditor portal) |
| Training | 3 pages (courses + course detail + completions) |
| Incidents | 3 pages (register + detail + breach workflow) |
| Privacy | 5 pages (ROPA + ROPA detail + DSAR queue + DSAR detail + DPIA) |
| Analytics | 3 pages (overview + report builder + archive) |
| Integrations | 3 pages (hub + config + run history) |
| AI Assistant | 1 panel (global drawer) |
| Settings | 12 sub-pages |
| MSP Console | 3 pages (portfolio + client detail + MSP settings) |
| Trust Center | 1 public page |
| **TOTAL** | **~67 distinct screens** |

---

*Document Version: 1.0*
*Author: Product Design, ORION SOFT LIMITED*
*Classification: CONFIDENTIAL*
*Last Updated: June 15, 2026*

*© 2026 ORION SOFT LIMITED. All rights reserved.*
