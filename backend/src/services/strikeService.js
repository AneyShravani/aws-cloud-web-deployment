// ============================================================
// SERVICE: strikeService  (No-show "strikes" — behavioural gate)
// ------------------------------------------------------------
// A strike = one booked slot the person never showed up for
// (a booking that reconciles to NO_SHOW). Strikes accumulate on
// the login ACCOUNT (AdminUser), not on a request, so a block
// survives across requests and locks login entirely.
//
// Ownership chain: Booking.labUserId -> LabUser.studentId ->
// AdminUser (the account that carries strikeLimit/strikeCount).
//
// When strikeCount reaches strikeLimit the account is auto-blocked
// (isActive:false, blockedReason:'STRIKES'). Only an admin can
// reactivate it (User Management), which resets the count and sets
// a fresh limit. This is INDEPENDENT of access-window expiry.
// ============================================================

const LabUser = require('../models/LabUser');
const AdminUser = require('../models/AdminUser');

// Resolve the login account that owns a booking, via its LabUser.
async function accountForLabUser(labUserId) {
  if (!labUserId) return null;
  const labUser = await LabUser.findById(labUserId).select('studentId');
  if (!labUser || !labUser.studentId) return null;
  return AdminUser.findById(labUser.studentId);
}

// Charge one no-show strike per booking to the owning account.
// `bookings` = [{ _id, labUserId }]. Multiple no-shows for the same
// person in one pass are aggregated into a single increment. If the
// running count reaches the account's limit, the account is blocked.
// Best-effort per account — a failure on one never blocks the rest.
async function chargeNoShows(bookings = []) {
  if (!bookings.length) return;

  const perLabUser = new Map();
  for (const b of bookings) {
    if (!b.labUserId) continue;
    const key = String(b.labUserId);
    perLabUser.set(key, (perLabUser.get(key) || 0) + 1);
  }

  for (const [labUserId, count] of perLabUser) {
    try {
      const account = await accountForLabUser(labUserId);
      if (!account || account.role !== 'STUDENT') continue;

      account.strikeCount = (account.strikeCount || 0) + count;

      // hit the limit -> auto-block (unless already blocked for some reason)
      if (account.isActive !== false && account.strikeCount >= (account.strikeLimit || 0)) {
        account.isActive = false;
        account.blockedReason = 'STRIKES';
      }
      await account.save();
    } catch (err) {
      console.error('Failed to charge no-show strike:', err.message);
    }
  }
}

// Derive the student-facing strike meter for an account.
//   safe  (green)  — plenty of margin
//   risk  (orange) — <= 2 strikes remaining
//   blocked (red)  — hit the limit (account is blocked)
function strikeStatus(account) {
  const limit = account?.strikeLimit || 0;
  const count = account?.strikeCount || 0;
  const remaining = Math.max(0, limit - count);
  let tone = 'safe';
  if (account?.isActive === false && account?.blockedReason === 'STRIKES') tone = 'blocked';
  else if (remaining <= 2) tone = 'risk';
  return { limit, count, remaining, tone };
}

module.exports = { chargeNoShows, accountForLabUser, strikeStatus };
