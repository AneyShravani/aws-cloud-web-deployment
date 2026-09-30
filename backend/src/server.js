

const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { reconcileBookings } = require('./services/bookingService');
const { runDeadlineCheck } = require('./jobs/deadlineChecker');

const PORT = process.env.PORT || 5000;
const RECONCILE_EVERY_MS = 2 * 60 * 1000; // sweep past-due bookings every 2 min
const DEADLINE_EVERY_MS = 6 * 60 * 60 * 1000; // flip assignment statuses every 6h

app.get('/', (req, res) => {
  res.send('BE is running');
});

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port : http://localhost:${PORT}`);
  });

  // Auto-mark no-shows / auto check-out forgotten sessions even if no admin
  // opens a page. Reads also reconcile on demand — this just keeps the DB
  // fresh for reports/overnight. Errors are swallowed so the timer survives.
  setInterval(() => {
    reconcileBookings({}).catch((e) => console.error('Booking reconcile sweep failed:', e.message));
  }, RECONCILE_EVERY_MS);

  // Keep assignment statuses + near-expiry/expired alerts fresh. Run once on
  // boot, then periodically. Errors swallowed so the timer survives.
  runDeadlineCheck().catch((e) => console.error('Deadline check failed:', e.message));
  setInterval(() => {
    runDeadlineCheck().catch((e) => console.error('Deadline check failed:', e.message));
  }, DEADLINE_EVERY_MS);
};

startServer().catch((error) => {
  console.error('❌ Failed to start server');
  console.error(error);
  process.exit(1);
});
