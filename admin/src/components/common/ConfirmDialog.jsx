// ============================================================
// COMPONENT: ConfirmDialog
// ------------------------------------------------------------
// The single, app-wide "are you sure?" dialog. It is dumb/
// presentational — visibility and result are driven by
// ConfirmContext (useConfirm). Not meant to be used directly;
// call useConfirm() instead.
// ============================================================
import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import './ConfirmDialog.css';

function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger', // 'danger' | 'default'
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Esc = cancel, and move focus to the confirm button on open
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    confirmRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = tone === 'danger' ? Trash2 : AlertTriangle;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`confirm-icon confirm-icon-${tone}`}>
          <Icon size={26} strokeWidth={2} />
        </div>

        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <button type="button" className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`confirm-btn confirm-btn-confirm-${tone}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
