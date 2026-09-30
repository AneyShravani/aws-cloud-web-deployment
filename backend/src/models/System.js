// ============================================================
// MODEL: System  (Module 3.5)
// ------------------------------------------------------------
// One computer inside a lab.
// Fields: labId, orgId, systemNumber/label,
// status: AVAILABLE | OCCUPIED,
// currentAssignmentId (when occupied).
// Occupancy table on the dashboard is computed from these.
// ============================================================

const mongoose = require("mongoose"); 

const systemSchema = new mongoose.Schema(
    {
        labId: {
            type: mongoose.Schema.Types.ObjectId, // points to one Lab document
            ref: "Lab",                           // tells Mongoose which template labId belongs to
            required: true,                       // can't save without a labId
        },
        orgId: {
            type: mongoose.Schema.Types.ObjectId, // points to one Organization document
            ref: "Organization",                  // tells Mongoose which template orgId belongs to
            required: true,                       // can't save without an orgId
        },
        name: {
            type: String,   // unique identifier for the system, e.g. "SYS-001"
            required: true, // can't save without a system name
        },
        status: {
            type: String,                          // AVAILABLE = free, OCCUPIED = assigned to a user
            enum: ["AVAILABLE", "OCCUPIED"],        // only these two values allowed
            default: "AVAILABLE",                   // new systems start out free
        },
        // --- Hardware configuration (filled in when the admin edits a system) ---
        // Systems are created blank via "Add Systems"; these specs are entered on edit.
        deviceName: { type: String, trim: true, default: "" }, // e.g. "CSE", "NCET"
        model: { type: String, trim: true, default: "" },      // e.g. "Dell Vostro 3710"
        processor: { type: String, trim: true, default: "" },  // e.g. "12th Gen Intel Core i7-12700 @ 2.10 GHz"
        ram: { type: String, trim: true, default: "" },        // e.g. "8 GB (7.70 GB usable)"
        ramSpeed: { type: String, trim: true, default: "" },   // e.g. "3200 MT/s"
        graphics: { type: String, trim: true, default: "" },   // e.g. "Intel UHD Graphics 770 – 128 MB"
        storage: { type: String, trim: true, default: "" },    // e.g. "477 GB"
        storageUsed: { type: String, trim: true, default: "" },// e.g. "149 GB" (changes over time)
    },
    {
        timestamps: true, // auto-adds createdAt and updatedAt
    }
);

module.exports = mongoose.model("System", systemSchema); // registers this template as "System"