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
    Filter,
    X
} from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import SHGTableDetail from './SHGTableDetail';

const ConversionView = ({ userId, userName, filterProps, onClose }) => {
    const { filterMonth, setFilterMonth, filterYear, setFilterYear } = filterProps;
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
    const [results, setResults] = useState({ success: [], failed: [] });
    const [activeFolder, setActiveFolder] = useState('success');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedSHG, setSelectedSHG] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);


    // Month and Year filtering are now provided via filterProps

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(5); // Default limit per user request

    const fetchStatus = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const statusParams = new URLSearchParams({
                month: filterMonth,
                year: filterYear
            }).toString();

            const resultsParams = new URLSearchParams({
                month: filterMonth,
                year: filterYear,
                page: currentPage,
                limit: limit,
                search: debouncedSearch
            }).toString();

            const [statusRes, resultsRes] = await Promise.all([
                fetch(`${API_BASE}/api/conversion/status/${userId}?${statusParams}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/api/conversion/results/${userId}?${resultsParams}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const statusData = await statusRes.json();
            const resultsData = await resultsRes.json();

            if (statusData.success) setSummary(statusData.summary);
            if (resultsData.success) {
                setResults(resultsData.results);
                if (resultsData.pagination) {
                    setTotalPages(resultsData.pagination.pages_success); // Simplified: Using success pages for navigation primarily?
                    // Actually, we might have different pages for success/failed.
                    // For now, let's assume we are paging based on the active folder count or just using the max pages returned.
                    // Let's use 'pages_success' if success folder is active, or 'pages_failed' effectively?
                    // The backend returns totals. let's calculate totalPages locally based on activeFolder.
                    const totalItems = activeFolder === 'success'
                        ? (resultsData.pagination.total_success || 0)
                        : (resultsData.pagination.total_failed || 0);
                    setTotalPages(Math.max(1, Math.ceil(totalItems / limit)));
                }
            }
        } catch (err) {
            console.error('Error fetching conversion data:', err);
        } finally {
            if (showLoading) setLoading(false);
            setRefreshing(false);
        }
    }, [userId, filterMonth, filterYear, currentPage, limit, activeFolder, debouncedSearch]);

    useEffect(() => {
        if (selectedSHG) {
            localStorage.setItem('selectedSHG', JSON.stringify(selectedSHG));
        } else {
            localStorage.removeItem('selectedSHG');
        }
    }, [selectedSHG]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchStatus(true);
        const interval = setInterval(() => {
            fetchStatus();
        }, 12000); // Further increased polling interval
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Reset pagination when search or folder changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, activeFolder]);

    // Handle Scroll Position Persistence
    useEffect(() => {
        const handleScroll = () => {
            sessionStorage.setItem('conversionViewScrollPos', window.scrollY);
        };
        window.addEventListener('scroll', handleScroll);

        // Restore scroll position
        const savedScrollPos = sessionStorage.getItem('conversionViewScrollPos');
        if (savedScrollPos) {
            window.scrollTo({ top: parseInt(savedScrollPos), behavior: 'instant' });
        }

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);




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

    const handleRejectSingle = async (item, folder) => {
        if (!window.confirm(`Are you sure you want to reject and send back ${item.shgName}?`)) return;
        try {
            const token = localStorage.getItem('token');
            const payload = {
                status: 'rejected',
                rejectionReason: 'The Conversion has Failed, upload again'
            };

            const res = await fetch(`${API_BASE}/api/admin/uploads/${item.uploadId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Immediately remove from local state for better UX
                setResults(prev => ({
                    ...prev,
                    [folder]: prev[folder].filter(i => i.uploadId !== item.uploadId)
                }));
                // Also update summary counts
                setSummary(prev => ({
                    ...prev,
                    [folder === 'success' ? 'completed' : 'failed']: Math.max(0, prev[folder === 'success' ? 'completed' : 'failed'] - 1)
                }));
                // Delay refetch to allow backend to process deletion
                setTimeout(() => fetchStatus(), 1000);
            } else {
                alert(data.message || 'Failed to reject upload');
            }
        } catch (err) {
            console.error('Error rejecting item:', err);
            alert('Error rejecting item');
        }
    };

    const filteredResults = results[activeFolder];

    const getSidebarCount = (folder) => {
        return folder === 'success' ? summary.completed : summary.failed;
    };

    if (selectedSHG) {
        return (
            <SHGTableDetail
                uploadId={selectedSHG.uploadId}
                shgName={selectedSHG.shgName}
                onBack={() => setSelectedSHG(null)}
            />
        );
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
                        { label: 'Success', count: summary.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Failed', count: summary.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
                        { label: 'Processing', count: summary.processing, icon: RotateCw, color: 'text-indigo-600', bg: 'bg-indigo-50', animate: summary.processing > 0 },
                        { label: 'In Queue', count: summary.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' }
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
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="w-full appearance-none bg-white/90 backdrop-blur-md border-2 border-gray-200 rounded-[20px] px-6 py-4 focus:outline-none focus:border-indigo-500 shadow-lg transition-all font-bold text-gray-700"
                                >
                                    {Array.from({ length: 12 }, (_, i) => {
                                        const m = String(i + 1).padStart(2, '0');
                                        return (
                                            <option key={m} value={m}>
                                                {new Date(0, i).toLocaleString('default', { month: 'short' })}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    <Filter size={16} />
                                </div>
                            </div>

                            <div className="relative group min-w-[110px]">
                                <select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
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

                                            {/* ACTIONS */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                {activeFolder === 'success' ? (
                                                    <>
                                                        {/* Primary Action */}
                                                        <button
                                                            onClick={() => setSelectedSHG(item)}
                                                            className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                                        >
                                                            <FileCheck className="w-4 h-4" />
                                                            View Table
                                                        </button>

                                                        {/* Secondary Actions */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setPreviewImage({ url: item.s3Url, name: item.shgName })}
                                                                className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all"
                                                                title="View original image"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRetrySingle(item.id)}
                                                                className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-lg hover:border-amber-500 hover:text-amber-600 transition-all"
                                                                title="Retry conversion"
                                                            >
                                                                <RefreshCw className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSingle(item, 'success')}
                                                                className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-lg hover:border-red-500 hover:text-red-600 transition-all"
                                                                title="Reject and send back to VO"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Primary Action */}
                                                        <button
                                                            onClick={() => handleRetrySingle(item.id)}
                                                            className="px-5 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                            Retry
                                                        </button>

                                                        {/* Secondary Actions */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setPreviewImage({ url: item.s3Url, name: item.shgName })}
                                                                className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all"
                                                                title="View original image"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSingle(item, 'failed')}
                                                                className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-lg hover:border-red-500 hover:text-red-600 transition-all"
                                                                title="Reject and send back to VO"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>

                        )}

                        {/* PAGINATION CONTROLS */}
                        {!loading && filteredResults.length > 0 && (
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative w-full max-w-5xl bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button UI - Top Right */}
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-6 right-6 z-10 p-3 bg-white/80 hover:bg-red-50 text-gray-900 hover:text-red-600 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-gray-100 group"
                        >
                            <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>

                        {/* Unified Scrollable Container */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
                            <div className="pt-12 pb-12 px-6 sm:px-12 flex flex-col items-center sm:items-start text-center sm:text-left">
                                {/* Modal Header Information */}
                                <div className="mb-8 w-full pr-12">
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                                        Original Record Image
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            SHG Record
                                        </span>
                                        <p className="text-sm font-bold text-gray-500">
                                            Name: <span className="text-indigo-600">{previewImage.name}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Image Container */}
                                <div className="w-full h-auto flex flex-col items-center">
                                    {previewImage.url ? (
                                        <div className="w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-white">
                                            <img
                                                src={previewImage.url}
                                                alt="Original Record"
                                                className="w-full h-auto block"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center p-12 bg-white rounded-3xl w-full border border-gray-100 shadow-sm">
                                            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                                            <p className="text-gray-900 font-black uppercase tracking-widest text-sm">Image not available</p>
                                            <p className="text-gray-500 text-xs mt-2">The S3 URL could not be generated for this record.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversionView;
