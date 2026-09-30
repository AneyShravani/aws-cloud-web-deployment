# Reports Module — Requirement (Module 3.8)

> **Owner:** Srushti · **Type:** New module · **Applies to:** Admin (per-organization)
> Read this together with the main spec and `PROJECT_ARCHITECTURE.md`.

---

## 1. What this module is (plain English)

A place where an **Admin** can generate a **detailed report of everything happening in their organization's AI lab** for a chosen time period. Think of it as a *time-scoped, drill-down version of the Dashboard* — instead of "what's true right now," it answers "what happened during these specific days."

The Admin picks a period, clicks **Generate Report**, and sees a full breakdown: which labs were used, which systems, which AI tools/models, which projects and their statuses, how many assignments were issued, how many students were served, and the expenses involved — all limited to the selected period.

---

## 2. Who uses it & the rules

- **Admin only.** Same as every other module. Route guarded by `auth → roleCheck('ADMIN') → orgIsolation`.
- **Organization-scoped.** A report only ever shows the logged-in Admin's own organization's data. Every query filters by `orgId` from the JWT (never from the request body) — same data-isolation rule as the rest of the app.
- **Super Admin does not use this.** (Super Admin only manages organizations.)

---

## 3. The three report types (what the Admin selects)

All three are just **three different ways of choosing a start date and an end date.** Once we have a `[from, to]` range, the report content is generated the exact same way for all three. Build the range logic once, reuse it.

### 3.1 Custom (date range)
- Admin picks a **From date** and a **To date**.
- Range = `From 00:00:00` → `To 23:59:59`.
- Validation: `From` must be on or before `To`.

### 3.2 Weekly
- Admin picks a **month** (year + month) and a **week within that month** (Week 1–5).
- **Recommended week definition (simple, unambiguous):**
  - Week 1 = 1st–7th, Week 2 = 8th–14th, Week 3 = 15th–21st, Week 4 = 22nd–28th, Week 5 = 29th–end of month.
