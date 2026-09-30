# Slot-Booking Assignments — Requirement & Blueprint (Module 3.7, v2)

> **Owner:** Akhilesh · **Type:** Major rework of the Assignments module · **Applies to:** Admin (per-organization)
> Replaces the "one system permanently occupied per user" model with a **time-sliced slot-booking system**.
> Read together with the main spec and `REPORTS_MODULE_REQUIREMENT.md` (Reports consumes this data).

---

## 1. Why we're changing it

Today an `Assignment` claims **one `System` for a whole date range** and flips it `OCCUPIED` until it expires. If the user doesn't show up, the machine sits idle but unbookable — wasted capacity.

**New model:** a system's day is divided into **1-hour slots**. Users book the specific slots they need, on the systems and days they need them. A system is only "busy" for the exact hours it's actually booked; every other slot stays open for someone else.

Example grid (default): **09:00–16:00, 1-hour slots, 12:00–13:00 lunch** →
`09–10 · 10–11 · 11–12 · 13–14 · 14–15 · 15–16` = **6 bookable slots per system per day.**

---

## 2. Decisions locked (confirmed)

1. **Slot grid is per-lab configurable** — each lab defines its own hours / slot length / breaks / working days, with an org default. Availability is always *computed* from the template.
2. **Admin-only booking** — all booking happens at the admin desk via the console + the ID-lookup box. Students receive an ID and (read-only) can see their bookings; they do **not** self-book.
3. **Booking-native check-in** — check-in/out is a one-click action on a booking that stamps real timestamps and flips status. **This replaces the old manual typed login/logout `Log`.**
4. **Recurring bookings supported** — admin can book a repeating slot (e.g. "System 2, 10–11, every working day until end date") in one action, auto-skipping already-taken slots.

## 3. Proposed defaults to confirm (smaller calls)

| # | Decision | Proposed default |
|---|---|---|
| D1 | **Persistent ID** | The `referenceId` becomes **one ID per approved user** (their access pass), used for all their bookings. Not per-booking. |
| D2 | **Bookings must sit inside the approval window** | Yes — a booking's `date` must be within the user's approved `startDate…endDate`. |
| D3 | **Self-conflict rule** | A user cannot hold two systems in the same slot on the same day. |
| D4 | **No-show handling** | A booking not checked-in by the end of its slot is auto-flagged `NO_SHOW` by the deadline job (the slot is not retroactively freed; it just reports the waste). |
| D5 | **Timezone / day boundary** | `Asia/Kolkata` (IST). All `date` normalization and slot times use it. |
| D6 | **Legacy data** | Existing `Assignment` rows stay as historical umbrellas (their `systemId` is preserved but no longer required going forward). No slot backfill. |
| D7 | **Cancellation** | Admin can cancel a `BOOKED`/`CHECKED_IN` slot; it flips to `CANCELLED` and the slot re-opens immediately. Cancelled rows are kept for history/reporting. |

---

## 4. Data model

### 4.1 `SlotConfig` (new) — the per-lab template
Stored once per lab (with an org-level default fallback). Slots are **generated from this, never stored per-day**, so editing it reshapes all *future* availability instantly. Past bookings are unaffected (they carry their own denormalized times).

```
SlotConfig {
  orgId, labId,                          // labId null = org default
  openTime: "09:00", closeTime: "16:00",
  slotMinutes: 60,
  breaks: [{ start: "12:00", end: "13:00" }],
  workingDays: [1,2,3,4,5,6],            // 0=Sun … 6=Sat (Mon–Sat by default)
  updatedBy, timestamps
}
```

### 4.2 `Booking` (new) — the atomic reservation
```
Booking {
  orgId, labId, systemId, labUserId,     // who + where
  assignmentId,                          // link to the approval umbrella (§4.3)
  date: Date,                            // normalized to IST midnight
  slotStart: "09:00", slotEnd: "10:00",  // denormalized → clean, stable history
  status: BOOKED | CHECKED_IN | COMPLETED | NO_SHOW | CANCELLED,
  actualCheckIn: Date, actualCheckOut: Date,
  bookedBy: AdminUser, timestamps
}
```
**Integrity:**
- Unique **partial** index `(systemId, date, slotStart)` where `status ≠ CANCELLED` → double-booking is physically impossible and race-safe (the DB rejects the second writer, same pattern as the current atomic `findOneAndUpdate`).
- Booking creation is validated against: approval window (D2), self-conflict (D3), working-day + valid-slot (from `SlotConfig`).

### 4.3 `Assignment` (repurposed) — the "approval umbrella"
Keeps the request→approval two-step (Reports/Dashboard/Logs anchor to it). Changes:
- **`referenceId` = the user's persistent access ID** (D1).
- **`systemId` no longer required** (the specific systems now live on each `Booking`). Kept nullable for legacy rows (D6).
- Retains `labUserId`, `projectName`, `startDate`, `endDate` (the permission window), `status`, `orgId`.

### 4.4 `System` (redefined status)
`status AVAILABLE | OCCUPIED` stops being a permanent flag. It now means **"occupied right now"** — recomputed from whether a live (`CHECKED_IN`/`BOOKED`) booking covers the current time. Occupancy everywhere is derived from `Booking`, not a stored flag.

---

## 5. Availability algorithm (single source of truth)

