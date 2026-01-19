import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Phone, ArrowRight, Activity, EyeClosed, Eye } from 'lucide-react';
import { AUTH_API_BASE } from '../utils/apiConfig';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Frontend validation
        if (!/^\d{10}$/.test(identifier) && !/^\d{15}$/.test(identifier)) {
            setError('Please enter either a 10-digit Admin Number or a 15-digit VO ID.');
            setLoading(false);
            return;
        }

        if (!password) {
            setError('Please enter your password.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${AUTH_API_BASE}/api/login`, {
                identifier,
                password
            });

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data));

                // Redirect based on role
                const userRole = (response.data.role || 'vo').toLowerCase();
                const isAdmin = (role) => {
                    const r = role.toLowerCase();
                    return r.includes('admin') || r.includes('district') || r.includes('super');
                };

                if (isAdmin(userRole)) {
                    navigate('/dashboard');
                } else {
                    navigate('/scanner');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto p-8">
            <div className="text-center mb-10 w-full">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4 animate-bounce">
                    <Activity size={32} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900">Welcome</h2>
                <p className="text-gray-500 mt-2">Sign in to your Self Help Group - SERP SMD account</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-pulse">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6 w-full">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VO ID / Admin Number</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => {
                                // Allow only digits, max 15
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length <= 15) setIdentifier(val);
                            }}
                            className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                            placeholder="Enter 15-digit VO ID or 10-digit Admin Number"
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
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                            placeholder="Password"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 px-3 text-gray-500"
                        >
                            {showPassword ? <Eye size={20} /> : <EyeClosed size={20} />}
                        </button>
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

            {/* <div className="mt-6 text-center text-sm text-gray-600 w-full">
                Don't have an account?{' '}
                <Link
                    to="/register"
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors duration-200"
                >
                    Create an account
                </Link>
            </div> */}
        </div>
    );
};

export default Login;
