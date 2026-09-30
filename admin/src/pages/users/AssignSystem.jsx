// ============================================================
// PAGE: AssignSystem  (Section 4 workflow — steps 3 & 4)
// ------------------------------------------------------------
// After "Assign User": the system shows AVAILABLE labs and
// AVAILABLE systems as options. Admin picks ONE system and
// enters projectName + startDate + endDate. On confirm the
// backend marks the system occupied, creates the Assignment,
// and generates the REFERENCE ID.
// Calls assignmentService.assign().
// ============================================================
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Building2, Monitor, Calendar, CheckCircle2, ClipboardList } from "lucide-react"; // one icon per field/state
import assignmentService from "../../services/assignmentService";
import labService from "../../services/labService";
import systemService from "../../services/systemService";
import "./AssignSystem.css";

function AssignSystem() {
    const { requestId } = useParams();         // this is the LabUser's _id (route param name unchanged)
    const location = useLocation();
    const navigate = useNavigate();

    const [request, setRequest] = useState(location.state?.request || null); // the LabUser being assigned

    const [labs, setLabs] = useState([]);               // all labs for dropdown 1
    const [selectedLabId, setSelectedLabId] = useState(""); // chosen lab

    const [systems, setSystems] = useState([]);              // available systems for chosen lab
    const [selectedSystemId, setSelectedSystemId] = useState(""); // chosen system

    const [projectName, setProjectName] = useState("");  // NEW: required by backend, was missing
    const [startDate, setStartDate] = useState("");       // NEW: required by backend, was missing
    const [endDate, setEndDate] = useState("");            // NEW: required by backend, was missing

    const [loadingLabs, setLoadingLabs] = useState(true);
    const [loadingSystems, setLoadingSystems] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const [error, setError] = useState(null);
    const [result, setResult] = useState(null); // holds the generated Reference ID after success

    // Fallback: if request wasn't passed via navigation state, fetch and find it by id
    useEffect(() => {
        if (request) return;
        const fetchRequest = async () => {
            try {
                const all = await assignmentService.getRequests();     // pending LabUsers
                const found = all.find((r) => r._id === requestId);    // FIX: was r.id, LabUser uses _id
                setRequest(found || null);
            } catch (err) {
                setError("Could not load request details.");
            }
        };
        fetchRequest();
    }, [requestId, request]);

    // Load all labs on mount, for the first dropdown
    useEffect(() => {
        const fetchLabs = async () => {
            try {
                const data = await labService.getAll();
                // FIX: backend listLabs returns { success: true, labs: [...] }, NOT a bare array.
                // data was the whole wrapper object before — labs.map() crashed because
                // the state held an object, not an array. Unwrap it here.
                setLabs(data.labs);
            } catch (err) {
                setError("Could not load labs.");
            } finally {
                setLoadingLabs(false);
            }
        };
        fetchLabs();
    }, []);

    // Whenever the selected lab changes, load AVAILABLE systems for that lab
    useEffect(() => {
        if (!selectedLabId) {
            setSystems([]);
            return;
        }
        const fetchSystems = async () => {
            setLoadingSystems(true);
            setSelectedSystemId(""); // reset previous system choice when lab changes
            try {
                const data = await systemService.getAvailableByLab(selectedLabId);
                // TEMP DEFENSIVE FIX — verify this in Network tab response before trusting it.
                // Handles both possible backend shapes: bare array, or { systems: [...] } wrapper
                // (same pattern that broke `labs` above). Replace with a direct unwrap once confirmed.
                setSystems(Array.isArray(data) ? data : (data.systems || []));
            } catch (err) {
                setError("Could not load systems for this lab.");
            } finally {
                setLoadingSystems(false);
            }
        };
        fetchSystems();
    }, [selectedLabId]);

    // Basic front-end guard before hitting the backend
    const isFormValid =
        selectedSystemId &&                          // a system must be picked
        projectName.trim() &&                          // project name required
        startDate &&                                     // start date required
        endDate &&                                        // end date required
        new Date(endDate) > new Date(startDate);            // end must be after start (mirrors backend check)

    const handleAssign = async () => {
        setAssigning(true);
        setError(null);
        try {
            const data = await assignmentService.assign(
                requestId,        // this is the labUserId
                selectedSystemId, // chosen system
                projectName,      // NEW
                startDate,        // NEW
                endDate           // NEW
            );
            setResult(data); // expected to contain { referenceId, ... }
        } catch (err) {
            setError("Assignment failed. Please try again.");
        } finally {
            setAssigning(false);
        }
    };

    if (error) return <div className="asn-status asn-status--error">{error}</div>;

    // Success state: show the generated Reference ID as a receipt-style card
    if (result) {
        return (
            <div className="asn-page">
                <div className="asn-success-card">
                    <CheckCircle2 size={28} className="asn-success-icon" />
                    <h2 className="asn-success-title">System Assigned</h2>
                    <p className="asn-success-sub">Share this Reference ID with the user — it controls their access.</p>
                    <div className="asn-refid">{result.referenceId}</div>
                    <button onClick={() => navigate("/assignments")} className="asn-secondary-btn">
                        Go to Assignments List
                    </button>
                </div>
            </div>
        );
    }

    if (!request) return <div className="asn-status">Loading request...</div>;

    return (
        <div className="asn-page">
            <h2 className="asn-heading">Assign System</h2>
            <p className="asn-subheading">
                Assigning for <strong>{request.name}</strong>
            </p>

            <div className="asn-card">
                <div className="asn-field">
                    <label className="asn-label"><Building2 size={15} /> Lab</label>
                    {loadingLabs ? (
                        <span className="asn-inline-status">Loading labs...</span>
                    ) : (
                        <select
                            className="asn-select"
                            value={selectedLabId}
                            onChange={(e) => setSelectedLabId(e.target.value)}
                        >
                            <option value="">-- Select a lab --</option>
                            {labs.map((lab) => (
                                <option key={lab._id} value={lab._id}>
                                    {lab.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {selectedLabId && (
                    <div className="asn-field">
                        <label className="asn-label"><Monitor size={15} /> Available System</label>
                        {loadingSystems ? (
                            <span className="asn-inline-status">Loading systems...</span>
                        ) : systems.length === 0 ? (
                            <span className="asn-inline-status asn-inline-status--warn">No available systems in this lab.</span>
                        ) : (
                            <select
                                className="asn-select"
                                value={selectedSystemId}
                                onChange={(e) => setSelectedSystemId(e.target.value)}
                            >
                                <option value="">-- Select a system --</option>
                                {systems.map((sys) => (
                                    <option key={sys._id} value={sys._id}>
                                        {sys.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                <div className="asn-field">
                    <label className="asn-label"><ClipboardList size={15} /> Project Name</label>
                    <input
                        type="text"
                        className="asn-input"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)} // NEW field
                        placeholder="e.g. Sentiment analysis dashboard"
                    />
                </div>

                <div className="asn-field-row">
                    <div className="asn-field">
                        <label className="asn-label"><Calendar size={15} /> Start Date</label>
                        <input
                            type="date"
                            className="asn-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)} // NEW field
                        />
                    </div>

                    <div className="asn-field">
                        <label className="asn-label"><Calendar size={15} /> End Date</label>
                        <input
                            type="date"
                            className="asn-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)} // NEW field
                        />
                    </div>
                </div>

                <button
                    onClick={handleAssign}
                    disabled={!isFormValid || assigning} // FIX: was only checking selectedSystemId
                    className="asn-confirm-btn"
                >
                    {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
            </div>
        </div>
    );
}

export default AssignSystem;