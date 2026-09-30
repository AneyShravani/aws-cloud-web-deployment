// ============================================================
// MIDDLEWARE: orgIsolation  ** DATA ISOLATION — CRITICAL **
// ------------------------------------------------------------
// Spec Section 5: one organization's data must NEVER mix
// with another's. This middleware takes orgId from the JWT
// (req.user.orgId) and forces every controller/query to
// filter by it. NEVER trust an orgId sent by the client.

// Runs AFTER auth. Guarantees every request from an Admin has
// a valid orgId attached, and blocks anything without one.
// Also attaches req.orgId as a single, trusted shortcut so
// controllers don't repeat "req.user.orgId" everywhere and
// risk typos or accidentally reading req.body.orgId instead.
//
// IMPORTANT: this does NOT filter your DB queries for you.
// Every controller still MUST use req.orgId (or req.user.orgId)
// in its find/update/delete filters. This middleware only
// guarantees that value exists and is trustworthy — it can't
// reach into your queries and add the filter for you.
// ============================================================

function orgIsolation(req, res, next) {
    // Super Admin has no orgId (operates across all orgs, but only
    // via the Organizations module — never touches org-scoped data)
    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }

    if (!req.user.orgId) {
        return res.status(403).json({
            success: false,
            message: "No organization associated with this account.",
        });
    }

    // trusted shortcut for controllers
    req.orgId = req.user.orgId;

    // SECURITY: if the client tried to sneak an orgId into the body,
    // strip it — orgId must NEVER come from client input, only from
    // the verified JWT payload set by auth middleware.
    if (req.body && req.body.orgId) {
        delete req.body.orgId;
    }

    next();
}

module.exports = orgIsolation;