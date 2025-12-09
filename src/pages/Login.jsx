import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Phone, ArrowRight, Activity } from 'lucide-react';
import { AUTH_API_BASE } from '../utils/apiConfig';

const Login = () => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Frontend validation (Strict as per requirements)
        if (!/^\d{10}$/.test(phone)) {
            setError('Mobile number must be exactly 10 digits and contain only numbers.');
            setLoading(false);
            return;
        }

        // Password validation is now handled by the backend (checking correctness)
        if (!password) {
            setError('Please enter your password.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${AUTH_API_BASE}/api/login`, {
                phone,
                password
            });

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data));
                navigate('/ocr');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-8">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4 animate-bounce">
                    <Activity size={32} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900">Welcome Back</h2>
                <p className="text-gray-500 mt-2">Sign in to your SHG account</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-pulse">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => {
                                // Allow only digits
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length <= 10) setPhone(val);
                            }}
                            className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                            placeholder="Enter 10-digit mobile number"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                            placeholder="Password"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                    {!loading && <ArrowRight size={16} className="ml-2" />}
                </button>
            </form>
        </div>
    );
};

export default Login;
