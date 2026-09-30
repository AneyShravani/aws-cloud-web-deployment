// ============================================================
// PAGE: StudentHome  (the portal landing / status screen)
// ------------------------------------------------------------
// Always reachable — this is where a student sees their current
// access at a glance (ID, project, window, countdown), their
// no-show strike meter, and the way forward (book a slot / raise a
// request). The banner above (StudentBanner) carries the near-expiry
// / expired / blocked alert.
// ============================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, CalendarDays, FolderGit2, ShieldAlert, CalendarPlus, FilePlus2, ArrowRight } from 'lucide-react';
import { useStudentAccess } from '../../context/StudentAccessContext';
import { formatDate, expiryHint } from '../../utils/expiry';
import InfoHint from '../../components/common/InfoHint';
import '../../components/student/student.css';

const STATE_UI = {
  active: { label: 'Active', pill: 'st-pill--active' },
  nearing: { label: 'Expiring soon', pill: 'st-pill--nearing' },
  expired: { label: 'Expired', pill: 'st-pill--expired' },
  none: { label: 'No access yet', pill: 'st-pill--none' },
};

function StrikeMeter({ strike }) {
  const total = strike?.limit || 0;
  const used = strike?.count || 0;
  const remaining = strike?.remaining ?? Math.max(0, total - used);
  const tone = strike?.tone || 'safe';
  const title = tone === 'blocked' ? 'Account blocked' : tone === 'risk' ? 'At risk' : 'Good standing';
  const sub = tone === 'blocked'
    ? 'Too many missed slots — contact your admin to reactivate.'
    : `${remaining} of ${total} no-show strike${total === 1 ? '' : 's'} left. Missing a booked slot costs one.`;

  return (
    <div className={`st-strike st-strike--${tone}`}>
      <span className="st-strike-ico"><ShieldAlert size={20} strokeWidth={2.2} /></span>
      <div className="st-strike-meta">
        <span className="st-strike-title">{title}</span>
        <span className="st-strike-sub">{sub}</span>
      </div>
      <span className="st-strike-dots" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`st-strike-dot ${i < used ? 'is-used' : 'is-left'}`} />
        ))}
      </span>
    </div>
  );
}

export default function StudentHome() {
  const navigate = useNavigate();
  const { profile, access, strike, loading, canBook, blocked } = useStudentAccess();

  if (loading) {
    return <div className="st-card"><div className="st-empty">Loading your account…</div></div>;
  }

  const ui = STATE_UI[access?.state] || STATE_UI.none;
  const hasAccess = access?.state && access.state !== 'none';
  const firstName = (profile?.name || 'there').split(' ')[0];

  return (
    <>
      <div className="st-page-head">
        <span className="st-eyebrow"><KeyRound size={13} strokeWidth={2.4} /> Your access</span>
        <h1 className="st-h1">Welcome back, {firstName}</h1>
        <p className="st-sub">Here's your lab access status and what you can do next.</p>
      </div>

      {/* Access hero */}
      <div className="st-hero">
        <h2>{hasAccess ? 'Lab access' : 'No active access yet'}</h2>
        <p>
          {hasAccess
            ? `${ui.label}${access.daysLeft != null ? ` · ${expiryHint(access.daysLeft)}` : ''}`
            : 'Raise a request to get your access ID and start booking lab slots.'}
        </p>
        {hasAccess && access.referenceId ? (
          <span className="st-hero-id"><KeyRound size={16} strokeWidth={2.4} /> {access.referenceId}</span>
        ) : null}
        {hasAccess ? (
          <div className="st-hero-facts">
            <div className="st-hero-fact"><span>Project</span><strong>{access.projectName || '—'}</strong></div>
            <div className="st-hero-fact"><span>From</span><strong>{formatDate(access.startDate) || '—'}</strong></div>
            <div className="st-hero-fact"><span>Until</span><strong>{formatDate(access.endDate) || '—'}</strong></div>
          </div>
        ) : null}
      </div>

      {/* Status + strike */}
      <div className="st-grid st-grid--2">
        <div className="st-card">
          <div className="st-card-head">
            <span className="st-card-ico"><CalendarDays size={18} /></span>
            <div><h3>Access status <InfoHint text="Live status of your approval window." /></h3></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className={`st-pill ${ui.pill}`}><span className="st-dot" />{ui.label}</span>
            {hasAccess && access.daysLeft != null ? (
              <span className="st-sub">{expiryHint(access.daysLeft)}</span>
            ) : null}
          </div>
        </div>

        <div className="st-card">
          <div className="st-card-head">
            <span className="st-card-ico"><ShieldAlert size={18} /></span>
            <div><h3>No-show strikes <InfoHint text="Booked slots you don't attend count as strikes." /></h3></div>
          </div>
          <StrikeMeter strike={strike} />
        </div>
      </div>

      {/* Next actions */}
      <div className="st-card">
        <div className="st-card-head">
          <span className="st-card-ico"><FolderGit2 size={18} /></span>
          <div><h3>What next? <InfoHint text="Jump straight to what you need." /></h3></div>
        </div>
        <div className="st-grid st-grid--2">
          <button
            type="button"
            className="st-tile"
            style={{ cursor: canBook ? 'pointer' : 'not-allowed', textAlign: 'left', width: '100%', opacity: canBook ? 1 : 0.6 }}
            onClick={() => canBook && navigate('/student/bookings')}
            disabled={!canBook}
          >
            <span className="st-tile-ico"><CalendarPlus size={18} /></span>
            <span className="st-tile-meta">
              <span className="st-tile-label">Book a slot</span>
              <span className="st-tile-value">{canBook ? 'Reserve a lab system' : 'Needs active access'}</span>
            </span>
            <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-muted)' }} />
          </button>

          <button
            type="button"
            className="st-tile"
            style={{ cursor: blocked ? 'not-allowed' : 'pointer', textAlign: 'left', width: '100%', opacity: blocked ? 0.6 : 1 }}
            onClick={() => !blocked && navigate('/student/requests')}
            disabled={blocked}
          >
            <span className="st-tile-ico"><FilePlus2 size={18} /></span>
            <span className="st-tile-meta">
              <span className="st-tile-label">{hasAccess ? 'Renew / new request' : 'Raise a request'}</span>
              <span className="st-tile-value">{blocked ? 'Account blocked — contact admin' : 'Submit project + HOD letter'}</span>
            </span>
            <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-muted)' }} />
          </button>
        </div>
      </div>
    </>
  );
}
