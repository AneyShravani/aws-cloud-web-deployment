import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FlaskConical, Eye, EyeOff } from 'lucide-react';
import '../../assets/colors.css';
import './Login.css';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email || !form.password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await login({
        email: form.email,
        password: form.password,
      }, { rememberMe: form.rememberMe });

      const role = response?.user?.role;
      // Any account still on its first login (admin-created students included)
      // must set a new password before entering.
      if (response?.user?.firstLogin && role !== 'SUPER_ADMIN') {
        navigate('/reset-password');
      } else if (role === 'SUPER_ADMIN') {
        navigate('/organizations');
      } else if (role === 'STUDENT') {
        navigate('/student/home');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        setError('Invalid Email or Password');
      } else if (err?.response?.status === 403) {
        // deactivated / strike-blocked accounts carry a specific reason
        setError(err?.response?.data?.message || 'Your account cannot sign in. Contact your admin.');
      } else {
        setError('Unable to connect to server');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">
            <FlaskConical size={24} strokeWidth={2.2} />
          </span>
          <h1>AI Lab Maintenance</h1>
          <p>Sign in to continue</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@college.edu"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
              </button>
            </div>
          </div>

          <div className="login-meta">
            <label className="login-checkbox">
              <input
                checked={form.rememberMe}
                name="rememberMe"
                onChange={handleChange}
                type="checkbox"
              />
              <span>Remember Me</span>
            </label>
            <Link className="login-link" to="/forgot-password">Forgot Password</Link>
          </div>

          {location.state?.message ? <p className="login-success">{location.state.message}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}

          <button className="app-button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;