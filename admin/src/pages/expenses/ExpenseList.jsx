// ============================================================
// PAGE: ExpenseList  (Module 3.3 — Expenses)
// ------------------------------------------------------------
// AI-tool spend tracker. Fields: Platform, Tool, Plan, Plan type,
// Total amount spent, Expiration date (drives a live status),
// Purpose. Records live in one full-width table;
// adding / editing happens in a pop-up modal (ExpenseModal).
// Each row can be edited or deleted. Plus bulk Excel upload
// (with a downloadable template whose headers match the form)
// — dollar amounts in the sheet auto-convert to INR.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import InfoHint from '../../components/common/InfoHint';
import {
    Wallet, TrendingUp, Layers, Building2, RefreshCw, Receipt, Pencil, Trash2, Plus,
    AlertCircle, Download, Upload, CheckCircle2,
} from 'lucide-react';
import expenseService from '../../services/expenseService';
import ExpenseModal from './ExpenseModal';
import ViewToggle from '../../components/common/ViewToggle';
import useTableView from '../../hooks/useTableView';
import { useConfirm } from '../../context/ConfirmContext';
import { fetchUsdToInrRate, toINR, normalizeCurrency, formatINR } from '../../utils/currency';
import { getExpiryStatus, formatDate, expiryHint } from '../../utils/expiry';
import './Expenses.css';

// human labels for the stored plan-type enum
const PLAN_TYPE_LABELS = { MONTHLY: 'Monthly', ANNUAL: 'Annual' };

const initialsOf = (name = '') => {
    const p = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (!p.length) return '#';
    return (p[0][0] + (p[1]?.[0] || p[0][1] || '')).toUpperCase();
};

// Template + accepted upload headers (loose, case-insensitive matching).
// Amount is a plain number; a dedicated Currency column (USD / INR) says
// how to convert each row — no guessing from $/₹ symbols.
const TEMPLATE_HEADERS = ['Platform', 'Tool', 'Plan', 'Plan Type (Monthly/Annual)', 'Amount', 'Currency (USD/INR)', 'Expiration Date (YYYY-MM-DD)', 'Purpose'];
const HEADER_ALIASES = {
    platform: ['platform', 'provider', 'platform/software', 'platform / software'],
    toolName: ['tool', 'tool name', 'tool/model', 'tool / model', 'software', 'model'],
    plan: ['plan', 'plan name', 'items', 'item'],
    planType: ['plan type', 'plan type (monthly/annual)', 'plantype', 'billing', 'billing cycle', 'cadence'],
    amount: ['amount', 'total amount spent', 'amount spent', 'cost', 'total'],
    currency: ['currency', 'currency (usd/inr)', 'curr', 'unit', 'usd/inr'],
    expirationDate: ['expiration date', 'expiration date (yyyy-mm-dd)', 'expiry', 'expiry date', 'expires', 'expires on', 'valid till', 'end date'],
    // `notes` kept as an alias so old sheets still import into Purpose
    purpose: ['purpose', 'notes', 'note', 'remarks', 'reason'],
};
const pickCell = (row, field) => {
    const aliases = HEADER_ALIASES[field];
    for (const key of Object.keys(row)) {
        if (aliases.includes(String(key).trim().toLowerCase())) return row[key];
    }
    return '';
};

