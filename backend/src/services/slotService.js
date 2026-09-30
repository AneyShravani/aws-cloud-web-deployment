// ============================================================
// SERVICE: slotService  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// The single source of truth for all time/day math:
//  - generateSlots(config)   -> ordered 1-hour (or N-min) slots
//                               for a day, with breaks removed.
//  - parseDateOnly("YYYY-MM-DD") -> UTC-midnight Date (the stable
//                               calendar-day key stored on Booking).
//  - IST helpers (todayYMD / nowHHMM) for "today"/"now" checks
//    used by check-in and no-show logic.
//
// Timezone: the app operates in IST (Asia/Kolkata, UTC+05:30).
// A calendar day is stored as UTC-midnight of that Y-M-D, and
// every read/write goes through parseDateOnly, so the key is
// deterministic regardless of server locale. "Now" checks shift
// the clock by +05:30 to read IST wall-clock time.
// ============================================================

const IST_OFFSET_MIN = 330; // +05:30

// ---- string <-> minutes helpers --------------------------------
function toMinutes(hhmm) {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + m;
}

function toHHMM(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---- slot generation -------------------------------------------
// Returns [{ index, start, end }] for a whole day, skipping any
// slot that overlaps a break. A slot is included only if it fits
// wholly inside [openTime, closeTime].
function generateSlots(config) {
    const open = toMinutes(config.openTime);
    const close = toMinutes(config.closeTime);
    const len = Number(config.slotMinutes) || 60;
    const breaks = (config.breaks || []).map((b) => ({
        s: toMinutes(b.start),
        e: toMinutes(b.end),
    }));

    const slots = [];
    let index = 0;
    for (let t = open; t + len <= close; t += len) {
        const start = t;
        const end = t + len;
        const overlapsBreak = breaks.some((b) => start < b.e && end > b.s);
        if (overlapsBreak) continue;
        slots.push({ index: index++, start: toHHMM(start), end: toHHMM(end) });
    }
    return slots;
}

// Look up a single slot's { start, end } by its start string,
// validating it's a real slot in this config. Returns null if not.
function findSlot(config, slotStart) {
    return generateSlots(config).find((s) => s.start === slotStart) || null;
}

// ---- date-only (calendar day) helpers --------------------------
// Accepts "YYYY-MM-DD" (preferred) or a Date/ISO string; returns a
// Date at UTC-midnight of that calendar day. Throws on garbage.
function parseDateOnly(input) {
    if (input instanceof Date && !isNaN(input.getTime())) {
        return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
    }
    const str = String(input || "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!m) {
        const err = new Error("Invalid date. Expected YYYY-MM-DD.");
        err.statusCode = 400;
        throw err;
    }
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (isNaN(d.getTime())) {
        const err = new Error("Invalid date.");
        err.statusCode = 400;
        throw err;
    }
    return d;
}

function ymd(date) {
    return new Date(date).toISOString().slice(0, 10);
}

// 0 = Sunday … 6 = Saturday, read from the UTC-midnight key.
function weekdayOf(date) {
    return new Date(date).getUTCDay();
}

function isWorkingDay(config, date) {
    const days = config.workingDays && config.workingDays.length ? config.workingDays : [1, 2, 3, 4, 5, 6];
    return days.includes(weekdayOf(date));
}

// ---- "now" in IST ----------------------------------------------
// A Date whose UTC fields read the IST wall-clock, so slicing its
// ISO string yields IST Y-M-D / HH:MM.
function nowIST() {
    return new Date(Date.now() + IST_OFFSET_MIN * 60000);
}

function todayYMD_IST() {
    return nowIST().toISOString().slice(0, 10);
}

function nowHHMM_IST() {
    return nowIST().toISOString().slice(11, 16);
}

// Combine a calendar day (UTC-midnight key) with an IST wall-clock "HH:MM"
// into the correct UTC instant, so it displays back as that time in IST.
function istTimeToInstant(dateOnly, hhmm) {
    const d = new Date(dateOnly);
    const [h, m] = String(hhmm).split(":").map(Number);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - IST_OFFSET_MIN * 60000);
}

module.exports = {
    IST_OFFSET_MIN,
    toMinutes,
    toHHMM,
    generateSlots,
    findSlot,
    parseDateOnly,
    ymd,
    weekdayOf,
    isWorkingDay,
    nowIST,
    todayYMD_IST,
    nowHHMM_IST,
    istTimeToInstant,
};
