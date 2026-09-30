// ============================================================
// PAGE: LogEntry
// Reference ID Search + Time Normalization + History Table
// ============================================================

import React, { useEffect, useState } from "react";
import logService from "../../services/logService";
import "./LogEntry.css";

function LogEntry() {
    const [referenceId, setReferenceId] = useState("");
    const [details, setDetails] = useState(null);
    const [loginTime, setLoginTime] = useState("");
    const [logoutTime, setLogoutTime] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);

    // Helper: Formats and standardizes human time inputs
    const normalizeTimeInput = (inputStr, fieldName) => {
        const str = inputStr.trim();
        if (!str) return { valid: false, error: `${fieldName} is required.` };

        // Case 1: Just a raw number like "10" or "4"
        if (/^\d{1,2}$/.test(str)) {
            const num = parseInt(str, 10);
            if (num < 1 || num > 12) {
                return { valid: false, error: `Invalid hour for ${fieldName}. Please enter a value between 1 and 12.` };
            }
            return {
                valid: false,
                error: `Please specify AM or PM for ${fieldName} (e.g., "${num} AM" or "${num} PM").`
            };
        }

        // Case 2: Flexible time formats like "10am", "10:00am", "4pm", "04:00 pm"
        const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
        const match = str.match(timeRegex);

        if (match) {
            let hour = parseInt(match[1], 10);
            const minute = match[2] ? match[2] : "00";
            const meridian = match[3].toUpperCase();

            if (hour < 1 || hour > 12) {
                return { valid: false, error: `Invalid hour in ${fieldName}. Must be between 1 and 12.` };
            }

            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            return {
                valid: true,
                formatted: `${formattedHour}:${minute} ${meridian}`
            };
        }

        // Return raw input if it's already a standard date/time string
        return { valid: true, formatted: str };
    };

    // Load log history
    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const res = await logService.getAll?.() || await logService.getLogs?.();
            const rawData = res?.data?.data !== undefined ? res.data.data : res?.data;
            setLogs(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error("Failed to load log history:", err);
            setLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Search assignment
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setSuccessMsg("");
        setDetails(null);

        const cleanRefId = referenceId.trim();
        if (!cleanRefId) {
            setError("Please enter a Reference ID.");
            return;
        }

        setLoading(true);
        try {
            const res = await logService.getByReferenceId(cleanRefId);
            const payload = res?.data?.data !== undefined ? res.data.data : res?.data;

            if (payload && (payload.referenceId || payload.assignmentId || payload.projectName)) {
                setDetails(payload);
            } else {
                setError("Reference ID not found.");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Reference ID not found.");
        } finally {
            setLoading(false);
        }
    };

    // Save Log Entry
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!loginTime || !logoutTime) {
            setError("Please enter both login and logout time.");
            return;
        }

        if (details?.liveStatus === "EXPIRED") {
            setError("This Reference ID has expired. Access denied — cannot log a visit.");
            return;
        }

        // Validate and normalize Login Time
        const parsedLogin = normalizeTimeInput(loginTime, "Login Time");
        if (!parsedLogin.valid) {
            setError(parsedLogin.error);
            return;
        }

        // Validate and normalize Logout Time
        const parsedLogout = normalizeTimeInput(logoutTime, "Logout Time");
        if (!parsedLogout.valid) {
            setError(parsedLogout.error);
            return;
        }

        setLoading(true);
        try {
            const payloadData = {
                referenceId: details.referenceId || referenceId.trim(),
                loginTime: parsedLogin.formatted,
                logoutTime: parsedLogout.formatted,
            };

            if (logService.createLog.length === 1) {
                await logService.createLog(payloadData);
            } else {
                await logService.createLog(payloadData.referenceId, payloadData.loginTime, payloadData.logoutTime);
            }

            setSuccessMsg(`Log recorded successfully (${parsedLogin.formatted} to ${parsedLogout.formatted})!`);
            setLoginTime("");
            setLogoutTime("");
            setDetails(null);
            setReferenceId("");

            fetchLogs();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save log entry.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="log-entry-page">
            <h2 className="log-entry-title">Logs & Access Entry</h2>

            {/* Search Row */}
            <form onSubmit={handleSearch} className="log-entry-search-row">
                <input
                    type="text"
                    className="log-entry-input"
                    placeholder="Enter Reference ID (e.g. 62B5-20260725-Y8J3)"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                />
                <button
                    className="log-entry-btn log-entry-btn-search"
                    type="submit"
                    disabled={loading}
                >
                    {loading ? "Searching..." : "Search"}
                </button>
            </form>

            {error && <p className="log-entry-error">{error}</p>}
            {successMsg && <p className="log-entry-success">{successMsg}</p>}

            {/* Assignment Details Card */}
            {details && (
                <div className="log-entry-details-card">
                    <div className="log-entry-field">
                        <label>Reference ID</label>
                        <input type="text" value={details.referenceId || ""} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Name</label>
                        <input type="text" value={details.name || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Roll Number</label>
                        <input type="text" value={details.rollNumber || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Department</label>
                        <input type="text" value={details.department || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Project</label>
                        <input type="text" value={details.projectName || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Lab</label>
                        <input type="text" value={details.labName || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>System</label>
                        <input type="text" value={details.systemName || "—"} readOnly />
                    </div>
                    <div className="log-entry-field">
                        <label>Status</label>
                        <input
                            type="text"
                            value={details.liveStatus || "ACTIVE"}
                            readOnly
                            className={`status-field status-${(details.liveStatus || "active").toLowerCase()}`}
                        />
                    </div>

                    {/* Expired Warning Banner */}
                    {details.liveStatus === "EXPIRED" && (
                        <div className="log-entry-expired-banner">
                            <span className="warning-icon">⛔</span>
                            <div>
                                <strong>Access Denied — Reference ID Expired</strong>
                                <p>This assignment has expired. You cannot record new login/logout visits for expired records.</p>
                            </div>
                        </div>
                    )}

                    <div className="log-entry-field">
                        <label>Login Time</label>
                        <input
                            type="text"
                            placeholder={details.liveStatus === "EXPIRED" ? "Disabled for expired ID" : "e.g. 10 AM or 10:00 AM"}
                            value={loginTime}
                            onChange={(e) => setLoginTime(e.target.value)}
                            disabled={details.liveStatus === "EXPIRED"}
                        />
                    </div>
                    <div className="log-entry-field">
                        <label>Logout Time</label>
                        <input
                            type="text"
                            placeholder={details.liveStatus === "EXPIRED" ? "Disabled for expired ID" : "e.g. 4 PM or 04:00 PM"}
                            value={logoutTime}
                            onChange={(e) => setLogoutTime(e.target.value)}
                            disabled={details.liveStatus === "EXPIRED"}
                        />
                    </div>

                    <button
                        className="log-entry-btn log-entry-btn-save"
                        onClick={handleSave}
                        disabled={loading || details.liveStatus === "EXPIRED"}
                        type="button"
                    >
                        {details.liveStatus === "EXPIRED" ? "Cannot Save (Expired)" : loading ? "Saving..." : "Save"}
                    </button>
                </div>
            )}

            {/* History Table */}
            <div className="log-entry-history">
                <h3 className="log-entry-history-title">Recent Logs History</h3>

                {logsLoading ? (
                    <p>Loading past logs...</p>
                ) : logs.length === 0 ? (
                    <p>No logs recorded yet.</p>
                ) : (
                    <table className="log-entry-history-table">
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
                            {logs.map((log, index) => (
                                <tr key={log._id || index}>
                                    <td>
                                        {new Date(log.createdAt || log.date || Date.now()).toLocaleDateString()}
                                    </td>
                                    <td className="ref-cell">{log.referenceId}</td>
                                    <td>{log.name || "—"}</td>
                                    <td>{log.projectName || "—"}</td>
                                    <td>{log.systemName || "—"}</td>
                                    <td>{log.loginTime}</td>
                                    <td>{log.logoutTime}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default LogEntry;