export default function ExpenseList() {
    const [expenses, setExpenses] = useState([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [rate, setRate] = useState(null);
    const [rateError, setRateError] = useState('');

    // modal: { open, editing }  — editing is null for "add new"
    const [modal, setModal] = useState({ open: false, editing: null });
    const [deletingId, setDeletingId] = useState(null);
    // hover tooltip for long (truncated) notes: { text, x, y } | null
    const [noteTip, setNoteTip] = useState(null);

    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { ok, message }
    const fileRef = useRef(null);
    const confirm = useConfirm();
    const [view, setView] = useTableView();

    useEffect(() => {
        fetchUsdToInrRate().then(setRate).catch(() => setRateError('Live $ rate unavailable — enter ₹ amounts, or retry shortly.'));
    }, []);

    const fetchExpenses = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await expenseService.getAll();
            setExpenses(res.data.expenses);
            setTotalSpent(res.data.totalSpent);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load expenses.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchExpenses(); }, []);

    const openAdd = () => setModal({ open: true, editing: null });
    const openEdit = (record) => setModal({ open: true, editing: record });
    const closeModal = () => setModal({ open: false, editing: null });
    const handleSaved = async () => { closeModal(); await fetchExpenses(); };

    const handleDelete = async (record) => {
        const ok = await confirm({
            title: 'Delete this record?',
            message: `“${record.toolName}”${record.platform ? ` (${record.platform})` : ''} will be permanently removed. This cannot be undone.`,
            confirmLabel: 'Delete record',
            tone: 'danger',
        });
        if (!ok) return;
        setDeletingId(record._id);
        try {
            await expenseService.remove(record._id);
            await fetchExpenses();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete expense.');
        } finally {
            setDeletingId(null);
        }
    };

    const platformsCount = new Set(expenses.map((e) => (e.platform || '').trim().toLowerCase()).filter(Boolean)).size;

    // Show the full-note bubble only when the text is actually clipped.
    const showNoteTip = (evt, text) => {
        const el = evt.currentTarget;
        if (el.scrollWidth <= el.clientWidth) return; // fits — nothing hidden
        const r = el.getBoundingClientRect();
        setNoteTip({ text, x: r.left, y: r.bottom + 8 });
    };
    const hideNoteTip = () => setNoteTip(null);

    // ---- Excel template ----
    const downloadTemplate = () => {
        const H = TEMPLATE_HEADERS;
        const ws = XLSX.utils.json_to_sheet(
            [
                { [H[0]]: 'Anthropic', [H[1]]: 'Claude', [H[2]]: '3 pro and 1 max', [H[3]]: 'Monthly', [H[4]]: 250, [H[5]]: 'USD', [H[6]]: '2026-12-31', [H[7]]: 'code generation for AI research' },
                { [H[0]]: 'Google', [H[1]]: 'Google Flow', [H[2]]: '1 Ultra plan', [H[3]]: 'Annual', [H[4]]: 6500, [H[5]]: 'INR', [H[6]]: '2027-03-15', [H[7]]: '' },
            ],
            { header: H }
        );
        ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 26 }, { wch: 28 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, 'expenses-template.xlsx');
    };

    // ---- Excel upload ----
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-uploading the same file
        if (!file) return;

        setImporting(true);
        setImportResult(null);
        try {
            const wb = XLSX.read(await file.arrayBuffer());
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

            const items = [];
            let skipped = 0;
            rows.forEach((row) => {
                const toolName = String(pickCell(row, 'toolName') || '').trim();
                const amountRaw = pickCell(row, 'amount');
                const currency = normalizeCurrency(pickCell(row, 'currency')); // blank -> INR
                const amountSpent = toINR(amountRaw, currency, rate);
                if (!toolName && String(amountRaw).trim() === '') return; // blank row — ignore
                if (!toolName || amountSpent == null) { skipped += 1; return; }
                items.push({
                    platform: String(pickCell(row, 'platform') || '').trim(),
                    toolName,
                    plan: String(pickCell(row, 'plan') || '').trim(),
                    planType: String(pickCell(row, 'planType') || '').trim(), // backend normalises to '' | MONTHLY | ANNUAL
                    amountSpent,
                    expirationDate: String(pickCell(row, 'expirationDate') || '').trim(), // optional; backend parses/validates
                    purpose: String(pickCell(row, 'purpose') || '').trim(),
                });
            });

            if (items.length === 0) {
                setImportResult({ ok: false, message: `No valid rows found. Make sure the sheet has Tool and Amount columns${skipped ? ` (${skipped} row(s) were incomplete)` : ''}.` });
                return;
            }

            const res = await expenseService.bulkCreate(items);
            const added = res.data.added ?? items.length;
            const serverSkipped = (res.data.skipped?.length || 0) + skipped;
            setImportResult({ ok: true, message: `Imported ${added} tool${added === 1 ? '' : 's'}${serverSkipped ? ` · skipped ${serverSkipped} incomplete row${serverSkipped === 1 ? '' : 's'}` : ''}.` });
            await fetchExpenses();
        } catch (err) {
            setImportResult({ ok: false, message: err.response?.data?.message || 'Could not read that file. Use the template (.xlsx).' });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="exp-page">
            {/* ---------- Header ---------- */}
            <header className="exp-header">
                <div className="exp-heading">
                    <span className="exp-eyebrow"><Wallet size={14} strokeWidth={2.4} /> Cost tracking</span>
                    <h1 className="exp-title">Expenses <InfoHint text="Track each AI platform, tool and plan, and what you’ve spent. Enter dollars or rupees — dollars convert to ₹ automatically." /></h1>
                </div>
                {rate ? (
                    <div className="exp-rate">
                        <RefreshCw size={14} /> $1 = ₹{rate.toFixed(2)}
                        <span className="exp-rate-live"><span className="exp-rate-dot" /> live</span>
                    </div>
                ) : rateError ? (
                    <div className="exp-warn"><AlertCircle size={14} /> {rateError}</div>
                ) : null}
            </header>

            {/* ---------- Stat cards ---------- */}
            <div className="exp-stats">
                <div className="exp-stat" style={{ '--exp-accent': 'var(--color-primary)' }}>
                    <div className="exp-stat-label"><TrendingUp size={14} /> Total spent</div>
                    <div className="exp-stat-value">{formatINR(totalSpent)}</div>
                </div>
                <div className="exp-stat exp-stat--count" style={{ '--exp-accent': 'var(--color-teal)' }}>
                    <div className="exp-stat-label"><Layers size={14} /> Tools tracked</div>
                    <div className="exp-stat-value">{expenses.length}</div>
                </div>
                <div className="exp-stat exp-stat--count" style={{ '--exp-accent': 'var(--color-info)' }}>
                    <div className="exp-stat-label"><Building2 size={14} /> Platforms</div>
                    <div className="exp-stat-value">{platformsCount}</div>
                </div>
            </div>

            {error ? <div className="exp-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error}</div> : null}

            {/* ---------- Records ---------- */}
            <section className="exp-records">
                <div className="exp-records-head">
                    <div className="exp-records-title-wrap">
                        <h3 className="exp-records-title">Tool breakdown</h3>
                        {!loading && expenses.length > 0 ? <span className="exp-records-count">{expenses.length} {expenses.length === 1 ? 'tool' : 'tools'}</span> : null}
                    </div>
                    <div className="exp-toolbar">
                        <ViewToggle view={view} onChange={setView} />
                        <button type="button" className="exp-mini-btn" onClick={downloadTemplate}>
                            <Download size={14} /> Template
                        </button>
                        <button type="button" className="exp-mini-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
                            <Upload size={14} /> {importing ? 'Importing…' : 'Upload Excel'}
                        </button>
                        <button type="button" className="exp-mini-btn exp-mini-btn--primary" onClick={openAdd}>
                            <Plus size={15} /> Add new record
                        </button>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} hidden />
                    </div>
                </div>

                {importResult ? (
                    <div className={`exp-import-result ${importResult.ok ? 'is-ok' : 'is-err'}`}>
                        {importResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {importResult.message}
                    </div>
                ) : null}

                {loading ? (
                    <div className="exp-loading">Loading expenses…</div>
                ) : expenses.length === 0 ? (
                    <div className="exp-empty">
                        <div className="exp-empty-icon"><Receipt size={26} /></div>
                        <h3>No expenses yet</h3>
                        <p>Add a record, or upload a filled template to add several at once.</p>
                        <button type="button" className="exp-btn exp-btn-primary exp-empty-cta" onClick={openAdd}>
                            <Plus size={16} /> Add new record
                        </button>
                    </div>
                ) : (
                    <div className={`exp-table-scroll tv-scroll ${view === 'table' ? 'is-tableview' : ''}`} data-view={view}>
                        <table className="exp-table">
                            <thead>
                                <tr>
                                    <th>Tool / model</th>
                                    <th>Plan</th>
                                    <th className="exp-num">Amount spent</th>
                                    <th>Expiry</th>
                                    <th>Status</th>
                                    <th>Purpose</th>
                                    <th className="exp-actions-col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((e) => {
                                    const status = getExpiryStatus(e.expirationDate);
                                    return (
                                    <tr key={e._id} className={deletingId === e._id ? 'is-deleting' : ''}>
                                        <td data-label="Tool">
                                            <div className="exp-tool">
                                                <span className="exp-tool-badge">{initialsOf(e.toolName)}</span>
                                                <span className="exp-tool-meta">
                                                    <span className="exp-tool-name">{e.toolName}</span>
                                                    {e.platform ? <span className="exp-tool-platform">{e.platform}</span> : null}
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Plan">
                                            <div className="exp-plan-cell">
                                                {e.plan ? <span className="exp-plan">{e.plan}</span> : <span className="exp-notes-empty">—</span>}
                                                {e.planType && PLAN_TYPE_LABELS[e.planType] ? <span className="exp-plantype">{PLAN_TYPE_LABELS[e.planType]}</span> : null}
                                            </div>
                                        </td>
                                        <td className="exp-num" data-label="Amount spent"><span className="exp-money">{formatINR(e.amountSpent)}</span></td>
                                        <td data-label="Expiry">
                                            {e.expirationDate ? <span className="exp-expiry">{formatDate(e.expirationDate)}</span> : <span className="exp-notes-empty">—</span>}
                                        </td>
                                        <td data-label="Status">
                                            <span className={`exp-status exp-status--${status.tone}`} title={expiryHint(status.daysLeft)}>
                                                <span className="exp-status-dot" aria-hidden="true" />{status.label}
                                            </span>
                                        </td>
                                        <td data-label="Purpose">
                                            {e.purpose ? (
                                                <span
                                                    className="exp-notes"
                                                    onMouseEnter={(ev) => showNoteTip(ev, e.purpose)}
                                                    onMouseLeave={hideNoteTip}
                                                >
                                                    {e.purpose}
                                                </span>
                                            ) : <span className="exp-notes-empty">—</span>}
                                        </td>
                                        <td className="exp-actions-col" data-label="Actions">
                                            <div className="exp-row-actions">
                                                <button type="button" className="exp-icon-btn" onClick={() => openEdit(e)} title="Edit" aria-label={`Edit ${e.toolName}`}>
                                                    <Pencil size={15} />
                                                </button>
                                                <button type="button" className="exp-icon-btn exp-icon-btn--danger" onClick={() => handleDelete(e)} disabled={deletingId === e._id} title="Delete" aria-label={`Delete ${e.toolName}`}>
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {noteTip ? (
                <div className="exp-note-tip" style={{ left: noteTip.x, top: noteTip.y }} role="tooltip">
                    {noteTip.text}
                </div>
            ) : null}

            <ExpenseModal open={modal.open} editing={modal.editing} rate={rate} onClose={closeModal} onSaved={handleSaved} />
        </div>
    );
}
