// src/App.jsx — UPDATED
// Changes from previous version:
//   - AdminComplaints (client complaint page) kept at /admin/complaints
//   - AdminWorkerComplaints (NEW worker complaint/support page) at /admin/worker-complaints
//   - Complaints (worker) replaced with WorkerComplaints (new full-featured page)
//   - All original routes, imports, and logic preserved exactly

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts & Protection
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import WorkerLayout from './components/WorkerLayout';
import ClientLayout from './components/ClientLayout';

// General Components
import Splash from './components/splash';
import TermsAndConditions from './components/TermsAndConditions';

// General Pages
import Home from './pages/Home';
import Notification from './pages/Notification';
import PublicProfile from './pages/PublicProfile';

// Auth Pages
import Register from './pages/auth/Register';
import WorkerRegister from './pages/auth/WorkerRegister';
import ClientRegister from './pages/auth/ClientRegister';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Admin Pages
import AdminDashboard        from './pages/admin/AdminDashboard';
import FraudMonitor          from './pages/admin/FraudMonitor';
import AdminComplaints       from './pages/admin/AdminComplaints';          // existing — client complaints
import AdminWorkerComplaints from './pages/admin/AdminWorkerComplaints';    // NEW — worker complaints & support
import AdminCommunity        from './pages/admin/AdminCommunity';

// Worker Pages
import WorkerDashboard      from './pages/worker/WorkerDashboard';
import JobRequests          from './pages/worker/JobRequests';
import JobBookings          from './pages/worker/JobBookings';
import Leaderboard          from './pages/worker/Leaderboard';
import Feedback             from './pages/worker/Feedback';
import WorkerComplaints     from './pages/worker/WorkerComplaints';         // NEW (replaces Complaints)
import History              from './pages/worker/History';
import ViewProfile          from './pages/worker/ViewProfile';
import ViewIdCard           from './pages/worker/ViewIdCard';
import Settings             from './pages/worker/Settings';
import CreateGroup          from './pages/worker/CreateGroup';
import MyGroups             from './pages/worker/MyGroups';
import ActiveGroupJobs      from './pages/worker/ActiveGroupJobs';
import CompletedGroupJobs   from './pages/worker/CompletedGroupJobs';
import WorkerProposals      from './pages/worker/WorkerProposals';
import AcceptInvites        from './pages/worker/AcceptInvites';
import Groups               from './pages/worker/Groups';
import Community            from './pages/worker/Community';
import WorkerLiveTracking   from './pages/worker/WorkerLiveTracking';

// Client Pages
import ClientDashboard    from './pages/client/ClientDashboard';
import ClientJobPost      from './pages/client/ClientJobPost';
import ClientAIAssist     from './pages/client/ClientAIAssist';
import ClientProfile      from './pages/client/ClientProfile';
import ClientJobManage    from './pages/client/ClientJobManage';
import ClientSettings     from './pages/client/Settings';
import ClientComplaints   from './pages/client/ClientComplaints';
import ClientGroups       from './pages/client/ClientGroups';
import ClientLiveTracking from './pages/client/ClientLiveTracking';

// ── Layout wrappers ───────────────────────────────────────────────────────────

/** Header-only layout (used for auth/general pages) */
const MainLayout = () => (
    <>
        <Header />
        <main>
            <Outlet />
        </main>
    </>
);

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    return (
        <Router>
            <Toaster position="top-center" reverseOrder={false} />

            <Routes>
                {/* ── No Header / Standalone Pages ── */}
                <Route path="/" element={<Splash />} />
                <Route path="/notification" element={<Notification />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/profile/public/:workerId" element={<PublicProfile />} />

                {/* ── Admin (No Header) ── */}
                <Route
                    path="/admin/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/fraud"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <FraudMonitor />
                        </ProtectedRoute>
                    }
                />
                {/* Existing: client complaints */}
                <Route
                    path="/admin/complaints"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminComplaints />
                        </ProtectedRoute>
                    }
                />
                {/* NEW: worker complaints & support tickets */}
                <Route
                    path="/admin/worker-complaints"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminWorkerComplaints />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/community"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminCommunity />
                        </ProtectedRoute>
                    }
                />

                {/* ── Header Layout Routes ── */}
                <Route element={<MainLayout />}>
                    <Route path="/home" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/register/worker" element={<WorkerRegister />} />
                    <Route path="/register/client" element={<ClientRegister />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* ── CLIENT ROUTES ── */}
                    <Route
                        path="/client"
                        element={
                            <ProtectedRoute allowedRoles={['client']}>
                                <ClientLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard"             element={<ClientDashboard />} />
                        <Route path="ai-assist"             element={<ClientAIAssist />} />
                        <Route path="job-manage"            element={<ClientJobManage />} />
                        <Route path="job-post"              element={<ClientJobPost />} />
                        <Route path="profile"               element={<ClientProfile />} />
                        <Route path="settings"              element={<ClientSettings />} />
                        <Route path="complaints"            element={<ClientComplaints />} />
                        <Route path="groups"                element={<ClientGroups />} />
                        <Route path="live-tracking/:jobId"  element={<ClientLiveTracking />} />
                    </Route>

                    {/* ── WORKER ROUTES ── */}
                    <Route
                        path="/worker"
                        element={
                            <ProtectedRoute allowedRoles={['worker']}>
                                <WorkerLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="dashboard"             element={<WorkerDashboard />} />
                        <Route path="job-requests"          element={<JobRequests />} />
                        <Route path="job-bookings"          element={<JobBookings />} />
                        <Route path="leaderboard"           element={<Leaderboard />} />
                        <Route path="feedback"              element={<Feedback />} />
                        <Route path="complaints"            element={<WorkerComplaints />} />  {/* updated component */}
                        <Route path="history"               element={<History />} />
                        <Route path="profile"               element={<ViewProfile />} />
                        <Route path="id-card"               element={<ViewIdCard />} />
                        <Route path="settings"              element={<Settings />} />
                        <Route path="create-group"          element={<CreateGroup />} />
                        <Route path="my-groups"             element={<MyGroups />} />
                        <Route path="groups"                element={<Groups />} />
                        <Route path="active-group-jobs"     element={<ActiveGroupJobs />} />
                        <Route path="completed-group-jobs"  element={<CompletedGroupJobs />} />
                        <Route path="proposals"             element={<WorkerProposals />} />
                        <Route path="accept-invites"        element={<AcceptInvites />} />
                        <Route path="community"             element={<Community />} />
                        <Route path="live-tracking/:jobId"  element={<WorkerLiveTracking />} />
                    </Route>
                </Route>

                {/* ── Catch-all ── */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;