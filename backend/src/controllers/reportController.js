const {
  createReportPdf,
  deleteArchivedReport,
  generateAndArchiveReport,
  getArchivedReport,
  listReports,
} = require('../services/reportService');

const handleReportError = (res, error) => {
  if ([400, 403, 404].includes(error.statusCode)) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  console.error('Report error:', error);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};

const generateReport = async (req, res) => {
  try {
    const result = await generateAndArchiveReport(req.user.orgId, req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return handleReportError(res, error);
  }
};

const getReports = async (req, res) => {
  try {
    const result = await listReports(req.user.orgId);
    return res.status(200).json(result);
  } catch (error) {
    return handleReportError(res, error);
  }
};

const getReport = async (req, res) => {
  try {
    const result = await getArchivedReport(req.user.orgId, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleReportError(res, error);
  }
};

const deleteReport = async (req, res) => {
  try {
    const result = await deleteArchivedReport(req.user.orgId, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleReportError(res, error);
  }
};

const downloadReportPdf = async (req, res) => {
  try {
    const result = await getArchivedReport(req.user.orgId, req.params.id);
    const buffer = await createReportPdf(result.report);
    const filename = `${result.report.metadata.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return handleReportError(res, error);
  }
};

module.exports = {
  generateReport,
  getReports,
  getReport,
  deleteReport,
  downloadReportPdf,
};
