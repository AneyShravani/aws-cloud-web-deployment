// ============================================================
// PAGE: StudentRequests  (raise access requests + history)
// ------------------------------------------------------------
// Always reachable (even when expired/blocked) — this is how a
// student gets or renews access. Submit a project + dates + HOD
// letter; the admin approves it and an access ID is issued. The
// table below shows every request with its live status + ref ID.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { FileText, UploadCloud, FileCheck2, X, AlertCircle, Check, CalendarRange, CheckCircle2, Lock } from 'lucide-react';
import assignmentService from '../../services/assignmentService';
import { useStudentAccess } from '../../context/StudentAccessContext';
import ProjectNameField from '../../components/common/ProjectNameField';
import InfoHint from '../../components/common/InfoHint';
import '../../components/student/student.css';

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const STATUS_PILL = {
  PENDING: 'st-pill--pending',
  ACTIVE: 'st-pill--active',
  NEARING_EXPIRY: 'st-pill--nearing',
  EXPIRED: 'st-pill--expired',
  REJECTED: 'st-pill--expired',
};
const statusLabel = (s) => (s === 'NEARING_EXPIRY' ? 'Expiring soon' : s ? s.charAt(0) + s.slice(1).toLowerCase() : '—');

const fmtSize = (b) => (!b ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function StudentRequests() {
  const { refresh, blocked } = useStudentAccess();
  const [form, setForm] = useState({ projectName: '', startDate: '', endDate: '', continueProjectId: null });
  const [projKey, setProjKey] = useState(0); // remount ProjectNameField to reset it
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assignmentService.getMyRequests();
      const data = res?.data || res || [];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const hasPending = rows.some((r) => r.status === 'PENDING');

  const change = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); setOkMsg(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setOkMsg('');
    const miss = [];
    if (!form.projectName.trim()) miss.push('Project name');
    if (!form.startDate) miss.push('Start date');
    if (!form.endDate) miss.push('End date');
    if (!file) miss.push('HOD letter');
    if (miss.length) { setError(`Please fill: ${miss.join(', ')}.`); return; }
    if (new Date(form.endDate) <= new Date(form.startDate)) { setError('End date must be after start date.'); return; }

    const fd = new FormData();
    fd.append('projectName', form.projectName.trim());
    fd.append('startDate', form.startDate);
    fd.append('endDate', form.endDate);
    if (form.continueProjectId) fd.append('continueProjectId', form.continueProjectId);
    fd.append('hodLetter', file);

    setSaving(true);
    try {
      await assignmentService.submitRequest(fd);
      setOkMsg('Request submitted — you\'ll be notified once the admin approves it.');
      setForm({ projectName: '', startDate: '', endDate: '', continueProjectId: null });
      setProjKey((k) => k + 1);
      setFile(null);
      await load();
      refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not submit your request.');
    } finally {
      setSaving(false);
    }
  };

  if (blocked) {
    return (
      <>
        <div className="st-page-head">
          <span className="st-eyebrow"><FileText size={13} strokeWidth={2.4} /> Requests</span>
          <h1 className="st-h1">My Requests</h1>
          <p className="st-sub">Request lab access with your project details and HOD letter.</p>
        </div>
        <div className="st-card">
          <div className="st-lock-panel">
            <div className="st-lock-ico"><Lock size={26} strokeWidth={2.2} /></div>
            <h3>Your account is blocked</h3>
            <p>
              You&apos;ve reached your no-show strike limit, so all lab functions — including raising
              requests — are locked. Please contact your admin to reactivate your account.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="st-page-head">
        <span className="st-eyebrow"><FileText size={13} strokeWidth={2.4} /> Requests</span>
        <h1 className="st-h1">My Requests <InfoHint text="Request lab access with your project details and HOD letter. Track approvals and access IDs here." /></h1>
      </div>

      {/* New request */}
      <div className="st-card">
        <div className="st-card-head">
          <span className="st-card-ico"><CalendarRange size={18} /></span>
          <div><h3>Raise a request <InfoHint text="Approved requests get an access ID you can book slots with." /></h3></div>
        </div>

        {hasPending ? (
          <div className="st-banner st-banner--warn" style={{ marginBottom: '1rem' }}>
            <span className="st-banner-icon"><AlertCircle size={18} /></span>
            <p className="st-banner-text">You have a request awaiting review. Please wait for it to be finalised before raising another.</p>
          </div>
        ) : null}

        {error ? <div className="st-err" style={{ marginBottom: '0.75rem' }}><AlertCircle size={14} /> {error}</div> : null}
        {okMsg ? (
          <div className="st-banner" style={{ marginBottom: '1rem', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 28%, transparent)', color: 'var(--color-success-dark)' }}>
            <span className="st-banner-icon"><CheckCircle2 size={18} /></span>
            <p className="st-banner-text">{okMsg}</p>
          </div>
        ) : null}

        <form onSubmit={submit} className="st-grid" style={{ gap: '1rem' }}>
          <div className="st-field">
            <label className="st-label" htmlFor="pn">Project name <span className="st-req">*</span></label>
            <ProjectNameField
              key={projKey}
              id="pn"
              viewer="student"
              value={form.projectName}
              disabled={hasPending || saving}
              onChange={({ name, continueProjectId }) => {
                setForm((f) => ({ ...f, projectName: name, continueProjectId }));
                setError(''); setOkMsg('');
              }}
            />
          </div>
          <div className="st-grid st-grid--2" style={{ gap: '1rem' }}>
            <div className="st-field">
              <label className="st-label" htmlFor="sd">Start date <span className="st-req">*</span></label>
              <input id="sd" type="date" className="st-input" value={form.startDate} min={todayStr()} onChange={change('startDate')} disabled={hasPending || saving} />
            </div>
            <div className="st-field">
              <label className="st-label" htmlFor="ed">End date <span className="st-req">*</span></label>
              <input id="ed" type="date" className="st-input" value={form.endDate} min={form.startDate || todayStr()} onChange={change('endDate')} disabled={hasPending || saving} />
            </div>
          </div>
          <div className="st-field">
            <label className="st-label">HOD letter <span className="st-req">*</span></label>
            <label className={`st-file ${file ? 'is-filled' : ''}`}>
              <span className="st-file-ico">{file ? <FileCheck2 size={18} /> : <UploadCloud size={19} />}</span>
              <span className="st-file-text">
                {file ? (
                  <>
                    <span className="st-file-title">{file.name}</span>
                    <span className="st-file-hint">{fmtSize(file.size)} · click to replace</span>
                  </>
                ) : (
                  <>
                    <span className="st-file-title">Click to upload your signed HOD letter</span>
                    <span className="st-file-hint">PDF, DOC, JPG or PNG</span>
                  </>
                )}
              </span>
              <input type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png" onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} disabled={hasPending || saving} />
              {file ? (
                <button type="button" className="st-btn st-btn--ghost st-btn--sm" style={{ marginLeft: 'auto', position: 'relative', zIndex: 1 }} onClick={(e) => { e.preventDefault(); setFile(null); }}>
                  <X size={14} /> Remove
                </button>
              ) : null}
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="st-btn st-btn--primary" disabled={hasPending || saving}>
              {saving ? 'Submitting…' : <><Check size={16} /> Submit request</>}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="st-card">
        <div className="st-card-head">
          <span className="st-card-ico"><FileText size={18} /></span>
          <div><h3>Request history <InfoHint text="Every request you've raised and its current status." /></h3></div>
        </div>

        {loading ? (
          <div className="st-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="st-empty">
            <div className="st-empty-ico"><FileText size={24} /></div>
            <h3>No requests yet</h3>
            <p>Raise your first request above to get an access ID.</p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr><th>Project</th><th>Window</th><th>Status</th><th>Access ID</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-heading)' }}>{r.projectName}</td>
                    <td>{r.startDate && r.endDate ? `${r.startDate} → ${r.endDate}` : '—'}</td>
                    <td><span className={`st-pill ${STATUS_PILL[r.status] || 'st-pill--muted'}`}><span className="st-dot" />{statusLabel(r.status)}</span></td>
                    <td>{r.referenceId && r.referenceId !== '--' ? <span className="st-ref">{r.referenceId}</span> : <span style={{ color: 'var(--color-muted)' }}>—</span>}</td>
                    <td>{r.submittedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
