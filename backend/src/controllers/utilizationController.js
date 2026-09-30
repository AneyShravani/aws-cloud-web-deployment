// ============================================================
// CONTROLLER: utilizationController  (Module 3.6)
// ------------------------------------------------------------
// addRecord    -> student + tool + project entry.
// listRecords  -> all utilization rows for the org.
// updateRecord -> mark done / add live URL /
//                 toggle deployment active-inactive.
// SECURITY FIX: addUtilization now verifies labUserId belongs
// to an Assignment in this org before creating the record —
// closes cross-org data leak (previously accepted any
// labUserId from req.body with no ownership check).
// ============================================================

const Utilization = require('../models/Utilization');
const Assignment = require('../models/Assignment'); // NEW: needed to verify labUserId belongs to this org

// Shared validation — keeps addUtilization and updateStatus consistent
function validateActiveRule(status, liveUrl, isActive) {
    if (isActive && (status !== 'done' || !liveUrl)) {
        return 'Cannot set isActive=true unless status is "done" and liveUrl is provided';
    }
    return null;
}

// CREATE
exports.addUtilization = async (req, res) => {
    try {
        const { labUserId, toolName, projectName, status, liveUrl, isActive } = req.body;
        const orgId = req.user.orgId;

        // NEW: verify labUserId actually belongs to this org before creating the record —
        // closes cross-org leak where any labUserId could be submitted from req.body
        const validAssignment = await Assignment.findOne({ labUserId, orgId });
        if (!validAssignment) {
            return res.status(400).json({ success: false, message: 'labUserId does not belong to this organization or has no assignment.' });
        }

        const error = validateActiveRule(status, liveUrl, isActive);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const record = await Utilization.create({
            orgId,
            labUserId,
            toolName,
            projectName,
            status,
            liveUrl,
            isActive,
        });

        res.status(201).json({ success: true, data: record });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// READ
exports.listUtilization = async (req, res) => {
    try {
        const orgId = req.user.orgId;

        const records = await Utilization.find({ orgId })
            .populate('labUserId', 'name rollNumber department');

        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// UPDATE
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, liveUrl, isActive } = req.body;
        const orgId = req.user.orgId;

        // fetch existing record first — need current values for fields not sent in this request
        const existing = await Utilization.findOne({ _id: id, orgId });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        // merge incoming fields with existing ones so partial updates are validated correctly
        const finalStatus = status ?? existing.status;
        const finalLiveUrl = liveUrl ?? existing.liveUrl;
        const finalIsActive = isActive ?? existing.isActive;

        const error = validateActiveRule(finalStatus, finalLiveUrl, finalIsActive);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const record = await Utilization.findOneAndUpdate(
            { _id: id, orgId },
            { status: finalStatus, liveUrl: finalLiveUrl, isActive: finalIsActive },
            { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: record });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};