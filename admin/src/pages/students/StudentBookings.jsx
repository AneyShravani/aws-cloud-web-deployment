// ============================================================
// PAGE: StudentBookings  (self-service slot booking) — GATED
// ------------------------------------------------------------
// Only usable with live access. When the student has none/expired
// access (or is blocked) the whole module renders a lock panel that
// points them to Requests — matching the backend, which refuses
// these endpoints with a typed 403.
//
// With access: pick a lab + date, see the system×slot grid, click a
// free slot to book it for yourself, and manage your bookings below.
// A compact strike reminder sits on top (missing a slot = a strike).
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Lock, ShieldAlert, RefreshCw, CalendarX, Ban, AlertCircle, CheckCircle2,
} from 'lucide-react';
import studentService from '../../services/studentService';
import { useStudentAccess } from '../../context/StudentAccessContext';
import { useConfirm } from '../../context/ConfirmContext';
import InfoHint from '../../components/common/InfoHint';
import '../../components/student/student.css';

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const BOOK_PILL = {
  BOOKED: 'st-pill--info',
  CHECKED_IN: 'st-pill--active',
  COMPLETED: 'st-pill--muted',
  NO_SHOW: 'st-pill--expired',
  CANCELLED: 'st-pill--muted',
};
const bookLabel = (s) => (s === 'NO_SHOW' ? 'No-show' : s === 'CHECKED_IN' ? 'Checked in' : s ? s.charAt(0) + s.slice(1).toLowerCase() : '—');

