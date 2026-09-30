// ============================================================
// PAGE: LogList  (Logs module — attendance history table)
// ------------------------------------------------------------
// Shows every saved Log row for this organization, newest first.
// ============================================================

import React, { useEffect, useState } from "react";   // hooks: run on mount + hold data
import logService from "../../services/logService";     // API calls for Logs module
import "./LogList.css";                                   // page-specific styles

function LogList() {
    const [logs, setLogs] = useState([]);      // holds the fetched list of logs
    const [loading, setLoading] = useState(true); // true while the initial fetch is running
    const [error, setError] = useState("");        // error message if fetch fails

    // Runs once when this page loads
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await logService.getAll();  // GET /api/logs
                setLogs(res.data);                        // store the list
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load logs.");
            } finally {
                setLoading(false);                        // stop loading regardless of outcome
            }
        };
        fetchLogs();
    }, []);                                        // empty deps = run only once on mount

    if (loading) return <p className="log-list-status">Loading logs...</p>; // loading state
    if (error) return <p className="log-list-status log-list-error">{error}</p>; // error state

    return (
        <div className="log-list-page">
            <h2 className="log-list-title">Logs — History</h2>

            {logs.length === 0 ? (
                <p className="log-list-status">No logs recorded yet.</p> // empty state
            ) : (
                <table className="log-list-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Reference ID</th>
                            <th>Name</th>
                            <th>Project</th>
                            <th>System</th>
                            <th>Login</th>
                            <th>Logout</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (              // one row per saved log
                            <tr key={log._id}>
                                <td>{new Date(log.date).toLocaleDateString()}</td> {/* format date for display */}
                                <td>{log.referenceId}</td>
                                <td>{log.name}</td>
                                <td>{log.projectName}</td>
                                <td>{log.systemName}</td>
                                <td>{log.loginTime}</td>
                                <td>{log.logoutTime}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default LogList;                // <-- also required, check this file had it too