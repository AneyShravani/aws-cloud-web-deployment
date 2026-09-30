// ============================================================
// MODEL: Utilization  (Module 3.6)
// ------------------------------------------------------------
// Tracks real usage: which student uses which tool for
// which project. Fields: orgId, labUserId, toolName/expenseId,
// projectName, status: DONE | NOT_DONE,
// liveUrl (when done), deploymentActive: true | false.
// ============================================================

const mongoose = require('mongoose'); // import mongoose to define schema/model

const utilizationSchema = new mongoose.Schema({
    orgId: {
        type: mongoose.Schema.Types.ObjectId, // reference to Organization
        ref: 'Organization', // links to Organization model
        required: true, // data isolation rule
    },
    labUserId: {
        type: mongoose.Schema.Types.ObjectId, // reference to LabUser
        ref: 'LabUser', // which student this record belongs to
        required: true,
    },
    toolName: {
        type: String, // e.g. "ChatGPT", "Claude"
        required: true,
        trim: true, // removes extra spaces
    },
    projectName: {
        type: String, // project the student is working on
        required: true,
        trim: true,
    },
    status: {
        type: String, // done / not_done
        enum: ['done', 'not_done'], // only these two values allowed
        default: 'not_done',
    },
    liveUrl: {
        type: String, // deployed link, only exists if status is 'done'
        trim: true,
        default: null,
    },
    isActive: {
    type: Boolean,
    default: false, // must be explicitly earned — can't be active before it's done
    },
}, {
    timestamps: true, // adds createdAt, updatedAt automatically
});

module.exports = mongoose.model('Utilization', utilizationSchema); // export model