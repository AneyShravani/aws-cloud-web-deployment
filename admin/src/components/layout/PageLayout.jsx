import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './PageLayout.css';

function PageLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  // Close the drawer whenever the route changes (e.g. tapping a nav link).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="page-shell">
      <div
        className={`sidebar-backdrop ${menuOpen ? 'is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <div className="page-content">
        <Navbar onMenuClick={openMenu} />
        <main className="page-main">{children}</main>
      </div>
    </div>
  );
}

export default PageLayout;