function LockPanel({ access, blocked }) {
  const navigate = useNavigate();
  const expired = access?.state === 'expired';
  // strike-block is a different remedy — only an admin can lift it
  if (blocked) {
    return (
      <div className="st-card">
        <div className="st-lock-panel">
          <div className="st-lock-ico"><Lock size={26} strokeWidth={2.2} /></div>
          <h3>Your account is blocked</h3>
          <p>
            You&apos;ve reached your no-show strike limit, so all lab functions are locked.
            Please contact your admin to reactivate your account — raising a new request won&apos;t lift this.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="st-card">
      <div className="st-lock-panel">
        <div className="st-lock-ico"><Lock size={26} strokeWidth={2.2} /></div>
        <h3>{expired ? 'Your access has expired' : 'You don\'t have active access yet'}</h3>
        <p>
          {expired
            ? 'Your permission has expired, so booking is locked. Raise a new request to renew your access and book slots again.'
            : 'Booking unlocks once a request of yours is approved. Raise a request to get your access ID.'}
        </p>
        <button type="button" className="st-btn st-btn--primary" onClick={() => navigate('/student/requests')}>
          Raise a request
        </button>
      </div>
    </div>
  );
}

export default function StudentBookings() {
  const { access, projects, strike, canBook, blocked, refresh } = useStudentAccess();
  const confirm = useConfirm();

  const multiProject = (projects?.length || 0) > 1;
  const [projectId, setProjectId] = useState('');
  const [labs, setLabs] = useState([]);
  const [labId, setLabId] = useState('');
  const [date, setDate] = useState(todayStr());

  // default the project picker to the first live project
  useEffect(() => {
    if (projects?.length && !projectId) setProjectId(projects[0].id);
  }, [projects, projectId]);
  const selProject = projects?.find((p) => p.id === projectId) || projects?.[0] || null;
  const [grid, setGrid] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [busySlot, setBusySlot] = useState('');
  const [busyCancel, setBusyCancel] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  // load labs + my bookings once
  useEffect(() => {
    if (!canBook) return;
    (async () => {
      try {
        const res = await studentService.getLabs();
        const list = res?.data || [];
        setLabs(list);
        if (list.length && !labId) setLabId(list[0]._id);
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not load labs.');
      }
    })();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBook]);

  const loadBookings = useCallback(async () => {
    try {
      const res = await studentService.getBookings();
      setBookings(res?.data || []);
    } catch {
      /* handled elsewhere */
    }
  }, []);

  const loadGrid = useCallback(async () => {
    if (!labId || !date) return;
    setLoadingGrid(true);
    setError('');
    try {
      const res = await studentService.getAvailability(labId, date);
      setGrid(res?.data || null);
    } catch (err) {
      setGrid(null);
      setError(err?.response?.data?.message || 'Could not load availability.');
    } finally {
      setLoadingGrid(false);
    }
  }, [labId, date]);

  useEffect(() => { if (canBook) loadGrid(); }, [canBook, loadGrid]);

  // a grid cell is "mine" when its bookingId is one of my own bookings
  const myBookingIds = new Set(bookings.map((b) => String(b.bookingId)));
  const isMineCell = (cell) => Boolean(cell?.booking && myBookingIds.has(String(cell.booking.bookingId)));

  const book = async (systemId, slotStart) => {
    setBusySlot(`${systemId}_${slotStart}`);
    setError(''); setNote('');
    try {
      await studentService.book({ systemId, date, slotStart, projectId: multiProject ? projectId : undefined });
      setNote(`Booked ${slotStart} — see it in “My bookings” below.`);
      await Promise.all([loadGrid(), loadBookings()]);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || 'Could not book that slot.');
      if (data?.code) refresh(); // access changed under us — resync gate
    } finally {
      setBusySlot('');
    }
  };

  const cancel = async (b) => {
    const ok = await confirm({
      title: 'Cancel this booking?',
      message: `Your ${b.slotStart}–${b.slotEnd} slot on ${b.date} (${b.systemName}) will be released.`,
      confirmLabel: 'Cancel booking',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyCancel(b.bookingId);
    setError(''); setNote('');
    try {
      await studentService.cancelBooking(b.bookingId);
      setNote('Booking cancelled.');
      await Promise.all([loadGrid(), loadBookings()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not cancel that booking.');
    } finally {
      setBusyCancel('');
    }
  };

  if (!canBook) {
    return (
      <>
        <div className="st-page-head">
          <span className="st-eyebrow"><CalendarCheck size={13} strokeWidth={2.4} /> Bookings</span>
          <h1 className="st-h1">My Bookings</h1>
          <p className="st-sub">Reserve lab systems by the hour.</p>
        </div>
        <LockPanel access={access} blocked={blocked} />
      </>
    );
  }

  return (
    <>
      <div className="st-page-head">
        <span className="st-eyebrow"><CalendarCheck size={13} strokeWidth={2.4} /> Bookings</span>
        <h1 className="st-h1">My Bookings <InfoHint text="Pick a lab and day, then tap a free slot to reserve it. Missing a booked slot costs a strike." /></h1>
      </div>

      {/* strike reminder */}
      <div className={`st-strike st-strike--${strike?.tone || 'safe'}`}>
        <span className="st-strike-ico"><ShieldAlert size={20} strokeWidth={2.2} /></span>
        <div className="st-strike-meta">
          <span className="st-strike-title">
            {strike?.tone === 'risk' ? 'Careful — few strikes left' : 'No-show strikes'}
          </span>
          <span className="st-strike-sub">{strike?.remaining ?? 0} of {strike?.limit ?? 0} left. Cancel ahead of time if you can't make it.</span>
        </div>
      </div>

      {/* controls */}
      <div className="st-card">
        <div className="st-book-controls">
          {multiProject ? (
            <div className="st-field">
              <label className="st-label" htmlFor="proj">Project</label>
              <select id="proj" className="st-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectName} · {p.referenceId}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="st-field">
            <label className="st-label" htmlFor="lab">Lab</label>
            <select id="lab" className="st-select" value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.length === 0 ? <option value="">No labs available</option> : null}
              {labs.map((l) => <option key={l._id} value={l._id}>{l.name}{l.building ? ` · ${l.building}` : ''}</option>)}
            </select>
          </div>
          <div className="st-field">
            <label className="st-label" htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              className="st-input"
              value={date}
              min={multiProject && selProject ? (String(selProject.startDate).slice(0, 10) > todayStr() ? String(selProject.startDate).slice(0, 10) : todayStr()) : todayStr()}
              max={multiProject && selProject ? String(selProject.endDate).slice(0, 10) : undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button type="button" className="st-btn st-btn--ghost" onClick={loadGrid} disabled={loadingGrid}>
            <RefreshCw size={15} className={loadingGrid ? 'st-spin' : ''} /> Refresh
          </button>
        </div>

        {error ? <div className="st-err" style={{ marginTop: '0.9rem' }}><AlertCircle size={14} /> {error}</div> : null}
        {note ? (
          <div className="st-banner" style={{ marginTop: '0.9rem', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 28%, transparent)', color: 'var(--color-success-dark)' }}>
            <span className="st-banner-icon"><CheckCircle2 size={18} /></span>
            <p className="st-banner-text">{note}</p>
          </div>
        ) : null}

        {/* grid */}
        <div style={{ marginTop: '1.1rem' }}>
          {loadingGrid ? (
            <div className="st-empty">Loading availability…</div>
          ) : !grid ? (
            <div className="st-empty"><p>Pick a lab and date to see open slots.</p></div>
          ) : !grid.isWorkingDay ? (
            <div className="st-empty">
              <div className="st-empty-ico"><CalendarX size={24} /></div>
              <h3>Not a working day</h3>
              <p>The lab is closed on this date. Choose another day.</p>
            </div>
          ) : grid.systems.length === 0 ? (
            <div className="st-empty"><p>No systems in this lab yet.</p></div>
          ) : (
            <div className="st-slotgrid">
              <table>
                <thead>
                  <tr>
                    <th className="st-sysname">System</th>
                    {grid.slots.map((s) => <th key={s.start}>{s.start}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grid.systems.map((sys) => (
                    <tr key={sys.systemId}>
                      <td className="st-sysname">{sys.name}</td>
                      {sys.slots.map((cell) => {
                        const key = `${sys.systemId}_${cell.start}`;
                        const b = cell.booking;
                        if (b && b.status) {
                          const isMine = isMineCell(cell);
                          return (
                            <td key={cell.start}>
                              <button type="button" className={`st-slot ${isMine ? 'st-slot--mine' : 'st-slot--taken'}`} disabled title={isMine ? 'Your booking' : 'Booked'}>
                                {isMine ? 'Yours' : 'Booked'}
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={cell.start}>
                            <button
                              type="button"
                              className="st-slot st-slot--free"
                              disabled={busySlot === key}
                              onClick={() => book(sys.systemId, cell.start)}
                              title={`Book ${cell.start}–${cell.end}`}
                            >
                              {busySlot === key ? '…' : 'Book'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* my bookings */}
      <div className="st-card">
        <div className="st-card-head">
          <span className="st-card-ico"><CalendarCheck size={18} /></span>
          <div><h3>My bookings <InfoHint text="Your upcoming and past reservations." /></h3></div>
        </div>
        {bookings.length === 0 ? (
          <div className="st-empty"><p>No bookings yet — reserve a slot above.</p></div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr><th>Date</th><th>Slot</th><th>System</th><th>Lab</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.bookingId}>
                    <td style={{ fontWeight: 700, color: 'var(--color-heading)' }}>{b.date}</td>
                    <td>{b.slotStart}–{b.slotEnd}</td>
                    <td>{b.systemName}</td>
                    <td>{b.labName}</td>
                    <td><span className={`st-pill ${BOOK_PILL[b.status] || 'st-pill--muted'}`}><span className="st-dot" />{bookLabel(b.status)}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {b.status === 'BOOKED' ? (
                        <button type="button" className="st-btn st-btn--danger st-btn--sm" disabled={busyCancel === b.bookingId} onClick={() => cancel(b)}>
                          <Ban size={13} /> {busyCancel === b.bookingId ? '…' : 'Cancel'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
