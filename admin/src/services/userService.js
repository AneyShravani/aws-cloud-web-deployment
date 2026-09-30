// ============================================================
// SERVICE: userService  (User Management — admin onboards people)
// ------------------------------------------------------------
// getAll()                       -> GET   /api/users
// lookup(email)                  -> GET   /api/users/lookup?email=  (autofill)
// create(payload)                -> POST  /api/users
// resend(id)                     -> POST  /api/users/:id/resend
// setActive(id, bool, strikeLimit) -> PATCH /api/users/:id/active
// payload: { name, email, rollNumber, department, userType, strikeLimit }
// On reactivation, strikeLimit sets a FRESH allowance and resets the count.
// ============================================================
import api from './api';

const userService = {
  getAll: async () => (await api.get('/users')).data,
  lookup: async (email) => (await api.get('/users/lookup', { params: { email } })).data,
  create: async (payload) => (await api.post('/users', payload)).data,
  resend: async (id) => (await api.post(`/users/${id}/resend`)).data,
  setActive: async (id, isActive, strikeLimit) =>
    (await api.patch(`/users/${id}/active`, { isActive, strikeLimit })).data,
  // legacy account-less user → add an email to create their login + email creds
  attachEmail: async (labUserId, email) =>
    (await api.post('/users/attach-email', { labUserId, email })).data,
};

export default userService;
