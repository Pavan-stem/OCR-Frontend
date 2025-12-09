import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    MapPin, Phone, Users, UploadCloud,
    CreditCard, DollarSign, LogOut, LayoutDashboard, Home, Building
} from 'lucide-react';
import { AUTH_API_BASE } from '../utils/apiConfig';

const Dashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (!token) {
                navigate('/login');
                return;
            }

            // Load initial data from localStorage if available to reduce flicker
            if (storedUser) {
                setUserData(JSON.parse(storedUser));
            }

            try {
                const config = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                };

                const response = await axios.get(`${AUTH_API_BASE}/dashboard`, config);
                // Update with fresh data from server
                setUserData(response.data);
                // Update local storage too
                localStorage.setItem('user', JSON.stringify(response.data));
            } catch (err) {
                console.error(err);
                // If dashboard fails but we have local data, maybe just warn? 
                // But for security, if token invalid, we should logout.
                if (err.response && err.response.status === 401) {
                    setError('Session expired. Please login again.');
                    localStorage.removeItem('token');
                    setTimeout(() => navigate('/login'), 2000);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (loading && !userData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-red-500 font-medium">{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {/* Navbar */}
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <LayoutDashboard className="h-8 w-8 text-indigo-600" />
                            <span className="ml-2 text-xl font-bold text-gray-800">SHG Dashboard</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-600 hidden sm:block">Group: {userData?.groupId}</span>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
                                title="Logout"
                            >
                                <LogOut size={16} className="mr-2" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">

                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
                        <p className="mt-1 text-sm text-gray-500">Manage your SHG profile information and status.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Phone Card */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                                        <Phone className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Phone</h3>
                                        <p className="mt-1 text-2xl font-semibold text-gray-700">{userData?.phone}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Group ID Card */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                                        <Users className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Group ID</h3>
                                        <p className="mt-1 text-2xl font-semibold text-gray-700">{userData?.groupId}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Location Card */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                                        <MapPin className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Location</h3>
                                        <div className="mt-1">
                                            <p className="text-sm font-medium text-gray-600">{userData?.village}, {userData?.mandal}</p>
                                            <p className="text-xs text-gray-500">{userData?.district}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panchayat Card */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                                        <Building className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Panchayat</h3>
                                        <p className="mt-1 text-xl font-semibold text-gray-700">{userData?.panchayat}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Upload Status */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className={`flex-shrink-0 rounded-md p-3 ${userData?.uploadStatus ? 'bg-teal-100' : 'bg-yellow-100'}`}>
                                        <UploadCloud className={`h-6 w-6 ${userData?.uploadStatus ? 'text-teal-600' : 'text-yellow-600'}`} />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Upload Status</h3>
                                        <span className={`mt-1 inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${userData?.uploadStatus ? 'bg-teal-100 text-teal-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {userData?.uploadStatus ? 'Completed' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Balance */}
                        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-300">
                            <div className="p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                                        <DollarSign className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-medium text-gray-900">Balance</h3>
                                        <p className="mt-1 text-2xl font-semibold text-gray-700">₹{userData?.balance}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="mt-10">
                        <button
                            onClick={() => navigate('/ocr')}
                            className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10 transition-all shadow-lg hover:shadow-xl"
                        >
                            <LayoutDashboard className="mr-2" />
                            Go to OCR Tool
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default Dashboard;
