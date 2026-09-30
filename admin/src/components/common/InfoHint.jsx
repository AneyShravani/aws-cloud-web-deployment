// ============================================================
// COMPONENT: InfoHint  (global "?" help affordance)
// ------------------------------------------------------------
// Replaces static section descriptions with a small question-mark
// icon beside the heading. The description appears in an animated
// tooltip on hover / keyboard focus, and toggles on click for
// touch. One component, used everywhere, so help copy is consistent
// and never clutters the layout.
//
// Usage:  <h1>Utilization <InfoHint text="What this page does…" /></h1>
// Rich content:  <InfoHint><strong>Tip</strong> …</InfoHint>
// ============================================================
import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import './InfoHint.css';

export default function InfoHint({ text, children, label = 'More information' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const content = children ?? text;

  return (
    <span
      className="info-hint"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-hint-btn"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle size={15} strokeWidth={2.2} />
      </button>
      <span id={id} role="tooltip" className={`info-hint-pop ${open ? 'is-open' : ''}`}>
        {content}
      </span>
    </span>
  );
}
