// ============================================================
// PAGE: LabList  (Module 3.4 — Lab Creation)
// ------------------------------------------------------------
// Table of all AI labs of THIS organization (an org can have
// multiple labs). Shows lab name + number of systems.
// Calls labService.getAll().
// UPDATED: added "Add Systems" button + modal (Module 3.5)
// UPDATED: added occupancy stat strip + highlighted total count (UI pass)
// UPDATED: systems table + occupancy strip moved into SystemList.jsx —
// this file now just passes data down and handles edit/delete modals.
// ============================================================
import React, { useEffect, useState } from 'react';
import { Eye, Pencil, Trash2, Plus, FlaskConical, Server, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import labService from '../../services/labService';
import CreateLab from './CreateLab';
import LabDetailsModal from './LabDetailsModal'; // bespoke lab details sheet (add/edit systems happen inline inside it)
import ViewToggle from '../../components/common/ViewToggle';
import useTableView from '../../hooks/useTableView';
import { useConfirm } from '../../context/ConfirmContext';
import './Labs.css';
import './LabList.css';
import systemService from '../../services/systemService';

const initialsOf = (name = '') => {
  const p = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!p.length) return '#';
  return (p[0][0] + (p[1]?.[0] || p[0][1] || '')).toUpperCase();
};

// builds a readable "Building · Floor · Lab-No" string from the parts that exist
const buildLocation = (lab) => (
  [lab?.building, lab?.floor, lab?.labNumber].map((p) => (p || '').trim()).filter(Boolean).join(' · ')
);

const normalizeLab = (lab) => ({
  id: lab?.id || lab?._id,
  name: lab?.name || '',
  building: lab?.building || '',
  floor: lab?.floor || '',
  labNumber: lab?.labNumber || '',
  location: buildLocation(lab),
  systemCount: Number(lab?.systemCount || 0),
  createdAt: lab?.createdAt ? new Date(lab.createdAt).toLocaleDateString() : '',
  updatedAt: lab?.updatedAt ? new Date(lab.updatedAt).toLocaleDateString() : '',
});

const formatDateTime = (dateValue) => (
  dateValue ? new Date(dateValue).toLocaleString() : 'N/A'
);

const normalizeLabDetails = (lab) => ({
  id: lab?.id || lab?._id,
  name: lab?.name || 'N/A',
  building: lab?.building || '',
  floor: lab?.floor || '',
  labNumber: lab?.labNumber || '',
  location: buildLocation(lab),
  organizationName: lab?.organizationName || 'N/A',
  createdBy: lab?.createdBy || 'N/A',
  adminEmail: lab?.adminEmail || 'N/A',
  createdAt: formatDateTime(lab?.createdAt),
  updatedAt: formatDateTime(lab?.updatedAt),
  systemCount: Number(lab?.systemCount || 0),
  systems: Array.isArray(lab?.systems) ? lab.systems.map((system) => ({
    id: system?.id || system?._id,
    name: system?.name || 'N/A',
    status: system?.status || 'AVAILABLE',
    deviceName: system?.deviceName || '',
    model: system?.model || '',
    processor: system?.processor || '',
    ram: system?.ram || '',
    ramSpeed: system?.ramSpeed || '',
    graphics: system?.graphics || '',
    storage: system?.storage || '',
    storageUsed: system?.storageUsed || '',
    createdAt: formatDateTime(system?.createdAt),
  })) : [],
});

