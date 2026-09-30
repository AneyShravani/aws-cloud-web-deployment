// ============================================================
// UTIL: currency
// ------------------------------------------------------------
// Fetches live USD -> INR rate from a free public API and
// converts currency-string cost input ($20, ₹1500) into a
// plain INR number before it's sent to the backend.
// ============================================================

const RATE_CACHE_KEY = 'usdToInrRateCache';
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour - avoid re-fetching on every keystroke/render

export const fetchUsdToInrRate = async () => {
  try {
    const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
      return cached.rate;
    }
  } catch {
    // corrupt cache, ignore and re-fetch
  }

  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  if (!res.ok) throw new Error('Failed to fetch exchange rate');
  const data = await res.json();
  const rate = data.rates?.INR;
  if (!rate) throw new Error('INR rate not found in API response');

  localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() }));
  return rate;
};

export const parseCurrencyToINR = (input, usdToInrRate) => {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  const isDollar = /^\$|USD/i.test(trimmed);
  const numericValue = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
  if (isNaN(numericValue)) return null;

  if (isDollar) {
    if (!usdToInrRate) return null; // rate hasn't loaded yet - caller should block submit
    return numericValue * usdToInrRate;
  }

  return numericValue; // ₹, Rs, INR, or no symbol -> already rupees
};

// True when the raw input is a dollar amount (so the UI can show a live
// "= ₹X" conversion preview only for $ values).
export const isDollarInput = (input) => /^\s*\$|USD/i.test(input || '');

// ------------------------------------------------------------
// Explicit-currency helpers (preferred over guessing from symbols).
// The UI/Excel now say *which* currency an amount is in, so we
// convert deterministically instead of parsing $ / ₹ out of text.
// ------------------------------------------------------------

// Normalise a free-text currency label to 'USD' or 'INR'.
// Blank / unknown defaults to 'INR' (no conversion) — safest.
export const normalizeCurrency = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (['usd', '$', 'dollar', 'dollars', 'us$', 'us dollar', 'us dollars'].includes(s)) return 'USD';
  return 'INR';
};

// Convert a plain numeric amount in a known currency to an INR number.
// Returns null when the amount isn't a valid number >= 0, or when USD is
// requested but the live rate hasn't loaded yet (caller should block submit).
export const toINR = (amount, currency, usdToInrRate) => {
  const n = parseFloat(String(amount ?? '').replace(/[^0-9.]/g, ''));
  if (isNaN(n) || n < 0) return null;
  if (normalizeCurrency(currency) === 'USD') {
    if (!usdToInrRate) return null;
    return n * usdToInrRate;
  }
  return n;
};

// Format a rupee number for display: ₹2,37,000.00 (Indian grouping).
export const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;