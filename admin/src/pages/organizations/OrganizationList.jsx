import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, Search, Pencil, Trash2, Mail, UserRound, CalendarPlus, Copy, Check, AlertCircle, CheckCircle2,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import organizationService from '../../services/organizationService';
import CreateOrganization from './CreateOrganization';
import { useConfirm } from '../../context/ConfirmContext';
import './OrganizationList.css';

const initialsOf = (name = '') => {
  const parts = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '#';
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || '')).toUpperCase();
};

const normalizeOrganization = (organization) => ({
  id: organization?.id || organization?._id,
  name: organization?.name || '',
  orgCode: organization?.orgCode || '',
  address: organization?.address || '',
  city: organization?.city || '',
  state: organization?.state || '',
  country: organization?.country || '',
  adminName: organization?.adminName || organization?.adminId?.name || '',
  adminEmail: organization?.adminEmail || organization?.adminId?.email || '',
  createdAt: organization?.createdAt ? new Date(organization.createdAt).toLocaleDateString() : '',
});

function OrganizationList() {
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState('');

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.getOrganizations();
      const organizationList = Array.isArray(response?.organizations) ? response.organizations : [];
      setOrganizations(organizationList.map(normalizeOrganization));
      setFeedback('');
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to load organizations');
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadOrganizations(); }, []);

  const filteredOrganizations = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter((organization) =>
      [organization.name, organization.orgCode, organization.adminName, organization.adminEmail]
        .join(' ').toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const handleOpenCreate = () => {
    setFeedback('');
    setEditingOrganization(null);
    setIsModalOpen(true);
  };

  const handleCreateOrganization = (organization) => {
    setOrganizations((previous) => [normalizeOrganization(organization), ...previous]);
    setFeedback(organization?.message || 'Organization created successfully.');
    setIsModalOpen(false);
    loadOrganizations();
  };

  const handleEditOrganization = async (organization) => {
    try {
      const response = await organizationService.getOrganization(organization.id);
      setEditingOrganization(normalizeOrganization(response?.organization || response));
      setFeedback('');
      setIsModalOpen(true);
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to load organization');
    }
  };

  const handleUpdateOrganization = (updatedOrganization) => {
    setEditingOrganization(null);
    setIsModalOpen(false);
    setFeedback(updatedOrganization?.message || 'Organization updated successfully.');
    loadOrganizations();
  };

  const handleDeleteOrganization = async (organization) => {
    const ok = await confirm({
      title: 'Delete this organization?',
      message: `"${organization.name}" and its admin account will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete Organization',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const response = await organizationService.deleteOrganization(organization.id);
      if (response?.success) {
        setOrganizations((previous) => previous.filter((o) => o.id !== organization.id));
        setFeedback(response.message || 'Organization deleted successfully.');
        return;
      }
      setFeedback(response?.message || 'Unable to delete organization');
    } catch (error) {
      setFeedback(error?.response?.data?.message || 'Unable to delete organization');
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      setTimeout(() => setCopiedId(''), 1500);
    } catch { /* clipboard unavailable — code is visible for manual copy */ }
  };

  const feedbackIsError = /unable|fail|error|invalid|not\b/i.test(feedback);

  return (
    <div className="org-page">
      {/* ---------- Header ---------- */}
      <header className="org-headbar">
        <div className="org-heading">
          <span className="org-eyebrow"><Building2 size={14} strokeWidth={2.4} /> Super admin</span>
          <h1 className="org-title">Organizations <InfoHint text="Manage colleges and their administrators. Each organization has its own ID used to issue member access IDs." /></h1>
        </div>
      </header>

      {/* ---------- Stat + toolbar ---------- */}
      <div className="org-toolbar">
        <div className="org-search">
          <Search size={16} strokeWidth={2.2} />
          <input
            type="search"
            placeholder="Search by name, ID or admin…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="button" className="org-btn org-btn--primary" onClick={handleOpenCreate}>
          <Plus size={16} strokeWidth={2.4} /> Create organization
        </button>
      </div>

      {feedback ? (
        <div className={`org-note ${feedbackIsError ? 'is-error' : ''}`}>
          {feedbackIsError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {feedback}
        </div>
      ) : null}

      {/* ---------- Cards ---------- */}
      {isLoading ? (
        <div className="org-state">Loading organizations…</div>
      ) : filteredOrganizations.length === 0 ? (
        <div className="org-state">
          <div className="org-state-icon"><Building2 size={26} /></div>
          <h3>{organizations.length === 0 ? 'No organizations yet' : 'No matches'}</h3>
          <p>{organizations.length === 0 ? 'Create your first organization to get started.' : 'Try a different search term.'}</p>
        </div>
      ) : (
        <div className="org-grid">
          {filteredOrganizations.map((organization) => (
            <article className="org-card" key={organization.id}>
              {/* org ID badge — top right */}
              {organization.orgCode ? (
                <button
                  type="button"
                  className="org-code"
                  onClick={() => copyCode(organization.orgCode)}
                  title="Copy organization ID"
                >
                  {copiedId === organization.orgCode ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
                  <span>{organization.orgCode}</span>
                </button>
              ) : null}

              <div className="org-card-head">
                <span className="org-avatar">{initialsOf(organization.name)}</span>
                <div className="org-card-title">
                  <h3>{organization.name}</h3>
                  {organization.city || organization.state ? (
                    <span className="org-card-loc">{[organization.city, organization.state].filter(Boolean).join(', ')}</span>
                  ) : null}
                </div>
              </div>

              <dl className="org-meta">
                <div className="org-meta-row">
                  <span className="org-meta-ico"><UserRound size={15} strokeWidth={2.1} /></span>
                  <div><dt>Admin</dt><dd>{organization.adminName || '—'}</dd></div>
                </div>
                <div className="org-meta-row">
                  <span className="org-meta-ico"><Mail size={15} strokeWidth={2.1} /></span>
                  <div><dt>Email</dt><dd>{organization.adminEmail || '—'}</dd></div>
                </div>
                <div className="org-meta-row">
                  <span className="org-meta-ico"><CalendarPlus size={15} strokeWidth={2.1} /></span>
                  <div><dt>Created</dt><dd>{organization.createdAt || '—'}</dd></div>
                </div>
              </dl>

              <div className="org-card-actions">
                <button type="button" className="org-icon-btn" onClick={() => handleEditOrganization(organization)} title="Edit">
                  <Pencil size={15} strokeWidth={2.2} /> <span>Edit</span>
                </button>
                <button type="button" className="org-icon-btn org-icon-btn--danger" onClick={() => handleDeleteOrganization(organization)} title="Delete">
                  <Trash2 size={15} strokeWidth={2.2} /> <span>Delete</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingOrganization ? 'Edit Organization' : 'Create Organization'}
        onClose={() => { setIsModalOpen(false); setEditingOrganization(null); }}
      >
        <CreateOrganization
          onClose={() => { setIsModalOpen(false); setEditingOrganization(null); }}
          onSave={editingOrganization ? handleUpdateOrganization : handleCreateOrganization}
          initialOrganization={editingOrganization}
        />
      </Modal>
    </div>
  );
}

export default OrganizationList;
