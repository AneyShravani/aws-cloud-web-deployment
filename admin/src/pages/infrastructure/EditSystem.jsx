// ============================================================
// PAGE: EditSystem (Module 3.5 — Infrastructure)
// ------------------------------------------------------------
// Edit one system: its name/label AND its hardware configuration
// (device name, model, processor, RAM, RAM speed, graphics,
// storage, storage used). systemId comes from the row the admin
// clicked, never typed.
//
// Mandatory: name, deviceName, model, processor, ram, storage.
// Optional:  ramSpeed, graphics, storageUsed.
//
// Status is NOT editable here. Status changes only happen through
// Module 3.7's assignment workflow (assigning / releasing a system
// to / from a user). Editing status directly here would let a
// system show OCCUPIED with no real Assignment record behind it.
// ============================================================
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import systemService from '../../services/systemService';
import '../labs/Labs.css'; // reuse the labs-module form styling for a consistent look

// field config drives both rendering and validation — `required` marks mandatory fields
const FIELDS = [
    { key: 'deviceName', label: 'Device name', required: true, placeholder: 'e.g. CSE' },
    { key: 'model', label: 'Model', required: true, placeholder: 'e.g. Dell Vostro 3710' },
    { key: 'processor', label: 'Processor', required: true, placeholder: 'e.g. 12th Gen Intel Core i7-12700 @ 2.10 GHz' },
    { key: 'ram', label: 'RAM', required: true, placeholder: 'e.g. 16 GB (15.7 GB usable)' },
    { key: 'ramSpeed', label: 'RAM speed', required: false, placeholder: 'e.g. 3200 MT/s' },
    { key: 'graphics', label: 'Graphics', required: false, placeholder: 'e.g. Intel UHD Graphics 770 – 128 MB' },
    { key: 'storage', label: 'Storage', required: true, placeholder: 'e.g. 477 GB' },
    { key: 'storageUsed', label: 'Storage used', required: false, placeholder: 'e.g. 149 GB' },
];

function EditSystem({ system, onClose, onSave }) {
    const [form, setForm] = useState({
        name: system?.name || '',
        deviceName: system?.deviceName || '',
        model: system?.model || '',
        processor: system?.processor || '',
        ram: system?.ram || '',
        ramSpeed: system?.ramSpeed || '',
        graphics: system?.graphics || '',
        storage: system?.storage || '',
        storageUsed: system?.storageUsed || '',
    });
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (key) => (event) => {
        const { value } = event.target;
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => ({ ...prev, [key]: '' }));
        setSubmitError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        // trim all values, then validate the mandatory ones
        const trimmed = Object.fromEntries(
            Object.entries(form).map(([key, value]) => [key, (value || '').trim()])
        );

        const errors = {};
        if (!trimmed.name) errors.name = 'System name is required.';
        FIELDS.forEach(({ key, label, required }) => {
            if (required && !trimmed[key]) errors[key] = `${label} is required.`;
        });

        if (Object.keys(errors).length) {
            setFieldErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        try {
            // status intentionally left out of the payload — see header note
            const response = await systemService.updateSystem(system.id, trimmed);
            onSave?.(response);
        } catch (error) {
            setSubmitError(error?.response?.data?.message || 'Unable to update system');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="lab-form" onSubmit={handleSubmit}>
            <div className="lab-field">
                <label className="lab-label" htmlFor="systemName">System name <span className="lab-req">*</span></label>
                <input
                    id="systemName"
                    type="text"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="e.g. System-1"
                    autoComplete="off"
                    autoFocus
                    className={`lab-input ${fieldErrors.name ? 'has-error' : ''}`}
                />
                {fieldErrors.name ? <span className="lab-field-error">{fieldErrors.name}</span> : null}
            </div>

            <div className="lab-field-row">
                {FIELDS.map(({ key, label, required, placeholder }) => (
                    <div className="lab-field" key={key}>
                        <label className="lab-label" htmlFor={`sys-${key}`}>
                            {label}{' '}
                            {required
                                ? <span className="lab-req">*</span>
                                : <span className="lab-optional">(optional)</span>}
                        </label>
                        <input
                            id={`sys-${key}`}
                            type="text"
                            value={form[key]}
                            onChange={handleChange(key)}
                            placeholder={placeholder}
                            autoComplete="off"
                            className={`lab-input ${fieldErrors[key] ? 'has-error' : ''}`}
                        />
                        {fieldErrors[key] ? <span className="lab-field-error">{fieldErrors[key]}</span> : null}
                    </div>
                ))}
            </div>

            {/* status is read-only here — real changes happen via the assignment workflow (Module 3.7) */}
            <div className="lab-field">
                <label className="lab-label">Status</label>
                <p className="sys-status-readonly">{system?.status || 'AVAILABLE'}</p>
            </div>

            {submitError ? <div className="lab-form-error"><X size={15} /> {submitError}</div> : null}

            <div className="lab-form-actions">
                <button type="button" className="lab-btn lab-btn-ghost" onClick={onClose} disabled={isSubmitting}>
                    <X size={16} /> Cancel
                </button>
                <button type="submit" className="lab-btn lab-btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : <><Check size={16} /> Save changes</>}
                </button>
            </div>
        </form>
    );
}

export default EditSystem;