function LabList() {
  const confirm = useConfirm();
  const [labs, setLabs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedLabDetails, setSelectedLabDetails] = useState(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [view, setView] = useTableView();

  const loadLabs = async () => {
    try {
      setIsLoading(true);
      const response = await labService.getAll();
      const labList = Array.isArray(response?.labs) ? response.labs : [];
      setLabs(labList.map(normalizeLab));
      setFeedback('');
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to load labs');
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const handleOpenCreate = () => {
    setFeedback('');
    setEditingLab(null);
    setIsModalOpen(true);
  };

  const handleEditLab = async (lab) => {
    try {
      const response = await labService.getById(lab.id);
      setEditingLab(normalizeLab(response?.lab || response));
      setFeedback('');
      setIsModalOpen(true);
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to load lab');
    }
  };

  const handleViewMore = async (lab) => {
    try {
      setIsDetailsOpen(true);
      setIsDetailsLoading(true);
      setSelectedLabDetails(null);
      setFeedback('');
      const response = await labService.getDetails(lab.id);
      setSelectedLabDetails(normalizeLabDetails(response?.lab || response));
    } catch (error) {
      setIsDetailsOpen(false);
      setFeedback(error?.response?.data?.message || 'Unable to load lab details');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedLabDetails(null);
  };

  const handleSaveLab = async (savedLab) => {
    setIsModalOpen(false);
    setEditingLab(null);
    setFeedback(savedLab?.message || 'Lab saved successfully.');
    await loadLabs();
  };

  const handleDeleteLab = async (lab) => {
    const ok = await confirm({
      title: 'Delete this lab?',
      message: `"${lab.name}" and its details will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete Lab',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    try {
      const response = await labService.delete(lab.id);
      if (response?.success) {
        setFeedback(response.message || 'Lab deleted successfully.');
        await loadLabs();
        return;
      }

      setFeedback(response?.message || 'Unable to delete lab');
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to delete lab');
    }
  };

  // refreshes both the details modal AND the labs table —
  // selectedLabDetails and labs are two separate pieces of state.
  const refreshAfterSystemChange = async () => {
    await handleViewMore({ id: selectedLabDetails.id });
    await loadLabs();
  };

  // called when the Delete button is clicked on a system row in SystemList
  const handleDeleteSystem = async (system) => {
    const ok = await confirm({
      title: 'Delete this system?',
      message: `"${system.name}" will be permanently removed from this lab. This cannot be undone.`,
      confirmLabel: 'Delete System',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    try {
      await systemService.deleteSystem(system.id);
      setFeedback('System deleted successfully.');
      await refreshAfterSystemChange();
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to delete system');
    }
  };

  const totalSystems = labs.reduce((sum, lab) => sum + lab.systemCount, 0);
  const avgSystems = labs.length ? Math.round(totalSystems / labs.length) : 0;
  const feedbackIsError = /unable|fail|error|invalid|not\b/i.test(feedback);

  return (
    <div className="lab-page">
      {/* ---------- Header ---------- */}
      <header className="lab-headbar">
        <div className="lab-heading">
          <span className="lab-eyebrow"><FlaskConical size={14} strokeWidth={2.4} /> Infrastructure</span>
          <h1 className="lab-title">Labs <InfoHint text="Manage the AI labs for your organization and the systems inside each one." /></h1>
        </div>
      </header>

      {/* ---------- Stat cards ---------- */}
      <div className="lab-stats">
        <div className="lab-stat" style={{ '--lab-accent': 'var(--color-primary)' }}>
          <span className="lab-stat-ico"><FlaskConical size={22} strokeWidth={2.1} /></span>
          <div className="lab-stat-body">
            <span className="lab-stat-value">{labs.length}</span>
            <span className="lab-stat-label">Total labs</span>
          </div>
        </div>
        <div className="lab-stat" style={{ '--lab-accent': 'var(--color-teal)' }}>
          <span className="lab-stat-ico"><Server size={22} strokeWidth={2.1} /></span>
          <div className="lab-stat-body">
            <span className="lab-stat-value">{totalSystems}</span>
            <span className="lab-stat-label">Total systems</span>
          </div>
        </div>
        <div className="lab-stat" style={{ '--lab-accent': 'var(--color-info)' }}>
          <span className="lab-stat-ico"><Layers size={22} strokeWidth={2.1} /></span>
          <div className="lab-stat-body">
            <span className="lab-stat-value">{avgSystems}</span>
            <span className="lab-stat-label">Avg systems / lab</span>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`lab-note ${feedbackIsError ? 'is-error' : ''}`}>
          {feedbackIsError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {feedback}
        </div>
      ) : null}

      {/* ---------- Records ---------- */}
      <section className="lab-records">
        <div className="lab-records-head">
          <div className="lab-records-title-wrap">
            <h3 className="lab-records-title">All labs</h3>
            {!isLoading && labs.length > 0 ? <span className="lab-records-count">{labs.length} {labs.length === 1 ? 'lab' : 'labs'}</span> : null}
          </div>
          <div className="lab-toolbar">
            <ViewToggle view={view} onChange={setView} />
            <button type="button" className="lab-mini-btn lab-mini-btn--primary" onClick={handleOpenCreate}>
              <Plus size={15} /> Create lab
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="lab-loading">Loading labs…</div>
        ) : labs.length === 0 ? (
          <div className="lab-empty">
            <div className="lab-empty-icon"><FlaskConical size={26} /></div>
            <h3>No labs yet</h3>
            <p>Create your first AI lab to start adding systems and tracking usage.</p>
            <button type="button" className="lab-btn lab-btn-primary lab-empty-cta" onClick={handleOpenCreate}>
              <Plus size={16} /> Create lab
            </button>
          </div>
        ) : (
          <div className="lab-table-scroll tv-scroll" data-view={view}>
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Lab name</th>
                  <th>Location</th>
                  <th>Systems</th>
                  <th>Created</th>
                  <th className="lab-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((lab) => (
                  <tr key={lab.id}>
                    <td data-label="Lab name">
                      <div className="lab-name-cell">
                        <span className="lab-badge"><FlaskConical size={18} strokeWidth={2} /></span>
                        <span className="lab-name-text">{lab.name}</span>
                      </div>
                    </td>
                    <td data-label="Location">
                      <span className="lab-location">{lab.location || '—'}</span>
                    </td>
                    <td data-label="Systems">
                      <span className="lab-sys-chip"><Server size={13} /> {lab.systemCount} {lab.systemCount === 1 ? 'system' : 'systems'}</span>
                    </td>
                    <td data-label="Created"><span className="lab-created">{lab.createdAt || '—'}</span></td>
                    <td className="lab-actions-col" data-label="Actions">
                      <div className="lab-row-actions-new">
                        <button className="lab-icon-btn" type="button" onClick={() => handleViewMore(lab)} title="View details" aria-label={`View ${lab.name}`}>
                          <Eye size={15} strokeWidth={2.2} />
                        </button>
                        <button className="lab-icon-btn" type="button" onClick={() => handleEditLab(lab)} title="Edit" aria-label={`Edit ${lab.name}`}>
                          <Pencil size={15} strokeWidth={2.2} />
                        </button>
                        <button className="lab-icon-btn lab-icon-btn--danger" type="button" onClick={() => handleDeleteLab(lab)} title="Delete" aria-label={`Delete ${lab.name}`}>
                          <Trash2 size={15} strokeWidth={2.2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        title={editingLab ? 'Edit Lab' : 'Create Lab'}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLab(null);
        }}
      >
        <CreateLab
          onClose={() => {
            setIsModalOpen(false);
            setEditingLab(null);
          }}
          onSave={handleSaveLab}
          initialLab={editingLab}
        />
      </Modal>

      <LabDetailsModal
        isOpen={isDetailsOpen}
        isLoading={isDetailsLoading}
        lab={selectedLabDetails}
        onClose={handleCloseDetails}
        onSystemsChanged={refreshAfterSystemChange}
        onDeleteSystem={handleDeleteSystem}
      />
    </div>
  );
}

export default LabList;