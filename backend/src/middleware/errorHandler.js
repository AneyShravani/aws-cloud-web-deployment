// ============================================================
// MIDDLEWARE: errorHandler (global, registered LAST in app.js)
// ------------------------------------------------------------
// Catches every thrown/async error and returns a clean JSON:
// { success: false, message }. Hides stack traces in
// production; logs full error on the server.
// ============================================================
