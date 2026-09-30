// ============================================================
// COMPONENT: ProjectCloseout  (Utilization — the single section)
// ------------------------------------------------------------
// One unified view of every project (Assignment): who holds it,
// its window, access ID + live status, and — once its window ends —
// the admin's close-out: COMPLETED (with tool, live URL, deployment)
// or INCOMPLETE. Marking drives the access-ID lifecycle:
//   INCOMPLETE -> continuable under the same access ID
//   COMPLETED  -> closed (reopen = maintenance); tracks live URL +
//                 whether the deployment is currently active.
// Replaces the old free-form "Student projects" records entirely.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderGit2, KeyRound, CheckCircle2, CircleDashed, ExternalLink, AlertCircle,
  ClipboardCheck, BarChart3, Rocket, Wrench,
} from 'lucide-react';
import assignmentService from '../../services/assignmentService';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import './ProjectCloseout.css';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const isUrl = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

const liveLabel = { ACTIVE: 'Active', NEARING_EXPIRY: 'Expiring', EXPIRED: 'Expired' };
const outcomeMeta = {
  COMPLETED: { label: 'Completed', cls: 'pc-out--done' },
  INCOMPLETE: { label: 'Incomplete', cls: 'pc-out--incomplete' },
  NONE: { label: 'Not marked', cls: 'pc-out--none' },
};

