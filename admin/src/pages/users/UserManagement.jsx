// ============================================================
// PAGE: UserManagement  (Admin — onboard people)
// ------------------------------------------------------------
// The admin creates login ACCOUNTS (name + college email + type).
// A temporary password is emailed; the user resets it on first
// login and can then raise requests themselves. No access ID is
// issued here — that happens only when a request is approved.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  UsersRound, UserPlus, Search, Mail, Hash, Building2, Send, Check, X,
  AlertCircle, CheckCircle2, Ban, RotateCcw, ShieldAlert, MailPlus, MailWarning,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import userService from '../../services/userService';
import { useConfirm } from '../../context/ConfirmContext';
import './UserManagement.css';

const USER_TYPES = ['student', 'faculty', 'hod', 'hr', 'employee'];
const EMPTY = { name: '', email: '', rollNumber: '', department: '', userType: 'student', strikeLimit: 3 };

// derive the strike meter from a user row (backend sends u.strike; fall back to raw counts)
const strikeOf = (u) => {
  if (u.strike) return u.strike;
  const limit = u.strikeLimit ?? 3;
  const count = u.strikeCount ?? 0;
  const remaining = Math.max(0, limit - count);
  let tone = 'safe';
  if (!u.isActive && u.blockedReason === 'STRIKES') tone = 'blocked';
  else if (remaining <= 2) tone = 'risk';
  return { limit, count, remaining, tone };
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const initialsOf = (name = '') => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
};

