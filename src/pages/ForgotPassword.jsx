import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Key, ArrowRight, Activity, ShieldCheck } from 'lucide-react';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        if (!/^\d{10}$/.test(phone)) {
            setError('Please enter a valid 10-digit mobile number.');
            setLoading(false);
            return;
        }

        // Simulate sending OTP
        setTimeout(() => {
            setLoading(false);
            setMessage('OTP sent to your mobile number (Demo: Use 123456)');
            setStep(2);
        }, 1500);
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (otp !== '123456') { // Demo check
            setError('Invalid OTP. Please try again.');
            setLoading(false);
            return;
        }

        setTimeout(() => {
            setLoading(false);
            setMessage('OTP Verified. Please set your new password.');
            setStep(3);
        }, 1000);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (newPassword.length < 4) {
            setError('Password must be at least 4 characters.');
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            setLoading(false);
            return;
        }

        try {
            // In a real app, you would verify the OTP token server-side or use a temp token
            // For now, we will simulate a password reset call to a hypothetical endpoint
            // Or since we don't have the backend for this yet, we just simulate success
            // await axios.post('http://localhost:5000/reset-password', { phone, password: newPassword });

            setTimeout(() => {
                setLoading(false);
                navigate('/login');
                alert('Password reset successfully! Please login with your new password.');
            }, 1500);

        } catch (err) {
            setError('Failed to reset password.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
                            <Key size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Forgot Password</h2>
                        <p className="text-gray-500 mt-2">Recover your account access</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-pulse">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
                            {message}
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleSendOTP} className="space-y-6">
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
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 10) setPhone(val);
                                        }}
                                        className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                                        placeholder="Enter registered mobile number"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors duration-200"
                            >
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                                {!loading && <ArrowRight size={16} className="ml-2" />}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyOTP} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <ShieldCheck size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                                        placeholder="Enter the 6-digit OTP"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Note: For this demo, use OTP 123456</p>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors duration-200"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                                {!loading && <ArrowRight size={16} className="ml-2" />}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 px-4 border"
                                    placeholder="Enter new password"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 px-4 border"
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-colors duration-200"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                                {!loading && <ArrowRight size={16} className="ml-2" />}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
