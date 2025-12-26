import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, MapPin, Users, ArrowRight, UserPlus, Home, Building, EyeClosed, Eye } from 'lucide-react';
import { AUTH_API_BASE } from '../utils/apiConfig';

const Register = () => {
    const [phone, setPhone] = useState('');
    const [voName, setVOName] = useState('');
    const [voID, setVOID] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [role, setRole] = useState('VO');

    // Location Fields
    const [districts, setDistricts] = useState([]);
    const [mandals, setMandals] = useState([]);
    const [villages, setVillages] = useState([]);

    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMandal, setSelectedMandal] = useState('');
    const [selectedVillage, setSelectedVillage] = useState('');
    const [voaName, setVOAName] = useState('');
    const [email, setEmail] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Load Districts from Backend
    useEffect(() => {
        const fetchDistricts = async () => {
            try {
                const res = await fetch(`${AUTH_API_BASE}/api/districts`);
                const data = await res.json();
                if (data.success) setDistricts(data.districts);
                else setError(data.error || 'Failed to fetch districts');
            } catch (err) {
                console.error('Failed to fetch districts', err);
                setError('Failed to load districts.');
            }
        };
        fetchDistricts();
    }, []);

    // Update Mandals when District changes
    useEffect(() => {
        if (selectedDistrict) {
            const fetchMandals = async () => {
                try {
                    const res = await fetch(`${AUTH_API_BASE}/api/mandals?district=${encodeURIComponent(selectedDistrict)}`);
                    const data = await res.json();
                    if (data.success) {
                        setMandals(data.mandals);
                        setSelectedMandal('');
                        setSelectedVillage('');
                        setVillages([]);
                    }
                } catch (err) {
                    console.error('Failed to fetch mandals', err);
                }
            };
            fetchMandals();
        } else {
            setMandals([]);
            setVillages([]);
        }
    }, [selectedDistrict]);

    // Update Villages when Mandal changes
    useEffect(() => {
        if (selectedDistrict && selectedMandal) {
            const fetchVillages = async () => {
                try {
                    const res = await fetch(`${AUTH_API_BASE}/api/villages?district=${encodeURIComponent(selectedDistrict)}&mandal=${encodeURIComponent(selectedMandal)}`);
                    const data = await res.json();
                    if (data.success) {
                        setVillages(data.villages);
                        setSelectedVillage('');
                    }
                } catch (err) {
                    console.error('Failed to fetch villages', err);
                }
            };
            fetchVillages();
        } else {
            setVillages([]);
        }
    }, [selectedMandal, selectedDistrict]);



    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        // Phone number validation: Must be 10 digits (we'll assume +91 is appended)
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            setError('Mobile number must be exactly 10 digits (excluding +91).');
            setLoading(false);
            return;
        }

        const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
            ? '+' + cleanPhone
            : '+91' + cleanPhone;

        if (!selectedDistrict || !selectedMandal) {
            setError('Please select District and Mandal.');
            setLoading(false);
            return;
        }

        // Village is required if the list is not empty
        if (villages.length > 0 && !selectedVillage) {
            setError('Please select a Village.');
            setLoading(false);
            return;
        }

        const finalVillage = selectedVillage || (villages.length === 0 ? 'N/A' : '');

        if (!voaName.trim()) {
            setError('Please enter voaName.');
            setLoading(false);
            return;
        }

        if (!voName.trim()) {
            setError('Please enter VO Name.');
            setLoading(false);
            return;
        }

        if (role === 'VO' && !voID.trim()) {
            setError('Please enter VO ID.');
            setLoading(false);
            return;
        }

        if (role === 'VO' && !/^\d+$/.test(voID)) {
            setError('VO ID must contain only numbers.');
            setLoading(false);
            return;
        }

        if (voID.trim().length >= 13) {
            setError('Please enter correct VO ID.');
            setLoading(false);
            return;
        }

        if (!password || password.length < 4) {
            setError('Password must be at least 4 characters.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${AUTH_API_BASE}/api/register`, {
                phone: formattedPhone, // Send formatted phone with +91
                voName: voName,
                voID,
                password,
                district: selectedDistrict,
                mandal: selectedMandal,
                village: finalVillage,
                voaName: voaName,
                role: role,
                email: email || ''
            });

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data));
                navigate('/scanner');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4 animate-bounce">
                    <UserPlus size={32} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
                <p className="text-gray-500 mt-2">Enter your details and location</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Role Selection */}
                <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2">
                    <label className="block text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                        <Users size={18} /> Register as:
                    </label>
                    <div className="flex gap-4">
                        {['VO', 'ADMIN', 'DEVELOPER'].map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${role === r ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100'}`}
                            >
                                {r === 'VO' ? 'Village Organization (VO)' : r.charAt(0) + r.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Left Column */}
                <div className="space-y-6">

                    {/* District */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MapPin size={18} className="text-gray-400" />
                            </div>
                            <select
                                value={selectedDistrict}
                                onChange={(e) => setSelectedDistrict(e.target.value)}
                                className="pl-10 block w-full border rounded-lg py-2.5"
                                required
                            >
                                <option value="">Select District</option>
                                {districts.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Village */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Village / panchayat</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Home size={18} className="text-gray-400" />
                            </div>
                            <select
                                value={selectedVillage}
                                onChange={(e) => setSelectedVillage(e.target.value)}
                                className="pl-10 block w-full border rounded-lg py-2.5"
                                disabled={!selectedMandal}
                            >
                                <option value="">Select Village</option>
                                {villages.map(v => (
                                    <option key={v.id} value={v.name}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* VO ID */}
                    {role === 'VO' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">VO ID</label>
                            <input
                                type="text"
                                value={voID}
                                onChange={(e) => setVOID(e.target.value.replace(/\D/g, ""))}
                                className="block w-full border rounded-lg py-2.5 px-3"
                                required
                            />
                        </div>
                    )}

                    {/* Mobile */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500">+91</span>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "");
                                    if (val.length <= 10) setPhone(val);
                                }}
                                className="pl-12 block w-full border rounded-lg py-2.5"
                                required
                            />
                        </div>
                    </div>

                    {/* Create Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Create Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full border rounded-lg py-2.5 px-3"
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
                </div>

                {/* Right Column */}
                <div className="space-y-6">

                    {/* Mandal */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mandal</label>
                        <select
                            value={selectedMandal}
                            onChange={(e) => setSelectedMandal(e.target.value)}
                            className="block w-full border rounded-lg py-2.5 px-3"
                            required
                            disabled={!selectedDistrict}
                        >
                            <option value="">Select Mandal</option>
                            {mandals.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* VO */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{role === 'VO' ? 'VO Name' : 'Full Name'}</label>
                        <input
                            type="text"
                            value={voName}
                            onChange={(e) => setVOName(e.target.value)}
                            className="block w-full border rounded-lg py-2.5 px-3"
                            required
                        />
                    </div>

                    {/* VOA Name */}
                    {role === 'VO' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">VOA Name</label>
                            <input
                                type="text"
                                value={voaName}
                                onChange={(e) => setVOAName(e.target.value)}
                                className="block w-full border rounded-lg py-2.5 px-3"
                                required
                            />
                        </div>
                    )}

                    {/* Email (Optional – Frontend Only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email ID <span className="text-gray-400">(optional)</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full border rounded-lg py-2.5 px-3"
                            placeholder="example@email.com"
                        />
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full border rounded-lg py-2.5 px-3"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 px-3 text-gray-500"
                            >
                                {showConfirmPassword ? <Eye size={20} /> : <EyeClosed size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Submit Button (Full Width) */}
                <div className="md:col-span-2 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                    >
                        {loading ? 'Creating Account...' : 'Register'}
                        {!loading && <ArrowRight size={16} className="ml-2" />}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Register;