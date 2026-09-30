// ============================================================
// CONTEXT: ConfirmContext  (global confirmation dialog)
// ------------------------------------------------------------
// Exposes a promise-based confirm() so ANY component can ask
// "are you sure?" with a single shared dialog:
//
//   const confirm = useConfirm();
//   const ok = await confirm({ title, message, tone: 'danger' });
//   if (!ok) return;   // user cancelled
//
// One ConfirmDialog is rendered at the provider level, so there
// is never more than one confirmation modal in the tree.
// ============================================================
import React, { createContext, useCallback, useContext, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  // holds the current request: { options, resolve } — null when closed
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setRequest({ options, resolve });
      }),
    []
  );

  const settle = useCallback(
    (result) => {
      setRequest((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(request)}
        {...(request?.options || {})}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

// Returns confirm(options) => Promise<boolean>. Safe fallback to
// window.confirm if used outside the provider (shouldn't happen).
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    return (options = {}) => Promise.resolve(window.confirm(options.message || 'Are you sure?'));
  }
  return confirm;
}
