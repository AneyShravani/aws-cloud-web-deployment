// ============================================================
// PAGE: StudentProfile  (read-only identity + access summary)
// ------------------------------------------------------------
// Always reachable. Shows who the account belongs to, the org, the
// current access ID/window, and a shortcut to change the password
// (reuses the existing forgot-password OTP flow).
// ============================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Mail, Hash, Building2, GraduationCap, KeyRound, ShieldAlert, LockKeyhole } from 'lucide-react';
import { useStudentAccess } from '../../context/StudentAccessContext';
import { formatDate } from '../../utils/expiry';
import InfoHint from '../../components/common/InfoHint';
import '../../components/student/student.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export default function StudentProfile() {
  const navigate = useNavigate();
  const { profile, access, strike, loading } = useStudentAccess();

  if (loading) return <div className="st-card"><div className="st-empty">Loading…</div></div>;

  const tiles = [
    { ico: <UserRound size={18} />, label: 'Full name', value: profile?.name || '—' },
    { ico: <Mail size={18} />, label: 'College email', value: profile?.email || '—' },
    { ico: <Hash size={18} />, label: 'Roll / ID', value: profile?.rollNumber || '—' },
    { ico: <Building2 size={18} />, label: 'Department', value: profile?.department || '—' },
    { ico: <GraduationCap size={18} />, label: 'User type', value: cap(profile?.userType) },
    { ico: <Building2 size={18} />, label: 'Organization', value: profile?.organizationName || '—' },
  ];

  const hasAccess = access?.state && access.state !== 'none';

  return (
    <>
      <div className="st-page-head">
        <span className="st-eyebrow"><UserRound size={13} strokeWidth={2.4} /> Profile</span>
        <h1 className="st-h1">Profile <InfoHint text="Your account details and current lab access. These are managed by your admin." /></h1>
      </div>

      <div className="st-card">
        <div className="st-card-head">
          <span className="st-card-ico"><UserRound size={18} /></span>
          <div><h3>Account <InfoHint text="Managed by your admin — contact them to change these." /></h3></div>
        </div>
        <div className="st-grid st-grid--3">
          {tiles.map((t) => (
            <div className="st-tile" key={t.label}>
              <span className="st-tile-ico">{t.ico}</span>
              <span className="st-tile-meta">
                <span className="st-tile-label">{t.label}</span>
                <span className="st-tile-value">{t.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="st-grid st-grid--2">
        <div className="st-card">
          <div className="st-card-head">
            <span className="st-card-ico"><KeyRound size={18} /></span>
            <div><h3>Current access <InfoHint text="Your active approval, if any." /></h3></div>
          </div>
          {hasAccess ? (
            <div className="st-grid" style={{ gap: '0.7rem' }}>
              <div className="st-tile"><span className="st-tile-ico"><KeyRound size={18} /></span><span className="st-tile-meta"><span className="st-tile-label">Access ID</span><span className="st-tile-value st-ref">{access.referenceId}</span></span></div>
              <div className="st-tile"><span className="st-tile-ico"><Building2 size={18} /></span><span className="st-tile-meta"><span className="st-tile-label">Project</span><span className="st-tile-value">{access.projectName || '—'}</span></span></div>
              <div className="st-tile"><span className="st-tile-ico"><GraduationCap size={18} /></span><span className="st-tile-meta"><span className="st-tile-label">Valid until</span><span className="st-tile-value">{formatDate(access.endDate) || '—'}</span></span></div>
            </div>
          ) : (
            <div className="st-empty"><p>No active access. Raise a request to get an access ID.</p></div>
          )}
        </div>

        <div className="st-card">
          <div className="st-card-head">
            <span className="st-card-ico"><ShieldAlert size={18} /></span>
            <div><h3>Standing &amp; security <InfoHint text="Your no-show strikes and password options." /></h3></div>
          </div>
          <div className={`st-strike st-strike--${strike?.tone || 'safe'}`} style={{ marginBottom: '1rem' }}>
            <span className="st-strike-ico"><ShieldAlert size={20} strokeWidth={2.2} /></span>
            <div className="st-strike-meta">
              <span className="st-strike-title">{strike?.remaining ?? 0} / {strike?.limit ?? 0} strikes left</span>
              <span className="st-strike-sub">Blocked after {strike?.limit ?? 0} missed slots.</span>
            </div>
          </div>
          <button type="button" className="st-btn st-btn--ghost" onClick={() => navigate('/forgot-password')}>
            <LockKeyhole size={15} /> Change password
          </button>
        </div>
      </div>
    </>
  );
}
