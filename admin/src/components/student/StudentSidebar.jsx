// ============================================================
// COMPONENT: StudentSidebar
// ------------------------------------------------------------
// The student portal navigation — a faithful mirror of the admin
// Sidebar (same CSS, same collapse/expand rail persisted across
// reloads, same mobile drawer) with a student-only nav set.
// "My Bookings" is GATED: with no live access it renders locked
// (non-clickable, lock icon) rather than a link, matching the
// backend rule that only Home / Requests / Profile stay usable.
// ============================================================
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, CalendarCheck, UserRound, LogOut, X, Lock,
  GraduationCap, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentAccess } from '../../context/StudentAccessContext';
import '../layout/Sidebar.css';
import './student.css';

const COLLAPSE_KEY = 'studentSidebarCollapsed';

const initialsOf = (name = '') => {
  const parts = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || '')).toUpperCase();
};

export default function StudentSidebar({ open = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { profile, canBook, blocked } = useStudentAccess();

  const name = profile?.name || user?.name || 'Student';
  const org = profile?.organizationName || user?.organizationName || 'Student portal';

  // desktop-only collapsed rail, remembered across reloads (mirrors admin)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Bookings needs live access (gated). When strike-blocked, everything
  // functional locks — Requests too (the only fix is admin reactivation).
  const NAV = [
    { to: '/student/home', label: 'Home', icon: LayoutDashboard },
    { to: '/student/requests', label: 'My Requests', icon: FileText, lockWhenBlocked: true },
    { to: '/student/bookings', label: 'My Bookings', icon: CalendarCheck, gated: true },
    { to: '/student/profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      {/* ---------- Brand ---------- */}
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">
          <GraduationCap size={20} strokeWidth={2.2} />
        </span>
        <div className="sidebar-brand-text">
          <strong>AI Lab</strong>
          <span>Student</span>
        </div>
        {/* desktop: collapse/expand rail */}
        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronsRight size={18} strokeWidth={2.4} /> : <ChevronsLeft size={18} strokeWidth={2.4} />}
        </button>
        {/* mobile drawer: close */}
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>

      {/* ---------- Nav ---------- */}
      <nav className="sidebar-nav" aria-label="Primary">
        <p className="sidebar-nav-label">Menu</p>
        {NAV.map(({ to, label, icon: Icon, gated, lockWhenBlocked }) => {
          const locked = (gated && !canBook) || (lockWhenBlocked && blocked);
          if (locked) {
            return (
              <div key={to} className="sidebar-link st-link-locked" title={collapsed ? `${label} — locked` : 'Locked — you need active access'}>
                <span className="sidebar-link-rail" aria-hidden="true" />
                <span className="sidebar-icon"><Icon size={19} strokeWidth={2} /></span>
                <span className="sidebar-link-text">{label}</span>
                <Lock size={14} strokeWidth={2.4} className="st-link-lock" />
              </div>
            );
          }
          return (
            <NavLink key={to} to={to} className="sidebar-link" onClick={onClose} title={collapsed ? label : undefined}>
              <span className="sidebar-link-rail" aria-hidden="true" />
              <span className="sidebar-icon"><Icon size={19} strokeWidth={2} /></span>
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ---------- Footer ---------- */}
      <div className="sidebar-footer">
        <div className="sidebar-user" title={collapsed ? name : undefined}>
          <span className="sidebar-avatar">{initialsOf(name)}</span>
          <span className="sidebar-user-meta">
            <strong>{name}</strong>
            <span>{org}</span>
          </span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout} type="button" title={collapsed ? 'Logout' : undefined}>
          <LogOut size={17} strokeWidth={2.2} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
