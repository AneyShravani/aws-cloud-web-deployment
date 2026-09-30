// ============================================================
// PAGE: BookingConsole  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// The new Assignments section. A systems × slots grid for a
// chosen lab + date: free cells are bookable, booked cells show
// who holds them and can be cancelled. Replaces the old
// "assign one permanent system" flow with time-sliced booking.
//
//   • Lab selector + date navigator (◀ Today ▶ / pick a date)
//   • Grid: rows = systems, columns = the day's slots
//   • Click a free cell   -> BookSlotModal (single or recurring)
//   • Click a booked cell -> details + cancel
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CalendarClock, ChevronLeft, ChevronRight, Building2, Plus, Monitor, Clock,
    User, Hash, AlertCircle, Info, Ban, CheckCircle2, X, CalendarDays, MessageCircle,
} from 'lucide-react';
import InfoHint from '../../components/common/InfoHint';
import labService from '../../services/labService';
import assignmentService from '../../services/assignmentService';
import bookingService from '../../services/bookingService';
import Modal from '../../components/common/Modal';
import { useConfirm } from '../../context/ConfirmContext';
import BookSlotModal from './BookSlotModal';
import './BookingConsole.css';

// ---- date helpers (local calendar day, admin runs in IST) ------
const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toStr(new Date());
const shift = (str, days) => {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return toStr(dt);
};
const prettyDate = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
};
// "HH:MM" -> minutes since midnight (for comparing slot times to "now")
const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const STATUS_LABEL = {
    BOOKED: 'Booked',
    CHECKED_IN: 'Checked in',
    COMPLETED: 'Completed',
    NO_SHOW: 'No-show',
};

const clockTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

// The status "dialogue" shown in the hover bubble — tone matches the cell colour.
const tipContent = (sysName, sl, freeNote) => {
    const meta = `${sysName} · ${sl.start}–${sl.end}`;
    const b = sl.booking;
    if (!b) return { tone: 'free', title: 'Free', line: freeNote || 'Click to book this slot', meta };
    switch (b.status) {
        case 'CHECKED_IN':
            return { tone: 'CHECKED_IN', title: b.userName, line: `Checked in · ${clockTime(b.checkIn)}`, meta };
        case 'COMPLETED':
            return { tone: 'COMPLETED', title: b.userName, line: `In ${clockTime(b.checkIn)} · Out ${clockTime(b.checkOut)}`, meta };
        case 'NO_SHOW':
            return { tone: 'NO_SHOW', title: b.userName, line: 'No-show · never checked in', meta };
        default:
            return { tone: 'BOOKED', title: b.userName, line: 'Booked · not checked in yet', meta };
    }
};

