import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/Dashboard';
import OCRApp from './App';

/* ===== helpers ===== */

const getUserRole = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return (user?.role || 'VO').toLowerCase();
    } catch {
        return 'vo';
    }
};

const isAdmin = (role) => {
    if (!role) return false;
    const r = role.toLowerCase();
    return r.includes('admin') || r.includes('district') || r.includes('super');
};

const isVO = (role) => {
    if (!role) return false;
    const r = role.toLowerCase();
    return r === 'vo' || r.startsWith('vo-') || r.includes('developer');
};

/* ===== routes ===== */

const ProtectedRoute = ({ children, type }) => {
    const token = localStorage.getItem('token');
    const role = getUserRole();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // ONLY Admins can see dashboard
    if (type === 'dashboard' && !isAdmin(role)) {
        return <Navigate to="/scanner" replace />;
    }

    return children;
};

const PublicRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    const role = getUserRole();

    if (token) {
        return (
            <Navigate
                to={isAdmin(role) ? '/dashboard' : '/scanner'}
                replace
            />
        );
    }

    return children;
};

const AppRoutes = () => {
    return (
        <Router>
            <Routes>

                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <AuthPage />
                        </PublicRoute>
                    }
                />

                {/* Scanner → VO + Admin */}
                <Route
                    path="/scanner"
                    element={
                        <ProtectedRoute>
                            <OCRApp />
                        </ProtectedRoute>
                    }
                />

                {/* Dashboard → Admin ONLY */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute type="dashboard">
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Default */}
                <Route
                    path="/"
                    element={
                        <Navigate
                            to={isAdmin(getUserRole()) ? '/dashboard' : '/scanner'}
                            replace
                        />
                    }
                />

            </Routes>
        </Router>
    );
};

export default AppRoutes;
