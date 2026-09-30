// ============================================================
// ROUTES: /api/student  (logged-in STUDENT self-service portal)
// ------------------------------------------------------------
// Chain: auth -> STUDENT role. Booking endpoints add
// requireActiveAccess, so an expired/blocked student is refused
// at the server, not merely hidden in the UI.
//   GET   /overview            -> profile + access + strikes (ungated)
//   GET   /labs                -> labs to book in            (gated)
//   GET   /availability        -> grid for a lab+date        (gated)
//   GET   /bookings            -> own bookings               (gated)
//   POST  /bookings            -> book a slot                (gated)
//   PATCH /bookings/:id/cancel -> cancel own slot            (gated)
// ============================================================

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const requireActiveAccess = require('../middleware/requireActiveAccess');
const {
  overview,
  labs,
  availability,
  createBooking,
  myBookings,
  cancelBooking,
} = require('../controllers/studentController');

router.use(auth, roleCheck('STUDENT'));

// Always readable — the portal needs it to know how to gate itself.
router.get('/overview', overview);

// Everything below requires a live, valid access pass.
router.get('/labs', requireActiveAccess, labs);
router.get('/availability', requireActiveAccess, availability);
router.get('/bookings', requireActiveAccess, myBookings);
router.post('/bookings', requireActiveAccess, createBooking);
router.patch('/bookings/:id/cancel', requireActiveAccess, cancelBooking);

module.exports = router;
