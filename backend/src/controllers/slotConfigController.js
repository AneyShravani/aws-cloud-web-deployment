// ============================================================
// CONTROLLER: slotConfigController  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// Reads/writes the per-lab bookable-day template. GET returns
// the EFFECTIVE config for a lab (its own, else org default,
// else the built-in default). PUT upserts the lab's own config.
// A labId of "default" targets the organization-wide default.
// ============================================================

const SlotConfig = require("../models/SlotConfig");
const bookingService = require("../services/bookingService");
const slot = require("../services/slotService");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function handleError(res, err, fallback) {
    const status = err && err.statusCode ? err.statusCode : 500;
    if (status === 500) console.error(`${fallback}:`, err);
    return res.status(status).json({ success: false, message: err.message || fallback });
}

// GET /api/slot-config/:labId   (labId = "default" for org default)
async function getConfig(req, res) {
    try {
        const labId = req.params.labId === "default" ? null : req.params.labId;
        const config = await bookingService.getEffectiveConfig(req.orgId, labId);
        // Preview the generated slots so the UI can show the grid immediately.
        const slots = slot.generateSlots(config);
        return res.json({ success: true, data: { config, slots } });
    } catch (err) {
        return handleError(res, err, "Could not load slot config");
    }
}

// PUT /api/slot-config/:labId   body: { openTime, closeTime, slotMinutes, breaks, workingDays }
async function upsertConfig(req, res) {
    try {
        const labId = req.params.labId === "default" ? null : req.params.labId;
        const { openTime, closeTime, slotMinutes, breaks, workingDays } = req.body;

        // Validation
        if (openTime && !TIME_RE.test(openTime)) return res.status(400).json({ success: false, message: "openTime must be HH:MM." });
        if (closeTime && !TIME_RE.test(closeTime)) return res.status(400).json({ success: false, message: "closeTime must be HH:MM." });
        if (openTime && closeTime && slot.toMinutes(openTime) >= slot.toMinutes(closeTime)) {
            return res.status(400).json({ success: false, message: "closeTime must be after openTime." });
        }
        if (slotMinutes && (slotMinutes < 15 || slotMinutes > 240)) {
            return res.status(400).json({ success: false, message: "slotMinutes must be between 15 and 240." });
        }
        if (breaks) {
            for (const b of breaks) {
                if (!TIME_RE.test(b.start) || !TIME_RE.test(b.end) || slot.toMinutes(b.start) >= slot.toMinutes(b.end)) {
                    return res.status(400).json({ success: false, message: "Each break needs valid start/end (HH:MM), end after start." });
                }
            }
        }
        if (workingDays && (!Array.isArray(workingDays) || workingDays.some((d) => d < 0 || d > 6))) {
            return res.status(400).json({ success: false, message: "workingDays must be an array of 0–6." });
        }

        const update = { orgId: req.orgId, labId, updatedBy: req.user.id };
        if (openTime !== undefined) update.openTime = openTime;
        if (closeTime !== undefined) update.closeTime = closeTime;
        if (slotMinutes !== undefined) update.slotMinutes = slotMinutes;
        if (breaks !== undefined) update.breaks = breaks;
        if (workingDays !== undefined) update.workingDays = workingDays;

        const config = await SlotConfig.findOneAndUpdate(
            { orgId: req.orgId, labId },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const slots = slot.generateSlots(config);
        return res.json({ success: true, message: "Slot config saved.", data: { config, slots } });
    } catch (err) {
        return handleError(res, err, "Could not save slot config");
    }
}

module.exports = { getConfig, upsertConfig };
