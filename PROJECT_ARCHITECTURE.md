# AI Lab Maintenance — Project Architecture (V1)

> **For new interns.** This document shows the *folder & file structure only* — no code.
> Read the spec (`AI_LAB_Tracker_V1_DOC.docx`) first, then use this map to know where everything lives.
>
> **Stack (planned):** React (admin dashboard) · Node.js + Express (backend) · MongoDB · Nodemailer (emails)

---

## 1. The Big Picture

```
ai-lab-maintenance/
│
├── admin/         → Frontend: the admin dashboard (what Super Admin & Admin see in browser)
├── backend/       → Backend: API server, database, emails, file uploads, deadline checks
└── docs/          → Project documentation (spec doc, this file)
```

Three roles use the system:

| Role | What they can do |
|---|---|
| **Super Admin** | Only creates organizations (colleges) and assigns 1 Admin per org. Nothing else. |
| **Admin** | Full access to all modules — but *only for their own organization* (data isolation). |
| **User** | Student/faculty/HOD etc. Submits a request (details + HOD letter) → gets a **Reference ID** when a system is assigned. |

---

## 2. `admin/` — Frontend (React Dashboard)

```
admin/
├── public/                          → Static files (favicon, index.html shell)
├── src/
│   │
│   ├── assets/                      → Images, logos, icons used across the app
│   │
│   ├── components/                  → Reusable UI building blocks (used by many pages)
│   │   ├── common/                  → Generic pieces: Button, Table, Modal, Card, StatusBadge, Loader
│   │   ├── layout/                  → App frame: Sidebar (role-based menu), Navbar, PageLayout
│   │   └── charts/                  → Charts for dashboard: occupancy bars, expense breakdown pie
│   │
│   ├── pages/                       → One folder per module (screens the user navigates to)
│   │   │
│   │   ├── auth/
│   │   │   ├── Login                → Login screen (Super Admin & Admin)
│   │   │   └── ResetPassword       → Forced password reset on Admin's FIRST login
│   │   │
│   │   ├── organizations/           → ★ SUPER ADMIN ONLY
│   │   │   ├── OrganizationList     → View all colleges/organizations
│   │   │   └── CreateOrganization   → Create org + enter Admin's email (system emails credentials)
│   │   │
│   │   ├── dashboard/               → Module 3.1 — the central snapshot
│   │   │   ├── Dashboard            → Aggregated stats: students, systems, tools, expenses, active assignments
│   │   │   ├── OccupancyTable       → Per-lab: total / occupied / available systems + "Fully occupied" flag
│   │   │   └── ReferenceIdLookup    → Admin enters a Reference ID → shows Active / Nearing expiry / Expired
│   │   │
│   │   ├── labs/                    → Module 3.4 — Lab Creation
│   │   │   ├── LabList              → All labs of this organization
│   │   │   └── CreateLab            → Add a new AI lab
│   │   │
│   │   ├── infrastructure/          → Module 3.5 — Systems per lab
│   │   │   ├── SystemList           → Systems inside a selected lab (with occupied/free status)
│   │   │   └── AddSystems           → Define how many systems a lab has
│   │   │
│   │   ├── expenses/                → Module 3.3 — AI tools & costs
│   │   │   ├── ExpenseList          → All tools/models with cost & spend (full breakdown)
│   │   │   └── AddExpense           → Add a tool/model + its cost
│   │   │
│   │   ├── utilization/             → Module 3.6 — Who uses what
│   │   │   ├── UtilizationList      → Student → tool → project, status (done/not done), live URL, active/inactive
│   │   │   └── UtilizationForm      → Add/update a utilization record
│   │   │
│   │   └── users/                   → Module 3.7 + Section 4 — the core workflow
│   │       ├── RequestList          → Pending user requests (name, roll no, dept, project, duration, HOD letter)
│   │       ├── RequestDetail        → View one request + uploaded HOD letter → "Assign User" button
│   │       ├── AssignSystem         → Shows AVAILABLE labs & systems → Admin picks one → Reference ID generated
│   │       └── AssignmentList       → All active/expired assignments with their Reference IDs
│   │
│   ├── services/                    → All API calls to the backend (one file per module)
│   │   ├── api                      → Axios base setup (backend URL, attaches auth token)
│   │   ├── authService              → login, reset password
│   │   ├── organizationService      → org CRUD (Super Admin)
│   │   ├── dashboardService         → stats, occupancy, reference ID lookup
│   │   ├── labService               → labs CRUD
│   │   ├── systemService            → systems CRUD
│   │   ├── expenseService           → expenses CRUD
│   │   ├── utilizationService       → utilization CRUD
│   │   └── assignmentService        → user requests, assign system, reference IDs
│   │
│   ├── context/                     → Global state (logged-in user, role, organization)
│   │   └── AuthContext              → Who is logged in? Super Admin or Admin? Which org?
│   │
│   ├── routes/                      → Navigation & access control
│   │   ├── AppRoutes                → Maps URLs → pages
│   │   └── ProtectedRoute           → Blocks pages by role (Super Admin can't see Admin modules & vice-versa)
│   │
│   ├── utils/                       → Small helpers
│   │   ├── constants                → Role names, status labels (ACTIVE / NEARING_EXPIRY / EXPIRED)
│   │   ├── dateHelpers              → Duration & deadline calculations, "nearing expiry" logic
│   │   └── validators               → Form validation (email, required fields, dates)
│   │
│   ├── App                          → Root component (wraps routes + context)
│   └── main                         → Entry point (mounts React app)
│
├── .env                             → Frontend config (backend API URL) — never commit real values
└── package.json                     → Frontend dependencies & scripts
```

