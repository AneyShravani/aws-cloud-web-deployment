// ============================================================
// PAGE: ApprovedUsers  (Module — Approved Users)
// ------------------------------------------------------------
// Everyone whose request the admin approved (an Assignment/
// access-pass exists). Admin can review the details, preview the
// uploaded HOD letter, edit the profile + window, or remove the
// user (with a confirm dialog). Table ⇄ Cards on mobile/tablet.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    UserCheck, ShieldCheck, Clock3, Hash, Building2, FileText, Pencil, Trash2,
    AlertCircle, CheckCircle2, X, ExternalLink, ArrowRight, Inbox,
} from 'lucide-react';
import assignmentService from '../../services/assignmentService';
import api from '../../services/api';
import InfoHint from '../../components/common/InfoHint';
import { useConfirm } from '../../context/ConfirmContext';
import ViewToggle from '../../components/common/ViewToggle';
import useTableView from '../../hooks/useTableView';
import ApprovedUserModal from './ApprovedUserModal';
import './ApprovedUsers.css';

const LIVE_LABEL = { ACTIVE: 'Active', NEARING_EXPIRY: 'Nearing expiry', EXPIRED: 'Expired' };

const initialsOf = (name = '') => {
    const p = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (!p.length) return '#';
    return (p[0][0] + (p[1]?.[0] || p[0][1] || '')).toUpperCase();
};
const prettyDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ApprovedUsers() {
    const confirm = useConfirm();
    const [view, setView] = useTableView();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const [editing, setEditing] = useState(null);          // approved user being edited
    const [letter, setLetter] = useState(null);            // { url?, type?, name, loading?, error? }

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await assignmentService.getAll();
            setUsers(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load approved users.');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        if (!feedback) return undefined;
        const t = setTimeout(() => setFeedback(''), 5000);
        return () => clearTimeout(t);
    }, [feedback]);

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter((u) => u.liveStatus === 'ACTIVE').length;
        const nearing = users.filter((u) => u.liveStatus === 'NEARING_EXPIRY').length;
        return { total, active, nearing };
    }, [users]);

    // ---- HOD letter preview (authenticated blob) ----
    const openLetter = async (u) => {
        if (!u.hodLetterPath) return;
        const filename = u.hodLetterPath.split('/').pop();
        setLetter({ name: filename, loading: true });
        try {
            const res = await api.get(`/assignments/uploads/${filename}`, { responseType: 'blob' });
            const blob = res.data;
            const url = URL.createObjectURL(blob);
            setLetter({ url, type: blob.type || '', name: filename, loading: false });
        } catch {
            setLetter({ name: filename, loading: false, error: 'Could not load the letter.' });
        }
    };
    const closeLetter = () => {
        setLetter((cur) => { if (cur?.url) URL.revokeObjectURL(cur.url); return null; });
    };
    // clean up any object URL on unmount
    useEffect(() => () => { if (letter?.url) URL.revokeObjectURL(letter.url); }, [letter]);

    const handleEdited = async () => { setEditing(null); setFeedback('Approved user updated.'); await fetchUsers(); };

    const handleDelete = async (u) => {
        const ok = await confirm({
            title: 'Remove this approved user?',
            message: `${u.name}${u.referenceId ? ` (${u.referenceId})` : ''} will be permanently removed along with their access pass and any slot bookings. This cannot be undone.`,
            confirmLabel: 'Remove user',
            tone: 'danger',
        });
        if (!ok) return;
        setDeletingId(u._id);
        setError('');
        try {
            await assignmentService.remove(u._id);
            setFeedback('Approved user removed.');
            await fetchUsers();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not remove the user.');
        } finally {
            setDeletingId(null);
        }
    };

    const feedbackIsError = false;

    return (
        <div className="au-page">
            {/* ---------- Header ---------- */}
            <header className="au-headbar">
                <div className="au-heading">
                    <span className="au-eyebrow"><UserCheck size={14} strokeWidth={2.4} /> User access</span>
                    <h1 className="au-title">Approved users <InfoHint text="Everyone approved for lab access. Preview their HOD letter, edit their details or window, or remove them." /></h1>
                </div>
            </header>

            {/* ---------- Stat cards ---------- */}
            <div className="au-stats">
                <div className="au-stat" style={{ '--au-accent': 'var(--color-primary)' }}>
                    <span className="au-stat-ico"><UserCheck size={22} strokeWidth={2.1} /></span>
                    <div className="au-stat-body">
                        <span className="au-stat-value">{stats.total}</span>
                        <span className="au-stat-label">Approved users</span>
                    </div>
                </div>
                <div className="au-stat" style={{ '--au-accent': 'var(--color-teal)' }}>
                    <span className="au-stat-ico"><ShieldCheck size={22} strokeWidth={2.1} /></span>
                    <div className="au-stat-body">
                        <span className="au-stat-value">{stats.active}</span>
                        <span className="au-stat-label">Active</span>
                    </div>
                </div>
                <div className="au-stat" style={{ '--au-accent': 'var(--color-warning)' }}>
                    <span className="au-stat-ico"><Clock3 size={22} strokeWidth={2.1} /></span>
                    <div className="au-stat-body">
                        <span className="au-stat-value">{stats.nearing}</span>
                        <span className="au-stat-label">Nearing expiry</span>
                    </div>
                </div>
            </div>

            {error ? <div className="au-note is-error"><AlertCircle size={16} /> {error}</div> : null}
            {feedback ? <div className={`au-note ${feedbackIsError ? 'is-error' : ''}`}><CheckCircle2 size={16} /> {feedback}</div> : null}

            {/* ---------- Records ---------- */}
            <section className="au-records">
                <div className="au-records-head">
                    <div className="au-records-title-wrap">
                        <h3 className="au-records-title">Approved users</h3>
                        {!loading && users.length > 0 ? <span className="au-records-count">{users.length} {users.length === 1 ? 'user' : 'users'}</span> : null}
                    </div>
                    <div className="au-records-tools">
                        <ViewToggle view={view} onChange={setView} />
                    </div>
                </div>

                {loading ? (
                    <div className="au-loading">Loading approved users…</div>
                ) : users.length === 0 ? (
                    <div className="au-empty">
                        <div className="au-empty-icon"><Inbox size={26} /></div>
                        <h3>No approved users yet</h3>
                        <p>Approve a request and the user will appear here with their access pass.</p>
                        <Link to="/requests" className="au-btn au-btn-primary" style={{ marginTop: '0.9rem' }}>
                            Go to Requests <ArrowRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <div className="au-table-scroll tv-scroll" data-view={view}>
                        <table className="au-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Type</th>
                                    <th>Project</th>
                                    <th>Window</th>
                                    <th>Access ID</th>
                                    <th>Status</th>
                                    <th>HOD letter</th>
                                    <th className="au-actions-col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u._id} className={deletingId === u._id ? 'is-deleting' : ''}>
                                        <td data-label="User">
                                            <div className="au-user">
                                                <span className="au-badge">{initialsOf(u.name)}</span>
                                                <span className="au-user-meta">
                                                    <span className="au-user-name">{u.name}</span>
                                                    <span className="au-user-sub">
                                                        <Hash size={11} style={{ verticalAlign: '-1px' }} /> {u.rollNumber || '—'}
                                                        {u.department ? <> · {u.department}</> : null}
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Type">{u.userType ? <span className="au-type-chip">{u.userType}</span> : <span className="au-letter-none">—</span>}</td>
                                        <td data-label="Project">{u.projectName || '—'}</td>
                                        <td data-label="Window"><span className="au-window">{prettyDate(u.startDate)} <span className="au-window-sep">→</span> {prettyDate(u.endDate)}</span></td>
                                        <td data-label="Access ID"><span className="au-refid">{u.referenceId || '—'}</span></td>
                                        <td data-label="Status"><span className={`au-status au-status-${u.liveStatus}`}><span className="au-status-dot" /> {LIVE_LABEL[u.liveStatus] || u.liveStatus}</span></td>
                                        <td data-label="HOD letter">
                                            {u.hodLetterPath ? (
                                                <button type="button" className="au-letter-btn" onClick={() => openLetter(u)}>
                                                    <FileText size={14} /> View
                                                </button>
                                            ) : <span className="au-letter-none">—</span>}
                                        </td>
                                        <td className="au-actions-col" data-label="Actions">
                                            <div className="au-row-actions">
                                                <button type="button" className="au-icon-btn" onClick={() => setEditing(u)} title="Edit" aria-label={`Edit ${u.name}`}>
                                                    <Pencil size={15} />
                                                </button>
                                                <button type="button" className="au-icon-btn au-icon-btn--danger" onClick={() => handleDelete(u)} disabled={deletingId === u._id} title="Remove" aria-label={`Remove ${u.name}`}>
                                                    <Trash2 size={15} />
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

            {/* ---------- Edit modal ---------- */}
            <ApprovedUserModal open={Boolean(editing)} user={editing} onClose={() => setEditing(null)} onSaved={handleEdited} />

            {/* ---------- HOD letter preview ---------- */}
            {letter ? (
                <div className="au-modal-backdrop" role="presentation">
                    <div className="au-modal au-modal--letter" role="dialog" aria-modal="true" aria-label="HOD letter">
                        <div className="au-modal-head">
                            <span className="au-modal-icon"><FileText size={19} strokeWidth={2.2} /></span>
                            <div className="au-modal-head-text">
                                <h3 className="au-modal-title">HOD letter</h3>
                                <p className="au-modal-sub">{letter.name}</p>
                            </div>
                            <button type="button" className="au-modal-close" onClick={closeLetter} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="au-letter-body">
                            {letter.loading ? (
                                <div className="au-letter-state">Opening letter…</div>
                            ) : letter.error ? (
                                <div className="au-letter-state"><AlertCircle size={22} /> {letter.error}</div>
                            ) : letter.type?.startsWith('image/') ? (
                                <img className="au-letter-img" src={letter.url} alt={letter.name} />
                            ) : letter.type === 'application/pdf' ? (
                                <iframe className="au-letter-frame" src={letter.url} title={letter.name} />
                            ) : (
                                <div className="au-letter-state">
                                    <FileText size={26} />
                                    This file type can’t be previewed here. Open it in a new tab instead.
                                </div>
                            )}
                        </div>
                        <div className="au-letter-foot">
                            <span className="au-letter-name">{letter.name}</span>
                            {letter.url ? (
                                <a className="au-mini-btn" href={letter.url} target="_blank" rel="noreferrer">
                                    <ExternalLink size={14} /> Open in new tab
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
