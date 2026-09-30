// ============================================================
// COMPONENT: ViewToggle
// ------------------------------------------------------------
// A segmented "Cards / Table" switch. Hidden on desktop (the
// table is always shown there) and only appears on mobile /
// tablet, where the user chooses between stacked cards and a
// horizontally-scrolling table. Pair it with useTableView().
// ============================================================
import React from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import './ViewToggle.css';

export default function ViewToggle({ view, onChange, className = '' }) {
    return (
        <div className={`view-toggle ${className}`} role="group" aria-label="Choose how to view the data">
            <button
                type="button"
                className={`view-toggle-btn ${view === 'grid' ? 'is-active' : ''}`}
                onClick={() => onChange('grid')}
                aria-pressed={view === 'grid'}
                title="Card view"
            >
                <LayoutGrid size={14} strokeWidth={2.2} />
                <span>Cards</span>
            </button>
            <button
                type="button"
                className={`view-toggle-btn ${view === 'table' ? 'is-active' : ''}`}
                onClick={() => onChange('table')}
                aria-pressed={view === 'table'}
                title="Table view"
            >
                <Table2 size={14} strokeWidth={2.2} />
                <span>Table</span>
            </button>
        </div>
    );
}
