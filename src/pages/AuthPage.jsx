import React from 'react';
import { useLocation } from 'react-router-dom';
import Login from './Login';
import Register from './Register';

const AuthPage = () => {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {location.pathname === '/login' ? <Login /> : <Register />}
            </div>
        </div>
    );
};

export default AuthPage;
