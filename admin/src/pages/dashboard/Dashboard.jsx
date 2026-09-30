// ============================================================
// PAGE: Dashboard  (Module 3.1)
// ------------------------------------------------------------
// Summary cards (animated count-up + icons), glowing hover,
// gradient accent header, OccupancyTable + ReferenceIdLookup.
// ============================================================

import React from "react";
import { useEffect, useState } from "react";
import Card from "../../components/common/Card";
import { useAuth } from "../../context/AuthContext";
import dashboardService from "../../services/dashboardService";
import OccupancyTable from "./OccupancyTable";
import ReferenceIdLookup from "./ReferenceIdLookup";
import UsersOverviewTable from "./UsersOverviewTable";

function Dashboard() {
  const { organizationName, user } = useAuth();
  const displayName = organizationName || "Assigned Organization";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await dashboardService.getStats();
        setStats(res.data.stats);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load dashboard stats.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Organization",
      value: displayName,
      accent: "var(--color-primary)",
      animate: false,
    },
    {
      title: "Labs",
      value: stats?.labCount ?? 0,
      accent: "var(--color-teal)",
      animate: true,
    },
    {
      title: "Systems",
      value: stats?.systemCount ?? 0,
      accent: "var(--color-info)",
      animate: true,
    },
    {
      title: "AI Tools",
      value: stats?.toolCount ?? 0,
      accent: "var(--color-primary-hover)",
      animate: true,
    },
    {
      title: "Active Approvals",
      value: stats?.activeAssignments ?? 0,
      accent: "var(--color-info)",
      animate: true,
    },
    {
      title: "Booked Today",
      value: stats?.todaysBookings ?? 0,
      accent: "var(--color-teal)",
      animate: true,
    },
    {
      title: "Checked In Now",
      value: stats?.checkedIn ?? 0,
      accent: "var(--color-success)",
      animate: true,
    },
    {
      title: "Total Expenses (₹)",
      value: Math.round(stats?.totalExpenses ?? 0),
      accent: "var(--color-warning)",
      animate: true,
    },
    {
      title: "Total Spent (₹)",
      value: Math.round(stats?.totalSpent ?? 0),
      accent: "var(--color-danger)",
      animate: true,
    },
  ];

  return (
    <div className="dash-root">
      <style>{`
        @keyframes dashFadeInUp {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dashGlow {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes dashGradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .dash-header-band {
          position: relative;
          border-radius: 14px;
          padding: 22px 26px;
          margin-bottom: 26px;
          overflow: hidden;
          background: linear-gradient(120deg, var(--color-primary), var(--color-teal), var(--color-primary-hover));
          background-size: 200% 200%;
          animation: dashGradientShift 8s ease infinite;
          box-shadow: 0 8px 24px rgba(48, 195, 109, 0.25);
        }
        .dash-header-band h1 {
          color: var(--color-white);
          margin: 0 0 4px;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }
          .dash-header-band {
  transform: translateZ(0);
  will-change: background-position;
  isolation: isolate;
}
        .dash-header-band p {
          color: rgba(255,255,255,0.9);
          margin: 0;
          font-size: 14px;
        }

        .dash-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 18px;
          margin-bottom: 28px;
        }
        .dash-card-wrap {
          animation: dashFadeInUp 0.55s ease both;
          border-radius: 14px;
          position: relative;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .dash-card-wrap::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 14px;
          padding: 1px;
          background: linear-gradient(135deg, var(--dash-accent, var(--color-primary)), transparent 60%);
          -webkit-mask: linear-gradient(var(--color-white) 0 0) content-box, linear-gradient(var(--color-white) 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
        }
        .dash-card-wrap:hover {
          transform: translateY(-6px);
          box-shadow: 0 14px 28px rgba(20, 36, 66, 0.14);
        }
        .dash-card-wrap:hover::before {
          opacity: 1;
        }

        .dash-section {
          animation: dashFadeInUp 0.6s ease both;
          animation-delay: 0.25s;
        }
      `}</style>

      <div className="dash-header-band">
        <h1>Welcome back, {user?.name || "Admin"} 👋</h1>
        <p>Here's what's happening across {displayName} right now.</p>
      </div>

      {error && (
        <p
          style={{
            color: "var(--color-white)",
            background: "var(--color-danger)",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {error}
        </p>
      )}

      <div className="dash-card-grid">
        {cards.map((c, i) => (
          <div
            key={c.title}
            className="dash-card-wrap"
            style={{
              animationDelay: `${i * 0.07}s`,
              "--dash-accent": c.accent,
            }}
          >
            <Card
              title={c.title}
              value={loading && c.animate ? "..." : c.value}
              icon={c.icon}
              accent={c.accent}
              animateNumber={c.animate && !loading}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="dash-section">
          <OccupancyTable />
        </div>
        <div className="dash-section" style={{ animationDelay: "0.35s" }}>
          <ReferenceIdLookup />
        </div>
        <div className="dash-section" style={{ animationDelay: "0.45s" }}>
          <UsersOverviewTable />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
