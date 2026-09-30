// ============================================================
// COMPONENT: ApprovedUserModal  (Approved Users module)
// ------------------------------------------------------------
// Edit an approved user: their profile (name / roll / department
// / user type) and the approval window (project + dates). Saves
// via assignmentService.update(assignmentId, ...). Backdrop does
// NOT close it — only the ✕ or Cancel.
// ============================================================
import React, { useEffect, useState } from 'react';
import { Pencil, AlertCircle, Check, X } from 'lucide-react';
import assignmentService from '../../services/assignmentService';

const USER_TYPES = ['student', 'faculty', 'hod', 'hr', 'employee'];
const dayValue = (v) => (v ? String(v).slice(0, 10) : '');

export default function ApprovedUserModal({ open, user, onClose, onSaved }) {
    const [form, setForm] = useState({
        name: '', rollNumber: '', department: '', userType: 'student',
        projectName: '', startDate: '', endDate: '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !user) return;
        setForm({
            name: user.name || '',
            rollNumber: user.rollNumber || '',
            department: user.department || '',
            userType: user.userType || 'student',
            projectName: user.projectName || '',
            startDate: dayValue(user.startDate),
            endDate: dayValue(user.endDate),
        });
        setError('');
    }, [open, user]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open || !user) return null;

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const required = ['name', 'rollNumber', 'department', 'projectName', 'startDate', 'endDate'];
        if (required.some((k) => !String(form[k]).trim())) {
            setError('All fields are required.');
            return;
        }
        if (new Date(form.endDate) <= new Date(form.startDate)) {
            setError('End date must be after start date.');
            return;
        }

        setSaving(true);
        try {
            await assignmentService.update(user._id, {
                name: form.name.trim(),
                rollNumber: form.rollNumber.trim(),
                department: form.department.trim(),
                userType: form.userType,
                projectName: form.projectName.trim(),
                startDate: form.startDate,
                endDate: form.endDate,
            });
            onSaved?.();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not update the user.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="au-modal-backdrop" role="presentation">
            <div className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-edit-title">
                <div className="au-modal-head">
                    <span className="au-modal-icon"><Pencil size={19} strokeWidth={2.2} /></span>
                    <div className="au-modal-head-text">
                        <h3 className="au-modal-title" id="au-edit-title">Edit approved user</h3>
                        <p className="au-modal-sub">{user.referenceId ? `Access ID ${user.referenceId}` : 'Update details & window'}</p>
                    </div>
                    <button type="button" className="au-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
                        <X size={18} />
                    </button>
                </div>

                <form className="au-modal-body" onSubmit={handleSubmit}>
                    {error ? <div className="au-modal-error"><AlertCircle size={16} /> {error}</div> : null}

                    <div className="au-field-grid">
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-name">Full name <span className="au-req">*</span></label>
                            <input id="au-name" name="name" className="au-input" value={form.name} onChange={handleChange} autoComplete="off" autoFocus />
                        </div>
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-roll">Roll number <span className="au-req">*</span></label>
                            <input id="au-roll" name="rollNumber" className="au-input" value={form.rollNumber} onChange={handleChange} autoComplete="off" />
                        </div>
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-dept">Department <span className="au-req">*</span></label>
                            <input id="au-dept" name="department" className="au-input" value={form.department} onChange={handleChange} autoComplete="off" />
                        </div>
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-type">User type</label>
                            <select id="au-type" name="userType" className="au-input" value={form.userType} onChange={handleChange}>
                                {USER_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="au-field">
                        <label className="au-label" htmlFor="au-project">Project name <span className="au-req">*</span></label>
                        <input id="au-project" name="projectName" className="au-input" value={form.projectName} onChange={handleChange} autoComplete="off" />
                    </div>

                    <div className="au-field-grid">
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-start">Start date <span className="au-req">*</span></label>
                            <input id="au-start" name="startDate" type="date" className="au-input" value={form.startDate} onChange={handleChange} />
                        </div>
                        <div className="au-field">
                            <label className="au-label" htmlFor="au-end">End date <span className="au-req">*</span></label>
                            <input id="au-end" name="endDate" type="date" className="au-input" value={form.endDate} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="au-modal-actions">
                        <button type="button" className="au-btn au-btn-ghost" onClick={onClose} disabled={saving}>
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="au-btn au-btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : <><Check size={16} /> Save changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
