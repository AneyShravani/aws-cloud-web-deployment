import React, { useEffect, useState } from 'react';
import Button from '../../components/common/Button';
import organizationService from '../../services/organizationService';
import './CreateOrganization.css';

const requiredFields = ['organizationName', 'address', 'city', 'state', 'country', 'adminName', 'adminEmail'];

function CreateOrganization({ onClose, onSave, initialOrganization }) {
  const [form, setForm] = useState({
    organizationName: '',
    address: '',
    city: '',
    state: '',
    country: '',
    adminName: '',
    adminEmail: ''
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialOrganization) {
      setForm({
        organizationName: initialOrganization.name,
        address: initialOrganization.address,
        city: initialOrganization.city,
        state: initialOrganization.state,
        country: initialOrganization.country,
        adminName: initialOrganization.adminName,
        adminEmail: initialOrganization.adminEmail
      });
    }
  }, [initialOrganization]);

  const resetForm = () => {
    setForm({
      organizationName: '',
      address: '',
      city: '',
      state: '',
      country: '',
      adminName: '',
      adminEmail: ''
    });
    setErrors({});
    setSubmitError('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setSubmitError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = requiredFields.reduce((acc, field) => {
      if (!form[field]?.trim()) {
        acc[field] = 'This field is required.';
      }
      return acc;
    }, {});

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        organizationName: form.organizationName.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
      };

      const response = initialOrganization
        ? await organizationService.updateOrganization(initialOrganization.id, payload)
        : await organizationService.createOrganization(payload);

      if (response?.success) {
        const organizationToSave = {
          id: response?.organization?.id || initialOrganization?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: response?.organization?.name || payload.organizationName,
          address: response?.organization?.address || payload.address,
          city: response?.organization?.city || payload.city,
          state: response?.organization?.state || payload.state,
          country: response?.organization?.country || payload.country,
          adminName: response?.organization?.adminName || payload.adminName,
          adminEmail: response?.organization?.adminEmail || payload.adminEmail,
          createdAt: response?.organization?.createdAt || initialOrganization?.createdAt || new Date().toLocaleDateString(),
          message: response?.message || (initialOrganization ? 'Organization updated successfully.' : 'Organization created successfully.'),
        };

        onSave?.(organizationToSave);
        resetForm();
        return;
      }

      setSubmitError(response?.message || 'Unable to save organization');
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to save organization';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (id, label, type = 'text', placeholder) => (
    <div className="create-org-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={form[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={errors[id] ? 'input-error' : ''}
      />
      {errors[id] ? <span className="field-error">{errors[id]}</span> : null}
    </div>
  );

  return (
    <form className="create-org-form" onSubmit={handleSubmit}>
      <div className="create-org-grid">
        {renderField('organizationName', 'Organization Name', 'text', 'College or organization')}
        {renderField('address', 'Address', 'text', 'Street address')}
        {renderField('city', 'City', 'text', 'City')}
        {renderField('state', 'State', 'text', 'State')}
        {renderField('country', 'Country', 'text', 'Country')}
        {renderField('adminName', 'Admin Name', 'text', 'Administrator name')}
        {renderField('adminEmail', 'Admin Email', 'email', 'admin@college.edu')}
      </div>

      {submitError ? <p className="field-error">{submitError}</p> : null}

      <div className="create-org-actions">
        <Button label="Cancel" variant="secondary" onClick={() => { onClose(); resetForm(); }} />
        <Button label={isSubmitting ? (initialOrganization ? 'Saving...' : 'Creating...') : initialOrganization ? 'Save Changes' : 'Create Organization'} variant="primary" type="submit" disabled={isSubmitting} />
      </div>
    </form>
  );
}

export default CreateOrganization;
