// ============================================================
// PAGE: RequestList  (Module 3.7 — Users, Section 4 workflow)
// ------------------------------------------------------------
// Pending requests = LabUsers with no Assignment yet. Two ways
// a request gets here:
//   • "Student"  -> a student raised it from their own account
//   • "Manual"   -> an admin entered it for a walk-in (letter
//                   in hand) via the "New Manual Request" form
// Both are the same record type and both flow into the same
// Assign step. Click "Review" on a row to assign a system.
// ============================================================
import React, { useEffect, useState } from 'react';
import { UserPlus, FileText, Check, CheckCircle2, Inbox, AlertCircle, Paperclip } from 'lucide-react';
import assignmentService from '../../services/assignmentService';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import StatusBadge from '../../components/common/StatusBadge';
import ManualRequestForm from './ManualRequestForm';
import './RequestList.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'manual', label: 'Manual' },
];

// Deterministic, on-brand avatar tint from a name — no randomness,
// so the same person always keeps the same colour.
const AVATAR_TINTS = [
  { bg: 'rgba(0, 135, 56, 0.14)', fg: 'var(--color-primary)' },
  { bg: 'rgba(26, 182, 157, 0.16)', fg: 'var(--color-teal)' },
  { bg: 'rgba(27, 162, 219, 0.16)', fg: 'var(--color-info)' },
  { bg: 'rgba(255, 143, 60, 0.16)', fg: 'var(--color-warning)' },
  { bg: 'rgba(114, 189, 32, 0.18)', fg: 'var(--color-primary-strong)' },
];

const initialsOf = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const dateInput = (v) => (v ? String(v).slice(0, 10) : '');

const tintFor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
};