`getAvailability(labId, date)` →
1. Load the lab's `SlotConfig` (or org default).
2. If `date`'s weekday ∉ `workingDays` → no slots.
3. Generate the ordered slot list from `open/close/slotMinutes` minus `breaks`.
4. Load all non-cancelled `Booking`s for every system in the lab on that `date`.
5. Return a grid: **for each system × each slot → free, or the booking (user, status).**

This one function powers the day grid, the ID-lookup box's "today's available slots", recurring-booking conflict checks, and Reports' utilization math.

---

## 6. The two core admin flows

### 6.1 Booking console (the new Assignments page)
- **Day grid**: rows = systems in the selected lab, columns = slots, for a chosen date. Free = clickable green; booked = filled with the user's name + status chip.
- **Date navigator**: ◀ / Today / ▶ / jump-to-date → past, present, future in one view.
- **Book**: click a free cell → pick the approved user (search by name or ID) → confirm. Or **recurring**: pick user + slot + "repeat every working day until <end>" → creates the series, skipping taken slots, and reports what it skipped.
- **Cancel**: click a booked cell → cancel (frees it immediately, D7).

### 6.2 The ID box (daily walk-up)
Admin types the user's ID →
- shows the user + approval window + their upcoming bookings,
- shows **today's available slots**, and
- lets the admin book more and **check them in** for the slot they're here for.

---

## 7. Module rewiring (what changes elsewhere)

| Module | Change |
|---|---|
| **Dashboard occupancy** | Compute "busy now" from live bookings; add **today's slot-utilization %** (booked slots ÷ capacity). |
| **Dashboard reference lookup** | Becomes the ID box (§6.2): user + their bookings + today's availability, not one static system. |
| **Logs / attendance** | Superseded by booking check-in/out (real timestamps + status). Old `Log` writes retire; the Logs page reads booking attendance. |
| **Reports** | Stronger inputs: real per-slot usage, no-show rate, per-system/day utilization. "In use during period" = a booking exists in the range (more precise than date-range overlap). Coordinate with `REPORTS_MODULE_REQUIREMENT.md`. |
| **Utilization** | Unchanged structurally (per person/project). |
| **Student portal / email / notifications** | On approval the student gets their **one ID** (email carries it). Student portal shows their bookings read-only. |
| **deadlineChecker job** | Also flips past-due un-checked-in bookings to `NO_SHOW` (D4). |

---

## 8. API surface (proposed)

```
# Config
GET   /api/slot-config/:labId            → effective config (lab or org default)
PUT   /api/slot-config/:labId            → update lab grid

# Availability + bookings
GET   /api/bookings/availability?labId=&date=     → the system×slot grid
POST  /api/bookings                      → { labUserId, systemId, date, slotStart }  (single)
POST  /api/bookings/recurring            → { labUserId, systemId, slotStart, from, to }  (series)
PATCH /api/bookings/:id/cancel
PATCH /api/bookings/:id/check-in
PATCH /api/bookings/:id/check-out
GET   /api/bookings?date=  | ?labUserId= | ?referenceId=   → console / box queries
```
All admin routes keep the existing `auth → roleCheck('ADMIN') → orgIsolation` chain and derive `orgId` from the JWT.

---

## 9. Frontend (follows `pages/<module>/` pattern)

- `pages/bookings/BookingConsole.jsx` + `.css` — the day grid + date nav + book/recurring/cancel (this replaces `AssignmentList` / `AssignSystem` as the Assignments section).
- `pages/bookings/BookingGrid.jsx` — the systems × slots grid cell component.
- `pages/bookings/RecurringBookingModal.jsx`, `pages/bookings/BookSlotModal.jsx`.
- `pages/bookings/IdLookupBox.jsx` — the walk-up box (can also live on the dashboard).
- `pages/settings/SlotConfig.jsx` — per-lab grid editor.
- `services/bookingService.js`, `services/slotConfigService.js`.

---

## 10. Build phases

1. **Data + engine** — `SlotConfig`, `Booking`, repurpose `Assignment`; availability algorithm; booking create (single + recurring + race-safe) / cancel; validation rules.
2. **Booking console UI** — day grid, date nav, book/recurring/cancel, user search.
3. **ID box + check-in/out** — walk-up lookup, native attendance; retire manual Log writes.
4. **Rewire Dashboard** — occupancy-now + today's utilization + the reference box.
5. **Reports hooks** — booking-level analytics (coordinate with Srushti).
6. **Per-lab SlotConfig editor** + polish, empty/loading/error states, responsive.

---

## 11. Acceptance criteria

1. A system's day shows 6 (default) slots; each is independently bookable and never double-books (concurrent attempts → exactly one wins).
2. Admin can book a single slot and a recurring series (auto-skipping taken slots, reporting skips) within the user's approval window.
3. One user ID pulls up that user's window + all their bookings; today's available slots are bookable from the box.
4. Check-in/out stamps real times and drives attendance; no-shows are flagged.
5. Dashboard occupancy reflects *live* usage and today's utilization %.
6. Reports numbers are derived from real bookings and match the console.
7. All data strictly org-scoped; non-admins can't reach any booking route.
8. The console is fully responsive with proper empty/loading/error states.

---

## 12. Open questions still to confirm
- D1–D7 above (defaults proposed).
- Reports coordination: which booking-level KPIs Srushti wants surfaced.
- Whether the SlotConfig editor ships in v1 or a fixed default is fine to start (grid stays configurable in the model either way).
