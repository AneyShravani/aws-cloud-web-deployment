// ============================================================
// ROUTES: /api/expenses   (Admin only)
// ------------------------------------------------------------
// Middleware chain: auth -> roleCheck(ADMIN) -> orgIsolation
// GET / , POST / , PUT /:id
// ============================================================

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const orgIsolation = require('../middleware/orgIsolation');

const {
    addExpense,
    bulkAddExpenses,
    listExpenses,
    updateExpense,
    deleteExpense,
} = require('../controllers/expenseController');

router.use(auth, roleCheck('ADMIN'), orgIsolation);

router.get('/', listExpenses);
router.post('/', addExpense);
router.post('/bulk', bulkAddExpenses); // Excel upload -> many expenses
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;