// ============================================================
// PAGE: CheckInDesk  (Slot-Booking Module — v2, Phase 3)
// ------------------------------------------------------------
// The daily front-desk tool. Attendance is slot-aware and mostly
// automatic:
//   • Check-in is only allowed DURING the booked slot; it stamps
//     the real current time (11:15 for an 11:00–12:00 slot is fine).
//   • A slot that ends with no check-in auto-becomes NO_SHOW.
//   • A checked-in user whose slot ends without a check-out is
//     auto-completed (check-out stamped at the slot end).
//   • Check-out before the slot ends records an early finish.
// The "Today at the lab" table shows every slot with its live
// status and the one action that makes sense right now — no
// lookup required. The ID box just pulls up one user's slots.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarClock, Search, LogIn, LogOut, User, Hash, Building2, Clock, Monitor,
    CheckCircle2, AlertCircle, ArrowRight, Calendar,
} from 'lucide-react';
import InfoHint from '../../components/common/InfoHint';
import bookingService from '../../services/bookingService';
import ViewToggle from '../../components/common/ViewToggle';
import useTableView from '../../hooks/useTableView';
import './CheckInDesk.css';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayOf = (iso) => String(iso).slice(0, 10);
const prettyDay = (iso) => {
    const [y, m, d] = dayOf(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
const clockTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

// where "now" sits relative to a booking's slot on its date
const phaseOf = (b) => {
    const now = new Date();
    const [y, m, d] = dayOf(b.date).split('-').map(Number);
    const [sh, sm] = b.slotStart.split(':').map(Number);
    const [eh, em] = b.slotEnd.split(':').map(Number);
    const start = new Date(y, m - 1, d, sh, sm);
    const end = new Date(y, m - 1, d, eh, em);
    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'current';
};

const BOOKING_STATUS = { BOOKED: 'Booked', CHECKED_IN: 'Checked in', COMPLETED: 'Completed', NO_SHOW: 'No-show', CANCELLED: 'Cancelled' };
const LIVE_STATUS = { ACTIVE: 'Active', NEARING_EXPIRY: 'Nearing expiry', EXPIRED: 'Expired' };

function initialsOf(name = '') {
    const p = name.trim().split(/\s+/).filter(Boolean);
    return p.length ? (p[0][0] + (p[1]?.[0] || '')).toUpperCase() : '?';
}

function CheckInDesk() {
    const [refId, setRefId] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null); // booking id currently acting

    const [attendance, setAttendance] = useState([]);
    const [attLoading, setAttLoading] = useState(true);
    const [view, setView] = useTableView();

    const today = todayStr();

    const loadAttendance = useCallback(async () => {
        setAttLoading(true);
        try {
            const res = await bookingService.list({ date: today });
            setAttendance(Array.isArray(res?.data) ? res.data : []);
        } catch {
            setAttendance([]);
        } finally {
            setAttLoading(false);
        }
    }, [today]);

    useEffect(() => { loadAttendance(); }, [loadAttendance]);

    const doLookup = async (e) => {
        if (e) e.preventDefault();
        const id = refId.trim();
        if (!id) { setError('Enter a reference ID.'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await bookingService.lookup(id);
            setResult(res.data);
        } catch (err) {
            setResult(null);
            setError(err?.response?.data?.message || 'No user found for that reference ID.');
        } finally {
            setLoading(false);
        }
    };

    const refreshResult = async () => {
        if (!result) return;
        try {
            const res = await bookingService.lookup(result.assignment.referenceId);
            setResult(res.data);
        } catch { /* keep prior */ }
    };

    // slot-aware check-in / check-out — the backend enforces the timing rules
    const act = async (id, kind) => {
        setBusyId(id);
        setError('');
        try {
            if (kind === 'in') await bookingService.checkIn(id);
            else await bookingService.checkOut(id);
            await Promise.all([loadAttendance(), refreshResult()]);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not update attendance.');
        } finally {
            setBusyId(null);
        }
    };

    // the single action that makes sense for a booking right now (or null)
    const actionFor = (id, b) => {
        if (b.status === 'CHECKED_IN') {
            return (
                <button className="cid-act cid-act-out" onClick={() => act(id, 'out')} disabled={busyId === id}>
                    <LogOut size={14} /> {busyId === id ? '…' : 'Check out'}
                </button>
            );
        }
        if (b.status === 'BOOKED') {
            const phase = phaseOf(b);
            if (phase === 'current') {
                return (
                    <button className="cid-act cid-act-in" onClick={() => act(id, 'in')} disabled={busyId === id}>
                        <LogIn size={14} /> {busyId === id ? '…' : 'Check in'}
                    </button>
                );
            }
            if (phase === 'upcoming') return <span className="cid-muted">Starts {b.slotStart}</span>;
        }
        return null;
    };

    const grouped = useMemo(() => {
        const g = { today: [], upcoming: [] };
        for (const b of result?.bookings || []) {
            const d = dayOf(b.date);
            if (d === today) g.today.push(b);
            else if (d > today) g.upcoming.push(b);
        }
        return g;
    }, [result, today]);

    return (
        <div className="cid-page">
            <header className="cid-header">
                <span className="cid-eyebrow"><CalendarClock size={14} strokeWidth={2.4} /> Front desk</span>
                <h1 className="cid-title">Check-in desk <InfoHint text="Check students in and out for their slots. Check-in works only while a slot is live; missed slots and forgotten check-outs are handled automatically." /></h1>
            </header>

            {/* ---------- ID box ---------- */}
            <form className="cid-box" onSubmit={doLookup}>
                <Search size={18} className="cid-box-icon" />
                <input
                    className="cid-box-input"
                    placeholder="Enter access ID (e.g. TM-1042)"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    autoFocus
                />
                <button type="submit" className="cid-box-btn" disabled={loading}>
                    {loading ? 'Looking…' : 'Look up'}
                </button>
            </form>

            {error ? <div className="cid-error" role="alert"><AlertCircle size={16} /> {error}</div> : null}

            {/* ---------- Lookup result ---------- */}
            {result ? (
                <section className="cid-result">
                    <div className="cid-usercard">
                        <span className="cid-avatar">{initialsOf(result.user.name)}</span>
                        <div className="cid-user-meta">
                            <span className="cid-user-name">{result.user.name}</span>
                            <span className="cid-user-sub">
                                <Hash size={12} /> {result.user.rollNumber}
                                {result.user.department ? <> · <Building2 size={12} /> {result.user.department}</> : null}
                            </span>
                        </div>
                        <div className="cid-user-right">
                            <span className={`cid-livestatus cid-live-${result.assignment.liveStatus}`}>
                                {LIVE_STATUS[result.assignment.liveStatus] || result.assignment.liveStatus}
                            </span>
                            <span className="cid-refid">{result.assignment.referenceId}</span>
                        </div>
                    </div>

                    <div className="cid-window">
                        <span><Calendar size={13} /> {prettyDay(result.assignment.startDate)} → {prettyDay(result.assignment.endDate)}</span>
                        <span className="cid-project">{result.assignment.projectName}</span>
                    </div>

                    <div className="cid-section">
                        <h3 className="cid-section-title">Today’s slots</h3>
                        {grouped.today.length === 0 ? (
                            <p className="cid-empty">
                                No slots booked for today.
                                <Link to="/bookings" className="cid-inline-link">Open Bookings <ArrowRight size={13} /></Link>
                            </p>
                        ) : (
                            <div className="cid-bookings">
                                {grouped.today.map((b) => (
                                    <div className={`cid-booking cid-status-${b.status}`} key={b.bookingId}>
                                        <span className="cid-booking-slot"><Clock size={14} /> {b.slotStart}–{b.slotEnd}</span>
                                        <span className="cid-booking-sys"><Monitor size={14} /> {b.systemName}</span>
                                        <span className="cid-booking-status">{BOOKING_STATUS[b.status] || b.status}</span>
                                        <span className="cid-booking-times">
                                            {b.actualCheckIn ? `in ${clockTime(b.actualCheckIn)}` : ''}
                                            {b.actualCheckOut ? ` · out ${clockTime(b.actualCheckOut)}` : ''}
                                        </span>
                                        <span className="cid-booking-action">
                                            {actionFor(b.bookingId, b) || <CheckCircle2 size={15} className="cid-done-ic" />}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {grouped.upcoming.length > 0 ? (
                        <div className="cid-section">
                            <h3 className="cid-section-title">Upcoming</h3>
                            <div className="cid-upcoming">
                                {grouped.upcoming.map((b) => (
                                    <div className="cid-upcoming-row" key={b.bookingId}>
                                        <span><Calendar size={13} /> {prettyDay(b.date)}</span>
                                        <span><Clock size={13} /> {b.slotStart}–{b.slotEnd}</span>
                                        <span><Monitor size={13} /> {b.systemName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>
            ) : null}

            {/* ---------- Today at the lab (always visible) ---------- */}
            <section className="cid-attendance">
                <div className="cid-attendance-head">
                    <h3 className="cid-section-title">Today at the lab</h3>
                    <div className="cid-att-tools">
                        {!attLoading && attendance.length > 0 ? <ViewToggle view={view} onChange={setView} /> : null}
                        <span className="cid-attendance-date">{prettyDay(today)}</span>
                    </div>
                </div>
                {attLoading ? (
                    <p className="cid-empty">Loading…</p>
                ) : attendance.length === 0 ? (
                    <p className="cid-empty">No bookings for today yet.</p>
                ) : (
                    <div className="cid-att-scroll tv-scroll" data-view={view}>
                        <table className="cid-att-table">
                            <thead>
                                <tr><th>Slot</th><th>User</th><th>Access ID</th><th>System</th><th>Status</th><th>In</th><th>Out</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {attendance.map((b) => (
                                    <tr key={b._id}>
                                        <td className="cid-num" data-label="Slot">{b.slotStart}–{b.slotEnd}</td>
                                        <td data-label="User">{b.labUserId?.name || '—'}</td>
                                        <td className="cid-refcell" data-label="Access ID">{b.assignmentId?.referenceId || '—'}</td>
                                        <td data-label="System">{b.systemId?.name || '—'}</td>
                                        <td data-label="Status"><span className={`cid-tag cid-status-${b.status}`}>{BOOKING_STATUS[b.status] || b.status}</span></td>
                                        <td className="cid-num" data-label="In">{clockTime(b.actualCheckIn)}</td>
                                        <td className="cid-num" data-label="Out">{clockTime(b.actualCheckOut)}</td>
                                        <td className="cid-rowaction" data-label="Action">{actionFor(b._id, b) || <span className="cid-muted">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default CheckInDesk;
