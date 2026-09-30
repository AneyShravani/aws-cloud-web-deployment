const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    type: {
      type: String,
      enum: ['custom', 'weekly', 'monthly'],
      required: true,
    },
    from: {
      type: Date,
      required: true,
    },
    to: {
      type: Date,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

reportSchema.index({ orgId: 1, generatedAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
