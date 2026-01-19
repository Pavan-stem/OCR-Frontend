import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    RotateCw,
    CheckCircle,
    XCircle,
    Clock,
    Play,
    AlertCircle,
    ChevronRight,
    FileCheck,
    FileX,
    Search,
    Download,
    Eye,
    RefreshCw,
    Loader2,
    Filter
} from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import SHGTableDetail from './SHGTableDetail';

const ConversionView = ({ userId, userName, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
    const [results, setResults] = useState({ success: [], failed: [] });
    const [activeFolder, setActiveFolder] = useState('success');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSHG, setSelectedSHG] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Month and Year filtering
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchStatus = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const [statusRes, resultsRes] = await Promise.all([
                fetch(`${API_BASE}/api/conversion/status/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/api/conversion/results/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const statusData = await statusRes.json();
            const resultsData = await resultsRes.json();

            if (statusData.success) setSummary(statusData.summary);
            if (resultsData.success) setResults(resultsData.results);
        } catch (err) {
            console.error('Error fetching conversion data:', err);
        } finally {
            if (showLoading) setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchStatus(true);
        const interval = setInterval(() => {
            fetchStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus]);


    const handleRetryAll = async () => {
        setRefreshing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/conversion/retry-failed/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchStatus();
            }
        } catch (err) {
            console.error('Error retrying all:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleRetrySingle = async (queueId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/conversion/retry/${queueId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchStatus();
            }
        } catch (err) {
            console.error('Error retrying item:', err);
        }
    };

    const filteredResults = results[activeFolder].filter(item => {
        const dateStr = activeFolder === 'success' ? item.convertedAt : item.failedAt;
        const itemDate = new Date(dateStr);
        const matchesMonth = itemDate.getMonth() + 1 === selectedMonth;
        const matchesYear = itemDate.getFullYear() === selectedYear;
        const matchesSearch = item.shgName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.shgID?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesMonth && matchesYear && matchesSearch;
    });

    const getSidebarCount = (folder) => {
        return results[folder].filter(item => {
            const dateStr = folder === 'success' ? item.convertedAt : item.failedAt;
            const itemDate = new Date(dateStr);
            return (itemDate.getMonth() + 1 === selectedMonth) && (itemDate.getFullYear() === selectedYear);
        }).length;
    };

    if (selectedSHG) {
        return <SHGTableDetail uploadId={selectedSHG.uploadId} shgName={selectedSHG.shgName} onBack={() => setSelectedSHG(null)} />;
    }

    return (
        <div className="min-h-screen bg-white rounded-3xl shadow-xl p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-2xl border border-white/20">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all group"
                        >
                            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h2 className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">SHG Conversions</h2>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">
                                Viewing results for: <span className="text-indigo-600">{userName}</span> VO
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setRefreshing(true); fetchStatus(); }}
                            className={`p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all ${refreshing ? 'animate-spin' : ''}`}
                            title="Refresh Status"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Status Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {[
                        { label: 'Completed', count: summary.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Failed', count: summary.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
                        { label: 'Processing', count: summary.processing, icon: RotateCw, color: 'text-indigo-600', bg: 'bg-indigo-50', animate: summary.processing > 0 },
                        { label: 'Pending', count: summary.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' }
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className={`${stat.bg} p-4 sm:p-5 lg:p-6 rounded-2xl lg:rounded-3xl border border-white transition-all hover:shadow-lg`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2.5 sm:p-3 bg-white rounded-xl shadow-sm ${stat.color}`}>
                                    <stat.icon
                                        className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.animate ? 'animate-spin' : 'group-hover:scale-110 transition-transform'
                                            }`}
                                    />
                                </div>

                                <div className={`text-2xl sm:text-3xl lg:text-4xl font-black ${stat.color}`}>
                                    {stat.count}
                                </div>
                            </div>

                            <div className="text-xs sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Navigation Sidebar */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-3 shadow-xl border border-white/20">
                        <button
                            onClick={() => setActiveFolder('success')}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeFolder === 'success'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                                : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <FileCheck className="w-5 h-5" />
                                <span className="font-bold">Success</span>
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${activeFolder === 'success' ? 'bg-white/20' : 'bg-gray-200'}`}>
                                {getSidebarCount('success')}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveFolder('failed')}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl mt-2 transition-all ${activeFolder === 'failed'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-100'
                                : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <FileX className="w-5 h-5" />
                                <span className="font-bold">Failed</span>
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${activeFolder === 'failed' ? 'bg-white/20' : 'bg-gray-200'}`}>
                                {getSidebarCount('failed')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Results List */}
                <div className="lg:col-span-9 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search bar */}
                        <div className="relative group flex-grow">
                            <Search
                                size={20}
                                className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors z-1"
                            />
                            <input
                                type="text"
                                placeholder={`Search ${activeFolder} SHGs...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/90 backdrop-blur-md border-2 border-gray-200 rounded-[24px] pl-16 pr-6 py-4 text-sm font-bold placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 shadow-lg transition-all"
                            />
                        </div>

                        {/* Time Filters */}
                        <div className="flex gap-4">
                            <div className="relative group min-w-[140px]">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="w-full appearance-none bg-white/90 backdrop-blur-md border-2 border-gray-200 rounded-[20px] px-6 py-4 focus:outline-none focus:border-indigo-500 shadow-lg transition-all font-bold text-gray-700"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {new Date(0, m - 1).toLocaleString('default', { month: 'short' })}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    <Filter size={16} />
                                </div>
                            </div>

                            <div className="relative group min-w-[110px]">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="w-full appearance-none bg-white/90 backdrop-blur-md border-2 border-gray-200 rounded-[20px] px-6 py-4 focus:outline-none focus:border-indigo-500 shadow-lg transition-all font-bold text-gray-700"
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    <Filter size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-lg border border-gray-200 overflow-hidden min-h-[300px]">

                        {/* HEADER */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 bg-gray-50/50 border-b border-gray-100">
                            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">
                                Showing {filteredResults.length} {activeFolder} results
                            </h4>

                            {activeFolder === 'failed' && filteredResults.length > 0 && (
                                <button
                                    onClick={handleRetryAll}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Retry All Failed
                                </button>
                            )}
                        </div>

                        {/* LOADING */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                                <p className="text-gray-500 font-black uppercase tracking-widest text-xs text-center">
                                    Fetching results data...
                                </p>
                            </div>

                            /* EMPTY STATE */
                        ) : filteredResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    {activeFolder === 'success'
                                        ? <FileCheck className="text-gray-300" size={32} />
                                        : <FileX className="text-gray-300" size={32} />}
                                </div>

                                <h4 className="text-lg font-black text-gray-900 mb-2">
                                    No {activeFolder} items found
                                </h4>

                                <p className="text-gray-500 font-medium max-w-xs">
                                    {searchTerm
                                        ? 'Try adjusting your search filters.'
                                        : activeFolder === 'success'
                                            ? 'Converted items will appear here after processing.'
                                            : 'Failures during conversion will be listed here.'}
                                </p>
                            </div>

                            /* LIST */
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredResults.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                                            {/* LEFT */}
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md ${activeFolder === 'success'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-red-50 text-red-600'
                                                        }`}
                                                >
                                                    {activeFolder === 'success'
                                                        ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        : <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
                                                </div>

                                                <div>
                                                    <h5 className="text-sm sm:text-base font-black text-gray-900 leading-tight">
                                                        {item.shgName}
                                                    </h5>

                                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                        <span>{item.shgID}</span>
                                                        <span className="hidden sm:inline w-1 h-1 bg-gray-300 rounded-full" />
                                                        <span className="normal-case font-medium">
                                                            {activeFolder === 'success'
                                                                ? `Converted: ${new Date(item.convertedAt).toLocaleDateString()}`
                                                                : `Failed: ${new Date(item.failedAt).toLocaleDateString()}`}
                                                        </span>
                                                    </div>

                                                    {activeFolder === 'failed' && (
                                                        <p className="text-[10px] text-red-500 font-bold mt-2 bg-red-50 px-2 py-1 rounded-lg inline-block">
                                                            Error: {item.error}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ACTION */}
                                            <div className="flex">
                                                {activeFolder === 'success' ? (
                                                    <button
                                                        onClick={() => setSelectedSHG(item)}
                                                        className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Table
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRetrySingle(item.id)}
                                                        className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Retry
                                                    </button>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConversionView;
