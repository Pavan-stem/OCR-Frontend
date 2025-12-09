import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import OCRApp from './App';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const AppRoutes = () => {
    return (
        <Router basename="/OCR">
            <Routes>
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<AuthPage />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/ocr"
                    element={
                        <ProtectedRoute>
                            <OCRApp />
                        </ProtectedRoute>
                    }
                />
                <Route path="/" element={<Navigate to="/register" replace />} />
            </Routes>
        </Router>
    );
};

export default AppRoutes;
