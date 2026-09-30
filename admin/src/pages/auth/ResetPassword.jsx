import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import '../../assets/colors.css';
import './Login.css';

const passwordPolicyMessage =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const isValidPassword = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[!@#$%^&*]/.test(password);

function ResetPassword({ mode = 'firstLogin' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [visibleFields, setVisibleFields] = useState({
    newPassword: false,
    confirmPassword: false,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isForgotPassword = mode === 'forgot';

  useEffect(() => {
    if (isForgotPassword && !location.state?.resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [isForgotPassword, location.state, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError('');
  };

  const toggleVisibility = (field) => {
    setVisibleFields((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const validate = () => {
    if (!form.newPassword || !form.confirmPassword) {
      return 'New password and confirm password are required.';
    }

    if (!isValidPassword(form.newPassword)) {
      return passwordPolicyMessage;
    }

    if (form.newPassword !== form.confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = isForgotPassword
        ? await authService.resetForgotPassword({
            ...form,
            resetToken: location.state?.resetToken,
          })
        : await authService.resetPassword(form);

      if (response?.success) {
        logout();
        navigate('/login', {
          replace: true,
          state: { message: 'Password updated successfully. Please login again.' },
        });
        return;
      }

      setError(response?.message || 'Unable to update password.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>Reset Password</h1>
          <p>{isForgotPassword ? 'Create a new password for your account.' : 'Set a new password before continuing.'}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-input-wrap">
              <input
                id="newPassword"
                name="newPassword"
                type={visibleFields.newPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Enter new password"
              />
              <button
                aria-label={visibleFields.newPassword ? 'Hide new password' : 'Show new password'}
                className="password-toggle"
                onClick={() => toggleVisibility('newPassword')}
                type="button"
              >
                {String.fromCharCode(visibleFields.newPassword ? 0x25c9 : 0x25cc)}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={visibleFields.confirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
              />
              <button
                aria-label={visibleFields.confirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="password-toggle"
                onClick={() => toggleVisibility('confirmPassword')}
                type="button"
              >
                {String.fromCharCode(visibleFields.confirmPassword ? 0x25c9 : 0x25cc)}
              </button>
            </div>
          </div>

          {error ? <p className="login-error">{error}</p> : null}

          <Button
            label={isSubmitting ? 'Updating...' : 'Update Password'}
            type="submit"
            disabled={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
