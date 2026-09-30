// ============================================================
// PAGE: UtilizationList  (Module 3.6 — Utilization)
// ------------------------------------------------------------
// One unified section: every project (Assignment) with its access
// ID, live status, holder, window, and the admin's close-out —
// completed (tool / live URL / deployment) or incomplete. This
// drives the access-ID continuation lifecycle. The old free-form
// per-tool "records" table has been folded into this single view.
// ============================================================
import React from 'react';
import { BarChart3 } from 'lucide-react';
import ProjectCloseout from './ProjectCloseout';
import InfoHint from '../../components/common/InfoHint';
import './UtilizationList.css';

export default function UtilizationList() {
  return (
    <div className="util-page">
      <header className="util-headbar">
        <div className="util-heading">
          <span className="util-eyebrow"><BarChart3 size={14} strokeWidth={2.4} /> Project tracking</span>
          <h1 className="util-title">Utilization <InfoHint text="Every student's project — access ID, live status, tool, deployment and completion, all in one place. Mark a project completed or incomplete once its window ends to control whether its access ID can be continued." /></h1>
        </div>
      </header>

      <ProjectCloseout />
    </div>
  );
}
