const {
  createOrganization: createOrganizationService,
  listOrganizations: listOrganizationsService,
  getOrganizationById: getOrganizationByIdService,
  updateOrganization: updateOrganizationService,
  deleteOrganization: deleteOrganizationService,
} = require('../services/organizationService');

const createOrganization = async (req, res) => {
  try {
    const result = await createOrganizationService(req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Organization creation failed:', error);

    if (error.statusCode === 400 || error.statusCode === 409) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const listOrganizations = async (req, res) => {
  try {
    const result = await listOrganizationsService();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Organization listing failed:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const listPublicOrganizations = async (req, res) => {
  try {
    const result = await listOrganizationsService();
    
    // Extract items array if service wraps results in a metadata object
    const orgs = Array.isArray(result) ? result : result.organizations || result.data || [];
    const publicList = orgs.map((org) => ({ _id: org._id, name: org.name }));
    
    return res.status(200).json(publicList);
  } catch (error) {
    console.error('Public organization listing failed:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getOrganizationById = async (req, res) => {
  try {
    const result = await getOrganizationByIdService(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Organization lookup failed:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const result = await updateOrganizationService(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Organization update failed:', error);

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const result = await deleteOrganizationService(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Organization deletion failed:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  createOrganization,
  listOrganizations,
  listPublicOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
};