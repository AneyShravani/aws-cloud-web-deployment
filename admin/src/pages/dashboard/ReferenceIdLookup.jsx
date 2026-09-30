// ============================================================
// SECTION: ReferenceIdLookup (part of Dashboard, Module 3.1)
// ------------------------------------------------------------
// Admin types a returning user's Reference ID and checks it:
//   ACTIVE          -> access granted
//   NEARING_EXPIRY  -> flagged / follow up
//   EXPIRED         -> access denied
// Shows the assignment details (project, dates, system).
// Calls dashboardService.checkReferenceId().
// ============================================================

import React from "react";
import { useState } from "react";
import dashboardService from "../../services/dashboardService";

const STATUS_COLORS = {
  ACTIVE: "var(--color-success)",
  NEARING_EXPIRY: "var(--color-warning)",
  EXPIRED: "var(--color-danger)",
};
const STATUS_LABELS = {
  ACTIVE: "Active — Access Granted",
  NEARING_EXPIRY: "Nearing Expiry — Follow Up",
  EXPIRED: "Expired — Access Denied",
};

export default function ReferenceIdLookup() {
  const [refId, setRefId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!refId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await dashboardService.checkReferenceId(refId.trim());
      setResult(res.data);
    } catch (err) {
       if (err.response?.status === 404) {
        setError("No user found with that Reference ID.");
      } else {
        setError(
          err.response?.data?.message || "Failed to check Reference ID.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="dash-card"
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <h3 style={{ color: "var(--color-heading)", marginBottom: 16 }}>
        Reference ID Lookup
      </h3>

      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: 10, marginBottom: 16 }}
      >
        <input
          type="text"
          value={refId}
          onChange={(e) => setRefId(e.target.value)}
          placeholder="Enter Reference ID"
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--color-primary)",
            color: "var(--color-white)",
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Checking..." : "Check"}
        </button>
      </form>

      {error && (
        <p
          style={{
            color: "var(--color-white)",
            background: "var(--color-warning)",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: 16,
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-white)",
              background: STATUS_COLORS[result.status] || "var(--color-muted)",
              marginBottom: 12,
            }}
          >
            {STATUS_LABELS[result.status] || result.status}
          </span>
          <p style={{ color: 'var(--color-text)', fontSize: 14, margin: '4px 0' }}>
            <strong>User:</strong> {result.user?.name} ({result.user?.rollNumber}, {result.user?.department})
          </p>
          <p style={{ color: 'var(--color-text)', fontSize: 14, margin: '4px 0' }}>
            <strong>Project:</strong> {result.projectName || '—'}
          </p>
          <p style={{ color: 'var(--color-text)', fontSize: 14, margin: '4px 0' }}>
            <strong>Window:</strong>{' '}
            {result.startDate ? new Date(result.startDate).toLocaleDateString() : '—'} —{' '}
            {result.endDate ? new Date(result.endDate).toLocaleDateString() : '—'}
          </p>
          <div style={{ marginTop: 10 }}>
            <strong style={{ color: 'var(--color-text)', fontSize: 14 }}>Today’s slots:</strong>
            {result.todaysBookings && result.todaysBookings.length > 0 ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--color-text)', fontSize: 14 }}>
                {result.todaysBookings.map((b, i) => (
                  <li key={i} style={{ margin: '2px 0' }}>
                    {b.slotStart}–{b.slotEnd} · {b.systemName}{' '}
                    <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>({b.status.replace('_', ' ').toLowerCase()})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ color: 'var(--color-muted)', fontSize: 14, marginLeft: 6 }}>none booked today</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
