// ============================================================
// COMPONENT: BookSlotModal  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// Opened from a FREE cell in the booking grid. The admin picks
// an approved user (search by name / roll / reference ID) and
// books either just this slot or a recurring series up to a
// chosen end date. Only users whose approval window covers the
// selected date are shown (matches the backend's D2 rule).
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Monitor, Calendar, Clock, Repeat, Check, AlertCircle, User, Hash } from 'lucide-react';
import Modal from '../../components/common/Modal';
import bookingService from '../../services/bookingService';
import './BookingConsole.css';

function BookSlotModal({ open, target, date, users, onClose, onBooked }) {
    const [term, setTerm] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [mode, setMode] = useState('single'); // 'single' | 'recurring'
    const [toDate, setToDate] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // reset whenever a new cell is opened
    useEffect(() => {
        if (open) {
            setTerm('');
            setSelectedId('');
            setMode('single');
            setToDate('');
            setError('');
            setSubmitting(false);
        }
    }, [open, target]);

    const selectedUser = useMemo(
        () => users.find((u) => u.labUserId === selectedId) || null,
        [users, selectedId]
    );

    // default the recurring end date to the selected user's window end
    useEffect(() => {
        if (selectedUser && mode === 'recurring' && !toDate) {
            setToDate(selectedUser.endDate ? String(selectedUser.endDate).slice(0, 10) : date);
        }
    }, [selectedUser, mode]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            [u.name, u.rollNumber, u.department, u.referenceId]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
        );
    }, [users, term]);

    if (!open || !target) return null;

    const handleSubmit = async () => {
        if (!selectedId) {
            setError('Pick a user to book this slot for.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            if (mode === 'recurring') {
                if (!toDate || toDate < date) {
                    setError('Choose an end date on or after the selected day.');
                    setSubmitting(false);
                    return;
                }
                const res = await bookingService.createRecurring({
                    labUserId: selectedId,
                    systemId: target.systemId,
                    slotStart: target.slotStart,
                    from: date,
                    to: toDate,
                });
                onBooked(res?.message || 'Recurring booking created.', res?.data || null);
            } else {
                const res = await bookingService.create({
                    labUserId: selectedId,
                    systemId: target.systemId,
                    date,
                    slotStart: target.slotStart,
                });
                onBooked(res?.message || 'Slot booked.', null);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not book the slot.');
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={open} title="Book a slot" onClose={onClose} size="wide">
            <div className="bsm">
                {/* target summary */}
                <div className="bsm-target">
                    <span className="bsm-target-item"><Monitor size={15} /> {target.systemName}</span>
                    <span className="bsm-target-item"><Calendar size={15} /> {date}</span>
                    <span className="bsm-target-item"><Clock size={15} /> {target.slotStart}–{target.slotEnd}</span>
                </div>

                {/* user search */}
                <div className="bsm-field">
                    <label className="bsm-label">Book for</label>
                    <div className="bsm-search">
                        <Search size={16} className="bsm-search-icon" />
                        <input
                            className="bsm-search-input"
                            placeholder="Search approved users by name, roll no, or reference ID"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="bsm-userlist">
                        {users.length === 0 ? (
                            <div className="bsm-empty">
                                No approved users have a project window covering {date}. Approve a request first
                                (or check the date).
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="bsm-empty">No users match “{term}”.</div>
                        ) : (
                            filtered.map((u) => (
                                <button
                                    type="button"
                                    key={u.labUserId}
                                    className={`bsm-user ${selectedId === u.labUserId ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedId(u.labUserId)}
                                >
                                    <span className="bsm-user-avatar"><User size={16} /></span>
                                    <span className="bsm-user-meta">
                                        <span className="bsm-user-name">{u.name}</span>
                                        <span className="bsm-user-sub">
                                            <Hash size={11} /> {u.rollNumber}
                                            {u.department ? ` · ${u.department}` : ''} · {u.referenceId}
                                        </span>
                                    </span>
                                    {selectedId === u.labUserId ? <Check size={16} className="bsm-user-check" /> : null}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* single vs recurring */}
                <div className="bsm-field">
                    <label className="bsm-label">Repeat</label>
                    <div className="bsm-modes">
                        <button
                            type="button"
                            className={`bsm-mode ${mode === 'single' ? 'is-active' : ''}`}
                            onClick={() => setMode('single')}
                        >
                            <Calendar size={15} /> Just this day
                        </button>
                        <button
                            type="button"
                            className={`bsm-mode ${mode === 'recurring' ? 'is-active' : ''}`}
                            onClick={() => setMode('recurring')}
                        >
                            <Repeat size={15} /> Repeat until…
                        </button>
                    </div>
                    {mode === 'recurring' ? (
                        <div className="bsm-recurring">
                            <span className="bsm-recurring-label">Same slot every working day, {date} →</span>
                            <input
                                type="date"
                                className="bsm-date-input"
                                min={date}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                            <span className="bsm-recurring-hint">Already-taken days are skipped automatically.</span>
                        </div>
                    ) : null}
                </div>

                {error ? (
                    <div className="bsm-error" role="alert">
                        <AlertCircle size={16} /> {error}
                    </div>
                ) : null}

                <div className="bsm-actions">
                    <button type="button" className="bc-btn bc-btn-ghost" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="bc-btn bc-btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !selectedId}
                    >
                        {submitting ? 'Booking…' : mode === 'recurring' ? 'Book series' : 'Book slot'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default BookSlotModal;
