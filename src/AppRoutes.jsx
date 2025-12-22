import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import OCRApp from './App';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const PublicRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/scanner" replace />;
    }
    return children;
};


const AppRoutes = () => {
    return (
        <Router>
            <Routes>

                {/* Login / Register */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <AuthPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <AuthPage />
                        </PublicRoute>
                    }
                />

                {/* Main App */}
                <Route
                    path="/scanner"
                    element={
                        <ProtectedRoute>
                            <OCRApp />
                        </ProtectedRoute>
                    }
                />

                {/* Default */}
                <Route path="/" element={<Navigate to="/scanner" replace />} />

            </Routes>
        </Router>
    );
};

export default AppRoutes;
