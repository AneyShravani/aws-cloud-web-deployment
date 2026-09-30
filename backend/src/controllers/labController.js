// ============================================================
// CONTROLLER: labController  (Module 3.4)
// ------------------------------------------------------------
// createLab -> new lab for the admin's org.
// listLabs  -> labs of the admin's org (with system counts).
// Always scoped by orgId (orgIsolation middleware).
// ============================================================
const {
  createLab: createLabService,
  listLabs: listLabsService,
  getLabById: getLabByIdService,
  getLabDetails: getLabDetailsService,
  updateLab: updateLabService,
  deleteLab: deleteLabService,
} = require('../services/labService');

const handleLabError = (res, error, fallbackMessage) => {
  if ([400, 403, 404, 409].includes(error.statusCode)) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};

const createLab = async (req, res) => {
  try {
    const result = await createLabService(req.user.orgId, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab creation failed:');
  }
};

const listLabs = async (req, res) => {
  try {
    const result = await listLabsService(req.user.orgId);
    return res.status(200).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab listing failed:');
  }
};

const getLabById = async (req, res) => {
  try {
    const result = await getLabByIdService(req.user.orgId, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab lookup failed:');
  }
};

const getLabDetails = async (req, res) => {
  try {
    const result = await getLabDetailsService(req.user.orgId, req.params.id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab detail lookup failed:');
  }
};

const updateLab = async (req, res) => {
  try {
    const result = await updateLabService(req.user.orgId, req.params.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab update failed:');
  }
};

const deleteLab = async (req, res) => {
  try {
    const result = await deleteLabService(req.user.orgId, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleLabError(res, error, 'Lab deletion failed:');
  }
};

module.exports = {
  createLab,
  listLabs,
  getLabById,
  getLabDetails,
  updateLab,
  deleteLab,
};
