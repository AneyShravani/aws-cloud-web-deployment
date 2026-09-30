// ============================================================
// SERVICE: studentService  (the student portal API client)
// ------------------------------------------------------------
// overview()                     -> GET   /api/student/overview  (profile+access+strikes)
// getLabs()                      -> GET   /api/student/labs
// getAvailability(labId, date)   -> GET   /api/student/availability
// getBookings()                  -> GET   /api/student/bookings
// book({ systemId, date, slotStart }) -> POST /api/student/bookings
// cancelBooking(id)              -> PATCH /api/student/bookings/:id/cancel
//
// The gated endpoints return a typed 403 (ACCESS_EXPIRED /
// ACCOUNT_BLOCKED / NO_ACCESS) that the UI surfaces to the student.
// ============================================================
import api from './api';

const studentService = {
  overview: async () => (await api.get('/student/overview')).data,
  getLabs: async () => (await api.get('/student/labs')).data,
  getAvailability: async (labId, date) =>
    (await api.get('/student/availability', { params: { labId, date } })).data,
  getBookings: async () => (await api.get('/student/bookings')).data,
  book: async (payload) => (await api.post('/student/bookings', payload)).data,
  cancelBooking: async (id) => (await api.patch(`/student/bookings/${id}/cancel`)).data,
};

export default studentService;
