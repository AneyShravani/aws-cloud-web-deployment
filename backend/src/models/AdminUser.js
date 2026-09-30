const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'STUDENT'],
      required: true,
    },
    userType: {
      type: String,
      enum: ['student', 'faculty', 'hod', 'hr', 'employee'],
      default: null,
    },
    rollNumber: {
      type: String,
      default: null,
      trim: true,
    },
    department: {
      type: String,
      default: null,
      trim: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    firstLogin: {
      type: Boolean,
      default: true,
    },
    // admin can deactivate an account to block login without deleting history
    isActive: {
      type: Boolean,
      default: true,
    },
    // ---- No-show "strikes" (behavioural gate, independent of access expiry) ----
    // strikeLimit: max no-shows this person is allowed before the account is
    //   auto-blocked. Admin sets it at creation AND again at each reactivation.
    // strikeCount: no-shows accumulated so far (reset to 0 on reactivation).
    // blockedReason: why isActive is false — 'STRIKES' (auto, hit the limit),
    //   'ADMIN' (admin deactivated manually), or 'NONE' (active).
    strikeLimit: {
      type: Number,
      default: 3,
      min: 1,
    },
    strikeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    blockedReason: {
      type: String,
      enum: ['NONE', 'STRIKES', 'ADMIN'],
      default: 'NONE',
    },
    resetPasswordOtpHash: {
      type: String,
      select: false,
      default: null,
    },
    resetPasswordOtpExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AdminUser', adminUserSchema);