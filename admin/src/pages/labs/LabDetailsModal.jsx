// ============================================================
// COMPONENT: LabDetailsModal  (Module 3.4 / 3.5)
// ------------------------------------------------------------
// Bespoke details sheet for one lab. Owns its own overlay, hero
// header, close button, Esc-to-close and body scroll lock.
//
// Add Systems / Edit System happen INLINE here (the body swaps
// to the form) instead of stacking a second modal on top.
// Deletes are handled by the parent via the global confirm().
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  Building2,
  Layers,
  Hash,
  UserRound,
  Mail,
  CalendarPlus,
  Clock,
  Plus,
  X,
  ArrowLeft,
} from 'lucide-react';
import SystemList from '../infrastructure/SystemList';
import AddSystems from '../infrastructure/AddSystems';
import EditSystem from '../infrastructure/EditSystem';
import './LabDetailsModal.css';

const getOccupancy = (systems = []) => {
  const total = systems.length;
  const occupied = systems.filter((s) => s.status === 'OCCUPIED').length;
  const available = total - occupied;
  return { total, occupied, available };
};

function LabDetailsModal({ isOpen, isLoading, lab, onClose, onSystemsChanged, onDeleteSystem }) {
  // 'details' | 'add' | 'edit' — which view the body shows (no stacked modals)
  const [mode, setMode] = useState('details');
  const [editSystem, setEditSystem] = useState(null);

  // Esc to close + lock background scroll while open
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // always reopen on the details view
  useEffect(() => {
    if (isOpen) {
      setMode('details');
      setEditSystem(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const { total, occupied, available } = getOccupancy(lab?.systems);
  const availablePct = total ? (available / total) * 100 : 0;
  const occupiedPct = total ? (occupied / total) * 100 : 0;

  // after a system is added/edited: refresh parent data, then return to details
  const handleSystemsSaved = async () => {
    await onSystemsChanged?.();
    setMode('details');
    setEditSystem(null);
  };

  const startEdit = (system) => {
    setEditSystem(system);
    setMode('edit');
  };

  return (
    <div className="ld-overlay">
      <div
        className="ld-modal"
        role="dialog"
        aria-modal="true"
        aria-label={lab?.name ? `${lab.name} details` : 'Lab details'}
      >
        {isLoading || !lab ? (
          <div className="ld-loading">Loading lab details…</div>
        ) : (
          <>
            <header className="ld-hero">
              <span className="ld-hero-glow" aria-hidden="true" />
              <button className="ld-close" type="button" onClick={onClose} aria-label="Close">
                <X size={18} strokeWidth={2.4} />
              </button>

              <div className="ld-hero-main">
                <div className="ld-hero-icon">
                  <FlaskConical size={26} strokeWidth={2} />
                </div>
                <div className="ld-hero-text">
                  <p className="ld-hero-kicker">AI Lab</p>
                  <h2 className="ld-hero-title">{lab.name}</h2>
                  <span className="ld-hero-org">
                    <Building2 size={14} strokeWidth={2.2} />
                    {lab.organizationName}
                  </span>
                </div>
              </div>

              <div className="ld-hero-summary">
                <strong>{total}</strong>
                <span>{total === 1 ? 'System' : 'Systems'}</span>
              </div>
            </header>

            {mode === 'details' ? (
              <div className="ld-body">
                <dl className="ld-meta">
                  <div className="ld-meta-row" style={{ animationDelay: '0.02s' }}>
                    <span className="ld-meta-ico"><Building2 size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Building / Block</dt>
                      <dd>{lab.building || '—'}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.04s' }}>
                    <span className="ld-meta-ico"><Layers size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Floor</dt>
                      <dd>{lab.floor || '—'}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.06s' }}>
                    <span className="ld-meta-ico"><Hash size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Lab number</dt>
                      <dd>{lab.labNumber || '—'}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.08s' }}>
                    <span className="ld-meta-ico"><UserRound size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Created by</dt>
                      <dd>{lab.createdBy}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.09s' }}>
                    <span className="ld-meta-ico"><Mail size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Admin email</dt>
                      <dd>{lab.adminEmail}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.14s' }}>
                    <span className="ld-meta-ico"><CalendarPlus size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Created</dt>
                      <dd>{lab.createdAt}</dd>
                    </div>
                  </div>
                  <div className="ld-meta-row" style={{ animationDelay: '0.19s' }}>
                    <span className="ld-meta-ico"><Clock size={17} strokeWidth={2.1} /></span>
                    <div className="ld-meta-text">
                      <dt>Last updated</dt>
                      <dd>{lab.updatedAt}</dd>
                    </div>
                  </div>
                </dl>

                <div className="ld-systems-head">
                  <h3>Systems {total > 0 ? <span className="ld-sys-count">{total}</span> : null}</h3>
                  <button className="ld-add-btn" type="button" onClick={() => setMode('add')}>
                    <Plus size={16} strokeWidth={2.4} />
                    Add Systems
                  </button>
                </div>

                {total > 0 && (
                  <div className="ld-util">
                    <div
                      className="ld-util-bar"
                      role="img"
                      aria-label={`${available} available, ${occupied} occupied of ${total} systems`}
                    >
                      <div className="ld-util-seg-available" style={{ width: `${availablePct}%` }} />
                      <div className="ld-util-seg-occupied" style={{ width: `${occupiedPct}%` }} />
                    </div>
                    <div className="ld-util-legend">
                      <span><i className="ld-dot ld-dot-total" /> Total <b>{total}</b></span>
                      <span><i className="ld-dot ld-dot-available" /> Available <b>{available}</b></span>
                      <span><i className="ld-dot ld-dot-occupied" /> Occupied <b>{occupied}</b></span>
                    </div>
                  </div>
                )}

                <SystemList
                  systems={lab.systems}
                  onEdit={startEdit}
                  onDelete={onDeleteSystem}
                  showOccupancy={false}
                />
              </div>
            ) : (
              <div className="ld-body">
                <button className="ld-back" type="button" onClick={() => setMode('details')}>
                  <ArrowLeft size={16} strokeWidth={2.2} />
                  Back to details
                </button>
                <h3 className="ld-sub-title">{mode === 'add' ? 'Add Systems' : `Edit ${editSystem?.name || 'System'}`}</h3>

                {mode === 'add' ? (
                  <AddSystems
                    labId={lab.id}
                    onClose={() => setMode('details')}
                    onSave={handleSystemsSaved}
                  />
                ) : (
                  <EditSystem
                    system={editSystem}
                    onClose={() => setMode('details')}
                    onSave={handleSystemsSaved}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LabDetailsModal;
