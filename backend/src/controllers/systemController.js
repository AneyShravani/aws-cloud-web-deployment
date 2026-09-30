// ============================================================
// CONTROLLER: systemController  (Module 3.5)
// ------------------------------------------------------------
// addSystems     -> create N systems inside a lab.
// listByLab      -> systems of one lab with statuses.
// listAvailable  -> only AVAILABLE systems grouped by lab
//                   (feeds the AssignSystem page options).
// getOccupancyForLab -> total/occupied/available + "Fully occupied" flag
//
// SECURITY FIX (this pass):
// - orgId now comes from req.user.orgId (JWT), never req.body.
// - Every query filters by BOTH labId and orgId, so one org
//   can never read or write another org's systems.
//
// NEW (this pass):
// - updateSystem -> edit a single system's name/status
// - deleteSystem -> remove a single system
// - Both scoped by _id + orgId together, same reasoning as every
//   other query here: filtering by _id alone would let one org
//   act on another org's system if they guessed/obtained its ID.
// ============================================================

const System = require("../models/System"); // System model

// Create N systems inside a lab
const addSystems = async (req, res) => {
    try {
        const { labId, count } = req.body; // orgId removed from here — no longer trusted from client
        const orgId = req.user.orgId; // FIX: orgId comes from the authenticated token, not the request body

        if (!labId || !count || count < 1) {
            return res.status(400).json({ message: "labId and a valid count are required" });
        }

        // FIX: find how many systems already exist in this lab (within this org),
        // so numbering continues instead of restarting at System-1 every time
        const existingCount = await System.countDocuments({ labId, orgId });

        // FIX: build the array first, then insertMany once (was: create() in a loop)
        const systemsToCreate = [];
        for (let i = 1; i <= count; i++) {
            systemsToCreate.push({
                labId,
                orgId,
                name: `System-${existingCount + i}`, // continues numbering, avoids duplicate names
            });
        }

        const systems = await System.insertMany(systemsToCreate);

        res.status(201).json(systems); // 201 = created successfully
    } catch (error) {
        res.status(500).json({ message: "Error adding systems", error: error.message });
    }
};

// List all systems in a lab
const listByLab = async (req, res) => {
    try {
        const labId = req.params.labId; // labId from URL
        const orgId = req.user.orgId; // FIX: pull orgId from token

        // FIX: filter by BOTH labId and orgId — prevents cross-org data leak
        const systems = await System.find({ labId, orgId });
        res.status(200).json(systems);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving systems", error: error.message });
    }
};

// List only AVAILABLE systems in a lab (for AssignSystem page)
const listAvailable = async (req, res) => {
    try {
        const labId = req.params.labId;
        const orgId = req.user.orgId; // FIX: pull orgId from token

        // FIX: filter by labId + orgId + status
        const systems = await System.find({ labId, orgId, status: "AVAILABLE" });
        res.status(200).json(systems);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving available systems", error: error.message });
    }
};

// Occupancy count for a lab: total / occupied / available + "Fully occupied" flag
const getOccupancyForLab = async (req, res) => {
    try {
        const labId = req.params.labId;
        const orgId = req.user.orgId; // FIX: pull orgId from token

        // FIX: every count filtered by labId + orgId
        const total = await System.countDocuments({ labId, orgId });
        const occupied = await System.countDocuments({ labId, orgId, status: "OCCUPIED" });
        const available = total - occupied;

        res.status(200).json({
            total,
            occupied,
            available,
            status: available === 0 ? "Fully occupied" : "Space available", // spec rule
        });
    } catch (error) {
        res.status(500).json({ message: "Error getting occupancy", error: error.message });
    }
};

/// Update one system: name + hardware configuration.
// status is intentionally NOT accepted here. Status changes only happen via
// Module 3.7's assignment workflow, so this route physically cannot be used to
// fake an OCCUPIED status with no real Assignment behind it.
//
// Mandatory: name, deviceName, model, processor, ram, storage.
// Optional:  ramSpeed, graphics, storageUsed.
const updateSystem = async (req, res) => {
    try {
        const { systemId } = req.params;
        const orgId = req.user.orgId;
        // status deliberately excluded from the destructure — this endpoint can never touch it
        const {
            name, deviceName, model, processor, ram, storage,
            ramSpeed, graphics, storageUsed,
        } = req.body;

        // trim everything up-front so " " never passes the required-field check
        const fields = {
            name: (name || "").trim(),
            deviceName: (deviceName || "").trim(),
            model: (model || "").trim(),
            processor: (processor || "").trim(),
            ram: (ram || "").trim(),
            storage: (storage || "").trim(),
            ramSpeed: (ramSpeed || "").trim(),
            graphics: (graphics || "").trim(),
            storageUsed: (storageUsed || "").trim(),
        };

        // validate the mandatory fields
        const requiredLabels = {
            name: "System name",
            deviceName: "Device name",
            model: "Model",
            processor: "Processor",
            ram: "RAM",
            storage: "Storage",
        };
        const missing = Object.keys(requiredLabels).find((key) => !fields[key]);
        if (missing) {
            return res.status(400).json({ message: `${requiredLabels[missing]} is required` });
        }

        const system = await System.findOneAndUpdate(
            { _id: systemId, orgId },
            fields, // only name + config are ever written, never status
            { new: true, runValidators: true }
        );

        if (!system) {
            return res.status(404).json({ message: "System not found" });
        }

        res.status(200).json(system);
    } catch (error) {
        res.status(500).json({ message: "Error updating system", error: error.message });
    }
};

// NEW: Delete one system (e.g. correcting an accidental over-add)
const deleteSystem = async (req, res) => {
    try {
        const { systemId } = req.params; // which system to remove
        const orgId = req.user.orgId;    // NEW: same org-scoping rule as updateSystem

        // NEW: same combined filter — prevents deleting another org's system
        const system = await System.findOneAndDelete({ _id: systemId, orgId });

        if (!system) {
            return res.status(404).json({ message: "System not found" });
        }

        res.status(200).json({ message: "System deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting system", error: error.message });
    }
};

module.exports = { addSystems, listByLab, listAvailable, getOccupancyForLab, updateSystem, deleteSystem }; // NEW: added updateSystem, deleteSystem