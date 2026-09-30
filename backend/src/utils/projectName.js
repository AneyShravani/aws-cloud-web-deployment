// ============================================================
// UTIL: projectName  (canonical project-name rules)
// ------------------------------------------------------------
// Project names are the permanent, unique key that owns an access
// ID, so they must be deterministic. Rule: lowercase, words joined
// by single hyphens, digits allowed — e.g. "AI Assistance" ->
// "ai-assistance". normalize() is forgiving (fixes spaces/case/
// stray separators); isValid() checks the strict final shape.
// ============================================================

const PROJECT_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXAMPLE = 'ai-assistance';

// Best-effort clean-up of whatever the user typed into the canonical form.
function normalizeProjectName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')      // spaces / underscores -> hyphen
    .replace(/[^a-z0-9-]/g, '')   // drop anything else
    .replace(/-+/g, '-')          // collapse repeats
    .replace(/^-+|-+$/g, '');     // trim leading/trailing hyphens
}

function isValidProjectName(name) {
  return PROJECT_NAME_RE.test(String(name || ''));
}

module.exports = { normalizeProjectName, isValidProjectName, PROJECT_NAME_RE, EXAMPLE };
