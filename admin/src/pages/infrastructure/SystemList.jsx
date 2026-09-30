// ============================================================
// PAGE: SystemList  (Module 3.5 — Infrastructure)
// ------------------------------------------------------------
// Renders the systems of one lab as refined "spec-sheet" panels:
// a header bar (name + device + status + actions) over a clean,
// aligned configuration grid, with a live storage-usage meter.
//
// NOTE: rendered INSIDE LabDetailsModal — it does not fetch its
// own data. The parent (LabList) passes the systems array down.
// ============================================================
import React from 'react';
import { Pencil, Trash2, Server } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import '../labs/LabList.css';

const systemStatusTone = (status) => (
    status === 'AVAILABLE' ? 'success' : status === 'OCCUPIED' ? 'warning' : 'neutral'
);

const getOccupancySummary = (systems) => {
    const total = systems.length;
    const occupied = systems.filter((system) => system.status === 'OCCUPIED').length;
    const available = total - occupied;
    return { total, occupied, available };
};

// "1.38 TB" / "477 GB" / "149 GB" -> gigabytes (number) so we can draw a meter
const toGB = (value) => {
    if (!value) return null;
    const match = String(value).match(/([\d.]+)\s*(TB|GB|MB)/i);
    if (!match) return null;
    const amount = parseFloat(match[1]);
    if (Number.isNaN(amount)) return null;
    const unit = match[2].toUpperCase();
    if (unit === 'TB') return amount * 1024;
    if (unit === 'MB') return amount / 1024;
    return amount;
};

// one label/value pair in the spec grid — hidden entirely if blank
const Spec = ({ label, value }) => {
    if (!value) return null;
    return (
        <div className="sys-spec">
            <span className="sys-spec-k">{label}</span>
            <span className="sys-spec-v">{value}</span>
        </div>
    );
};

function SystemList({ systems, onEdit, onDelete, showOccupancy = true }) {
    if (!systems || systems.length === 0) {
        return <div className="lab-detail-empty">No systems available for this lab.</div>;
    }

    const { total, occupied, available } = getOccupancySummary(systems);

    return (
        <>
            {showOccupancy && (
                <div className="occupancy-strip">
                    <div className="occupancy-chip occupancy-chip-total">
                        <span>Total</span>
                        <strong>{total}</strong>
                    </div>
                    <div className="occupancy-chip occupancy-chip-available">
                        <span>Available</span>
                        <strong>{available}</strong>
                    </div>
                    <div className="occupancy-chip occupancy-chip-occupied">
                        <span>Occupied</span>
                        <strong>{occupied}</strong>
                    </div>
                </div>
            )}

            <ul className="sys-list">
                {systems.map((system) => {
                    const hasSpecs = Boolean(
                        system.deviceName || system.model || system.processor
                        || system.ram || system.graphics || system.storage
                    );
                    const ram = [system.ram, system.ramSpeed].filter(Boolean).join(' · ');

                    const totalGB = toGB(system.storage);
                    const usedGB = toGB(system.storageUsed);
                    const hasMeter = totalGB && usedGB != null && totalGB > 0;
                    const usedPct = hasMeter ? Math.min(100, Math.round((usedGB / totalGB) * 100)) : 0;
                    const meterTone = usedPct >= 90 ? 'is-danger' : usedPct >= 75 ? 'is-warning' : '';

                    return (
                        <li className="sys-item" key={system.id}>
                            <div className="sys-item-bar">
                                <div className="sys-id">
                                    <span className="sys-id-badge"><Server size={17} strokeWidth={2.1} /></span>
                                    <div className="sys-id-text">
                                        <span className="sys-id-name">{system.name}</span>
                                        {system.deviceName ? <span className="sys-id-device">{system.deviceName}</span> : null}
                                    </div>
                                </div>
                                <div className="sys-item-actions">
                                    <StatusBadge label={system.status} tone={systemStatusTone(system.status)} />
                                    <div className="sys-btns">
                                        <button
                                            className="sys-btn"
                                            type="button"
                                            onClick={() => onEdit(system)}
                                            title={`Edit ${system.name}`}
                                            aria-label={`Edit ${system.name}`}
                                        >
                                            <Pencil size={15} strokeWidth={2.2} />
                                        </button>
                                        <button
                                            className="sys-btn sys-btn--danger"
                                            type="button"
                                            onClick={() => onDelete(system)}
                                            title={`Delete ${system.name}`}
                                            aria-label={`Delete ${system.name}`}
                                        >
                                            <Trash2 size={15} strokeWidth={2.2} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {hasSpecs ? (
                                <div className="sys-body">
                                    <div className="sys-specs">
                                        <Spec label="Model" value={system.model} />
                                        <Spec label="Processor" value={system.processor} />
                                        <Spec label="Memory" value={ram} />
                                        <Spec label="Graphics" value={system.graphics} />
                                    </div>

                                    {system.storage ? (
                                        <div className={`sys-storage ${hasMeter ? meterTone : ''}`}>
                                            <div className="sys-storage-head">
                                                <span className="sys-spec-k">Storage</span>
                                                <span className="sys-storage-num">
                                                    {system.storageUsed ? <b>{system.storageUsed}</b> : null}
                                                    {system.storageUsed ? <i> used of </i> : null}
                                                    <b>{system.storage}</b>
                                                    {hasMeter ? <span className="sys-storage-pct">{usedPct}%</span> : null}
                                                </span>
                                            </div>
                                            {hasMeter ? (
                                                <div className="sys-meter">
                                                    <div className="sys-meter-fill" style={{ width: `${usedPct}%` }} />
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="sys-body">
                                    <p className="sys-noconfig">Configuration not set yet — click <b>Edit</b> to add the specs.</p>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

export default SystemList;
