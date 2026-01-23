import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Plus, Trash2, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const HierarchyTab = () => {
    const [ccID, setCcID] = useState('');
    const [voIDInput, setVoIDInput] = useState('');
    const [voIDs, setVoIDs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleAddVO = () => {
        const cleaned = voIDInput.trim();
        if (!cleaned) return;

        // Split by comma, space or newline
        const ids = cleaned.split(/[\s,\n]+/).filter(id => id.length === 15 && /^\d+$/.test(id));

        if (ids.length === 0) {
            setError('Please enter valid 15-digit VO IDs.');
            return;
        }

        const newIDs = ids.filter(id => !voIDs.includes(id));
        setVoIDs([...voIDs, ...newIDs]);
        setVoIDInput('');
        setError('');
    };

    const removeVO = (idToRemove) => {
        setVoIDs(voIDs.filter(id => id !== idToRemove));
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!/^\d{8}$/.test(ccID)) {
            setError('Cluster ID must be exactly 8 digits.');
            return;
        }

        if (voIDs.length === 0) {
            setError('Please add at least one VO ID.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/api/hierarchy/assign-bulk`, {
                ccID,
                voIDs
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                const { results } = response.data;
                setSuccess(`Successfully mapped ${results.success} VOs to CC ${ccID}.`);
                if (results.failed > 0) {
                    setError(`Failed to map ${results.failed} VOs. Check logs for details.`);
                }
                setVoIDs([]);
                setCcID('');
            } else {
                setError(response.data.error || 'Failed to assign VOs.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred while assigning VOs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                    <div className="flex items-center gap-3">
                        <Shield className="text-white w-8 h-8" />
                        <div>
                            <h2 className="text-2xl font-black text-white">VO-CC Relationship Management</h2>
                            <p className="text-blue-100 text-sm font-medium">Link multiple VO users to a Cluster Coordinator (CC)</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleAssign} className="space-y-8">
                        {/* CC ID Input */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                            <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">
                                Cluster Coordinator (CC) ID
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={ccID}
                                    onChange={(e) => setCcID(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    placeholder="Enter 8-digit Cluster ID"
                                    className="w-full pl-4 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-bold text-lg"
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-400 font-medium italic">Example: 12345678</p>
                        </div>

                        {/* VO ID Input */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                            <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">
                                Add VO IDs (15-digits)
                            </label>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <textarea
                                        value={voIDInput}
                                        onChange={(e) => setVoIDInput(e.target.value)}
                                        placeholder="Paste VO IDs here (separated by comma, space or newline)"
                                        className="w-full pl-4 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-sm h-24"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddVO}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl shadow-lg transition-all self-end"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>

                            {/* VO ID Tags */}
                            {voIDs.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Selected VOs ({voIDs.length})</span>
                                        <button
                                            type="button"
                                            onClick={() => setVoIDs([])}
                                            className="text-[10px] text-red-500 font-black uppercase tracking-widest hover:underline"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-gray-100">
                                        {voIDs.map((id) => (
                                            <div key={id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold text-xs group">
                                                {id}
                                                <button
                                                    type="button"
                                                    onClick={() => removeVO(id)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={20} className="shrink-0" />
                                <p className="text-sm font-bold">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                                <CheckCircle size={20} className="shrink-0" />
                                <p className="text-sm font-bold">{success}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || (voIDs.length === 0 && !ccID)}
                            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-3 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98]'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Processing Assignments...</span>
                                </>
                            ) : (
                                <>
                                    <span>Establish Mappings</span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HierarchyTab;
