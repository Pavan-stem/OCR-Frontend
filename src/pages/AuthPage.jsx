import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('register');

    useEffect(() => {
        if (location.pathname === '/login') {
            setActiveTab('login');
        } else if (location.pathname === '/register') {
            setActiveTab('register');
        }
    }, [location]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        navigate(`/${tab}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => handleTabChange('register')}
                        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors duration-200 ${activeTab === 'register'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Create Account
                    </button>
                    <button
                        onClick={() => handleTabChange('login')}
                        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors duration-200 ${activeTab === 'login'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Sign In
                    </button>
                </div>

                {/* Content Area */}
                <div className="relative">
                    {/* 
                      We render both but hide one to keep state? 
                      No, mounting/unmounting is safer for resetting state errors, 
                      but kept inputs are nice. 
                      Let's conditionally render.
                    */}
                    {activeTab === 'register' ? <Register /> : <Login />}
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
