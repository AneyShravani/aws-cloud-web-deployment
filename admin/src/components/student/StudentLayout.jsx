// ============================================================
// COMPONENT: StudentLayout
// ------------------------------------------------------------
// The student portal shell: fixed full-height sidebar + a scrolling
// content pane (same shell as the admin PageLayout), a compact
// topbar with a mobile hamburger, and the access banner pinned above
// every page. Wraps everything in StudentAccessProvider so the
// sidebar, banner and pages all read one access state.
// ============================================================
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { StudentAccessProvider, useStudentAccess } from '../../context/StudentAccessContext';
import StudentSidebar from './StudentSidebar';
import StudentBanner from './StudentBanner';
import '../layout/PageLayout.css';
import './student.css';

function StudentTopbar({ onMenuClick }) {
  const { profile } = useStudentAccess();
  return (
    <header className="st-topbar">
      <div className="st-topbar-left">
        <button type="button" className="st-hamburger" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} strokeWidth={2.2} />
        </button>
        <div>
          <p className="st-topbar-kicker">AI Lab Maintenance</p>
          <h2 className="st-topbar-title">Student Portal</h2>
        </div>
      </div>
      <div className="st-topbar-user">
        <span className="st-topbar-dot" />
        {profile?.name || 'Student'}
      </div>
    </header>
  );
}

function Shell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <div className="page-shell">
      <div
        className={`sidebar-backdrop ${menuOpen ? 'is-open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <StudentSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="page-content">
        <StudentTopbar onMenuClick={() => setMenuOpen(true)} />
        <main className="page-main">
          <div className="st-page">
            <StudentBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }) {
  return (
    <StudentAccessProvider>
      <Shell>{children}</Shell>
    </StudentAccessProvider>
  );
}
