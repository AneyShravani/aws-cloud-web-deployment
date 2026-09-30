// ============================================================
// CONTEXT: StudentAccessContext
// ------------------------------------------------------------
// Fetches /api/student/overview once and exposes the single source
// of truth the whole student portal gates itself on:
//   profile  — name / email / roll / dept / org
//   access   — { state: none|active|nearing|expired, referenceId,
//                projectName, startDate, endDate, daysLeft }
//   strike   — { limit, count, remaining, tone: safe|risk|blocked }
//
// Booking modules are enabled only when access.state is 'active' or
// 'nearing'. This is UX; the backend re-checks on every action.
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import studentService from '../services/studentService';

const StudentAccessContext = createContext(null);

export function StudentAccessProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState({ state: 'none' });
  const [projects, setProjects] = useState([]);
  const [strike, setStrike] = useState({ limit: 0, count: 0, remaining: 0, tone: 'safe' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await studentService.overview();
      setProfile(res?.profile || null);
      setAccess(res?.access || { state: 'none' });
      setProjects(Array.isArray(res?.projects) ? res.projects : []);
      setStrike(res?.strike || { limit: 0, count: 0, remaining: 0, tone: 'safe' });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // strike-blocked (hit the no-show limit) — can log in, but every module is
  // locked until an admin reactivates. Independent of the access window.
  const blocked = strike?.tone === 'blocked';
  // booking-capable = a live, unexpired window AND not strike-blocked
  const canBook = (access?.state === 'active' || access?.state === 'nearing') && !blocked;

  const value = useMemo(
    () => ({ profile, access, projects, strike, blocked, loading, error, canBook, refresh }),
    [profile, access, projects, strike, blocked, loading, error, canBook, refresh]
  );

  return <StudentAccessContext.Provider value={value}>{children}</StudentAccessContext.Provider>;
}

export const useStudentAccess = () => {
  const ctx = useContext(StudentAccessContext);
  if (!ctx) throw new Error('useStudentAccess must be used within StudentAccessProvider');
  return ctx;
};