export default function UserManagement() {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  // create modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // reactivate modal (asks for a fresh strike allowance)
  const [reactUser, setReactUser] = useState(null);
  const [reactLimit, setReactLimit] = useState(3);
  const [reactBusy, setReactBusy] = useState(false);

  // add-email modal (onboard a legacy account-less user)
  const [emailTarget, setEmailTarget] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userService.getAll();
      setUsers(Array.isArray(res?.users) ? res.users : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(''), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.rollNumber, u.department, u.userType]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [users, search]);

  const openCreate = () => { setForm(EMPTY); setFormErr(''); setOpen(true); };
  const change = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setFormErr(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFormErr('Name and college email are required.');
      return;
    }
    setSubmitting(true);
    setFormErr('');
    try {
      const res = await userService.create({
        name: form.name.trim(),
        email: form.email.trim(),
        rollNumber: form.rollNumber.trim(),
        department: form.department.trim(),
        userType: form.userType,
        strikeLimit: Number(form.strikeLimit) || 3,
      });
      setOpen(false);
      setBanner(res?.emailSent === false
        ? `Account created, but the email could not be sent — share the credentials manually.`
        : `Account created — login credentials emailed to ${form.email.trim()}.`);
      await load();
    } catch (err) {
      setFormErr(err?.response?.data?.message || 'Could not create the user.');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async (u) => {
    const ok = await confirm({
      title: 'Resend credentials?',
      message: `A new temporary password will be generated and emailed to ${u.email}. Their current password stops working.`,
      confirmLabel: 'Resend',
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      const res = await userService.resend(u.id);
      setBanner(res?.emailSent === false ? 'New password set, but email failed to send.' : `New credentials emailed to ${u.email}.`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not resend credentials.');
    } finally {
      setBusyId('');
    }
  };

  // Deactivate is a simple confirm. Reactivate opens a modal that asks for a
  // fresh strike allowance ("how many strikes this time?") and resets the count.
  const toggleActive = async (u) => {
    if (u.isActive) {
      const ok = await confirm({
        title: 'Deactivate this account?',
        message: `${u.name} will no longer be able to log in. Their history is kept and you can reactivate anytime.`,
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
      setBusyId(u.id);
      try {
        await userService.setActive(u.id, false);
        setBanner(`${u.name} deactivated.`);
        await load();
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not update the account.');
      } finally {
        setBusyId('');
      }
      return;
    }
    // reactivating
    setReactUser(u);
    setReactLimit(u.strikeLimit || 3);
  };

  const openAddEmail = (u) => { setEmailTarget(u); setEmailValue(''); setEmailErr(''); };

  const submitAddEmail = async (e) => {
    e.preventDefault();
    const email = emailValue.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setEmailErr('Enter a valid email.'); return; }
    setEmailBusy(true);
    setEmailErr('');
    try {
      const res = await userService.attachEmail(emailTarget.labUserId, email);
      setBanner(res?.emailSent === false
        ? `Linked to an existing account for ${email}.`
        : `Account created — login credentials emailed to ${email}.`);
      setEmailTarget(null);
      await load();
    } catch (err) {
      setEmailErr(err?.response?.data?.message || 'Could not add the email.');
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmReactivate = async (e) => {
    e.preventDefault();
    if (!reactUser) return;
    const limit = Math.max(1, Number(reactLimit) || 1);
    setReactBusy(true);
    try {
      await userService.setActive(reactUser.id, true, limit);
      setBanner(`${reactUser.name} reactivated with ${limit} strike${limit === 1 ? '' : 's'}.`);
      setReactUser(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reactivate the account.');
    } finally {
      setReactBusy(false);
    }
  };

  return (
    <div className="um-page">
      <header className="um-headbar">
        <div className="um-heading">
          <span className="um-eyebrow"><UsersRound size={14} strokeWidth={2.4} /> User accounts</span>
          <h1 className="um-title">User Management <InfoHint text="Create login accounts for students, faculty and staff. Credentials are emailed automatically — no access ID is issued here (that happens when a request is approved)." /></h1>
        </div>
      </header>

      <div className="um-toolbar">
        <div className="um-search">
          <Search size={16} strokeWidth={2.2} />
          <input type="search" placeholder="Search by name, email, roll or type…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="um-btn um-btn--primary" onClick={openCreate}>
          <UserPlus size={16} strokeWidth={2.4} /> Create user
        </button>
      </div>

      {banner ? <div className="um-note"><CheckCircle2 size={16} /> {banner}</div> : null}
      {error ? <div className="um-note is-error"><AlertCircle size={16} /> {error}</div> : null}

      <section className="um-panel">
        {loading ? (
          <div className="um-state">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="um-state">
            <div className="um-state-icon"><UsersRound size={26} /></div>
            <h3>{users.length === 0 ? 'No users yet' : 'No matches'}</h3>
            <p>{users.length === 0 ? 'Create the first account — the person gets their login by email.' : 'Try a different search.'}</p>
          </div>
        ) : (
          <div className="um-table-scroll">
            <table className="um-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roll / Dept</th>
                  <th>Type</th>
                  <th>Strikes</th>
                  <th>Status</th>
                  <th className="um-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const acct = u.hasAccount;
                  const s = acct ? strikeOf(u) : null;
                  return (
                  <tr key={`${acct ? 'a' : 'l'}-${u.id}`} className={acct && !u.isActive ? 'is-inactive' : ''}>
                    <td data-label="User">
                      <div className="um-user">
                        <span className="um-avatar">{initialsOf(u.name)}</span>
                        <span className="um-user-meta">
                          <span className="um-user-name">{u.name}</span>
                          {acct ? (
                            <span className="um-user-email"><Mail size={12} /> {u.email}</span>
                          ) : (
                            <span className="um-user-email um-user-email--none"><MailWarning size={12} /> No email yet</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td data-label="Roll / Dept">
                      <span className="um-rd">{[u.rollNumber, u.department].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td data-label="Type"><span className="um-type">{cap(u.userType || 'student')}</span></td>
                    <td data-label="Strikes">
                      {acct ? (
                        <span className={`um-strikes um-strikes--${s.tone}`} title={`${s.count} of ${s.limit} strikes used`}>
                          <ShieldAlert size={13} strokeWidth={2.2} />
                          {s.count} / {s.limit}
                        </span>
                      ) : <span className="um-rd">—</span>}
                    </td>
                    <td data-label="Status">
                      {!acct ? (
                        <span className="um-status is-nologin"><span className="um-status-dot" />No login</span>
                      ) : !u.isActive && u.blockedReason === 'STRIKES' ? (
                        <span className="um-status is-blocked"><span className="um-status-dot" />Blocked · no-shows</span>
                      ) : (
                        <span className={`um-status ${u.isActive ? 'is-active' : 'is-off'}`}>
                          <span className="um-status-dot" />{u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      )}
                    </td>
                    <td className="um-actions-col" data-label="Actions">
                      <div className="um-row-actions">
                        {acct ? (
                          <>
                            <button type="button" className="um-icon-btn" title="Resend credentials" disabled={busyId === u.id} onClick={() => resend(u)}>
                              <Send size={15} />
                            </button>
                            <button
                              type="button"
                              className={`um-icon-btn ${u.isActive ? 'um-icon-btn--danger' : 'um-icon-btn--ok'}`}
                              title={u.isActive ? 'Deactivate' : 'Reactivate'}
                              disabled={busyId === u.id}
                              onClick={() => toggleActive(u)}
                            >
                              {u.isActive ? <Ban size={15} /> : <RotateCcw size={15} />}
                            </button>
                          </>
                        ) : (
                          <button type="button" className="um-btn um-btn--ghost um-btn--sm" onClick={() => openAddEmail(u)}>
                            <MailPlus size={14} /> Add email
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={open} title="Create user account" onClose={() => setOpen(false)} closeOnBackdrop={false}>
        <form className="um-form" onSubmit={submit}>
          {formErr ? <div className="um-note is-error"><AlertCircle size={15} /> {formErr}</div> : null}
          <div className="um-field">
            <label className="um-label" htmlFor="um-name">Full name <span className="um-req">*</span></label>
            <input id="um-name" className="um-input" value={form.name} onChange={change('name')} placeholder="e.g. Anita Sharma" autoComplete="off" autoFocus />
          </div>
          <div className="um-field">
            <label className="um-label" htmlFor="um-email">College email <span className="um-req">*</span></label>
            <div className="um-input-icon">
              <Mail size={15} />
              <input id="um-email" type="email" className="um-input" value={form.email} onChange={change('email')} placeholder="name@college.edu" autoComplete="off" />
            </div>
            <span className="um-hint">Login credentials are emailed here.</span>
          </div>
          <div className="um-field-row">
            <div className="um-field">
              <label className="um-label" htmlFor="um-roll"><Hash size={13} /> Roll / ID</label>
              <input id="um-roll" className="um-input" value={form.rollNumber} onChange={change('rollNumber')} placeholder="e.g. CS101" autoComplete="off" />
            </div>
            <div className="um-field">
              <label className="um-label" htmlFor="um-dept"><Building2 size={13} /> Department</label>
              <input id="um-dept" className="um-input" value={form.department} onChange={change('department')} placeholder="e.g. CSE" autoComplete="off" />
            </div>
          </div>
          <div className="um-field-row">
            <div className="um-field">
              <label className="um-label" htmlFor="um-type">User type</label>
              <select id="um-type" className="um-input um-select" value={form.userType} onChange={change('userType')}>
                {USER_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
            </div>
            <div className="um-field">
              <label className="um-label" htmlFor="um-strikes"><ShieldAlert size={13} /> No-show strikes allowed</label>
              <input id="um-strikes" type="number" min="1" max="50" className="um-input" value={form.strikeLimit} onChange={change('strikeLimit')} />
              <span className="um-hint">Account is blocked after this many missed slots.</span>
            </div>
          </div>
          <div className="um-form-actions">
            <button type="button" className="um-btn um-btn--ghost" onClick={() => setOpen(false)} disabled={submitting}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={submitting}>
              {submitting ? 'Creating…' : <><Check size={16} /> Create &amp; email login</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reactivate — set a fresh strike allowance and clear the block */}
      <Modal isOpen={!!reactUser} title="Reactivate account" onClose={() => setReactUser(null)} closeOnBackdrop={false}>
        <form className="um-form" onSubmit={confirmReactivate}>
          <p className="um-react-lead">
            <strong>{reactUser?.name}</strong> will be able to log in again and their strike count is reset to&nbsp;0.
            Set how many no-show strikes they are allowed this time.
          </p>
          <div className="um-field">
            <label className="um-label" htmlFor="um-react-strikes"><ShieldAlert size={13} /> No-show strikes allowed</label>
            <input
              id="um-react-strikes"
              type="number"
              min="1"
              max="50"
              className="um-input"
              value={reactLimit}
              onChange={(e) => setReactLimit(e.target.value)}
              autoFocus
            />
          </div>
          <div className="um-form-actions">
            <button type="button" className="um-btn um-btn--ghost" onClick={() => setReactUser(null)} disabled={reactBusy}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={reactBusy}>
              {reactBusy ? 'Reactivating…' : <><RotateCcw size={16} /> Reactivate</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add email — onboard a legacy user approved before accounts existed */}
      <Modal isOpen={!!emailTarget} title="Add email & send login" onClose={() => setEmailTarget(null)} closeOnBackdrop={false}>
        <form className="um-form" onSubmit={submitAddEmail}>
          <p className="um-react-lead">
            <strong>{emailTarget?.name}</strong> was approved before login accounts existed, so they have no email on file.
            Add their college email to create their account and email the credentials. Their roll &amp; department are kept from their record.
          </p>
          {emailErr ? <div className="um-note is-error"><AlertCircle size={15} /> {emailErr}</div> : null}
          <div className="um-field">
            <label className="um-label" htmlFor="um-attach-email">College email <span className="um-req">*</span></label>
            <div className="um-input-icon">
              <Mail size={15} />
              <input
                id="um-attach-email"
                type="email"
                className="um-input"
                value={emailValue}
                onChange={(e) => { setEmailValue(e.target.value); setEmailErr(''); }}
                placeholder="name@college.edu"
                autoComplete="off"
                autoFocus
              />
            </div>
            <span className="um-hint">Login credentials are emailed here.</span>
          </div>
          <div className="um-form-actions">
            <button type="button" className="um-btn um-btn--ghost" onClick={() => setEmailTarget(null)} disabled={emailBusy}>
              <X size={16} /> Cancel
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={emailBusy}>
              {emailBusy ? 'Sending…' : <><Check size={16} /> Create &amp; email login</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
