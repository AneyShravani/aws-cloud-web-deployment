// ============================================================
// COMPONENT: ExpenseModal  (Module 3.3 — Expenses)
// ------------------------------------------------------------
// A pop-up dialog that ADDS or EDITS an expense, described the
// way it comes from the finance sheet:
//   Platform -> Tool / model -> Plan -> Amount (+ currency) -> Notes
//
// Currency is chosen explicitly with a ₹ / $ toggle — the admin
// picks the currency and types a plain number. Dollars convert
// to INR (live rate) with a "= ₹X" preview; rupees are stored
// as-is. (No more guessing the currency from a $/₹ symbol.)
//
// Behaviour the admin asked for:
//   • Backdrop is blurred.
//   • Clicking the backdrop / open area does NOT close it (so a
//     stray click can't wipe half-typed data) — only the ✕ or
//     Cancel button closes it.
//   • On edit, every field is pre-filled from the record.
// ============================================================
import React, { useEffect, useState } from 'react';
import { Receipt, Pencil, ArrowRight, AlertCircle, Check, X } from 'lucide-react';
import expenseService from '../../services/expenseService';
import { toINR, formatINR } from '../../utils/currency';
import { toDateInputValue } from '../../utils/expiry';

const EMPTY = { platform: '', toolName: '', plan: '', planType: '', amount: '', currency: 'INR', expirationDate: '', purpose: '' };