function RequestList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null); // the request being approved
  const [approveForm, setApproveForm] = useState({ projectName: '', startDate: '', endDate: '' });
  const [approveError, setApproveError] = useState('');
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approved, setApproved] = useState(null); // { name, referenceId } after approval
  const [copied, setCopied] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await assignmentService.getRequests();
      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError('Could not load requests. Please try again.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleViewLetter = async (event, req) => {
    event.stopPropagation();
    const filename = req.hodLetterPath.split('/').pop();
    setOpeningId(req._id);
    try {
      const response = await api.get(`/assignments/uploads/${filename}`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank');
    } catch (err) {
      setError('Could not open HOD letter.');
    } finally {
      setOpeningId(null);
    }
  };

  // v2 slot-booking: approving creates the umbrella + the user's persistent
  // access ID (no machine pinned). The admin can review/adjust the project
  // window here before confirming, so a stale/past window doesn't silently
  // make the user unbookable. On confirm the user drops off the pending list.
  const openApprove = (req) => {
    setApproveTarget(req);
    setApproveForm({
      projectName: req.projectName || '',
      startDate: dateInput(req.startDate),
      endDate: dateInput(req.endDate),
    });
    setApproveError('');
  };

  const confirmApprove = async () => {
    const { projectName, startDate, endDate } = approveForm;
    if (!projectName.trim() || !startDate || !endDate) {
      setApproveError('Project name, start date and end date are all required.');
      return;
    }
    if (endDate <= startDate) {
      setApproveError('End date must be after start date.');
      return;
    }
    if (endDate < todayStr()) {
      setApproveError("End date can't be in the past — the user could never book a slot.");
      return;
    }
    setApproveSubmitting(true);
    setApproveError('');
    try {
      const res = await assignmentService.approve(approveTarget._id, {
        projectName: projectName.trim(),
        startDate,
        endDate,
      });
      setApproved({ name: approveTarget.name, referenceId: res.referenceId });
      setApproveTarget(null);
      await fetchRequests();
      window.dispatchEvent(new Event('requests:changed')); // update the sidebar badge now
    } catch (err) {
      setApproveError(err?.response?.data?.message || 'Could not approve this request.');
    } finally {
      setApproveSubmitting(false);
    }
  };

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the ID is shown for manual copy */
    }
  };

  const sourceOf = (req) => (req.source === 'manual' ? 'manual' : 'student');
  const filtered = requests.filter((req) => filter === 'all' || sourceOf(req) === filter);

  const countFor = (key) =>
    key === 'all' ? requests.length : requests.filter((r) => sourceOf(r) === key).length;

  return (
    <div className="requests-page">
      {/* ---------- Header ---------- */}
      <header className="requests-header">
        <div className="requests-heading">
          <span className="requests-eyebrow">
            <Inbox size={14} strokeWidth={2.4} />
            Assignments queue
          </span>
          <h1 className="requests-title">User requests <InfoHint text="Requests raised by students, plus walk-ins you enter manually. Approve one to issue its access ID, then reserve lab slots in Bookings." /></h1>
        </div>

        <button type="button" className="requests-new-btn" onClick={() => setIsManualOpen(true)}>
          <UserPlus size={17} strokeWidth={2.2} />
          New manual request
        </button>
      </header>

      {/* ---------- Toolbar: segmented filter + result count ---------- */}
      <div className="requests-toolbar">
        <div className="requests-segmented" role="tablist" aria-label="Filter requests by source">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`requests-seg-btn ${filter === f.key ? 'is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="requests-seg-count">{countFor(f.key)}</span>
            </button>
          ))}
        </div>

        {!loading && filtered.length > 0 ? (
          <span className="requests-result-count">
            {filtered.length} {filtered.length === 1 ? 'request' : 'requests'}
          </span>
        ) : null}
      </div>

      {/* ---------- Error ---------- */}
      {error ? (
        <div className="requests-error" role="alert">
          <AlertCircle size={18} strokeWidth={2.2} />
          {error}
        </div>
      ) : null}

      {/* ---------- Panel ---------- */}
      <section className="requests-panel">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="requests-empty">
            <div className="requests-empty-icon">
              <Inbox size={30} strokeWidth={1.8} />
            </div>
            {requests.length === 0 ? (
              <>
                <h3>No pending requests</h3>
                <p>When a student raises a request or a walk-in arrives with an HOD letter, it will show up here ready to assign.</p>
                <button type="button" className="requests-new-btn" onClick={() => setIsManualOpen(true)}>
                  <UserPlus size={17} strokeWidth={2.2} />
                  New manual request
                </button>
              </>
            ) : (
              <>
                <h3>Nothing in this view</h3>
                <p>No requests match the “{FILTERS.find((f) => f.key === filter)?.label}” filter right now. Try switching to “All”.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="requests-table-head" aria-hidden="true">
              <span>Requester</span>
              <span>Type</span>
              <span>Source</span>
              <span>HOD letter</span>
              <span />
            </div>

            <div className="request-list">
              {filtered.map((req) => {
                const isManual = sourceOf(req) === 'manual';
                const tint = tintFor(req.name || req._id);
                return (
                  <article className="request-row" key={req._id}>
                    <div className="req-cell req-cell--user">
                      <div className="req-user">
                        <span
                          className="req-avatar"
                          style={{ background: tint.bg, color: tint.fg }}
                          aria-hidden="true"
                        >
                          {initialsOf(req.name)}
                        </span>
                        <div className="req-user-meta">
                          <span className="req-name">{req.name}</span>
                          <span className="req-sub">
                            {req.rollNumber}
                            {req.department ? ` · ${req.department}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="req-cell req-cell--type" data-label="Type">
                      <span className="req-type-chip">{req.userType}</span>
                    </div>

                    <div className="req-cell req-cell--source" data-label="Source">
                      <StatusBadge
                        label={isManual ? 'Manual' : 'Student'}
                        tone={isManual ? 'warning' : 'neutral'}
                      />
                    </div>

                    <div className="req-cell req-cell--letter" data-label="HOD letter">
                      {req.hodLetterPath ? (
                        <button
                          className="req-letter-btn"
                          type="button"
                          onClick={(e) => handleViewLetter(e, req)}
                          disabled={openingId === req._id}
                        >
                          <FileText size={15} strokeWidth={2.2} />
                          <span>{openingId === req._id ? 'Opening…' : 'View'}</span>
                        </button>
                      ) : (
                        <span className="req-letter-none">
                          <Paperclip size={14} strokeWidth={2.2} />
                          Not uploaded
                        </span>
                      )}
                    </div>

                    <div className="req-cell req-cell--action">
                      <button
                        className="req-review"
                        type="button"
                        onClick={() => openApprove(req)}
                      >
                        <Check size={15} strokeWidth={2.4} />
                        <span>Approve</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={isManualOpen}
        title="New manual request"
        onClose={() => setIsManualOpen(false)}
        size="wide"
        closeOnBackdrop={false}
      >
        <ManualRequestForm
          onClose={() => setIsManualOpen(false)}
          onApproved={async ({ name, referenceId }) => {
            setIsManualOpen(false);
            setApproved({ name, referenceId }); // pop the floating access-ID card
            await fetchRequests();
            window.dispatchEvent(new Event('requests:changed')); // update the sidebar badge now
          }}
        />
      </Modal>

      <Modal isOpen={Boolean(approveTarget)} title="Approve request" onClose={() => setApproveTarget(null)}>
        {approveTarget ? (
          <div className="req-approve">
            <p className="req-approve-lead">
              Approving <strong>{approveTarget.name}</strong>
              {approveTarget.rollNumber ? <span className="req-approve-roll"> · {approveTarget.rollNumber}</span> : null}.
              Confirm the project window — the user can only book slots inside these dates.
            </p>

            {approveTarget.continuation ? (
              <div className={`req-approve-cont req-approve-cont--${approveTarget.continuation.mode}`} role="note">
                <CheckCircle2 size={16} strokeWidth={2.2} />
                <span>
                  {approveTarget.continuation.mode === 'reopen' ? 'Reopening for maintenance' : 'Continuation'} of
                  {' '}<strong>{approveTarget.continuation.projectName}</strong> — the same access ID{' '}
                  <code>{approveTarget.continuation.referenceId}</code> will be reused (no new ID).
                </span>
              </div>
            ) : null}

            <div className="req-approve-field">
              <label htmlFor="approveProject">Project</label>
              <input
                id="approveProject"
                type="text"
                value={approveForm.projectName}
                onChange={(e) => setApproveForm((f) => ({ ...f, projectName: e.target.value }))}
                placeholder="What they will work on"
              />
            </div>

            <div className="req-approve-grid">
              <div className="req-approve-field">
                <label htmlFor="approveStart">Start date</label>
                <input
                  id="approveStart"
                  type="date"
                  value={approveForm.startDate}
                  onChange={(e) => setApproveForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="req-approve-field">
                <label htmlFor="approveEnd">End date</label>
                <input
                  id="approveEnd"
                  type="date"
                  min={todayStr()}
                  value={approveForm.endDate}
                  onChange={(e) => setApproveForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            {approveError ? (
              <div className="req-approve-error" role="alert">
                <AlertCircle size={15} strokeWidth={2.2} /> {approveError}
              </div>
            ) : null}

            <div className="req-approve-actions">
              <button type="button" className="req-approve-ghost" onClick={() => setApproveTarget(null)} disabled={approveSubmitting}>
                Cancel
              </button>
              <button type="button" className="requests-new-btn" onClick={confirmApprove} disabled={approveSubmitting}>
                <Check size={16} strokeWidth={2.2} />
                {approveSubmitting ? 'Approving…' : 'Approve & issue ID'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={Boolean(approved)} title="Request approved" onClose={() => setApproved(null)}>
        {approved ? (
          <div className="req-approved">
            <div className="req-approved-icon"><CheckCircle2 size={30} strokeWidth={2} /></div>
            <h3 className="req-approved-title">{approved.name} is approved</h3>
            <p className="req-approved-text">
              Share this access ID — the user gives it at the lab desk to book slots and check in.
            </p>
            <div className="req-approved-id">
              <code>{approved.referenceId}</code>
              <button type="button" onClick={() => copyId(approved.referenceId)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="req-approved-next">
              Next: open <strong>Bookings</strong> to reserve lab slots for them.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

// Skeleton rows mirror the real row layout so loading doesn't shift the grid.
function SkeletonList() {
  return (
    <div className="request-list" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="req-skeleton-row" key={i}>
          <div className="req-skeleton-user">
            <span className="skeleton skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line sk-lg" />
              <div className="skeleton skeleton-line sk-sm" />
            </div>
          </div>
          <span className="skeleton skeleton-pill" />
          <span className="skeleton skeleton-pill" />
          <span className="skeleton skeleton-pill" />
          <span className="skeleton skeleton-pill sk-btn" />
        </div>
      ))}
    </div>
  );
}

export default RequestList;
