const Lab = require('../models/Lab');
const System = require('../models/System');
const AdminUser = require('../models/AdminUser');
const Organization = require('../models/Organization');
const mongoose = require('mongoose');

const duplicateLabMessage = 'A lab with this name already exists in your organization.';

const normalizeLab = async (lab) => {
  const labId = lab._id || lab.id;
  const systemCount = await System.countDocuments({ labId });

  return {
    id: labId?.toString(),
    _id: labId,
    name: lab.name,
    building: lab.building || '',
    floor: lab.floor || '',
    labNumber: lab.labNumber || '',
    systemCount,
    createdAt: lab.createdAt,
    updatedAt: lab.updatedAt,
  };
};

const requireOrgId = (orgId) => {
  if (!orgId) {
    const error = new Error('Organization context is required.');
    error.statusCode = 403;
    throw error;
  }
};

const validateName = (name) => {
  const resolvedName = (name || '').trim();

  if (!resolvedName) {
    const error = new Error('Lab name is required.');
    error.statusCode = 400;
    throw error;
  }

  return resolvedName;
};

// Validates the full lab payload and returns the trimmed, ready-to-save fields.
// name / building / floor are mandatory; labNumber is optional (empty string if omitted).
const validateLabFields = (payload = {}) => {
  const name = validateName(payload.name);

  const building = (payload.building || '').trim();
  if (!building) {
    const error = new Error('Building / block is required.');
    error.statusCode = 400;
    throw error;
  }

  const floor = (payload.floor || '').trim();
  if (!floor) {
    const error = new Error('Floor is required.');
    error.statusCode = 400;
    throw error;
  }

  const labNumber = (payload.labNumber || '').trim();

  return { name, building, floor, labNumber };
};

const validateLabId = (labId) => {
  if (!mongoose.Types.ObjectId.isValid(labId)) {
    const error = new Error('Lab not found.');
    error.statusCode = 404;
    throw error;
  }
};

const assertUniqueLabName = async ({ orgId, name, excludeLabId = null }) => {
  const query = { orgId, name };

  if (excludeLabId) {
    query._id = { $ne: excludeLabId };
  }

  const existingLab = await Lab.findOne(query);

  if (existingLab) {
    const error = new Error(duplicateLabMessage);
    error.statusCode = 409;
    throw error;
  }
};

const createLab = async (orgId, payload = {}) => {
  requireOrgId(orgId);

  const { name, building, floor, labNumber } = validateLabFields(payload);
  await assertUniqueLabName({ orgId, name });

  try {
    const lab = await Lab.create({ name, building, floor, labNumber, orgId });

    return {
      success: true,
      message: 'Lab created successfully.',
      lab: await normalizeLab(lab),
    };
  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error(duplicateLabMessage);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
};

const listLabs = async (orgId) => {
  requireOrgId(orgId);

  const labs = await Lab.find({ orgId }).sort({ createdAt: -1 });
  const normalizedLabs = await Promise.all(labs.map(normalizeLab));

  return {
    success: true,
    labs: normalizedLabs,
  };
};

const getLabById = async (orgId, labId) => {
  requireOrgId(orgId);
  validateLabId(labId);

  const lab = await Lab.findById(labId);

  if (!lab) {
    const error = new Error('Lab not found.');
    error.statusCode = 404;
    throw error;
  }

  if (lab.orgId.toString() !== orgId.toString()) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  return {
    success: true,
    lab: await normalizeLab(lab),
  };
};

const getLabDetails = async (orgId, labId, adminId = null) => {
  requireOrgId(orgId);
  validateLabId(labId);

  const lab = await Lab.findById(labId);

  if (!lab) {
    const error = new Error('Lab not found.');
    error.statusCode = 404;
    throw error;
  }

  if (lab.orgId.toString() !== orgId.toString()) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  const systems = await System.find({ labId, orgId }).sort({ createdAt: 1 });
  const organization = await Organization.findById(lab.orgId)
    .select('name adminId')
    .populate('adminId', 'name email');
  let admin = organization?.adminId && typeof organization.adminId === 'object' ? organization.adminId : null;

  if (!admin && adminId && mongoose.Types.ObjectId.isValid(adminId)) {
    admin = await AdminUser.findById(adminId).select('name email');
  }

  return {
    success: true,
    lab: {
      id: lab._id.toString(),
      name: lab.name,
      building: lab.building || '',
      floor: lab.floor || '',
      labNumber: lab.labNumber || '',
      organizationName: organization?.name || '',
      createdBy: admin?.name || '',
      adminEmail: admin?.email || '',
      createdAt: lab.createdAt,
      updatedAt: lab.updatedAt,
      systemCount: systems.length,
      systems: systems.map((system) => ({
        id: system._id.toString(),
        name: system.name,
        status: system.status,
        deviceName: system.deviceName || '',
        model: system.model || '',
        processor: system.processor || '',
        ram: system.ram || '',
        ramSpeed: system.ramSpeed || '',
        graphics: system.graphics || '',
        storage: system.storage || '',
        storageUsed: system.storageUsed || '',
        createdAt: system.createdAt,
      })),
    },
  };
};

const updateLab = async (orgId, labId, payload = {}) => {
  requireOrgId(orgId);
  validateLabId(labId);

  const { name, building, floor, labNumber } = validateLabFields(payload);
  const lab = await Lab.findById(labId);

  if (!lab) {
    const error = new Error('Lab not found.');
    error.statusCode = 404;
    throw error;
  }

  if (lab.orgId.toString() !== orgId.toString()) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  await assertUniqueLabName({ orgId, name, excludeLabId: labId });

  try {
    lab.name = name;
    lab.building = building;
    lab.floor = floor;
    lab.labNumber = labNumber;
    await lab.save();
  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error(duplicateLabMessage);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }

  return {
    success: true,
    message: 'Lab updated successfully.',
    lab: await normalizeLab(lab),
  };
};

const deleteLab = async (orgId, labId) => {
  requireOrgId(orgId);
  validateLabId(labId);

  const lab = await Lab.findById(labId);

  if (!lab) {
    const error = new Error('Lab not found.');
    error.statusCode = 404;
    throw error;
  }

  if (lab.orgId.toString() !== orgId.toString()) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  const systemCount = await System.countDocuments({ labId });

  if (systemCount > 0) {
    const error = new Error('Cannot delete a lab that has systems assigned.');
    error.statusCode = 409;
    throw error;
  }

  await Lab.findByIdAndDelete(labId);

  return {
    success: true,
    message: 'Lab deleted successfully.',
  };
};

module.exports = {
  createLab,
  listLabs,
  getLabById,
  getLabDetails,
  updateLab,
  deleteLab,
};
