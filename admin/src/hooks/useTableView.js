// ============================================================
// HOOK: useTableView
// ------------------------------------------------------------
// Shared "Cards vs Table" preference for the responsive data
// tables (mobile / tablet only — desktop always shows the table).
// The choice is persisted in localStorage and kept in sync across
// every mounted toggle via a window event, so switching on one
// module carries over everywhere.
// ============================================================
import { useCallback, useEffect, useState } from 'react';

const KEY = 'admin:tableView';
const EVENT = 'admin:tableView:change';

const read = () => {
    try {
        return localStorage.getItem(KEY) === 'table' ? 'table' : 'grid';
    } catch {
        return 'grid';
    }
};

export default function useTableView() {
    const [view, setView] = useState(read);

    const update = useCallback((next) => {
        const v = next === 'table' ? 'table' : 'grid';
        setView(v);
        try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
    }, []);

    // keep every mounted instance in sync (same tab + other tabs)
    useEffect(() => {
        const onCustom = (e) => setView(e.detail === 'table' ? 'table' : 'grid');
        const onStorage = (e) => { if (e.key === KEY) setView(read()); };
        window.addEventListener(EVENT, onCustom);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(EVENT, onCustom);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    return [view, update];
}
