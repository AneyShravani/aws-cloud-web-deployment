import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  Wallet,
  Activity,
  UsersRound,
  Inbox,
  UserCheck,
  CalendarCheck,
  ClipboardCheck,
  FileBarChart,
  Building2,
  LogOut,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import assignmentService from '../../services/assignmentService';
import './Sidebar.css';

const COLLAPSE_KEY = 'sidebarCollapsed';

// Nav is data-driven so the markup stays tiny and every item is consistent.
const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/labs', label: 'Labs', icon: FlaskConical },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/utilization', label: 'Utilization', icon: Activity },
  { to: '/users', label: 'User Management', icon: UsersRound },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/approved-users', label: 'Approved Users', icon: UserCheck },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/checkin', label: 'Check-in', icon: ClipboardCheck },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
];

const SUPER_ADMIN_NAV = [
  { to: '/organizations', label: 'Organizations', icon: Building2 },
];

const initialsOf = (name = '') => {
  const parts = name.trim().replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || '')).toUpperCase();
};

function Sidebar({ open = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, organizationName, user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const roleLabel = isSuperAdmin ? 'Super Admin' : 'Admin';
  const navItems = isSuperAdmin ? SUPER_ADMIN_NAV : ADMIN_NAV;

  // desktop-only collapsed rail, remembered across reloads
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  // Live count of PENDING requests, shown as a badge on the Requests item.
  // Pending = requests with no Assignment yet (same list the Requests page shows).
  const [pendingRequests, setPendingRequests] = useState(0);
  const refreshPending = useCallback(async () => {
    if (isSuperAdmin) return;
    try {
      const res = await assignmentService.getRequests();
      setPendingRequests(Array.isArray(res?.data) ? res.data.length : 0);
    } catch { /* keep last known count on transient errors */ }
  }, [isSuperAdmin]);

  // fetch on mount, when the app regains focus, on an approve elsewhere
  // (custom 'requests:changed' event), and as a slow safety-net poll.
  useEffect(() => {
    if (isSuperAdmin) return undefined;
    refreshPending();
    const onFocus = () => refreshPending();
    const onChanged = () => refreshPending();
    window.addEventListener('focus', onFocus);
    window.addEventListener('requests:changed', onChanged);
    const id = setInterval(refreshPending, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('requests:changed', onChanged);
      clearInterval(id);
    };
  }, [isSuperAdmin, refreshPending]);

  // also refresh when navigating between pages (e.g. back from Requests)
  useEffect(() => { refreshPending(); }, [location.pathname, refreshPending]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      {/* ---------- Brand ---------- */}
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">
          <FlaskConical size={20} strokeWidth={2.2} />
        </span>
        <div className="sidebar-brand-text">
          <strong>AI Lab</strong>
          <span>Maintenance</span>
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
        {navItems.map(({ to, label, icon: Icon }) => {
          const badge = to === '/requests' ? pendingRequests : 0;
          const badgeLabel = badge > 99 ? '99+' : badge;
          return (
            <NavLink
              key={to}
              to={to}
              className="sidebar-link"
              onClick={onClose}
              title={collapsed ? `${label}${badge ? ` (${badge})` : ''}` : undefined}
            >
              <span className="sidebar-link-rail" aria-hidden="true" />
              <span className="sidebar-icon">
                <Icon size={19} strokeWidth={2} />
                {badge > 0 ? (
                  <span className="sidebar-badge" aria-label={`${badge} new request${badge === 1 ? '' : 's'}`}>{badgeLabel}</span>
                ) : null}
              </span>
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ---------- Footer: user + logout ---------- */}
      <div className="sidebar-footer">
        <div className="sidebar-user" title={collapsed ? (user?.name || 'Admin') : undefined}>
          <span className="sidebar-avatar">{initialsOf(user?.name)}</span>
          <span className="sidebar-user-meta">
            <strong>{user?.name || 'Admin'}</strong>
            <span>{organizationName || roleLabel}</span>
          </span>
        </div>
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          type="button"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={17} strokeWidth={2.2} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
