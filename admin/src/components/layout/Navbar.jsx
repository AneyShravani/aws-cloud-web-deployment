import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

function Navbar({ onMenuClick = () => {} }) {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <style>{`
        .topbar-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          width: 42px;
          height: 42px;
          padding: 0;
          margin-right: 12px;
          background: var(--color-card-bg);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .topbar-hamburger span {
          display: block;
          width: 20px;
          height: 2px;
          margin: 0 auto;
          border-radius: 2px;
          background: var(--color-heading);
          transition: transform 0.2s ease;
        }
        .topbar-hamburger:hover {
          background: var(--color-light-bg);
        }
        .topbar-hamburger:active {
          transform: scale(0.94);
        }
        @media (max-width: 900px) {
          .topbar-hamburger {
            display: flex;
          }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="topbar-hamburger"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="topbar-kicker">AI Lab Maintenance</p>
          <h2 className="topbar-title">Admin Panel</h2>
        </div>
      </div>

      <div className="topbar-user">
        <span className="topbar-dot" />
        {user?.name || 'Admin'}
      </div>
    </header>
  );
}

export default Navbar;