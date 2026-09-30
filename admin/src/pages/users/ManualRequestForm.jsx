// ============================================================
// COMPONENT: ManualRequestForm  (Module 3.7)
// ------------------------------------------------------------
// Admin-side version of the student request form, for walk-in
// users who bring a physical HOD letter. Captures the SAME data
// a student would enter themselves (name, roll no, department,
// user type, project, dates, HOD letter) and posts it to the
// admin request endpoint. Backend tags it source: 'manual'.
// ============================================================
import React, { useState } from 'react';
import { UserPlus, ChevronDown, UploadCloud, FileText, X, AlertCircle, Check, Mail, UserCheck, Sparkles, Loader2 } from 'lucide-react';
import assignmentService from '../../services/assignmentService';
import userService from '../../services/userService';
import { useConfirm } from '../../context/ConfirmContext';
import ProjectNameField from '../../components/common/ProjectNameField';
import './ManualRequestForm.css';

const emailIsValid = (v) => /^\S+@\S+\.\S+$/.test((v || '').trim());

const USER_TYPES = ['student', 'faculty', 'hod', 'hr', 'employee'];

// today's calendar day as YYYY-MM-DD (admin runs in IST); used to block
// windows that end in the past — those can never be booked.
const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ManualRequestForm({ onClose, onApproved }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    email: '',
    name: '',
    rollNumber: '',
    department: '',
    userType: 'student',
    projectName: '',
    continueProjectId: null,
    startDate: '',
    endDate: '',
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // account lookup by email: 'idle' | 'checking' | 'found' | 'new'
  const [lookup, setLookup] = useState({ status: 'idle' });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const handleEmailChange = (event) => {
    setForm((prev) => ({ ...prev, email: event.target.value }));
    setErrors((prev) => ({ ...prev, email: '' }));
    setLookup({ status: 'idle' }); // reset until they blur / re-check
    setSubmitError('');
  };

  // On blur, look the email up. Found → autofill identity from the account.
  // Not found → flag as a new user (account will be created on approve).
  const handleEmailBlur = async () => {
    const email = form.email.trim();
    if (!emailIsValid(email)) return;
    setLookup({ status: 'checking' });
    try {
      const res = await userService.lookup(email);
      if (res?.user) {
        setForm((prev) => ({
          ...prev,
          name: res.user.name || prev.name,
          rollNumber: res.user.rollNumber || prev.rollNumber,
          department: res.user.department || prev.department,
          userType: res.user.userType || prev.userType,
        }));
        setLookup({ status: 'found' });
      } else {
        setLookup({ status: 'new' });
      }
    } catch {
      setLookup({ status: 'idle' });
    }
  };

  const handleFile = (event) => {
    setFile(event.target.files[0] || null);
    setErrors((prev) => ({ ...prev, hodLetter: '' }));
    setSubmitError('');
  };

  const clearFile = () => {
    setFile(null);
    setErrors((prev) => ({ ...prev, hodLetter: '' }));
  };

  const validate = () => {
    const next = {};
    ['name', 'rollNumber', 'department', 'projectName', 'startDate', 'endDate'].forEach((field) => {
      if (!String(form[field]).trim()) next[field] = 'Required.';
    });
    if (!form.email.trim()) next.email = 'Required.';
    else if (!emailIsValid(form.email)) next.email = 'Enter a valid email.';
    if (!file) next.hodLetter = 'HOD letter is required.';
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      next.endDate = 'End date must be after start date.';
    }
    // A window that ends in the past is unbookable — block it up front.
    if (form.endDate && form.endDate < todayStr()) {
      next.endDate = "End date can't be in the past.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    // Manual walk-ins are approved right here — confirm before issuing the pass.
    // Message differs for an existing account vs a brand-new one.
    const isNew = lookup.status === 'new';
    const ok = await confirm({
      title: 'Approve this user?',
      message: isNew
        ? `No account exists for ${form.email.trim()} — it will be created and login credentials emailed, then their access ID is issued.`
        : `This will issue an access ID for ${form.name.trim() || 'the user'}.`,
      confirmLabel: 'Yes, approve',
    });
    if (!ok) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('email', form.email.trim());
      formData.append('name', form.name.trim());
      formData.append('rollNumber', form.rollNumber.trim());
      formData.append('department', form.department.trim());
      formData.append('userType', form.userType);
      formData.append('projectName', form.projectName.trim());
      if (form.continueProjectId) formData.append('continueProjectId', form.continueProjectId);
      formData.append('startDate', form.startDate);
      formData.append('endDate', form.endDate);
      formData.append('hodLetter', file);

      // 1) create the request record, 2) approve it to mint the access ID
      const created = await assignmentService.createRequest(formData);
      const labUserId = created?.data?._id || created?.data?.id;
      if (!labUserId) throw new Error('Could not read the created user.');

      const approved = await assignmentService.approve(labUserId, {
        projectName: form.projectName.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });

      onApproved?.({ name: form.name.trim(), referenceId: approved.referenceId });
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error?.message || 'Unable to approve the user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (id, label, { type = 'text', placeholder = '', full = false, min } = {}) => (
    <div className={`mrf-field ${full ? 'mrf-field--full' : ''}`}>
      <label className="mrf-label" htmlFor={id}>
        {label} <span className="mrf-req" aria-hidden="true">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        min={min}
        value={form[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`mrf-input ${errors[id] ? 'has-error' : ''}`}
      />
      {errors[id] ? (
        <span className="mrf-error">
          <AlertCircle size={13} strokeWidth={2.4} />
          {errors[id]}
        </span>
      ) : null}
    </div>
  );

  return (
    <form className="mrf-form" onSubmit={handleSubmit}>
      <div className="mrf-intro">
        <span className="mrf-intro-icon">
          <UserPlus size={20} strokeWidth={2.2} />
        </span>
        <p>
          Enter the user's <strong>college email</strong> — if they already have an account, their
          details fill in automatically. Add the project, dates and HOD letter, then approve to issue
          their access ID. A brand-new email gets an account + emailed login on approve.
        </p>
      </div>

      <div className="mrf-grid">
        {/* Email drives an account lookup + autofill */}
        <div className="mrf-field mrf-field--full">
          <label className="mrf-label" htmlFor="email">
            College email <span className="mrf-req" aria-hidden="true">*</span>
          </label>
          <div className="mrf-email-wrap">
            <Mail size={15} className="mrf-email-icon" />
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              placeholder="name@college.edu"
              autoComplete="off"
              className={`mrf-input mrf-input--email ${errors.email ? 'has-error' : ''}`}
            />
          </div>
          {errors.email ? (
            <span className="mrf-error"><AlertCircle size={13} strokeWidth={2.4} /> {errors.email}</span>
          ) : lookup.status === 'checking' ? (
            <span className="mrf-lookup"><Loader2 size={13} className="mrf-spin" /> Checking…</span>
          ) : lookup.status === 'found' ? (
            <span className="mrf-lookup is-found"><UserCheck size={13} strokeWidth={2.4} /> Existing account — details autofilled.</span>
          ) : lookup.status === 'new' ? (
            <span className="mrf-lookup is-new"><Sparkles size={13} strokeWidth={2.4} /> New user — an account will be created &amp; credentials emailed on approve.</span>
          ) : null}
        </div>

        {field('name', 'Full name', { placeholder: 'Student / employee name' })}
        {field('rollNumber', 'Roll number', { placeholder: 'e.g. CS101' })}
        {field('department', 'Department', { placeholder: 'e.g. CSE' })}

        <div className="mrf-field">
          <label className="mrf-label" htmlFor="userType">User type</label>
          <div className="mrf-select-wrap">
            <select
              id="userType"
              name="userType"
              value={form.userType}
              onChange={handleChange}
              className="mrf-select"
            >
              {USER_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <ChevronDown className="mrf-select-arrow" size={16} strokeWidth={2.2} />
          </div>
        </div>

        <div className="mrf-field mrf-field--full">
          <label className="mrf-label" htmlFor="projectName">
            Project name <span className="mrf-req" aria-hidden="true">*</span>
          </label>
          <ProjectNameField
            id="projectName"
            viewer="admin"
            value={form.projectName}
            error={errors.projectName}
            onChange={({ name, continueProjectId }) => {
              setForm((f) => ({ ...f, projectName: name, continueProjectId }));
              setErrors((e) => ({ ...e, projectName: '' }));
              setSubmitError('');
            }}
          />
        </div>
        {field('startDate', 'Start date', { type: 'date' })}
        {field('endDate', 'End date', { type: 'date', min: todayStr() })}

        <div className="mrf-field mrf-field--full">
          <label className="mrf-label" htmlFor="hodLetter">
            HOD letter <span className="mrf-req" aria-hidden="true">*</span>
          </label>
          <label className={`mrf-dropzone ${file ? 'is-filled' : ''} ${errors.hodLetter ? 'has-error' : ''}`}>
            <span className="mrf-dz-icon">
              {file ? <FileText size={18} strokeWidth={2} /> : <UploadCloud size={20} strokeWidth={2} />}
            </span>
            <span className="mrf-dz-text">
              {file ? (
                <>
                  <span className="mrf-dz-title">{file.name}</span>
                  <span className="mrf-dz-hint">{formatSize(file.size)} · click to replace</span>
                </>
              ) : (
                <>
                  <span className="mrf-dz-title">
                    <span className="mrf-dz-accent">Click to upload</span> the HOD letter
                  </span>
                  <span className="mrf-dz-hint">PDF, DOC, JPG or PNG</span>
                </>
              )}
            </span>
            <input
              id="hodLetter"
              name="hodLetter"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png"
              onChange={handleFile}
            />
            {file ? (
              <button
                type="button"
                className="mrf-dz-remove"
                onClick={(e) => { e.preventDefault(); clearFile(); }}
                aria-label="Remove file"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            ) : null}
          </label>
          {errors.hodLetter ? (
            <span className="mrf-error">
              <AlertCircle size={13} strokeWidth={2.4} />
              {errors.hodLetter}
            </span>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div className="mrf-submit-error" role="alert">
          <AlertCircle size={18} strokeWidth={2.2} />
          {submitError}
        </div>
      ) : null}

      <div className="mrf-actions">
        <button type="button" className="mrf-btn mrf-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="mrf-btn mrf-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Approving…' : <><Check size={16} strokeWidth={2.4} /> Approve user</>}
        </button>
      </div>
    </form>
  );
}

export default ManualRequestForm;
