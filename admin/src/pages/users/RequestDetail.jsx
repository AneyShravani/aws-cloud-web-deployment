// ============================================================
// PAGE: RequestDetail  (Section 4 workflow — step 2)
// ------------------------------------------------------------
// Shows ONE request in full + a viewer/download link for the
// uploaded HOD letter. Admin reviews it and clicks the
// "Assign User" button -> navigates to AssignSystem.
// ============================================================
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { User, Hash, Building2, FileText, ArrowRight } from "lucide-react";
import assignmentService from "../../services/assignmentService";
import api from "../../services/api"; // axios instance with auth header attached
import "./RequestDetail.css";

function RequestDetail() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [request, setRequest] = useState(location.state?.request || null);
    const [loading, setLoading] = useState(!location.state?.request);
    const [error, setError] = useState(null);
    const [letterLoading, setLetterLoading] = useState(false);

    useEffect(() => {
        if (request) return;

        const fetchRequest = async () => {
            try {
                const all = await assignmentService.getRequests();
                const found = all.find((r) => r._id === id);
                if (!found) {
                    setError("Request not found.");
                } else {
                    setRequest(found);
                }
            } catch (err) {
                setError("Could not load request. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchRequest();
    }, [id, request]);

    const handleAssignClick = () => {
        navigate(`/assign/${request._id}`, { state: { request } });
    };

    // Fetches the HOD letter as an authenticated blob (can't use a plain
    // <a href> because direct browser navigation can't send the JWT header).
    const handleViewLetter = async () => {
        const filename = request.hodLetterPath.split("/").pop();
        setLetterLoading(true);
        try {
            const response = await api.get(`/assignments/uploads/${filename}`, {
                responseType: "blob",
            });
            const blobUrl = URL.createObjectURL(response.data);
            window.open(blobUrl, "_blank");
        } catch (err) {
            console.error(err);
            alert("Could not open HOD letter.");
        } finally {
            setLetterLoading(false);
        }
    };

    if (loading) return <div className="req-status req-status--loading">Loading request...</div>;
    if (error) return <div className="req-status req-status--error">{error}</div>;
    if (!request) return <div className="req-status">No request data available.</div>;

    return (
        <div className="req-page">
            <h2 className="req-heading">Request Details</h2>

            <div className="req-card">
                <div className="req-row">
                    <div className="req-label"><User size={16} /> Name</div>
                    <div className="req-value">{request.name}</div>
                </div>

                <div className="req-row">
                    <div className="req-label"><Hash size={16} /> Roll No</div>
                    <div className="req-value">{request.rollNumber}</div>
                </div>

                <div className="req-row">
                    <div className="req-label"><Building2 size={16} /> Department</div>
                    <div className="req-value">{request.department}</div>
                </div>

                <div className="req-row req-row--last">
                    <div className="req-label"><FileText size={16} /> HOD Letter</div>
                    <div className="req-value">
                        <button
                            onClick={handleViewLetter}
                            disabled={letterLoading}
                            className="req-letter-link"
                        >
                            <FileText size={14} /> {letterLoading ? "Opening..." : "View Letter"}
                        </button>
                    </div>
                </div>
            </div>

            <button onClick={handleAssignClick} className="req-assign-btn">
                Assign User <ArrowRight size={16} />
            </button>
        </div>
    );
}

export default RequestDetail;