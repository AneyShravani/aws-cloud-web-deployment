# AI Lab Maintenance — Cloud Team Handoff & Deployment Guide

> **Audience:** the cloud / DevOps team taking this project to production.
> **Read this file top to bottom before deploying.** It explains what the product is, how it is structured, the login hierarchy and credentials, the environment variables, and exactly what must change for the email service to work in production.
>
> Two files are **NOT** in this Git repo for security reasons (`backend/.env` and `admin/.env`). They will be shared **privately over WhatsApp**. See [§9 Files shared over WhatsApp](#9-files-shared-privately-over-whatsapp).

---

## 1. What is this project?

**AI Lab Maintenance** is a multi-tenant web system that lets a college / institution manage its AI labs end to end:

- Track **labs**, the **systems (machines)** inside each lab, and their occupied/free status.
- Take **access requests** from students/faculty (with an HOD permission letter), approve them, and issue a unique **Access / Reference ID** per project.
- Let approved students **book slots** on lab systems and record **attendance / check-in**.
- Track **AI tool & subscription expenses** and **project utilization** (which project used which tool, is it completed, live URL, deployment status).
- Enforce **access expiry** (each access ID has a validity window) and a **no-show strike system** (repeated no-shows block a student until an admin reactivates them).
- Generate **reports**.

It is **multi-tenant**: each organization (college) only ever sees its own data. This isolation is enforced on every backend query.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend (admin + student portal) | React 18 + Vite, React Router v6, lucide-react icons |
| Backend API | Node.js + Express 5 |
| Database | MongoDB (MongoDB Atlas — cloud-hosted) via Mongoose 9 |
| Auth | JWT (JSON Web Tokens), bcrypt password hashing |
| Email | Nodemailer over SMTP |
| File uploads | Multer (HOD permission letters) |
| PDF | pdfkit (report/export generation) |

**Runtime requirement:** Node.js 18+ (LTS 20 recommended). npm 9+.

The **frontend and the student portal are the same React app** (one build) — the student portal lives under the `/student/*` routes and is shown to users with the `STUDENT` role.

---

## 3. Repository layout

```
ai-lab-maintainence/
├── admin/                → Frontend React app (admin dashboard + student portal)
│   ├── src/
│   │   ├── components/    → Reusable UI (common/, layout/, student/)
│   │   ├── pages/         → One folder per module (see §6)
│   │   ├── services/      → Axios API calls, one file per module
│   │   ├── context/       → Auth + student-access global state
│   │   ├── routes/        → AppRoutes (URL→page) + ProtectedRoute (role gating)
│   │   └── utils/, hooks/
│   ├── .env              → Frontend config (NOT in git — see §8)
│   └── .env.example      → Template for the above
│
├── backend/              → Express API server
│   ├── src/
│   │   ├── config/        → db.js (Mongo), mail.js (SMTP transporter)
│   │   ├── models/        → Mongoose schemas (see §5)
│   │   ├── controllers/   → Request logic, one file per module
│   │   ├── routes/        → API endpoints, one file per module
│   │   ├── middleware/    → auth (JWT), roleCheck, orgIsolation, requireActiveAccess, upload
│   │   ├── services/      → Business logic (auth, email, strikes, reference IDs, bookings…)
│   │   ├── jobs/          → deadlineChecker (scheduled status refresh)
│   │   └── uploads/       → Stored HOD letters (NOT in git; only README kept)
│   ├── .env              → Secrets: Mongo URI, JWT secret, SMTP (NOT in git — see §8)
│   └── .env.example      → Template for the above
│
├── docs/                 → Older spec docs (V1)
├── PROJECT_ARCHITECTURE.md → Original V1 folder map (partly outdated; this file supersedes it)
└── CLOUD_TEAM_HANDOFF.md → THIS FILE
```

---

## 4. Login hierarchy — the three roles

There are **three kinds of login**, all through the same login page (`/login`). The backend decides what each can see based on their `role`.

| Role | Who | What they can do | How the account is created |
|---|---|---|---|
| **SUPER_ADMIN** | The platform owner (ToriiMinds) | Only the **Organizations** module — create a college/org and its one Admin. Cannot see any org's operational data. | Seeded once directly in the database (there is one super-admin account). |
| **ADMIN** | One administrator per organization | **Everything** for their own organization: labs, systems, requests, approvals, bookings, check-in, expenses, utilization, user management, reports. Strictly isolated to their org. | Created by the Super Admin when they create the organization. The system **emails the admin their login + a temporary password**. |
| **STUDENT** | Students/faculty who use the lab | The **student portal** (`/student/*`): raise access requests, book slots, see their access status & strikes, edit profile. | Created by an Admin in **User Management** (or auto-created when an admin approves a request and attaches an email). The system **emails them their login + temporary password**. |

**First login:** every newly-created ADMIN and STUDENT is forced to reset their password on first login (`firstLogin` flag → `/reset-password`).

**Two independent access gates for students:**
1. **Access expiry** — each access/reference ID has an end date. Near expiry the student sees a warning banner; once expired they can only use Requests + Profile.
2. **No-show strikes** — a booked slot the student doesn't show up for = 1 strike. Hitting the admin-configured strike limit **blocks** the account: the student can still *log in* but every module shows "account blocked, contact your admin" until an admin reactivates them (which resets the strike count). A hard **deactivation** by an admin blocks login entirely.

---

## 5. Data model (MongoDB collections)

| Model | Purpose |
|---|---|
| `Organization` | A college/tenant. Root of all data isolation. |
| `AdminUser` | Every login identity (SUPER_ADMIN / ADMIN / STUDENT). Holds password hash, role, orgId, `firstLogin`, strike fields (`strikeLimit`, `strikeCount`, `blockedReason`, `isActive`). |
| `LabUser` | A requester record per access request (name, roll no, department, HOD letter, status PENDING/APPROVED/REJECTED). Linked to an `AdminUser` once they have a login. |
| `Assignment` | **The project + its permanent access/reference ID.** Holds the unique `referenceId`, project `nameKey`, dates, outcome (completed/incomplete), live URL, deployment flag, tool, and full continuation `history[]`. |
| `Booking` | A student's slot booking on a system, plus attendance/check-in + no-show flag (drives strikes). |
| `Lab` / `System` | A lab and the machines inside it. |
| `Expense` | AI tool / subscription cost tracking. |
| `Utilization` | Legacy free-form utilization records (superseded by Assignment outcome fields; kept for history). |
| `SlotConfig` | Per-org slot/booking configuration. |
| `Log` / `Notification` / `Report` | Manual logs, deadline alerts, generated reports. |

---

## 6. Modules (what each screen does)

### Admin portal (role ADMIN — sidebar order)

| Module | Route | What it does |
|---|---|---|
| **Dashboard** | `/dashboard` | Org snapshot: counts of students, systems, tools, expenses, active assignments; per-lab occupancy; Reference-ID lookup (Active / Nearing expiry / Expired). |
| **Labs** | `/labs` | Create & list the org's AI labs; view a lab's details and systems. |
| **Expenses** | `/expenses` | Track AI tools / subscriptions: platform, tool, plan, amount spent (₹), notes; bulk Excel upload; add/edit/delete records. |
| **Utilization** | `/utilization` | Project close-out: mark each project **Completed / Incomplete**, record the tool used, live URL and deployment status; view holder, access-ID window, and outcome in one table. |
| **User Management** | `/users` | Onboard people: create student accounts (emails credentials), resend credentials, activate/deactivate, set the strike limit. Also lists **legacy** approved users who had no login yet and lets the admin **add an email** to create their account. Strikes are shown here. |
| **Requests** | `/requests` | Incoming access requests (with pending-count badge). Open one → review details + HOD letter → approve/reject. Approving issues/continues an access ID. |
| **Approved Users** | `/approved-users` | Consolidated list of everyone granted access (no strike column — that lives in User Management). |
| **Bookings** | `/bookings` | Slot-booking console: see and manage students' system bookings. |
| **Check-in** | `/checkin` | Daily check-in desk — mark attendance for booked slots; no-shows feed the strike system. |
| **Reports** | `/reports` | Generate and view reports. |

### Super Admin portal (role SUPER_ADMIN)

| Module | Route | What it does |
|---|---|---|
| **Organizations** | `/organizations` | Create/list organizations (colleges) and assign each one Admin. The only module a Super Admin sees. |

### Student portal (role STUDENT — `/student/*`)

| Module | Route | What it does |
|---|---|---|
| **Home** | `/student/home` | Overview: access status, near-expiry / expired banners, strike meter (green safe / orange risk / red blocked), quick actions. |
| **My Requests** | `/student/requests` | Raise a new access request (with the project-name continuation flow), track request status. |
| **My Bookings** | `/student/bookings` | Book a slot on a system and see upcoming/past bookings (locked when access expired or account blocked). |
| **Profile** | `/student/profile` | View/edit own profile. |

**Project continuation:** an access ID belongs to a *project*, not a person. Project names are unique per org and follow a strict format (lowercase, hyphen-separated, e.g. `ai-assistance`). When a student types an existing project name, the system offers to **continue** it (same access ID) rather than mint a new one; a finished project can be **reopened for maintenance** on the same ID.

> **Note on legacy routes:** `/assignments`, `/assign/:requestId`, `/logs`, `/logs/history` are older screens kept reachable by URL but intentionally **removed from the navigation**. They are not part of the current flow and can be retired later.

---

## 7. Running it locally (for the cloud team to verify before deploying)

```bash
# 1. Backend
cd backend
npm install
# put the provided backend/.env in this folder (see §8/§9)
npm run dev          # nodemon on http://localhost:5000  (or: npm start)

# 2. Frontend (new terminal)
cd admin
npm install
# put the provided admin/.env in this folder
npm run dev          # Vite dev server on http://localhost:5173

# 3. Production build of the frontend
cd admin
npm run build        # outputs static files to admin/dist/  → serve behind any static host / CDN
```

Backend health check: `GET http://localhost:5000/` returns `BE is running`.

**Background jobs** (started automatically by `backend/src/server.js`, no cron setup needed):
- Booking reconcile sweep — every 2 minutes (auto-marks no-shows / auto-checkout).
- Deadline check — on boot and every 6 hours (refreshes assignment expiry statuses & alerts).

---

## 8. Environment variables

### `backend/.env`

| Variable | Purpose | Production action |
|---|---|---|
| `PORT` | API port (default 5000) | Set to whatever the host expects. |
| `MONGO_URI` | MongoDB Atlas connection string | Use the production database URI. |
| `JWT_SECRET` | Secret used to sign login tokens | **Set a long random string.** Never reuse the dev value. |
| `NEARING_EXPIRY_DAYS` | Days before end-date an access ID counts as "nearing expiry" | Tune if desired (default 7). |
| `SMTP_HOST` | Mail server host | **See §10 — must be set for emails to work.** |
| `SMTP_PORT` | Mail server port (587 typical) | Match the provider. |
| `SMTP_USER` | SMTP username / sender mailbox | See §10. |
| `SMTP_PASS` | SMTP password / app password | See §10. |
| `MAIL_FROM` | "From" address on outgoing emails | See §10. |

### `admin/.env`

| Variable | Purpose | Production action |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend API the frontend calls | **Change** from `http://localhost:5000/api` to the deployed backend URL, e.g. `https://api.yourdomain.com/api`. Must be set **at build time** (Vite inlines it). |

Templates for both files are committed as `backend/.env.example` and `admin/.env.example`.

---

## 9. Files shared privately over WhatsApp

These are **git-ignored on purpose** (they contain secrets) and are sent separately. Place each in the folder shown, then run the app:

| File | Goes in | Contains |
|---|---|---|
| `backend/.env` | `backend/` | Mongo URI, JWT secret, SMTP credentials |
| `admin/.env` | `admin/` | `VITE_API_URL` |

> If HOD permission letters / uploaded files need to be preserved, the `backend/src/uploads/` folder contents are also not in git and would be shared separately or migrated to object storage in production.

---

## 10. Email service — what to change

**Currently used:** the app sends email via **SMTP using Nodemailer**. The transporter is configured in **`backend/src/config/mail.js`**, reading these values from `backend/.env`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` (the "from" address; defaults to `SMTP_USER` if unset, and the `.env.example` shows `noreply@toriiminds.com`).

**Emails the system sends** (defined in `backend/src/services/emailService.js`):
1. **Admin credentials** — when a Super Admin creates an organization.
2. **User (student) credentials** — when an Admin creates/onboards a student.
3. **Password reset OTP** — forgot-password flow.
4. **Request approved** — when a student's access request is approved.

**What the cloud team must change for production email:**
- Set real `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in `backend/.env` for the production mail provider (e.g. company Google Workspace / SendGrid / Amazon SES SMTP).
- Set `MAIL_FROM` to the production sender address (e.g. `noreply@<yourdomain>`), and verify/authenticate that domain (SPF/DKIM) with the provider so mail isn't spam-filtered.
- No code change is required to switch providers — **only the `.env` SMTP values.** If you prefer an API-based provider instead of SMTP, the only file to change is `backend/src/config/mail.js` (the transporter), and everything in `emailService.js` keeps working.

---

## 11. Credentials

> Passwords are **hashed in the database** and are **not stored in this repo**. Fill in the real values below privately (do not commit real production passwords to git). The accounts already exist in the current database.

| Role | Login email | Password |
|---|---|---|
| **Super Admin** (ToriiMinds / platform owner) | `superadmin@ailab.com` | ‹ set / provided by Akhilesh › |
| **Admin — Torii Minds** | `akhilesh.v@ncetmail.com` | ‹ set / provided by Akhilesh › |
| **Admin — Test College** (demo org) | `admin@test.com` | ‹ demo password › |
| **Student — demo (Torii Minds)** | `student@torii.com` | ‹ demo password › |
| **Student — demo (Test College)** | `student@test.com` | ‹ demo password › |

**Akhilesh:** paste the real Super Admin and ToriiMinds Admin passwords into the two `‹ … ›` cells above (or share them with the cloud team over WhatsApp alongside the `.env` files). The `Test College` / demo student rows are throwaway test accounts safe to keep for the cloud team to click around with.

> **Housekeeping:** the database also contains demo/test tenants (`Test College`, and a leftover `__TEST_BOOKING_ORG__`) used during development. These are safe to delete before go-live once the cloud team has finished testing — tell me if you want them removed.

---

## 12. Code audit — what was checked & cleaned before handoff

A full read-only audit was run over `admin/src/` and `backend/src/`.

**Fixed during handoff prep:**
- **Data isolation made consistent.** The `orgIsolation` middleware (forces the org from the JWT, strips any client-supplied `orgId`) is now applied on **all** admin route groups — it was previously omitted on expenses, utilization, dashboard, labs and systems (their controllers already filtered by the logged-in org, so there was no actual leak, but the middleware is now uniform and the misleading "middleware is empty / will crash" comments were removed). Verified: those endpoints still return 200 with correct org-scoped data.
- **Dead code removed.** Deleted two orphaned, unused screens (`StudentSignup.jsx`, `StudentRequestForm.jsx`) left over from before the current student portal. This also removed the only hardcoded `http://localhost:5000` link in the frontend.
- **Personal photos excluded from git** (`permission_images/`, 26 MB — not used by the app).

**Confirmed clean:**
- No hardcoded DB URIs, JWT secrets, or API keys in source — all come from `.env`.
- No `console.log`/`debugger` leftovers in controllers/services (only the DB-connect and startup banners).
- No lorem/placeholder/dummy text shown to end users.
- No broken imports; every route maps to a real controller.

**Minor items left as-is (documented, not blockers):**
- `backend/src/seed.js` and the `migrate*.js` / `backfill*.js` scripts are **one-off developer tools**. They are **not** imported or run by the server (`server.js` only starts the booking-reconcile and deadline-check timers). Do **not** run them against production. `seed.js` contains a throwaway `admin2@example.com / password123` sample — safe because it never runs automatically, but don't seed prod with it.
- `backend/src/config/env.js` is an (unused) stub — there is no fail-fast validation of env vars, so the server will start even if `MONGO_URI`/`JWT_SECRET`/SMTP are missing and only error at runtime. **Double-check all env vars are set before starting in production.**
- Currency conversion (`admin/src/utils/currency.js`) fetches a live USD→INR rate from `api.exchangerate-api.com` (cached 1h). It degrades gracefully — INR entry always works; only $ entry needs the rate and the form blocks submit if it can't load. No action required unless you want to remove the external dependency.

## 13. Pre-handoff checklist (status)

- [x] Frontend production build passes (`npm run build` → `admin/dist/`).
- [x] Backend boots, connects to MongoDB, health endpoint returns 200.
- [x] Org data-isolation middleware applied uniformly; verified via authed API calls.
- [x] Dead code removed; no hardcoded hosts in frontend.
- [x] Secrets (`*.env`) kept out of git; `.env.example` templates committed.
- [x] Personal photos folder (`permission_images/`) kept out of git.
- [ ] Real production `.env` values set by the cloud team (Mongo, JWT, SMTP, API URL).
- [ ] Production SMTP verified (test email received).
- [ ] Demo/test tenants removed after testing (optional).
```
