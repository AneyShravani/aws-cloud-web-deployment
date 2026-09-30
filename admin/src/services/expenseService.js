// ============================================================
// SERVICE: expenseService
// ------------------------------------------------------------
// getAll()            -> GET    /api/expenses
// create(payload)     -> POST   /api/expenses
// update(id, payload) -> PUT    /api/expenses/:id
// remove(id)          -> DELETE /api/expenses/:id
// bulkCreate(items)   -> POST   /api/expenses/bulk  (Excel upload)
// payload/items: { platform, toolName, plan, planType, amountSpent, expirationDate, purpose }
// ============================================================

import api from './api';

const getAll = () => api.get('/expenses');
const create = (payload) => api.post('/expenses', payload);
const update = (id, payload) => api.put(`/expenses/${id}`, payload);
const remove = (id) => api.delete(`/expenses/${id}`);
const bulkCreate = (items) => api.post('/expenses/bulk', { items });

export default { getAll, create, update, remove, bulkCreate };
