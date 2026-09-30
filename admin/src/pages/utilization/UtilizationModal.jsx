// ============================================================
// COMPONENT: UtilizationModal  (Module 3.6 — Utilization)
// ------------------------------------------------------------
// A pop-up dialog that ADDS or EDITS a utilization record.
//
//   • ADD  — student (dropdown from assignments), tool, project
//            (auto-filled from the student's assignment but still
//            editable), status, live URL, deployment active.
//   • EDIT — student / tool / project are shown locked; only
//            status, live URL and deployment active are editable
//            (matches the backend PUT which merges those three).
//
// Backdrop is blurred and clicking outside does NOT close the
// dialog, so a stray click can't wipe half-typed data — only the
// ✕ or Cancel button closes it.
// ============================================================
import React, { useEffect, useState } from 'react';
import { Rocket, Pencil, AlertCircle, Check, X, CheckCircle2, Circle } from 'lucide-react';
import utilizationService from '../../services/utilizationService';
import assignmentService from '../../services/assignmentService';

// well-formed http/https URL? empty is allowed (liveUrl is optional)
const isValidUrl = (value) => {
    if (!value.trim()) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const EMPTY = { labUserId: '', toolName: '', projectName: '', status: 'not_done', liveUrl: '', isActive: true };

export default function UtilizationModal({ open, editing, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [assignments, setAssignments] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(editing);

    // (re)seed the form each time the dialog opens
    useEffect(() => {
        if (!open) return;
        if (editing) {
            setForm({
                labUserId: editing.labUserId?._id || '',
                toolName: editing.toolName || '',
                projectName: editing.projectName || '',
                status: editing.status || 'not_done',
                liveUrl: editing.liveUrl || '',
                isActive: editing.isActive ?? true,
            });
        } else {
            setForm(EMPTY);
        }
        setError('');
    }, [open, editing]);

    // load assignments only for ADD mode (student dropdown source)
    useEffect(() => {
        if (!open || isEdit) return;
        setLoadingAssignments(true);
        assignmentService
            .getAll()
            .then((res) => {
                const list = Array.isArray(res)
                    ? res
                    : Array.isArray(res?.data)
                        ? res.data
                        : Array.isArray(res?.assignments)
                            ? res.assignments
                            : [];
                setAssignments(list);
            })
            .catch(() => setError('Failed to load the student list.'))
            .finally(() => setLoadingAssignments(false));
    }, [open, isEdit]);

    // lock background scroll while the dialog is open
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    const setStatus = (status) => setForm((f) => ({ ...f, status }));
    const toggleActive = () => setForm((f) => ({ ...f, isActive: !f.isActive }));

    const handleStudentSelect = (e) => {
        const selectedId = e.target.value;
        const matched = assignments.find(
            (a) => a.labUserId?._id === selectedId || a.labUserId === selectedId
        );
        setForm((f) => ({
            ...f,
            labUserId: selectedId,
            projectName: matched ? (matched.projectName || f.projectName) : f.projectName,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isEdit && (!form.labUserId || !form.toolName.trim() || !form.projectName.trim())) {
            setError('Student, tool name and project name are required.');
            return;
        }
        if (!isValidUrl(form.liveUrl)) {
            setError('Live URL must be a valid http:// or https:// link, or left blank.');
            return;
        }

        setSaving(true);
        try {
            if (isEdit) {
                await utilizationService.update(editing._id, {
                    status: form.status,
                    liveUrl: form.liveUrl.trim(),
                    isActive: form.isActive,
                });
            } else {
                await utilizationService.create({
                    labUserId: form.labUserId,
                    toolName: form.toolName.trim(),
                    projectName: form.projectName.trim(),
                    status: form.status,
                    liveUrl: form.liveUrl.trim(),
                    isActive: form.isActive,
                });
            }
            onSaved?.();
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'add'} record.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        // NOTE: no onClick on the backdrop — clicking outside must NOT close.
        <div className="util-modal-backdrop" role="presentation">
            <div className="util-modal" role="dialog" aria-modal="true" aria-labelledby="util-modal-title">
                <div className="util-modal-head">
                    <span className="util-modal-icon">{isEdit ? <Pencil size={19} strokeWidth={2.2} /> : <Rocket size={19} strokeWidth={2.2} />}</span>
                    <div className="util-modal-head-text">
                        <h3 className="util-modal-title" id="util-modal-title">{isEdit ? 'Update record' : 'Add utilization record'}</h3>
                        <p className="util-modal-sub">{isEdit ? `${editing.labUserId?.name || 'Student'} · ${editing.toolName}` : 'Track a student, their tool and project — mark it live once deployed.'}</p>
                    </div>
                    <button type="button" className="util-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
                        <X size={18} />
                    </button>
                </div>

                <form className="util-modal-body" onSubmit={handleSubmit}>
                    {error ? <div className="util-modal-error"><AlertCircle size={16} /> {error}</div> : null}

                    {isEdit ? (
                        <div className="util-locked">
                            <span className="util-locked-value">{editing.labUserId?.name || 'Student'}</span>
                            <span className="util-locked-sub">{editing.toolName} · {editing.projectName}</span>
                        </div>
                    ) : (
                        <>
                            <div className="util-field">
                                <label className="util-label" htmlFor="labUserId">Student <span className="util-req">*</span></label>
                                <select id="labUserId" name="labUserId" className="util-input" value={form.labUserId} onChange={handleStudentSelect} disabled={loadingAssignments}>
                                    <option value="">{loadingAssignments ? 'Loading students…' : 'Select a student'}</option>
                                    {assignments.map((a) => {
                                        const studentObj = typeof a.labUserId === 'object' ? a.labUserId : null;
                                        const studentId = studentObj?._id || a.labUserId;
                                        const studentName = studentObj?.name || a.name || 'Unknown Student';
                                        const rollNumber = studentObj?.rollNumber || a.rollNumber || '';
                                        return (
                                            <option key={a._id} value={studentId}>
                                                {studentName}{rollNumber ? ` (${rollNumber})` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="util-field-grid">
                                <div className="util-field">
                                    <label className="util-label" htmlFor="toolName">Tool / model <span className="util-req">*</span></label>
                                    <input id="toolName" name="toolName" className="util-input" value={form.toolName} onChange={handleChange} placeholder="e.g. Claude, Google Flow" autoComplete="off" />
                                </div>
                                <div className="util-field">
                                    <label className="util-label" htmlFor="projectName">Project <span className="util-req">*</span></label>
                                    <input id="projectName" name="projectName" className="util-input" value={form.projectName} onChange={handleChange} placeholder="e.g. Lab attendance app" autoComplete="off" />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="util-field">
                        <label className="util-label">Status</label>
                        <div className="util-seg" role="group" aria-label="Status">
                            <button type="button" className={`util-seg-btn ${form.status === 'not_done' ? 'is-active' : ''}`} onClick={() => setStatus('not_done')} aria-pressed={form.status === 'not_done'}>
                                <Circle size={14} /> Not done
                            </button>
                            <button type="button" className={`util-seg-btn ${form.status === 'done' ? 'is-active' : ''}`} onClick={() => setStatus('done')} aria-pressed={form.status === 'done'}>
                                <CheckCircle2 size={14} /> Done
                            </button>
                        </div>
                    </div>

                    <div className="util-field">
                        <label className="util-label" htmlFor="liveUrl">Live URL <span className="util-optional">· only if deployed</span></label>
                        <input id="liveUrl" name="liveUrl" className="util-input" value={form.liveUrl} onChange={handleChange} placeholder="https://your-project.example.com" autoComplete="off" />
                    </div>

                    <label className={`util-switch ${form.isActive ? 'is-on' : ''}`}>
                        <span className="util-switch-text">
                            <span className="util-switch-title">Deployment active</span>
                            <span className="util-switch-sub">Is this project currently live and running?</span>
                        </span>
                        <input type="checkbox" checked={form.isActive} onChange={toggleActive} />
                        <span className="util-switch-track" aria-hidden="true" />
                    </label>

                    <div className="util-modal-actions">
                        <button type="button" className="util-btn util-btn-ghost" onClick={onClose} disabled={saving}>
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="util-btn util-btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : isEdit ? <><Check size={16} /> Save changes</> : <><Rocket size={16} /> Add record</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
