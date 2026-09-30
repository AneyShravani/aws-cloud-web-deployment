// ============================================================
// SECTION: OccupancyTable (part of Dashboard, Module 3.1)
// ------------------------------------------------------------
// v2 slot-booking: occupancy is TIME-BASED.
// Per-lab: Lab | Systems | Busy now | Free now | Today (util%) | Status
//   busyNow  = systems with a live booking this exact slot
//   Today    = slots booked today / capacity today
// ============================================================

import React from 'react';
import { useEffect, useState } from 'react';
import dashboardService from '../../services/dashboardService';

export default function OccupancyTable() {
  const [occupancy, setOccupancy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOccupancy = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dashboardService.getOccupancy();
        setOccupancy(res.data.occupancy);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load occupancy data.');
      } finally {
        setLoading(false);
      }
    };
    fetchOccupancy();
  }, []);

  return (
    <div className="dash-card" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20 }}>
      <h3 style={{ color: 'var(--color-heading)', marginBottom: 4 }}>Lab Occupancy</h3>
      <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 16px' }}>Live right now, plus today’s slot utilization.</p>

      {error && <p style={{ color: 'var(--color-white)', background: 'var(--color-danger)', padding: '8px 12px', borderRadius: 6, fontSize: 14 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--color-text)' }}>Loading occupancy...</p>
      ) : occupancy.length === 0 ? (
        <p style={{ color: 'var(--color-text)' }}>No labs found for your organization yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--color-light-bg)' }}>
                <Th>Lab</Th><Th>Systems</Th><Th>Busy now</Th><Th>Free now</Th><Th>Today</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {occupancy.map((lab) => {
                const chip = statusChip(lab);
                return (
                  <tr key={lab.labId} style={{ borderTop: '1px solid var(--color-table-border)' }}>
                    <Td>{lab.labName}</Td>
                    <Td>{lab.total}</Td>
                    <Td>{lab.busyNow}</Td>
                    <Td>{lab.freeNow}</Td>
                    <Td>
                      {!lab.working ? (
                        <span style={{ color: 'var(--color-muted)' }}>Closed</span>
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <strong style={{ color: 'var(--color-heading)' }}>{lab.utilizationPct}%</strong>
                          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}> · {lab.slotsBooked}/{lab.slotCapacity}</span>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: 'var(--color-white)', background: chip.bg }}>
                        {chip.label}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Status chip reflects the live moment, not a permanent flag.
function statusChip(lab) {
  if (lab.total === 0) return { label: 'No systems', bg: 'var(--color-muted)' };
  if (!lab.working) return { label: 'Closed today', bg: 'var(--color-muted)' };
  if (lab.fullyOccupiedNow) return { label: 'Full right now', bg: 'var(--color-danger)' };
  return { label: 'Space now', bg: 'var(--color-success)' };
}

function Th({ children }) { return <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, color: 'var(--color-heading)' }}>{children}</th>; }
function Td({ children }) { return <td style={{ padding: '10px 14px', fontSize: 14, color: 'var(--color-text)' }}>{children}</td>; }