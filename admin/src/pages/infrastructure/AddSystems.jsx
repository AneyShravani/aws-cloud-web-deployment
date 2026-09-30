// ============================================================
// PAGE: AddSystems  (Module 3.5 — Infrastructure)
// ------------------------------------------------------------
// Admin defines HOW MANY systems a lab has (e.g. Lab 1 -> 10).
// Creates the system records inside the selected lab.
// Calls systemService.addToLab().
// FIX (Copilot MEDIUM): count must be a whole number — decimals
// like 2.5 used to pass validation and get silently truncated
// by the backend loop, giving unexpected results.
// ============================================================

import React, { useState } from 'react';
import Button from '../../components/common/Button';
import systemService from '../../services/systemService';
import '../organizations/CreateOrganization.css'; // reuse existing form styling

function AddSystems({ labId, onClose, onSave }) {
    const [count, setCount] = useState('');       // how many systems to add
    const [fieldError, setFieldError] = useState('');   // validation error (empty/invalid count)
    const [submitError, setSubmitError] = useState('');  // error from the API call
    const [isSubmitting, setIsSubmitting] = useState(false); // disables button while request is in flight

    const handleSubmit = async (event) => {
        event.preventDefault(); // stop normal browser form reload

        const numericCount = Number(count); // convert input string to number

        // basic validation before hitting the API
        if (!Number.isInteger(numericCount) || numericCount < 1) { // FIX: reject decimals (e.g. 2.5), not just falsy/negative values
            setFieldError('Enter a valid whole number of systems (1 or more).'); // updated message reflects the whole-number requirement
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        try {
            const response = await systemService.addSystems(labId, numericCount); // labId comes from prop, not user input
            onSave?.(response); // tell parent (LabList) to refresh + close modal
            setCount(''); // reset field
        } catch (error) {
            setSubmitError(error?.response?.data?.message || 'Unable to add systems');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="create-org-form" onSubmit={handleSubmit}>
            <div className="create-org-field">
                <label htmlFor="systemCount">Number of Systems</label>
                <input
                    id="systemCount"
                    type="number"
                    min="1"
                    step="1" // NEW: hints the browser's own increment UI toward whole numbers too, backs up the JS check above
                    value={count}
                    onChange={(event) => {
                        setCount(event.target.value); // update as user types
                        setFieldError('');            // clear old error once they start fixing it
                        setSubmitError('');
                    }}
                    placeholder="e.g. 5"
                    className={fieldError ? 'input-error' : ''}
                />
                {fieldError ? <span className="field-error">{fieldError}</span> : null}
            </div>

            {submitError ? <p className="field-error">{submitError}</p> : null}

            <div className="create-org-actions">
                <Button label="Cancel" variant="secondary" onClick={onClose} />
                <Button
                    label={isSubmitting ? 'Adding...' : 'Add Systems'}
                    variant="primary"
                    type="submit"
                    disabled={isSubmitting}
                />
            </div>
        </form>
    );
}

export default AddSystems;