---

## 3. `backend/` — API Server (Node.js + Express)

```
backend/
├── src/
│   │
│   ├── config/                      → App configuration
│   │   ├── db                       → MongoDB connection
│   │   ├── env                      → Loads & validates environment variables
│   │   └── mail                     → Email (SMTP/Nodemailer) setup — used to send Admin credentials
│   │
│   ├── models/                      → Database schemas (the shape of our data)
│   │   ├── Organization             → College/org: name, assigned admin — ROOT of data isolation
│   │   ├── AdminUser                → Super Admin & Admin accounts: email, password, role, orgId, firstLogin flag
│   │   ├── Lab                      → An AI lab: name, orgId, total systems
│   │   ├── System                   → A computer in a lab: labId, status (occupied/available)
│   │   ├── Expense                  → AI tool/model: name, cost, amount spent, orgId
│   │   ├── LabUser                  → The requester: name, roll no, department, HOD letter file path
│   │   ├── Assignment               → ★ THE REFERENCE ID lives here: user + system + project + start/end date + status
│   │   ├── Utilization              → student → tool → project, done/not done, live URL, active/inactive
│   │   └── Notification             → "Deadline approaching" alerts shown to Admin
│   │
│   ├── controllers/                 → The logic for each request (one file per module)
│   │   ├── authController           → Login, first-login password reset
│   │   ├── organizationController   → Create org, assign admin, trigger credentials email (Super Admin)
│   │   ├── dashboardController      → Aggregate stats, per-lab occupancy, Reference ID status check
│   │   ├── labController            → Create/list labs
│   │   ├── systemController         → Define systems per lab, occupied/available counts
│   │   ├── expenseController        → Add tools, costs, expense breakdown totals
│   │   ├── utilizationController    → Track project usage, status, live URLs
│   │   └── assignmentController     → User request intake, assign system, generate Reference ID
│   │
│   ├── routes/                      → URL endpoints → controllers (one file per module)
│   │   ├── authRoutes               → /api/auth/...
│   │   ├── organizationRoutes       → /api/organizations/...   (Super Admin only)
│   │   ├── dashboardRoutes          → /api/dashboard/...
│   │   ├── labRoutes                → /api/labs/...
│   │   ├── systemRoutes             → /api/systems/...
│   │   ├── expenseRoutes            → /api/expenses/...
│   │   ├── utilizationRoutes        → /api/utilization/...
│   │   └── assignmentRoutes         → /api/assignments/...
│   │
│   ├── middleware/                  → Code that runs BEFORE controllers (security gates)
│   │   ├── auth                     → Verifies login token (JWT) on every protected request
│   │   ├── roleCheck                → Super Admin vs Admin permission enforcement
│   │   ├── orgIsolation             → ★ DATA ISOLATION: forces every query to filter by the admin's orgId
│   │   ├── upload                   → Handles HOD letter file uploads (multer)
│   │   └── errorHandler             → Catches all errors → clean JSON responses
│   │
│   ├── services/                    → Business logic shared across controllers
│   │   ├── emailService             → Sends login ID + password to newly assigned Admins
│   │   ├── referenceIdService       → Generates Reference IDs; computes Active / Nearing expiry / Expired
│   │   └── notificationService      → Creates "deadline approaching" notifications for the Admin panel
│   │
│   ├── jobs/                        → Scheduled background tasks
│   │   └── deadlineChecker          → Cron job: runs daily, finds assignments nearing/past end-date → notifies
│   │
│   ├── utils/                       → Small helpers
│   │   ├── generatePassword         → Random temp password for new Admins
│   │   └── validators               → Request body validation rules
│   │
│   ├── uploads/                     → Stored HOD letters (uploaded documents)
│   │
│   ├── app                          → Express app setup: middleware + all routes wired together
│   └── server                       → Entry point: starts the server, connects DB, starts cron jobs
│
├── .env                             → Secrets: DB URL, JWT secret, SMTP credentials — never commit
└── package.json                     → Backend dependencies & scripts
```

