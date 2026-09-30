import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import authService from '../../services/authService';
import '../../assets/colors.css';
import './Login.css';

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await authService.forgotPassword({ email: email.trim() });

      if (response?.success) {
        setStep('otp');
        setMessage(response.message || 'OTP sent successfully.');
        return;
      }

      setError(response?.message || 'Unable to send OTP.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to send OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();

    if (!otp.trim()) {
      setError('OTP is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await authService.verifyForgotPasswordOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      if (response?.success && response?.resetToken) {
        navigate('/forgot-reset-password', {
          replace: true,
          state: { resetToken: response.resetToken },
        });
        return;
      }

      setError(response?.message || 'Unable to verify OTP.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to verify OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>Forgot Password</h1>
          <p>
            {step === 'email'
              ? 'Enter your Admin email to receive an OTP.'
              : 'Enter the OTP sent to your Admin email.'}
          </p>
        </div>

        <form className="login-form" onSubmit={step === 'email' ? handleEmailSubmit : handleOtpSubmit}>
          <div className="login-field">
            <label htmlFor="forgotEmail">Email</label>
            <input
              disabled={step === 'otp'}
              id="forgotEmail"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setError('');
              }}
              placeholder="name@college.edu"
              type="email"
              value={email}
            />
          </div>

          {step === 'otp' ? (
            <div className="login-field">
              <label htmlFor="otp">OTP</label>
              <input
                id="otp"
                inputMode="numeric"
                maxLength="6"
                name="otp"
                onChange={(event) => {
                  setOtp(event.target.value);
                  setError('');
                }}
                placeholder="Enter 6-digit OTP"
                value={otp}
              />
            </div>
          ) : null}

          {message ? <p className="login-success">{message}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}

          <Button
            disabled={isSubmitting}
            label={isSubmitting ? 'Please wait...' : step === 'email' ? 'Send OTP' : 'Verify OTP'}
            type="submit"
          />

          <Link className="login-link" to="/login">Back to Login</Link>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
