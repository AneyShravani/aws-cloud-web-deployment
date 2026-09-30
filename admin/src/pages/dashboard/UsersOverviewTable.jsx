// ============================================================
// SECTION: UsersOverviewTable (Dashboard, Module 3.1)
// ------------------------------------------------------------
// Shows every user with an active/past assignment: name, ID,
// lab, system, and hours worked (computed from Assignment's
// startDate to min(now, endDate)). Reuses assignmentService.getAll()
// - no new backend endpoint needed, same data listAssignments
// already returns.
// ============================================================

import React from 'react';
import { useEffect, useState } from 'react';
import assignmentService from '../../services/assignmentService';

const STATUS_COLORS = {
  ACTIVE: 'var(--color-success)',
  NEARING_EXPIRY: 'var(--color-warning)',
  EXPIRED: 'var(--color-danger)',
};

const calculateHoursWorked = (startDate, endDate) => {
  const start = new Date(startDate);
  const now = new Date();
  const end = new Date(endDate);
  const effectiveEnd = now < end ? now : end; // cap at endDate once expired
  const hours = (effectiveEnd - start) / (1000 * 60 * 60);
  return Math.max(0, Math.round(hours));
};

export default function UsersOverviewTable() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true);
      setError('');
      try {
        // assignmentService returns the { success, data } envelope
        const res = await assignmentService.getAll();
        setAssignments(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        setError('Could not load user overview data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  return (
    <div
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 20,
      }}
    >
      <h3 style={{ color: 'var(--color-heading)', marginBottom: 16 }}>User Overview</h3>

      {error && (
        <p style={{ color: 'var(--color-white)', background: 'var(--color-danger)', padding: '8px 12px', borderRadius: 6, fontSize: 14 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text)' }}>Loading users...</p>
      ) : assignments.length === 0 ? (
        <p style={{ color: 'var(--color-text)' }}>No users assigned yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-light-bg)' }}>
                <Th>S.No</Th>
                <Th>User Name</Th>
                <Th>User ID</Th>
                <Th>Lab</Th>
                <Th>System</Th>
                <Th>Hours Working</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a._id || a.referenceId} style={{ borderTop: '1px solid var(--color-table-border)' }}>
                  <Td>{i + 1}</Td>
                  <Td>{a.name}</Td>
                  <Td>{a.labUserId?.rollNumber || '—'}</Td>
                  <Td>{a.labName}</Td>
                  <Td>{a.systemName}</Td>
                  <Td>{calculateHoursWorked(a.startDate, a.endDate)} hrs</Td>
                  <Td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-white)',
                        background: STATUS_COLORS[a.liveStatus] || 'var(--color-muted)',
                      }}
                    >
                      {a.liveStatus}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, color: 'var(--color-heading)' }}>{children}</th>;
}

function Td({ children }) {
  return <td style={{ padding: '10px 14px', fontSize: 14, color: 'var(--color-text)' }}>{children}</td>;
}