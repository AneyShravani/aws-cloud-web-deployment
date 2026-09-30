// ============================================================
// UTIL: expiry
// ------------------------------------------------------------
// Derives a tool's expiration status from its expirationDate.
// Status is NOT stored — it's computed at render time so it stays
// correct as days pass:
//   • no date            -> "No expiry"  (neutral)
//   • date in the past   -> "Expired"    (danger)
//   • within 7 days      -> "Near expiry"(warning)
//   • more than 7 days   -> "Active"     (success)
// ============================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const NEAR_EXPIRY_DAYS = 7;

// midnight of the given date, so comparisons are whole-day based
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Returns { key, label, tone, daysLeft } describing the tool's status.
// daysLeft is null when there's no date; negative once expired.
export const getExpiryStatus = (expirationDate) => {
  if (!expirationDate) {
    return { key: 'none', label: 'No expiry', tone: 'neutral', daysLeft: null };
  }

  const expiry = new Date(expirationDate);
  if (Number.isNaN(expiry.getTime())) {
    return { key: 'none', label: 'No expiry', tone: 'neutral', daysLeft: null };
  }

  const daysLeft = Math.round((startOfDay(expiry) - startOfDay(new Date())) / MS_PER_DAY);

  if (daysLeft < 0) {
    return { key: 'expired', label: 'Expired', tone: 'danger', daysLeft };
  }
  if (daysLeft <= NEAR_EXPIRY_DAYS) {
    return { key: 'near', label: 'Near expiry', tone: 'warning', daysLeft };
  }
  return { key: 'active', label: 'Active', tone: 'success', daysLeft };
};

// "12 Aug 2026" style date for display; '' when blank/invalid
export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// YYYY-MM-DD for prefilling a <input type="date">; '' when blank/invalid
export const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// short human hint like "3 days left" / "Expired 2 days ago" / "Expires today"
export const expiryHint = (daysLeft) => {
  if (daysLeft == null) return '';
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
};
