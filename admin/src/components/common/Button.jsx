import React from 'react';
import './Button.css';

function Button({ label, variant = 'primary', onClick, disabled, loading, type = 'button' }) {
  return (
    <button
      className={`app-button ${variant === 'secondary' ? 'button-secondary' : variant === 'danger' ? 'button-danger' : 'button-primary'}`}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}

export default Button;
