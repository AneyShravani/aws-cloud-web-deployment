// ============================================================
// SERVICE: bookingService  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// getAvailability(labId, date) -> GET  /bookings/availability
// list(params)                 -> GET  /bookings
// create(payload)              -> POST /bookings
// createRecurring(payload)     -> POST /bookings/recurring
// cancel(id)                   -> PATCH /bookings/:id/cancel
// checkIn(id) / checkOut(id)   -> PATCH /bookings/:id/check-in|out
// (baseURL already includes /api)
// ============================================================
import api from './api';

const bookingService = {
    getAvailability: async (labId, date) =>
        (await api.get('/bookings/availability', { params: { labId, date } })).data,

    lookup: async (referenceId) =>
        (await api.get('/bookings/lookup', { params: { referenceId } })).data,

    list: async (params = {}) => (await api.get('/bookings', { params })).data,

    create: async (payload) => (await api.post('/bookings', payload)).data,

    createRecurring: async (payload) => (await api.post('/bookings/recurring', payload)).data,

    cancel: async (id) => (await api.patch(`/bookings/${id}/cancel`)).data,

    checkIn: async (id) => (await api.patch(`/bookings/${id}/check-in`)).data,

    checkOut: async (id) => (await api.patch(`/bookings/${id}/check-out`)).data,
};

export default bookingService;