function initialsOf(name = '') {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

function BookingConsole() {
    const confirm = useConfirm();

    const [labs, setLabs] = useState([]);
    const [selectedLabId, setSelectedLabId] = useState('');
    const [date, setDate] = useState(todayStr());

    const [availability, setAvailability] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [banner, setBanner] = useState('');

    const [users, setUsers] = useState([]);        // approved umbrellas → bookable users
    const [bookTarget, setBookTarget] = useState(null); // { systemId, systemName, slotStart, slotEnd }
    const [detail, setDetail] = useState(null);         // a booked cell's booking
    const [notice, setNotice] = useState('');           // transient info toast (e.g. clicked a passed slot)
    const [tip, setTip] = useState(null);               // hover speech-bubble { x, y, place, ...content }
    const dateInputRef = useRef(null);                  // native date picker (opened from the date label)

    const today = todayStr();
    // Past days are VIEW-ONLY: you can navigate to them to inspect history
    // (who booked, statuses), but you can't book or cancel anything there.
    const isPast = date < today;

    // open the browser's calendar popup when the date label is clicked
    const openDatePicker = () => {
        const el = dateInputRef.current;
        if (el?.showPicker) {
            try { el.showPicker(); return; } catch { /* fall through to native focus */ }
        }
        el?.focus();
    };

    // step one day in either direction — past is allowed (view-only)
    const stepDay = (delta) => {
        setDate(shift(date, delta));
    };

    // show the status "dialogue" bubble above (or below, near the top) a cell
    const showTip = (e, content) => {
        const r = e.currentTarget.getBoundingClientRect();
        const place = r.top < 120 ? 'bottom' : 'top';
        const x = Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120);
        const y = place === 'top' ? r.top - 10 : r.bottom + 10;
        setTip({ ...content, x, y, place });
    };
    const hideTip = () => setTip(null);

    // ---- initial load: labs + approved users --------------------
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [labsRes, asnRes] = await Promise.all([
                    labService.getAll(),
                    assignmentService.getAll(),
                ]);
                if (!alive) return;
                const labList = labsRes?.labs || [];
                setLabs(labList);
                setSelectedLabId((prev) => prev || labList[0]?._id || '');
                setUsers(mapUsers(asnRes?.data || []));
            } catch (err) {
                if (alive) setError('Could not load labs. Please refresh.');
            }
        })();
        return () => { alive = false; };
    }, []);

    const fetchAvailability = useCallback(async () => {
        if (!selectedLabId) return;
        setLoading(true);
        setError('');
        try {
            const res = await bookingService.getAvailability(selectedLabId, date);
            setAvailability(res?.data || null);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load availability.');
            setAvailability(null);
        } finally {
            setLoading(false);
        }
    }, [selectedLabId, date]);

    useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

    // clear the success banner shortly after it shows
    useEffect(() => {
        if (!banner) return undefined;
        const t = setTimeout(() => setBanner(''), 6000);
        return () => clearTimeout(t);
    }, [banner]);

    // clear the transient info notice shortly after it shows
    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(''), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    // users whose approval window covers the selected date (D2)
    const eligibleUsers = useMemo(
        () => users.filter((u) => {
            const s = String(u.startDate).slice(0, 10);
            const e = String(u.endDate).slice(0, 10);
            return s <= date && date <= e;
        }),
        [users, date]
    );

    const stats = useMemo(() => {
        if (!availability?.systems?.length) return null;
        let total = 0;
        let booked = 0;
        for (const sys of availability.systems) {
            for (const sl of sys.slots) {
                total += 1;
                if (sl.booking) booked += 1;
            }
        }
        return { total, booked, pct: total ? Math.round((booked / total) * 100) : 0 };
    }, [availability]);

    const handleBooked = async (message) => {
        setBookTarget(null);
        setBanner(message);
        await fetchAvailability();
    };

    const handleCancel = async (booking) => {
        const ok = await confirm({
            title: 'Cancel this booking?',
            message: `This frees ${booking.systemName || 'the system'} at ${booking.slotStart}–${booking.slotEnd} on ${date}. The slot becomes available again.`,
            confirmLabel: 'Cancel booking',
            cancelLabel: 'Keep it',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await bookingService.cancel(booking.bookingId);
            setDetail(null);
            setBanner('Booking cancelled — slot freed.');
            await fetchAvailability();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not cancel the booking.');
        }
    };

    const selectedLab = labs.find((l) => l._id === selectedLabId);
    const slotCount = availability?.slots?.length || 0;

    // On TODAY, a slot whose end time is already past (IST/local wall clock)
    // can't be booked — it would instantly reconcile to NO_SHOW. Treat it like
    // a read-only cell. (Recomputed each render / on every refresh.)
    const isToday = date === today;
    const nowMinutes = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
    const isSlotPassed = (sl) => isToday && toMinutes(sl.end) <= nowMinutes;
    // today's whole working window is over: every slot has already ended
    const dayClosed = isToday
        && availability?.isWorkingDay
        && (availability?.slots?.length || 0) > 0
        && availability.slots.every((s) => toMinutes(s.end) <= nowMinutes);

    return (
        <div className="bc-page">
            {/* ---------- Header ---------- */}
            <header className="bc-header">
                <div className="bc-heading">
                    <span className="bc-eyebrow"><CalendarClock size={14} strokeWidth={2.4} /> Slot bookings</span>
                    <h1 className="bc-title">Booking console <InfoHint text="Book systems by the hour. Green cells are free — click one to reserve it for an approved user." /></h1>
                </div>

                {stats ? (
                    <div className="bc-daystat">
                        <span className="bc-daystat-value">{stats.booked}/{stats.total}</span>
                        <span className="bc-daystat-label">slots booked · {stats.pct}%</span>
                    </div>
                ) : null}
            </header>

            {/* ---------- Toolbar: lab + date ---------- */}
            <div className="bc-toolbar">
                <div className="bc-lab">
                    <Building2 size={16} className="bc-lab-icon" />
                    <select
                        className="bc-lab-select"
                        value={selectedLabId}
                        onChange={(e) => setSelectedLabId(e.target.value)}
                    >
                        {labs.length === 0 ? <option value="">No labs</option> : null}
                        {labs.map((lab) => (
                            <option key={lab._id} value={lab._id}>{lab.name}</option>
                        ))}
                    </select>
                </div>

                <div className="bc-datenav">
                    <button
                        type="button"
                        className="bc-datebtn"
                        onClick={() => stepDay(-1)}
                        aria-label="Previous day"
                        title="Previous day"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button type="button" className="bc-datecenter" onClick={openDatePicker} aria-label="Pick a date">
                        <span className="bc-datepretty">{prettyDate(date)}</span>
                        <CalendarDays size={15} className="bc-datepick-ic" />
                        <input
                            ref={dateInputRef}
                            type="date"
                            className="bc-dateinput"
                            value={date}
                            onChange={(e) => {
                                const v = e.target.value;
                                setDate(v || today); // past dates allowed (view-only)
                            }}
                        />
                    </button>
                    <button type="button" className="bc-datebtn" onClick={() => stepDay(1)} aria-label="Next day">
                        <ChevronRight size={18} />
                    </button>
                    <button
                        type="button"
                        className={`bc-today ${date === today ? 'is-today' : ''}`}
                        onClick={() => setDate(today)}
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* legend */}
            <div className="bc-legend">
                <span className="bc-legend-item"><span className="bc-swatch bc-swatch-free" /> Free</span>
                <span className="bc-legend-item"><span className="bc-swatch bc-swatch-BOOKED" /> Booked</span>
                <span className="bc-legend-item"><span className="bc-swatch bc-swatch-CHECKED_IN" /> Checked in</span>
                <span className="bc-legend-item"><span className="bc-swatch bc-swatch-COMPLETED" /> Completed</span>
                <span className="bc-legend-item"><span className="bc-swatch bc-swatch-NO_SHOW" /> No-show</span>
            </div>

            {isPast ? (
                <div className="bc-readonly" role="status">
                    <Info size={16} /> Viewing a past date — history is read-only. You can’t book or cancel slots here.
                </div>
            ) : null}
            {dayClosed ? (
                <div className="bc-closed" role="status">
                    <Clock size={16} /> Today’s working hours are over — no more bookings can be made today. Existing bookings are still shown below.
                </div>
            ) : null}
            {notice ? (
                <div className="bc-readonly" role="status">
                    <Info size={16} /> {notice}
                </div>
            ) : null}
            {banner ? (
                <div className="bc-banner" role="status">
                    <CheckCircle2 size={16} /> {banner}
                </div>
            ) : null}
            {error ? (
                <div className="bc-error" role="alert">
                    <AlertCircle size={16} /> {error}
                </div>
            ) : null}

            {/* ---------- Grid ---------- */}
            <section className="bc-panel">
                {loading ? (
                    <div className="bc-placeholder">Loading availability…</div>
                ) : !availability ? (
                    <div className="bc-placeholder">Select a lab to see its slots.</div>
                ) : !availability.isWorkingDay ? (
                    <div className="bc-notice">
                        <div className="bc-notice-icon"><CalendarDays size={26} /></div>
                        <h3>Not a working day</h3>
                        <p>{selectedLab?.name || 'This lab'} isn’t open on {prettyDate(date)}. Change the lab’s schedule to open this weekday, or pick another date.</p>
                    </div>
                ) : availability.systems.length === 0 ? (
                    <div className="bc-notice">
                        <div className="bc-notice-icon"><Monitor size={26} /></div>
                        <h3>No systems in this lab</h3>
                        <p>Add systems to {selectedLab?.name || 'this lab'} before you can book slots.</p>
                    </div>
                ) : (
                    <div className="bc-gridscroll">
                        <div className="bc-grid" style={{ '--bc-slots': slotCount }}>
                            {/* header row */}
                            <div className="bc-grid-corner">System</div>
                            {availability.slots.map((s) => (
                                <div className="bc-grid-slothead" key={s.start}>
                                    <Clock size={12} /> {s.start}
                                    <span className="bc-grid-slotend">{s.end}</span>
                                </div>
                            ))}

                            {/* system rows */}
                            {availability.systems.map((sys) => (
                                <React.Fragment key={sys.systemId}>
                                    <div className="bc-grid-sysname">
                                        <Monitor size={14} /> {sys.name}
                                    </div>
                                    {sys.slots.map((sl) => {
                                        const b = sl.booking;
                                        if (!b) {
                                            const passed = isSlotPassed(sl);
                                            const blocked = isPast || passed;
                                            const freeNote = isPast ? 'Was not booked' : passed ? 'Slot already passed' : undefined;
                                            return (
                                                <button
                                                    key={sl.start}
                                                    type="button"
                                                    className={`bc-cell bc-cell-free ${blocked ? 'bc-cell-free--past' : ''}`}
                                                    onClick={blocked
                                                        ? () => setNotice(isPast
                                                            ? 'This date is in the past — bookings here are view-only.'
                                                            : 'This slot has already passed — it can no longer be booked.')
                                                        : () => setBookTarget({
                                                            systemId: sys.systemId,
                                                            systemName: sys.name,
                                                            slotStart: sl.start,
                                                            slotEnd: sl.end,
                                                        })}
                                                    onMouseEnter={(e) => showTip(e, tipContent(sys.name, sl, freeNote))}
                                                    onMouseLeave={hideTip}
                                                    onFocus={(e) => showTip(e, tipContent(sys.name, sl, freeNote))}
                                                    onBlur={hideTip}
                                                    aria-label={blocked ? `${sys.name} at ${sl.start} — ${passed ? 'already passed' : 'not booked'}` : `Book ${sys.name} at ${sl.start}`}
                                                >
                                                    {blocked ? null : <Plus size={16} />}
                                                </button>
                                            );
                                        }
                                        return (
                                            <button
                                                key={sl.start}
                                                type="button"
                                                className={`bc-cell bc-cell-booked bc-status-${b.status}`}
                                                onClick={() => setDetail({
                                                    ...b,
                                                    systemName: sys.name,
                                                    slotStart: sl.start,
                                                    slotEnd: sl.end,
                                                })}
                                                onMouseEnter={(e) => showTip(e, tipContent(sys.name, sl))}
                                                onMouseLeave={hideTip}
                                                onFocus={(e) => showTip(e, tipContent(sys.name, sl))}
                                                onBlur={hideTip}
                                            >
                                                <span className="bc-cell-avatar">{initialsOf(b.userName)}</span>
                                                <span className="bc-cell-name">{b.userName}</span>
                                            </button>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <p className="bc-foot"><Info size={13} /> Only users with an approved project window covering the selected date can be booked.</p>

            {/* ---------- Book modal ---------- */}
            <BookSlotModal
                open={Boolean(bookTarget)}
                target={bookTarget}
                date={date}
                users={eligibleUsers}
                onClose={() => setBookTarget(null)}
                onBooked={handleBooked}
            />

            {/* ---------- Booked-cell detail ---------- */}
            <Modal isOpen={Boolean(detail)} title="Booking details" onClose={() => setDetail(null)}>
                {detail ? (
                    <div className="bc-detail">
                        <div className="bc-detail-row"><User size={15} /> <span>{detail.userName}</span></div>
                        {detail.rollNumber ? <div className="bc-detail-row"><Hash size={15} /> <span>{detail.rollNumber}</span></div> : null}
                        <div className="bc-detail-row"><Monitor size={15} /> <span>{detail.systemName}</span></div>
                        <div className="bc-detail-row"><Clock size={15} /> <span>{detail.slotStart}–{detail.slotEnd} · {prettyDate(date)}</span></div>
                        <div className="bc-detail-row">
                            <span className={`bc-status-badge bc-status-${detail.status}`}>{STATUS_LABEL[detail.status] || detail.status}</span>
                        </div>

                        <div className="bc-detail-actions">
                            <button type="button" className="bc-btn bc-btn-ghost" onClick={() => setDetail(null)}>Close</button>
                            {/* past = view-only: no cancelling history */}
                            {!isPast && detail.status !== 'COMPLETED' ? (
                                <button type="button" className="bc-btn bc-btn-danger" onClick={() => handleCancel(detail)}>
                                    <Ban size={15} /> Cancel booking
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* ---------- Hover status bubble ---------- */}
            {tip ? (
                <div
                    className={`bc-tip bc-tip--${tip.tone} bc-tip--${tip.place}`}
                    style={{ left: tip.x, top: tip.y }}
                    role="tooltip"
                >
                    <div className="bc-tip-body">
                        <MessageCircle size={13} className="bc-tip-ic" />
                        <span className="bc-tip-text">
                            <span className="bc-tip-title">{tip.title}</span>
                            <span className="bc-tip-line">{tip.line}</span>
                            <span className="bc-tip-meta">{tip.meta}</span>
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// Collapse approved-umbrella assignments into a unique, bookable user list,
// keeping each user's widest (latest-ending) window.
function mapUsers(assignments) {
    const seen = new Map();
    for (const a of assignments) {
        const lu = a.labUserId;
        const id = lu && (lu._id || lu);
        if (!id) continue;
        const key = String(id);
        const entry = {
            labUserId: key,
            name: lu?.name || a.name || '—',
            rollNumber: lu?.rollNumber || '',
            department: lu?.department || '',
            referenceId: a.referenceId,
            startDate: a.startDate,
            endDate: a.endDate,
            projectName: a.projectName,
        };
        const prev = seen.get(key);
        if (!prev || new Date(entry.endDate) > new Date(prev.endDate)) seen.set(key, entry);
    }
    return [...seen.values()];
}

export default BookingConsole;
