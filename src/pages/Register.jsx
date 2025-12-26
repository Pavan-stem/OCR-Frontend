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

    // Load Districts from CSV (Replicating App.jsx client-side logic)
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                // Detect base path - logic from App.jsx
                let basePath = '';
                try {
                    if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
                        basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                    }
                } catch (e) { }

                const possiblePaths = [
                    ...(basePath ? [`${basePath}/districts-mandals.csv`] : []),
                    "./districts-mandals.csv",
                    "districts-mandals.csv",
                    "/districts-mandals.csv",
                    "/OCR/districts-mandals.csv"
                ];
                const uniquePaths = Array.from(new Set(possiblePaths));

                let csvText = null;
                for (const path of uniquePaths) {
                    try {
                        const res = await fetch(`${path}?t=${Date.now()}`);
                        if (res.ok) {
                            const text = await res.text();
                            if (text.includes(',') || text.includes('mandal') || text.includes('district')) {
                                csvText = text;
                                break;
                            }
                        }
                    } catch (err) { continue; }
                }

                if (csvText) {
                    const lines = csvText.split('\n').filter(line => line.trim());
                    await loadCSVDataFromText(lines);
                }
            } catch (err) {
                console.warn("Could not load CSV file:", err);
                setError('Failed to load location data.');
            }
        };
        fetchLocations();
    }, []);

    const loadCSVDataFromText = async (lines) => {
        try {
            if (lines.length < 2) return;

            const headerValues = [];
            let current = '';
            let inQuotes = false;
            for (let char of lines[0]) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    headerValues.push(current.trim().replace(/^"|"$/g, '').toLowerCase());
                    current = '';
                } else current += char;
            }
            headerValues.push(current.trim().replace(/^"|"$/g, '').toLowerCase());

            const mandalIdx = headerValues.findIndex(h => h.includes('mandal'));
            const districtIdx = headerValues.findIndex(h => h.includes('district'));
            const villageIdx = headerValues.findIndex(h => h.includes('village'));

            if (districtIdx === -1 || mandalIdx === -1) return;

            const districtMap = new Map();

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = [];
                current = '';
                inQuotes = false;
                for (let char of line) {
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) {
                        values.push(current.trim().replace(/^"|"$/g, ''));
                        current = '';
                    } else current += char;
                }
                values.push(current.trim().replace(/^"|"$/g, ''));

                const mandalName = values[mandalIdx]?.trim();
                const districtName = values[districtIdx]?.trim();
                const villageName = villageIdx !== -1 ? values[villageIdx]?.trim() : '';

                if (!districtName || !mandalName) continue;

                if (!districtMap.has(districtName)) {
                    districtMap.set(districtName, {
                        id: `d_${districtName.toLowerCase().replace(/\s+/g, '_')}`,
                        name: districtName,
                        mandals: new Map()
                    });
                }

                const district = districtMap.get(districtName);
                const mandalKey = mandalName.toLowerCase();

                if (!district.mandals.has(mandalKey)) {
                    district.mandals.set(mandalKey, {
                        id: `m_${mandalName.toLowerCase().replace(/\s+/g, '_')}`,
                        name: mandalName,
                        villages: []
                    });
                }

                const mandal = district.mandals.get(mandalKey);

                if (villageName) {
                    const villageId = `v_${villageName.toLowerCase().replace(/\s+/g, '_')}`;
                    if (!mandal.villages.some(v => v.id === villageId)) {
                        mandal.villages.push({ id: villageId, name: villageName });
                    }
                } else if (mandal.villages.length === 0) {
                    // Default village as mandal name if empty
                    const defaultId = `v_${mandalName.toLowerCase().replace(/\s+/g, '_')}`;
                    if (!mandal.villages.some(v => v.id === defaultId)) {
                        mandal.villages.push({ id: defaultId, name: mandalName });
                    }
                }
            }

            // Convert to array structure for state
            const districtsArray = Array.from(districtMap.values()).map(d => ({
                ...d,
                mandals: Array.from(d.mandals.values()).map(m => ({
                    ...m,
                    villages: m.villages.sort((a, b) => a.name.localeCompare(b.name))
                })).sort((a, b) => a.name.localeCompare(b.name))
            })).sort((a, b) => a.name.localeCompare(b.name));

            setDistricts(districtsArray);
        } catch (error) {
            console.error('Error parsing CSV:', error);
        }
    };

    // Update Mandals when District changes
    useEffect(() => {
        if (selectedDistrict) {
            const district = districts.find(d => d.name === selectedDistrict);
            if (district) {
                setMandals(district.mandals || []);
                setSelectedMandal('');
                setSelectedVillage('');
                setVillages([]);
            }
        } else {
            setMandals([]);
            setVillages([]);
        }
    }, [selectedDistrict, districts]);

    // Update Villages when Mandal changes
    useEffect(() => {
        if (selectedDistrict && selectedMandal) {
            const mandal = mandals.find(m => m.name === selectedMandal);
            if (mandal) {
                setVillages(mandal.villages || []);
                setSelectedVillage('');
            }
        } else {
            setVillages([]);
        }
    }, [selectedMandal, mandals]);


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

        if (!voID.trim()) {
            setError('Please enter VO ID.');
            setLoading(false);
            return;
        }

        if (!/^\d+$/.test(voID)) {
            setError('VO ID must contain only numbers.');
            setLoading(false);
            return;
        }

        if (voID.trim().length <= 13) {
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">VO Name</label>
                        <input
                            type="text"
                            value={voName}
                            onChange={(e) => setVOName(e.target.value)}
                            className="block w-full border rounded-lg py-2.5 px-3"
                        />
                    </div>

                    {/* VOA Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">VOA Name</label>
                        <input
                            type="text"
                            value={voaName}
                            onChange={(e) => setVOAName(e.target.value)}
                            className="block w-full border rounded-lg py-2.5 px-3"
                        />
                    </div>

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