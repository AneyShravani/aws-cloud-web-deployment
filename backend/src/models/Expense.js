// ============================================================
// MODEL: Expense  (Module 3.3)
// ------------------------------------------------------------
// One AI tool/model the lab pays for, described the way it
// comes from the finance sheet:
//   platform       -> the provider (e.g. Anthropic, Google)
//   toolName       -> the product used (e.g. Claude, Google Flow)
//   plan           -> the plan/items (e.g. "3 pro and 1 max")
//   planType       -> MONTHLY | ANNUAL (optional billing cadence)
//   amountSpent    -> total spent on it (INR)
//   expirationDate -> when the tool/subscription expires (drives status)
//   purpose        -> why the tool was bought (was "notes")
// `cost` is kept (mirrored to amountSpent on write) so the
// dashboard/reports that read it keep working — the UI now
// tracks a single money value ("Total amount spent").
// ============================================================

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    platform: {
      type: String,
      trim: true,
      default: '',
    },
    toolName: {
      type: String,
      required: true,
      trim: true,
    },
    plan: {
      type: String,
      trim: true,
      default: '',
    },
    // Optional billing cadence — '' when not specified
    planType: {
      type: String,
      enum: ['', 'MONTHLY', 'ANNUAL'],
      default: '',
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    amountSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    // When the tool/subscription expires. Optional at the schema level so
    // legacy rows and bulk imports without a date still save; the UI derives
    // Active / Near expiry / Expired / No expiry from this.
    expirationDate: {
      type: Date,
      default: null,
    },
    // Why the tool was purchased (renamed from `notes`)
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Expense', expenseSchema);