---

## 4. Module → Folder Cheat Sheet

| Spec Module | Frontend (`admin/src/pages/`) | Backend (controller/route) | Owner |
|---|---|---|---|
| 3.2 Organizations | `organizations/` | `organizationController` | Super Admin | -->Srushti
| 3.1 Dashboard | `dashboard/` | `dashboardController` | Admin | --> Krishna
| 3.3 Expenses | `expenses/` | `expenseController` | Admin |--> Krishna
| 3.4 Lab Creation | `labs/` | `labController` | Admin | -->Srushti
| 3.5 Infrastructure / Systems | `infrastructure/` | `systemController` | Admin | --> sravani
| 3.6 Utilization | `utilization/` | `utilizationController` | Admin | --> sravani
| 3.7 Users & Assignment | `users/` | `assignmentController` | Admin | --> sravani

---

## 5. The Core Workflow (Section 4 of the spec) — Where It Happens

1. **User request comes in** (name, roll no, dept, project, duration, HOD letter)
   → stored via `assignmentController` + `upload` middleware → `LabUser` model + `uploads/`
2. **Admin reviews** → `pages/users/RequestList` → `RequestDetail` → clicks **"Assign User"**
3. **System shows available labs & systems** → `pages/users/AssignSystem` (data from `systemController`)
4. **Admin assigns one system** → `Assignment` created, `System` marked occupied
5. **Reference ID generated** → `referenceIdService` (carries project purpose + start/end dates)
6. **Deadline nears** → `jobs/deadlineChecker` → `notificationService` → alert on Admin dashboard
7. **User returns** → Admin checks ID in `pages/dashboard/ReferenceIdLookup`:
   **Active** → allow · **Nearing expiry** → follow up · **Expired** → deny

---

## 6. Two Rules That Must Never Break

1. **Data isolation** — every backend query for labs, systems, expenses, users, assignments MUST be filtered by the Admin's `orgId` (`middleware/orgIsolation`). One college must never see another college's data.
2. **Role separation** — Super Admin sees ONLY the Organizations module; Admin sees everything EXCEPT Organizations (`middleware/roleCheck` + frontend `ProtectedRoute`).