export default function ProjectCloseout() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');

  // mark / update modal
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ outcome: 'COMPLETED', toolName: '', liveUrl: '', deployed: false, note: '' });
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await assignmentService.getAll();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(''), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const stats = useMemo(() => ({
    total: rows.length,
    completed: rows.filter((r) => r.outcome === 'COMPLETED').length,
    deployed: rows.filter((r) => r.deployed).length,
  }), [rows]);

  const needsAction = rows.filter((r) => r.liveStatus === 'EXPIRED' && (!r.outcome || r.outcome === 'NONE')).length;

  // expired-but-unmarked first (they need action), then the rest
  const sorted = useMemo(() => {
    const weight = (r) => {
      if (r.liveStatus === 'EXPIRED' && (!r.outcome || r.outcome === 'NONE')) return 0;
      if (!r.outcome || r.outcome === 'NONE') return 1;
      return 2;
    };
    return [...rows].sort((a, b) => weight(a) - weight(b));
  }, [rows]);

  const openMark = (r) => {
    setTarget(r);
    setForm({
      outcome: r.outcome && r.outcome !== 'NONE' ? r.outcome : 'COMPLETED',
      toolName: r.toolName || '',
      liveUrl: r.liveUrl || '',
      deployed: Boolean(r.deployed),
      note: r.outcomeNote || '',
    });
    setModalErr('');
  };

  const save = async () => {
    if (form.outcome === 'COMPLETED' && form.liveUrl.trim() && !isUrl(form.liveUrl.trim())) {
      setModalErr('Live URL must start with http:// or https:// (or leave it blank).');
      return;
    }
    setSaving(true); setModalErr('');
    try {
      await assignmentService.setOutcome(target._id, {
        outcome: form.outcome,
        toolName: form.toolName.trim(),
        liveUrl: form.outcome === 'COMPLETED' ? form.liveUrl.trim() : '',
        deployed: form.outcome === 'COMPLETED' ? form.deployed : false,
        note: form.note.trim(),
      });
      setBanner(`“${target.name}” marked ${form.outcome === 'COMPLETED' ? 'completed' : 'incomplete'}.`);
      setTarget(null);
      await load();
    } catch (err) {
      setModalErr(err?.response?.data?.message || 'Could not save the outcome.');
    } finally {
      setSaving(false);
    }
  };

  const clearOutcome = async () => {
    setSaving(true); setModalErr('');
    try {
      await assignmentService.setOutcome(target._id, { outcome: 'NONE' });
      setBanner(`“${target.name}” outcome cleared.`);
      setTarget(null);
      await load();
    } catch {
      setModalErr('Could not clear the outcome.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="pc-panel">
      {/* stat strip */}
      <div className="pc-stats">
        <div className="pc-stat" style={{ '--pc-accent': 'var(--color-info)' }}>
          <span className="pc-stat-ico"><BarChart3 size={20} strokeWidth={2.1} /></span>
          <div><span className="pc-stat-val">{stats.total}</span><span className="pc-stat-lbl">Projects</span></div>
        </div>
        <div className="pc-stat" style={{ '--pc-accent': 'var(--color-success)' }}>
          <span className="pc-stat-ico"><CheckCircle2 size={20} strokeWidth={2.1} /></span>
          <div><span className="pc-stat-val">{stats.completed}</span><span className="pc-stat-lbl">Completed</span></div>
        </div>
        <div className="pc-stat" style={{ '--pc-accent': 'var(--color-primary)' }}>
          <span className="pc-stat-ico"><Rocket size={20} strokeWidth={2.1} /></span>
          <div><span className="pc-stat-val">{stats.deployed}</span><span className="pc-stat-lbl">Active deployments</span></div>
        </div>
      </div>

      <div className="pc-head">
        <div className="pc-head-title">
          <span className="pc-head-ico"><ClipboardCheck size={18} strokeWidth={2.2} /></span>
          <div>
            <h3>Projects &amp; close-out <InfoHint text="Every project, its access ID and live status. Once a window ends, mark it completed (with tool, live URL & deployment) or incomplete — this controls whether the access ID can be continued." /></h3>
          </div>
        </div>
        {needsAction > 0 ? <span className="pc-need">{needsAction} awaiting close-out</span> : null}
      </div>

      {banner ? <div className="pc-note"><CheckCircle2 size={15} /> {banner}</div> : null}
      {error ? <div className="pc-note pc-note--err"><AlertCircle size={15} /> {error}</div> : null}

      {loading ? (
        <div className="pc-state">Loading projects…</div>
      ) : sorted.length === 0 ? (
        <div className="pc-state">
          <div className="pc-state-ico"><FolderGit2 size={24} /></div>
          <p>No approved projects yet. Approve a request to create one.</p>
        </div>
      ) : (
        <div className="pc-scroll">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Project / tool</th><th>Holder</th><th>Window</th><th>Access</th>
                <th>Outcome</th><th>Deployment</th><th className="pc-right">Close-out</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const oc = outcomeMeta[r.outcome || 'NONE'] || outcomeMeta.NONE;
                const expiredUnmarked = r.liveStatus === 'EXPIRED' && (!r.outcome || r.outcome === 'NONE');
                const completed = r.outcome === 'COMPLETED';
                return (
                  <tr key={r._id} className={expiredUnmarked ? 'pc-row--attn' : ''}>
                    <td data-label="Project / tool">
                      <div className="pc-proj">
                        <span className="pc-proj-name">{r.name}</span>
                        {r.kind && r.kind !== 'INITIAL' ? <span className="pc-kind">{r.kind === 'MAINTENANCE' ? 'maintenance' : 'continued'}</span> : null}
                        {r.historyCount > 0 ? <span className="pc-hist">{r.historyCount} past</span> : null}
                      </div>
                      <div className="pc-proj-sub">
                        {r.toolName ? <span className="pc-tool">{r.toolName}</span> : null}
                        {isUrl(r.liveUrl) ? (
                          <a className="pc-live" href={r.liveUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Visit</a>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Holder">
                      <span className="pc-holder">{r.name || '—'}</span>
                      {r.rollNumber ? <span className="pc-holder-roll">{r.rollNumber}</span> : null}
                    </td>
                    <td data-label="Window"><span className="pc-window">{fmt(r.startDate)} → {fmt(r.endDate)}</span></td>
                    <td data-label="Access">
                      <span className="pc-ref"><KeyRound size={12} /> {r.referenceId}</span>
                      <span className={`pc-live-status pc-ls--${(r.liveStatus || '').toLowerCase()}`}>{liveLabel[r.liveStatus] || r.liveStatus}</span>
                    </td>
                    <td data-label="Outcome"><span className={`pc-out ${oc.cls}`}>{oc.label}</span></td>
                    <td data-label="Deployment">
                      {completed ? (
                        <span className={`pc-deploy ${r.deployed ? 'is-on' : 'is-off'}`}><span className="pc-deploy-dot" /> {r.deployed ? 'Active' : 'Inactive'}</span>
                      ) : <span className="pc-muted">—</span>}
                    </td>
                    <td className="pc-right" data-label="Close-out">
                      <button type="button" className="pc-btn" onClick={() => openMark(r)}>
                        {r.outcome && r.outcome !== 'NONE' ? 'Update' : 'Mark'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!target} title="Project close-out" onClose={() => setTarget(null)} closeOnBackdrop={false}>
        {target ? (
          <div className="pc-form">
            <p className="pc-form-lead">
              Set the outcome for <strong>{target.name}</strong> (access ID <code>{target.referenceId}</code>).
            </p>

            <div className="pc-choices">
              <button type="button" className={`pc-choice ${form.outcome === 'COMPLETED' ? 'is-on' : ''}`} onClick={() => setForm((f) => ({ ...f, outcome: 'COMPLETED' }))}>
                <CheckCircle2 size={16} /> Completed
                <span>Closes the ID — future changes reopen as maintenance.</span>
              </button>
              <button type="button" className={`pc-choice ${form.outcome === 'INCOMPLETE' ? 'is-on' : ''}`} onClick={() => setForm((f) => ({ ...f, outcome: 'INCOMPLETE' }))}>
                <CircleDashed size={16} /> Incomplete
                <span>Stays continuable later under the same ID.</span>
              </button>
            </div>

            <div className="pc-field">
              <label htmlFor="pc-tool"><Wrench size={13} /> Tool used <span className="pc-opt">(optional)</span></label>
              <input id="pc-tool" className="pc-input" value={form.toolName} onChange={set('toolName')} placeholder="e.g. Claude Code, ChatGPT" />
            </div>

            {form.outcome === 'COMPLETED' ? (
              <>
                <div className="pc-field">
                  <label htmlFor="pc-url">Live URL <span className="pc-opt">(optional)</span></label>
                  <input id="pc-url" className="pc-input" value={form.liveUrl} onChange={set('liveUrl')} placeholder="https://deployed-app.example.com" />
                </div>
                <label className="pc-toggle">
                  <input type="checkbox" checked={form.deployed} onChange={(e) => setForm((f) => ({ ...f, deployed: e.target.checked }))} />
                  <span className="pc-toggle-track"><span className="pc-toggle-knob" /></span>
                  <span className="pc-toggle-label">Deployment is currently live</span>
                </label>
              </>
            ) : null}

            <div className="pc-field">
              <label htmlFor="pc-note">Note <span className="pc-opt">(optional)</span></label>
              <input id="pc-note" className="pc-input" value={form.note} onChange={set('note')} placeholder="e.g. handed over, pending review…" />
            </div>

            {modalErr ? <div className="pc-note pc-note--err"><AlertCircle size={15} /> {modalErr}</div> : null}

            <div className="pc-form-actions">
              {target.outcome && target.outcome !== 'NONE' ? (
                <button type="button" className="pc-btn pc-btn--ghost pc-btn--clear" disabled={saving} onClick={clearOutcome}>Clear</button>
              ) : null}
              <button type="button" className="pc-btn pc-btn--ghost" onClick={() => setTarget(null)} disabled={saving}>Cancel</button>
              <button type="button" className="pc-btn pc-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save outcome'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
