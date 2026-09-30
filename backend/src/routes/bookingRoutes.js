// ============================================================
// ROUTES: /api/bookings   (Slot-Booking Module — v2)
// ------------------------------------------------------------
// All admin-only + org-isolated. Chain: auth → ADMIN → orgIsolation.
//   GET   /availability?labId=&date=  -> system×slot grid for a day
//   POST  /                           -> book one slot
//   POST  /recurring                  -> book a repeating slot series
//   GET   /?date=&labUserId=&referenceId=&labId=  -> console/box reads
//   PATCH /:id/cancel                 -> free a slot
//   PATCH /:id/check-in               -> mark attendance in
//   PATCH /:id/check-out              -> mark attendance out
// ============================================================

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const orgIsolation = require("../middleware/orgIsolation");

const {
    getAvailability,
    createBooking,
    createRecurring,
    cancelBooking,
    checkIn,
    checkOut,
    listBookings,
    lookup,
} = require("../controllers/bookingController");

// every route is admin-only + org-scoped
router.use(auth, roleCheck("ADMIN"), orgIsolation);

router.get("/availability", getAvailability);
router.get("/lookup", lookup);
router.get("/", listBookings);
router.post("/", createBooking);
router.post("/recurring", createRecurring);
router.patch("/:id/cancel", cancelBooking);
router.patch("/:id/check-in", checkIn);
router.patch("/:id/check-out", checkOut);

module.exports = router;
