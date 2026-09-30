// ============================================================
// CONTROLLER: expenseController  (Module 3.3)
// ------------------------------------------------------------
// addExpense       -> add one tool (platform/tool/plan/spend).
// listExpenses     -> full breakdown + computed total.
// updateExpense    -> edit a tool.
// bulkAddExpenses  -> add many at once (Excel upload).
// The UI tracks a single money value (amountSpent); we mirror
// it into `cost` so dashboard/report code that reads `cost`
// keeps working.
// ============================================================

const Expense = require('../models/Expense');

const toMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// normalise a free-text plan-type into the stored enum ('' | MONTHLY | ANNUAL)
const normalizePlanType = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (['monthly', 'month', 'mo', 'm'].includes(s)) return 'MONTHLY';
  if (['annual', 'annually', 'yearly', 'year', 'yr', 'y'].includes(s)) return 'ANNUAL';
  return '';
};

// parse an incoming expiration value (ISO string / Date / Excel-ish string)
// into a Date, or null when blank/invalid
const toDate = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// normalise one incoming row into a valid Expense doc, or return an error string
const buildDoc = (orgId, row) => {
  const platform = String(row.platform || '').trim();
  const toolName = String(row.toolName || '').trim();
  const plan = String(row.plan || '').trim();
  const planType = normalizePlanType(row.planType);
  const purpose = String(row.purpose || '').trim();
  const amount = toMoney(row.amountSpent);
  const expirationDate = toDate(row.expirationDate);

  if (!toolName) return { error: 'tool name is required' };
  if (amount === null) return { error: 'amount spent must be a number ≥ 0' };

  // cost mirrors amountSpent (single money value in the new model)
  return {
    doc: {
      orgId, platform, toolName, plan, planType,
      cost: amount, amountSpent: amount, expirationDate, purpose,
    },
  };
};

// POST /api/expenses
const addExpense = async (req, res) => {
  try {
    const { platform, toolName, plan, planType, amountSpent, expirationDate, purpose } = req.body;
    const { doc, error } = buildDoc(req.user.orgId, { platform, toolName, plan, planType, amountSpent, expirationDate, purpose });
    if (error) return res.status(400).json({ success: false, message: `Invalid expense: ${error}.` });

    const expense = await Expense.create(doc);
    return res.status(201).json({ success: true, expense });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// POST /api/expenses/bulk   { items: [{ platform, toolName, plan, amountSpent, notes }] }
const bulkAddExpenses = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to import.' });
    }
    if (items.length > 500) {
      return res.status(400).json({ success: false, message: 'Too many rows (max 500 per upload).' });
    }

    const docs = [];
    const skipped = [];
    items.forEach((row, i) => {
      const { doc, error } = buildDoc(req.user.orgId, row);
      if (error) skipped.push({ row: i + 1, reason: error });
      else docs.push(doc);
    });

    const inserted = docs.length ? await Expense.insertMany(docs) : [];
    return res.status(201).json({ success: true, added: inserted.length, skipped });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// GET /api/expenses
const listExpenses = async (req, res) => {
  try {
    // Per-org, auth-scoped data must never be served from the browser cache
    // (otherwise a stale/other-account response can be shown after re-login).
    res.set('Cache-Control', 'no-store');

    const expenses = await Expense.find({ orgId: req.user.orgId }).sort({ createdAt: -1 });
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amountSpent || 0), 0);

    return res.status(200).json({
      success: true,
      expenses,
      totalSpent,
      totalCost: totalSpent, // kept for backward-compat consumers
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const { platform, toolName, plan, planType, amountSpent, expirationDate, purpose } = req.body;
    const { doc, error } = buildDoc(req.user.orgId, { platform, toolName, plan, planType, amountSpent, expirationDate, purpose });
    if (error) return res.status(400).json({ success: false, message: `Invalid expense: ${error}.` });

    const { orgId, ...fields } = doc; // don't overwrite orgId
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      fields,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    return res.status(200).json({ success: true, expense });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    return res.status(200).json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  addExpense,
  bulkAddExpenses,
  listExpenses,
  updateExpense,
  deleteExpense,
};
