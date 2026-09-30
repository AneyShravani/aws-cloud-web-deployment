// ============================================================
// MODEL: Lab  (Module 3.4)
// ------------------------------------------------------------
// An AI lab inside an organization (an org can have many).
// Fields: name, building, floor, labNumber (optional), orgId.
// System count is derived from the System collection (count of
// systems with this labId).
// ============================================================
const mongoose = require('mongoose');

const labSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Building / block the lab sits in (mandatory)
    building: {
      type: String,
      required: true,
      trim: true,
    },
    // Floor the lab is on (mandatory)
    floor: {
      type: String,
      required: true,
      trim: true,
    },
    // Physical lab number/label — optional, blank if the lab has none
    labNumber: {
      type: String,
      trim: true,
      default: '',
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

labSchema.index({ orgId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Lab', labSchema);