- The chosen week resolves to a `[from, to]` range, then generate as normal.
- *(See Open Question #1 — confirm whether the manager wants this simple definition or true calendar weeks Mon–Sun.)*

### 3.3 Monthly
- Admin picks a **year** and a **month**.
- Range = 1st of that month `00:00:00` → last day of that month `23:59:59`.

> **Design note for Srushti:** Put the "type + selection → `[from, to]`" logic in one place (a `resolveDateRange()` helper in the report service). The three types differ *only* in how they produce the range. Everything after that is shared.

---

## 4. What every report must contain (the analytics)

The manager's ask is "all the analytics this project shows." Below is the concrete list, grouped. Every number/list is **scoped to the selected period** (see Section 5 for what "in the period" means per data type).

### A. Overview (headline numbers)
- Number of **labs** that had activity in the period
- **Systems**: total, in-use during the period, free — and utilization % (`in-use / total`)
- Number of **AI tools/models** in use
- Number of **projects** worked on
- **Assignments** issued, broken down by status: **Active / Nearing expiry / Expired**
- Number of **students/users** served
- **Expenses**: total cost and total spent *(see Open Question #2 — whether expenses are period-scoped or shown as current totals)*

### B. Lab-wise breakdown (one row per lab)
- Lab name
- Total systems / occupied / available (+ "Fully occupied" flag, same rule as Dashboard: available = 0)
- Number of assignments active in this lab during the period
- Number of projects in this lab
- Which tools/models were used in this lab

### C. Systems
- Total systems, how many were in use during the period, how many stayed free
- Overall utilization rate for the period

### D. Tools & Models (from Expenses + Utilization)
- For each tool/model: its **cost**, **amount spent**, **how many projects used it**, **how many students used it**

### E. Projects & Utilization
- A list of projects active in the period, each showing: student, tool/model, project name, **status (done / not done)**, **deployment active / inactive**, and **live URL** (if done)
- Counts: done vs not-done, active vs inactive deployments

### F. Assignments (Reference IDs)
- List of assignments relevant to the period, each showing: **Reference ID**, student, system, lab, project name, start date, end date, and status (Active / Nearing expiry / Expired)
- Counts by status; highlight ones **nearing expiry**

### G. Students / Users
- Total students/users served in the period
- Breakdown **by department** and **by user type** (student / faculty / hod / hr / employee)

---

## 5. How "in the period" is decided per data type (important detail)

A verbal ask glosses over this, but Srushti needs it spelled out. Each data type is filtered into the period differently:

| Data | How to decide it belongs to the period | Notes |
|---|---|---|
| **Assignments** | The assignment's date range **overlaps** the report range: `startDate ≤ to` **AND** `endDate ≥ from` | This is what answers "which lab/system was *in use* during these days." Do **not** just use `createdAt`. |
| **Utilization** | Record's `createdAt` falls within `[from, to]` | Records logged during the period. |
| **Labs / Systems** | Considered "used in the period" if they have an assignment that overlaps the period (per the rule above) | Labs/systems themselves are fairly static. |
| **Students / Users (LabUser)** | Those who have an assignment or utilization record in the period | Count each student once. |
| **Expenses** | **Decision needed** — either expenses `createdAt` within the period, or current running totals | See Open Question #2. |

> Recommendation: use the **overlap** rule for assignments (it's the meaningful one for "what was happening in the lab those days") and `createdAt` for records that are point-in-time events (utilization).

---

## 6. Backend work

Follow the existing module pattern (route → controller → service → models), and reuse existing models — this module mostly **reads and aggregates** data that already exists.

**Files to add:**
- `backend/src/routes/reportRoutes.js` — mounts under `/api/reports`, chain: `auth → roleCheck('ADMIN') → orgIsolation`
- `backend/src/controllers/reportController.js` — thin: validates input, calls the service, returns JSON
- `backend/src/services/reportService.js` — the real work:
  - `resolveDateRange(type, params)` → `{ from, to }` (handles custom / weekly / monthly)
  - `generateReport(orgId, from, to)` → the full analytics object (Sections A–G above)
- Mount in `backend/src/app.js`: `app.use('/api/reports', reportRoutes)`

**Endpoint (recommended, single):**
- `POST /api/reports/generate`
  - body: `{ type: 'custom' | 'weekly' | 'monthly', ...params }`
    - custom → `{ from, to }`
    - weekly → `{ year, month, week }`
    - monthly → `{ year, month }`
  - returns: the full report JSON (overview + all sections)
- Keeping the "week of month" math on the **backend** means the date logic lives in exactly one place.

**Models:** No new model required for V1 — reports are generated **on-demand** from existing collections (Lab, System, Expense, Utilization, LabUser, Assignment). *(Optional future: a `Report` model to save generated reports for history/audit — see Out of Scope.)*

**Reuse:** `referenceIdService.getStatus()` already computes Active / Nearing-expiry / Expired for an assignment — reuse it for the assignment status breakdown instead of re-writing that logic.

---

## 7. Frontend work

**Files to add (follow the `pages/<module>/` pattern):**
- `admin/src/pages/reports/ReportsPage.jsx` — the controls: report-type selector (Custom / Weekly / Monthly) + the matching date pickers + a **Generate Report** button
- `admin/src/pages/reports/ReportView.jsx` — renders the returned report (reuse existing `Card`, `Table`, and the chart components `OccupancyChart` / `ExpenseChart` where they fit)
- `admin/src/services/reportService.js` — one call: `generate(payload)` → `POST /api/reports/generate` (remember: paths are **without** the `/api` prefix now, since `baseURL` already includes it)
- Add a **route** in `admin/src/routes/AppRoutes.jsx`: `/reports`, guarded `allowedRoles={['ADMIN']} blockFirstLogin`
- Add a **"Reports" link** in `admin/src/components/layout/Sidebar.jsx` (Admin section)

**UX behavior:**
- Selecting a report type shows only the relevant inputs (Custom → two date pickers; Weekly → month + week dropdown; Monthly → year + month).
- Clicking **Generate** calls the API and renders the report below.
- Show a clear **"No activity in this period"** empty state when a report comes back with nothing.
- Loading state while generating.

---

## 8. Export

Reports usually need to leave the screen. **Recommended for V1:** an on-screen report plus a **"Download PDF"** (print-friendly layout) button. A **CSV export** of the tables is a nice-to-have. *(Confirm with manager — Open Question #3.)*

---

## 9. Acceptance criteria (how we'll know it's done)

1. An Admin can generate all three report types (Custom / Weekly / Monthly) and each produces a correct `[from, to]` range.
2. Every report shows all sections A–G from Section 4, scoped to the selected period.
3. All data is strictly the Admin's **own organization** — a second org's admin never sees the first org's data in any report.
4. Assignment status counts (Active / Nearing / Expired) match what the Dashboard's Reference ID lookup would say.
5. Picking a period with no activity shows a clean "no activity" state, not an error or a crash.
6. Non-admins / logged-out users cannot reach `/reports` or the `/api/reports` endpoint (401/403).
7. (If export is in scope) the report can be downloaded/printed.

---

## 10. Decisions to confirm with the manager (open questions)

1. **Weekly definition:** simple blocks (1–7, 8–14, …) as recommended, or true calendar weeks (Mon–Sun)?
2. **Expenses in a report:** show only expenses *added during* the period, or the organization's *current running totals*? (Expenses are cumulative by nature, so this matters.)
3. **Export:** is PDF/CSV/print download required for V1, or is on-screen enough for now?
4. **Saved history:** should generated reports be saved (so you can re-open a past report), or is on-demand generation fine for V1?
5. **Empty period:** confirm the "no activity" behavior is acceptable.
6. **Priority KPIs:** are there specific numbers the manager most wants front-and-center (e.g., utilization %, expiring assignments)?

---

## 11. Out of scope for V1 (note, don't build yet)

- Scheduled / auto-emailed reports.
- Super Admin cross-organization reports.
- Saved report history / audit trail (unless Open Question #4 says otherwise).
- Real-time / auto-refreshing reports.
- Charts beyond reusing the existing Dashboard chart components.

---

### Quick summary for Srushti
You're building a **read-only, admin-only, org-scoped Reports module**. The heart of it is: **turn (report type + selection) into a `[from, to]` date range, then aggregate the existing data (labs, systems, tools, projects, assignments, students, expenses) into one detailed report.** Reuse the existing patterns — nothing here needs new data models for V1. Start by nailing the date-range logic and the assignment "overlap" filter; the rest is aggregation and display. Ping me on the six open questions before you start so you're not guessing.
