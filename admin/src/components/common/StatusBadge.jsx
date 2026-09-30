import React from 'react';
import './StatusBadge.css';

function StatusBadge({ label, tone = 'neutral' }) {
  const toneClass = tone === 'success' ? 'status-success' : tone === 'warning' ? 'status-warning' : tone === 'danger' ? 'status-danger' : 'status-neutral';

  return <span className={`status-badge ${toneClass}`}>{label}</span>;
}

export default StatusBadge;
