const bcrypt = require('bcrypt');
const Organization = require('../models/Organization');
const AdminUser = require('../models/AdminUser');
const { generatePassword } = require('../utils/generatePassword');
const { sendAdminCredentials } = require('./emailService');
const { generateOrgCode } = require('./referenceIdService');

const normalizeOrganization = (organization) => {
  if (!organization) {
    return null;
  }

  const admin = organization.adminId || null;

  return {
    id: organization._id?.toString() || organization.id,
    _id: organization._id || organization.id,
    name: organization.name || '',
    orgCode: organization.orgCode || '',
    address: organization.address || '',
    city: organization.city || '',
    state: organization.state || '',
    country: organization.country || '',
    adminName: admin?.name || '',
    adminEmail: admin?.email || '',
    adminId: admin?._id ? admin._id.toString() : null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
};

const createOrganization = async (payload = {}) => {
  const {
    organizationName,
    name,
    address = '',
    city = '',
    state = '',
    country = '',
    adminName,
    adminEmail,
    email,
  } = payload;

  const resolvedOrganizationName = (organizationName || name || '').trim();
  const resolvedAdminName = (adminName || '').trim();
  const resolvedAdminEmail = (adminEmail || email || '').trim().toLowerCase();

  if (!resolvedOrganizationName || !resolvedAdminName || !resolvedAdminEmail) {
    const error = new Error('Organization name, admin name, and admin email are required');
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = resolvedOrganizationName;
  const trimmedAdminName = resolvedAdminName;
  const trimmedAdminEmail = resolvedAdminEmail;

  const existingOrganization = await Organization.findOne({ name: trimmedName });

  if (existingOrganization) {
    const error = new Error('"Organization already exists."');
    error.statusCode = 409;
    throw error;
  }

  const existingAdmin = await AdminUser.findOne({ email: trimmedAdminEmail });

  if (existingAdmin) {
    const error = new Error('Admin is already assigned to another organization.');
    error.statusCode = 409;
    throw error;
  }

  const orgCode = await generateOrgCode(trimmedName);

  const organization = await Organization.create({
    name: trimmedName,
    orgCode,
    address,
    city,
    state,
    country,
  });

  const temporaryPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const adminUser = await AdminUser.create({
    name: trimmedAdminName,
    email: trimmedAdminEmail,
    password: hashedPassword,
    role: 'ADMIN',
    orgId: organization._id,
    firstLogin: true,
  });

  await Organization.findByIdAndUpdate(organization._id, { adminId: adminUser._id });

  try {
    await sendAdminCredentials({
      adminName: trimmedAdminName,
      adminEmail: trimmedAdminEmail,
      temporaryPassword,
      organizationName: trimmedName,
    });

    return {
      success: true,
      message: 'Organization created successfully. Login credentials have been sent to the Admin email.',
      organization: {
        id: organization._id,
        name: organization.name,
        orgCode: organization.orgCode,
        adminId: adminUser._id,
      },
    };
  } catch (emailError) {
    console.error('Email sending failed:', emailError);

    return {
      success: true,
      message: 'Organization created successfully, but email could not be sent.',
      organization: {
        id: organization._id,
        name: organization.name,
        orgCode: organization.orgCode,
        adminId: adminUser._id,
      },
    };
  }
};

const listOrganizations = async () => {
  const organizations = await Organization.find().populate('adminId', 'name email').lean();
  return {
    success: true,
    organizations: organizations.map(normalizeOrganization),
  };
};

const getOrganizationById = async (organizationId) => {
  const organization = await Organization.findById(organizationId).populate('adminId', 'name email').lean();

  if (!organization) {
    const error = new Error('Organization not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    organization: normalizeOrganization(organization),
  };
};

const updateOrganization = async (organizationId, payload = {}) => {
  const {
    organizationName,
    name,
    address = '',
    city = '',
    state = '',
    country = '',
    adminName,
    adminEmail,
    email,
  } = payload;

  const resolvedOrganizationName = (organizationName || name || '').trim();
  const resolvedAdminName = (adminName || '').trim();
  const resolvedAdminEmail = (adminEmail || email || '').trim().toLowerCase();

  if (!resolvedOrganizationName || !resolvedAdminName || !resolvedAdminEmail) {
    const error = new Error('Organization name, admin name, and admin email are required');
    error.statusCode = 400;
    throw error;
  }

  const existingOrganization = await Organization.findById(organizationId);

  if (!existingOrganization) {
    const error = new Error('Organization not found.');
    error.statusCode = 404;
    throw error;
  }

  const duplicateOrganization = await Organization.findOne({
    name: resolvedOrganizationName,
    _id: { $ne: organizationId },
  });

  if (duplicateOrganization) {
    const error = new Error('This organisation is already present');
    error.statusCode = 409;
    throw error;
  }

  let adminUser = null;

  if (existingOrganization.adminId) {
    adminUser = await AdminUser.findById(existingOrganization.adminId);
  }

  if (!adminUser) {
    const existingAdminWithEmail = await AdminUser.findOne({ email: resolvedAdminEmail });

    if (existingAdminWithEmail) {
      const error = new Error('This admin is associated with another organisation');
      error.statusCode = 409;
      throw error;
    }

    const error = new Error('Admin not found for this organization.');
    error.statusCode = 404;
    throw error;
  }

  const duplicateAdmin = await AdminUser.findOne({
    email: resolvedAdminEmail,
    _id: { $ne: adminUser._id },
  });

  if (duplicateAdmin) {
    const error = new Error('This admin is associated with another organisation');
    error.statusCode = 409;
    throw error;
  }

  await AdminUser.findByIdAndUpdate(adminUser._id, {
    name: resolvedAdminName,
    email: resolvedAdminEmail,
  });

  const updatedOrganization = await Organization.findByIdAndUpdate(
    organizationId,
    {
      name: resolvedOrganizationName,
      address,
      city,
      state,
      country,
    },
    { new: true }
  ).populate('adminId', 'name email');

  return {
    success: true,
    message: 'Organization updated successfully.',
    organization: normalizeOrganization(updatedOrganization),
  };
};

const deleteOrganization = async (organizationId) => {
  const organization = await Organization.findById(organizationId);

  if (!organization) {
    const error = new Error('Organization not found.');
    error.statusCode = 404;
    throw error;
  }

  if (organization.adminId) {
    await AdminUser.findByIdAndDelete(organization.adminId);
  }

  await Organization.findByIdAndDelete(organizationId);

  return {
    success: true,
    message: 'Organization deleted successfully.',
  };
};

module.exports = {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
};
