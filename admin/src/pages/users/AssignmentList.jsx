// ============================================================
// PAGE: AssignmentList  (Module 3.7)
// ------------------------------------------------------------
// All assignments with their Reference IDs, user, system,
// project, start/end dates and live status
// (ACTIVE / NEARING_EXPIRY / EXPIRED).
// Calls assignmentService.getAll().
// ============================================================
import React, { useEffect, useState } from "react";
import assignmentService from "../../services/assignmentService";
import { formatDate } from "../../utils/dateHelpers"; // new import
import "./AssignmentList.css"; // optional CSS for styling

function AssignmentList() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await assignmentService.getAll();
                setAssignments(response.data);
            } catch (err) {
                setError("Could not load assignments. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, []);

    if (loading) return <p>Loading assignments...</p>;
    if (error) return <p style={{ color: "red" }}>{error}</p>;
    if (assignments.length === 0) return <p>No assignments yet.</p>;

    return (
        <div>
            <h2>All Assignments</h2>
            <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                    <tr>
                        <th>Reference ID</th>
                        <th>Name</th>
                        <th>Lab</th>
                        <th>System</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {assignments.map((a) => (
                        <tr key={a.referenceId}>
                            <td>{a.referenceId}</td>
                            <td>{a.name}</td>
                            <td>{a.labName}</td>
                            <td>{a.systemName}</td>
                            <td>{formatDate(a.startDate)}</td>
                            <td>{formatDate(a.endDate)}</td>
                            <td>{a.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AssignmentList;