// ============================================================
// COMPONENT: StudentBanner
// ------------------------------------------------------------
// The top-of-screen notification a student sees about their access.
// Driven by StudentAccessContext — mirrors the admin near-expiry /
// expired alerts:
//   nearing -> amber "expires in N days, renew"
//   expired -> red "permission expired, raise a new request"
//   blocked -> red "account blocked (no-shows)" (rarely seen —
//              a blocked account usually can't log in)
// active / none render nothing here (Home shows the full status).
// ============================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarX, ShieldX } from 'lucide-react';
import { useStudentAccess } from '../../context/StudentAccessContext';
import './student.css';

export default function StudentBanner() {
  const navigate = useNavigate();
  const { access, strike } = useStudentAccess();

  const blocked = strike?.tone === 'blocked';
  const state = access?.state;

  if (!blocked && state !== 'nearing' && state !== 'expired') return null;

  let tone = 'warn';
  let Icon = AlertTriangle;
  let text = '';
  let cta = 'Raise a request';

  if (blocked) {
    tone = 'danger';
    Icon = ShieldX;
    text = 'Your account is blocked after too many missed slots. Contact your admin to reactivate it.';
    cta = null;
  } else if (state === 'expired') {
    tone = 'danger';
    Icon = CalendarX;
    text = `Your access${access.referenceId ? ` (${access.referenceId})` : ''} has expired. Raise a new request to keep using the lab.`;
  } else if (state === 'nearing') {
    tone = 'warn';
    Icon = AlertTriangle;
    const d = access.daysLeft;
    const when = d === 0 ? 'today' : d === 1 ? 'in 1 day' : d > 1 ? `in ${d} days` : 'soon';
    text = `Your access${access.referenceId ? ` (${access.referenceId})` : ''} expires ${when}. Raise a new request to renew it.`;
  }

  return (
    <div className={`st-banner st-banner--${tone}`} role="alert">
      <span className="st-banner-icon"><Icon size={18} strokeWidth={2.2} /></span>
      <p className="st-banner-text">{text}</p>
      {cta ? (
        <button type="button" className="st-banner-cta" onClick={() => navigate('/student/requests')}>
          {cta}
        </button>
      ) : null}
    </div>
  );
}