export default function ExpenseModal({ open, editing, rate, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const isEdit = Boolean(editing);

    // (re)seed the form each time the dialog opens.
    // Stored amounts are already in INR, so an edited record starts on ₹.
    useEffect(() => {
        if (!open) return;
        if (editing) {
            setForm({
                platform: editing.platform || '',
                toolName: editing.toolName || '',
                plan: editing.plan || '',
                planType: editing.planType || '',
                amount: editing.amountSpent != null ? String(editing.amountSpent) : '',
                currency: 'INR',
                expirationDate: toDateInputValue(editing.expirationDate),
                purpose: editing.purpose || '',
            });
        } else {
            setForm(EMPTY);
        }
        setError('');
    }, [open, editing]);

    // lock background scroll while the dialog is open
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    const setCurrency = (currency) => setForm((f) => ({ ...f, currency }));

    // live "= ₹X" preview — only when Dollars is selected
    const previewINR = (() => {
        if (form.currency !== 'USD' || !rate || form.amount.trim() === '') return null;
        const inr = toINR(form.amount, 'USD', rate);
        return inr == null ? null : formatINR(inr);
    })();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.platform.trim() || !form.toolName.trim() || !form.plan.trim() || form.amount.trim() === '') {
            setError('Platform, tool, plan and amount are required.');
            return;
        }

        if (!form.expirationDate) {
            setError('Expiration date is required.');
            return;
        }

        const amountINR = toINR(form.amount, form.currency, rate);
        if (amountINR == null) {
            setError(
                form.currency === 'USD' && !rate
                    ? 'Exchange rate still loading — try again in a moment.'
                    : 'Enter the amount as a plain number (e.g. 40 or 6500).'
            );
            return;
        }

        setLoading(true);
        try {
            const payload = {
                platform: form.platform.trim(),
                toolName: form.toolName.trim(),
                plan: form.plan.trim(),
                planType: form.planType, // '' | MONTHLY | ANNUAL
                amountSpent: amountINR,
                expirationDate: form.expirationDate, // YYYY-MM-DD
                purpose: form.purpose.trim(),
            };
            if (isEdit) await expenseService.update(editing._id, payload);
            else await expenseService.create(payload);
            onSaved?.();
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'add'} expense.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        // NOTE: no onClick on the backdrop — clicking outside must NOT close.
        <div className="exp-modal-backdrop" role="presentation">
            <div className="exp-modal" role="dialog" aria-modal="true" aria-labelledby="exp-modal-title">
                <div className="exp-modal-head">
                    <span className="exp-form-icon">{isEdit ? <Pencil size={19} strokeWidth={2.2} /> : <Receipt size={19} strokeWidth={2.2} />}</span>
                    <div className="exp-modal-head-text">
                        <h3 className="exp-form-title" id="exp-modal-title">{isEdit ? 'Edit record' : 'Add new record'}</h3>
                        <p className="exp-form-sub">{isEdit ? `Updating “${editing.toolName}”` : 'Pick a currency, enter a number — dollars convert to ₹'}</p>
                    </div>
                    <button type="button" className="exp-modal-close" onClick={onClose} aria-label="Close" disabled={loading}>
                        <X size={18} />
                    </button>
                </div>

                <form className="exp-modal-body" onSubmit={handleSubmit}>
                    {error ? <div className="exp-error"><AlertCircle size={16} /> {error}</div> : null}

                    <div className="exp-field-grid">
                        <div className="exp-field">
                            <label className="exp-label" htmlFor="platform">Platform / provider <span className="exp-req">*</span></label>
                            <input id="platform" name="platform" className="exp-input" value={form.platform} onChange={handleChange} placeholder="e.g. Anthropic, Google" autoComplete="off" autoFocus />
                        </div>

                        <div className="exp-field">
                            <label className="exp-label" htmlFor="toolName">Tool / model name <span className="exp-req">*</span></label>
                            <input id="toolName" name="toolName" className="exp-input" value={form.toolName} onChange={handleChange} placeholder="e.g. Claude, Google Flow" autoComplete="off" />
                        </div>

                        <div className="exp-field">
                            <label className="exp-label" htmlFor="plan">Plan <span className="exp-req">*</span></label>
                            <input id="plan" name="plan" className="exp-input" value={form.plan} onChange={handleChange} placeholder="e.g. 3 pro and 1 max, 1 Ultra plan" autoComplete="off" />
                        </div>

                        <div className="exp-field">
                            <label className="exp-label" htmlFor="planType">Plan type <span className="exp-optional">· optional</span></label>
                            <select id="planType" name="planType" className="exp-input exp-select" value={form.planType} onChange={handleChange}>
                                <option value="">Not specified</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="ANNUAL">Annual</option>
                            </select>
                        </div>

                        <div className="exp-field">
                            <label className="exp-label" htmlFor="amount">Amount spent <span className="exp-req">*</span></label>
                            <div className="exp-amount-row">
                                <div className="exp-currency-toggle" role="group" aria-label="Currency">
                                    <button type="button" className={`exp-cur-btn ${form.currency === 'INR' ? 'is-active' : ''}`} onClick={() => setCurrency('INR')} aria-pressed={form.currency === 'INR'}>₹ Rupees</button>
                                    <button type="button" className={`exp-cur-btn ${form.currency === 'USD' ? 'is-active' : ''}`} onClick={() => setCurrency('USD')} aria-pressed={form.currency === 'USD'}>$ Dollars</button>
                                </div>
                                <div className="exp-amount-input">
                                    <span className="exp-amount-sym">{form.currency === 'USD' ? '$' : '₹'}</span>
                                    <input id="amount" name="amount" className="exp-input exp-input--amount" value={form.amount} onChange={handleChange} placeholder={form.currency === 'USD' ? '40' : '6500'} inputMode="decimal" autoComplete="off" />
                                </div>
                            </div>
                            {previewINR ? <span className="exp-convert"><ArrowRight size={12} /> {previewINR}</span> : null}
                        </div>

                        <div className="exp-field">
                            <label className="exp-label" htmlFor="expirationDate">Expiration date <span className="exp-req">*</span></label>
                            <input id="expirationDate" name="expirationDate" type="date" className="exp-input" value={form.expirationDate} onChange={handleChange} />
                            <span className="exp-field-hint">When this tool / subscription expires.</span>
                        </div>
                    </div>

                    <div className="exp-field">
                        <label className="exp-label" htmlFor="purpose">Purpose <span className="exp-optional">· optional</span></label>
                        <textarea id="purpose" name="purpose" className="exp-input exp-textarea" value={form.purpose} onChange={handleChange} placeholder="e.g. code generation for the AI research project" rows={2} />
                    </div>

                    <div className="exp-modal-actions">
                        <button type="button" className="exp-btn exp-btn-ghost" onClick={onClose} disabled={loading}>
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="exp-btn exp-btn-primary" disabled={loading}>
                            {loading ? 'Saving…' : isEdit ? <><Check size={16} /> Save changes</> : <><Receipt size={16} /> Add record</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
