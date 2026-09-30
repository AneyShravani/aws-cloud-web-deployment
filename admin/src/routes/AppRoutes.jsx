import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Login from "../pages/auth/Login";
import ResetPassword from "../pages/auth/ResetPassword";
import Unauthorized from "../pages/auth/Unauthorized";
import Dashboard from "../pages/dashboard/Dashboard";
import LabList from "../pages/labs/LabList";
import OrganizationList from "../pages/organizations/OrganizationList";
import ExpenseList from "../pages/expenses/ExpenseList";
import ProtectedRoute from "./ProtectedRoute";
import UtilizationList from "../pages/utilization/UtilizationList";
import RequestList from "../pages/users/RequestList";
import RequestDetail from "../pages/users/RequestDetail";
import ApprovedUsers from "../pages/users/ApprovedUsers";
import AssignSystem from "../pages/users/AssignSystem";
import AssignmentList from "../pages/users/AssignmentList";
import BookingConsole from "../pages/bookings/BookingConsole";
import StudentLayout from "../components/student/StudentLayout";
import StudentHome from "../pages/students/StudentHome";
import StudentRequests from "../pages/students/StudentRequests";
import StudentBookings from "../pages/students/StudentBookings";
import StudentProfile from "../pages/students/StudentProfile";
import UserManagement from "../pages/users/UserManagement";
import LogEntry from "../pages/logs/LogEntry";
import LogList from "../pages/logs/LogList";
import CheckInDesk from "../pages/checkin/CheckInDesk";
import ReportsPage from "../pages/reports/ReportsPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public self-signup is disabled — admins create accounts via User Management. */}
      <Route path="/student/signup" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/forgot-reset-password"
        element={<ResetPassword mode="forgot" />}
      />
      <Route
        path="/reset-password"
        element={
          <ProtectedRoute requireFirstLogin>
            <ResetPassword />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <Dashboard />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <ProtectedRoute>
            <PageLayout>
              <Unauthorized />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations"
        element={
          <ProtectedRoute requireSuperAdmin>
            <PageLayout>
              <OrganizationList />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/labs"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <LabList />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <ExpenseList />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/utilization"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <UtilizationList />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      {/* User Management — admin onboards people (accounts + emailed credentials) */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <UserManagement />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      {/* Module 3.7 — Users & Assignment workflow */}
      <Route
        path="/requests"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <RequestList />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests/:id"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <RequestDetail />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      {/* Approved users — the consolidated list of everyone granted access */}
      <Route
        path="/approved-users"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <ApprovedUsers />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assign/:requestId"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <AssignSystem />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      {/* v2 slot-booking console — the new Assignments section */}
      <Route
        path="/bookings"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <BookingConsole />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      {/* legacy assignment list — kept reachable during transition, not in nav */}
      <Route
        path="/assignments"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <AssignmentList />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      {/* v2 slot-booking: the daily check-in desk (booking-native attendance) */}
      <Route
        path="/checkin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <CheckInDesk />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      {/* legacy manual log entry — kept reachable during transition, not in nav */}
      <Route
        path="/logs"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <LogEntry />
            </PageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs/history"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <LogList />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]} blockFirstLogin>
            <PageLayout>
              <ReportsPage />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      {/* ---------- Student portal (guarded, STUDENT role) ---------- */}
      <Route
        path="/student/home"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]} blockFirstLogin>
            <StudentLayout><StudentHome /></StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/requests"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]} blockFirstLogin>
            <StudentLayout><StudentRequests /></StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/bookings"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]} blockFirstLogin>
            <StudentLayout><StudentBookings /></StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]} blockFirstLogin>
            <StudentLayout><StudentProfile /></StudentLayout>
          </ProtectedRoute>
        }
      />
      {/* legacy entry point -> new home */}
      <Route path="/student/dashboard" element={<Navigate to="/student/home" replace />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
