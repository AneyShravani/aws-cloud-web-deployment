// ============================================================
// UTILS: dateHelpers
// ------------------------------------------------------------
// Date/duration helpers used across pages:
// - formatDate(), daysBetween()
// - isNearingExpiry(endDate)  (within NEARING_EXPIRY_DAYS)
// - isExpired(endDate)
// ============================================================

// Formats an ISO date string (e.g. "2026-07-29T00:00:00.000Z") into "DD-MM-YYYY"
// for display in tables. Keep raw ISO strings in state/API — only format at render time.
export function formatDate(isoString) {
    if (!isoString) return "-";                          // guard against null/undefined
    const date = new Date(isoString);                     // parse the ISO string
    if (isNaN(date)) return "-";                           // guard against invalid dates
    const day = String(date.getDate()).padStart(2, "0");   // 2-digit day
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 2-digit month (0-indexed, so +1)
    const year = date.getFullYear();                       // 4-digit year
    return `${day}-${month}-${year}`;                       // e.g. "29-07-2026"
}