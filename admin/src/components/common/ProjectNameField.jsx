// ============================================================
// COMPONENT: ProjectNameField  (type-to-continue project picker)
// ------------------------------------------------------------
// A project name is the permanent, unique key that owns an access
// ID. As the user types, matching existing projects surface in a
// dropdown. Picking one shows who worked on it / when / its status
// and asks to confirm — Yes reuses that project's access ID
// (CONTINUE if incomplete, REOPEN for maintenance if completed);
// No means the typed name collides and must be changed. A name
// that matches nothing is a brand-new project.
//
// Emits onChange({ name, continueProjectId, mode }) where mode is
// 'new' | 'continue' | 'reopen'. Enforces the lowercase-hyphen
// naming rule inline, with an example under the field.
//
// Used by both the admin Manual Request form and the student
// self-service request form (viewer prop only tweaks copy).
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FolderGit2, RefreshCw, Wrench, CheckCircle2, XCircle, Loader2, AlertCircle, X } from 'lucide-react';
import projectService from '../../services/projectService';
import './ProjectNameField.css';

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXAMPLE = 'ai-assistance';

// forgiving client-side mirror of the backend normalizer
const normalize = (raw) => String(raw || '')
  .trim().toLowerCase()
  .replace(/[_\s]+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusText = (p) => {
  if (p.outcome === 'COMPLETED') return p.liveUrl ? 'Completed · Deployed' : 'Completed';
  if (p.outcome === 'INCOMPLETE') return 'Incomplete';
  if (p.liveStatus === 'EXPIRED') return 'Expired';
  if (p.liveStatus === 'NEARING_EXPIRY') return 'Expiring soon';
  return 'Active';
};
const statusTone = (p) => {
  if (p.outcome === 'COMPLETED') return 'info';
  if (p.outcome === 'INCOMPLETE') return 'warn';
  if (p.liveStatus === 'EXPIRED') return 'danger';
  if (p.liveStatus === 'NEARING_EXPIRY') return 'warn';
  return 'ok';
};

export default function ProjectNameField({
  value = '',
  onChange = () => {},
  disabled = false,
  error = '',
  viewer = 'admin',
  id = 'projectName',
}) {
  const [text, setText] = useState(value);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // a match awaiting confirm
  const [locked, setLocked] = useState(null);      // confirmed continuation/reopen
  const [nameTaken, setNameTaken] = useState(false); // typed a name that exists but declined to continue
  const boxRef = useRef(null);
  const debRef = useRef(null);

  useEffect(() => { setText(value); }, [value]);

  // debounced search as the user types (skip while locked)
  useEffect(() => {
    if (locked || disabled) return undefined;
    const q = normalize(text);
    if (!q) { setResults([]); setOpen(false); return undefined; }
    setLoading(true);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const res = await projectService.search(q);
        setResults(res?.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(debRef.current);
  }, [text, locked, disabled]);

  // close dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setSelected(null); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const normalized = useMemo(() => normalize(text), [text]);
  const formatBad = normalized.length > 0 && !NAME_RE.test(normalized);

  const emitNew = (raw) => onChange({ name: normalize(raw), continueProjectId: null, mode: 'new' });

  const handleType = (e) => {
    const v = e.target.value;
    setText(v);
    setNameTaken(false);
    setSelected(null);
    emitNew(v);
  };

  const pick = (p) => { setSelected(p); setOpen(false); };

  const confirmContinue = () => {
    const p = selected;
    setLocked(p);
    setSelected(null);
    setText(p.name);
    setNameTaken(false);
    onChange({ name: p.name, continueProjectId: p.id, mode: p.completed ? 'reopen' : 'continue' });
  };

  const declineContinue = () => {
    // they don't want the same project, but the name collides → force a rename
    setNameTaken(true);
    setSelected(null);
  };

  const clearLock = () => {
    setLocked(null);
    setText('');
    setNameTaken(false);
    onChange({ name: '', continueProjectId: null, mode: 'new' });
  };

  // ---- locked (continuation/reopen confirmed) ----
  if (locked) {
    const reopen = locked.completed;
    return (
      <div className="pnf" ref={boxRef}>
        <div className={`pnf-locked pnf-locked--${reopen ? 'reopen' : 'continue'}`}>
          <span className="pnf-locked-ico">{reopen ? <Wrench size={16} /> : <RefreshCw size={16} />}</span>
          <div className="pnf-locked-body">
            <span className="pnf-locked-title">
              {reopen ? 'Reopening for maintenance' : 'Continuing project'} · <strong>{locked.name}</strong>
            </span>
            <span className="pnf-locked-sub">
              Same access ID <code>{locked.referenceId}</code> — no new ID is created.
            </span>
          </div>
          {!disabled ? (
            <button type="button" className="pnf-locked-x" onClick={clearLock} aria-label="Choose a different project">
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // ---- typing / searching ----
  return (
    <div className="pnf" ref={boxRef}>
      <div className={`pnf-input-wrap ${error || formatBad || nameTaken ? 'has-error' : ''}`}>
        <Search size={15} className="pnf-input-ico" />
        <input
          id={id}
          className="pnf-input"
          value={text}
          onChange={handleType}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={`e.g. ${EXAMPLE}`}
          autoComplete="off"
          disabled={disabled}
          spellCheck={false}
        />
        {loading ? <Loader2 size={15} className="pnf-input-spin" /> : null}
      </div>

      {open && results.length > 0 ? (
        <ul className="pnf-menu" role="listbox">
          <li className="pnf-menu-head">Existing projects — pick one to continue</li>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="pnf-opt" onClick={() => pick(p)}>
                <span className="pnf-opt-ico"><FolderGit2 size={15} /></span>
                <span className="pnf-opt-main">
                  <span className="pnf-opt-name">{p.name}</span>
                  <span className="pnf-opt-sub">{p.holderName}{p.endDate ? ` · until ${fmtDate(p.endDate)}` : ''}</span>
                </span>
                <span className={`pnf-tag pnf-tag--${statusTone(p)}`}>{statusText(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* confirmation card after picking a match */}
      {selected ? (
        <div className={`pnf-confirm pnf-confirm--${selected.completed ? 'reopen' : 'continue'}`}>
          <div className="pnf-confirm-head">
            <span className="pnf-confirm-ico">{selected.completed ? <Wrench size={16} /> : <RefreshCw size={16} />}</span>
            <div>
              <p className="pnf-confirm-title">
                “{selected.name}” already exists
                <span className={`pnf-tag pnf-tag--${statusTone(selected)}`}>{statusText(selected)}</span>
              </p>
              <p className="pnf-confirm-meta">
                {viewer === 'student' ? 'Previously worked on by' : 'Current holder:'} <strong>{selected.holderName}</strong>
                {selected.startDate ? ` · ${fmtDate(selected.startDate)} → ${fmtDate(selected.endDate)}` : ''}
              </p>
            </div>
          </div>
          <p className="pnf-confirm-q">
            {selected.completed
              ? 'This project is completed. Reopen it for maintenance under the same access ID?'
              : 'Are you continuing this same project? It keeps the same access ID.'}
          </p>
          <div className="pnf-confirm-actions">
            <button type="button" className="pnf-btn pnf-btn--ghost" onClick={declineContinue}>
              <XCircle size={15} /> No, it&apos;s different
            </button>
            <button type="button" className="pnf-btn pnf-btn--primary" onClick={confirmContinue}>
              <CheckCircle2 size={15} /> {selected.completed ? 'Yes, reopen' : 'Yes, continue'}
            </button>
          </div>
        </div>
      ) : null}

      {/* inline hints / errors */}
      {nameTaken ? (
        <span className="pnf-hint pnf-hint--err"><AlertCircle size={13} /> That name already exists — please choose a different project name.</span>
      ) : formatBad ? (
        <span className="pnf-hint pnf-hint--err"><AlertCircle size={13} /> Use lowercase words joined by hyphens, e.g. “{EXAMPLE}”.</span>
      ) : error ? (
        <span className="pnf-hint pnf-hint--err"><AlertCircle size={13} /> {error}</span>
      ) : (
        <span className="pnf-hint">Lowercase, words joined by hyphens — e.g. “{EXAMPLE}”. Existing names appear as you type.</span>
      )}
    </div>
  );
}
