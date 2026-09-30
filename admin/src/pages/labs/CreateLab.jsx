// ============================================================
// PAGE: CreateLab  (Module 3.4 — Lab Creation)
// ------------------------------------------------------------
// Form for the Admin to create / edit an AI lab for their org.
// Fields: lab name*, building/block*, floor*, lab number (optional).
// Calls labService.create() / labService.update().
// ============================================================
import React, { useEffect, useState } from 'react';
import { X, Check, Plus } from 'lucide-react';
import labService from '../../services/labService';
import './Labs.css';

const EMPTY_FORM = { name: '', building: '', floor: '', labNumber: '' };

function CreateLab({ onClose, onSave, initialLab }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialLab) {
      setForm({
        name: initialLab.name || '',
        building: initialLab.building || '',
        floor: initialLab.floor || '',
        labNumber: initialLab.labNumber || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setFieldErrors({});
    setSubmitError('');
  }, [initialLab]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setSubmitError('');
  };

  const handleChange = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setSubmitError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const building = form.building.trim();
    const floor = form.floor.trim();
    const labNumber = form.labNumber.trim();

    const errors = {};
    if (!name) errors.name = 'Lab name is required.';
    if (!building) errors.building = 'Building / block is required.';
    if (!floor) errors.floor = 'Floor is required.';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = { name, building, floor, labNumber };
      const response = initialLab
        ? await labService.update(initialLab.id, payload)
        : await labService.create(payload);

      if (response?.success) {
        onSave?.({
          ...(response.lab || {}),
          message: response.message || (initialLab ? 'Lab updated successfully.' : 'Lab created successfully.'),
        });
        resetForm();
        return;
      }

      setSubmitError(response?.message || 'Unable to save lab');
    } catch (error) {
      setSubmitError(error?.response?.data?.message || 'Unable to save lab');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="lab-form" onSubmit={handleSubmit}>
      <div className="lab-field">
        <label className="lab-label" htmlFor="labName">Lab name <span className="lab-req">*</span></label>
        <input
          id="labName"
          name="labName"
          type="text"
          value={form.name}
          onChange={handleChange('name')}
          placeholder="e.g. AI & Data Science Lab"
          autoComplete="off"
          autoFocus
          className={`lab-input ${fieldErrors.name ? 'has-error' : ''}`}
        />
        {fieldErrors.name ? <span className="lab-field-error">{fieldErrors.name}</span> : null}
      </div>

      <div className="lab-field-row">
        <div className="lab-field">
          <label className="lab-label" htmlFor="labBuilding">Building / Block <span className="lab-req">*</span></label>
          <input
            id="labBuilding"
            name="labBuilding"
            type="text"
            value={form.building}
            onChange={handleChange('building')}
            placeholder="e.g. CSE Block"
            autoComplete="off"
            className={`lab-input ${fieldErrors.building ? 'has-error' : ''}`}
          />
          {fieldErrors.building ? <span className="lab-field-error">{fieldErrors.building}</span> : null}
        </div>

        <div className="lab-field">
          <label className="lab-label" htmlFor="labFloor">Floor <span className="lab-req">*</span></label>
          <input
            id="labFloor"
            name="labFloor"
            type="text"
            value={form.floor}
            onChange={handleChange('floor')}
            placeholder="e.g. Ground Floor"
            autoComplete="off"
            className={`lab-input ${fieldErrors.floor ? 'has-error' : ''}`}
          />
          {fieldErrors.floor ? <span className="lab-field-error">{fieldErrors.floor}</span> : null}
        </div>
      </div>

      <div className="lab-field">
        <label className="lab-label" htmlFor="labNumber">
          Lab number <span className="lab-optional">(optional)</span>
        </label>
        <input
          id="labNumber"
          name="labNumber"
          type="text"
          value={form.labNumber}
          onChange={handleChange('labNumber')}
          placeholder="e.g. Lab-204"
          autoComplete="off"
          className="lab-input"
        />
      </div>

      {submitError ? <div className="lab-form-error"><X size={15} /> {submitError}</div> : null}

      <div className="lab-form-actions">
        <button type="button" className="lab-btn lab-btn-ghost" onClick={() => { onClose(); resetForm(); }} disabled={isSubmitting}>
          <X size={16} /> Cancel
        </button>
        <button type="submit" className="lab-btn lab-btn-primary" disabled={isSubmitting}>
          {isSubmitting
            ? (initialLab ? 'Saving…' : 'Creating…')
            : initialLab
              ? <><Check size={16} /> Save changes</>
              : <><Plus size={16} /> Create lab</>}
        </button>
      </div>
    </form>
  );
}

export default CreateLab;
