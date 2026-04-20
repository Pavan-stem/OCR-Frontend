import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Download, FileBarChart, ChartPie as PieChartIcon, Activity, Clock, CheckCircle,
    FileText, Filter, LayoutGrid, List, ChevronRight, AlertCircle,
    TrendingUp, Users, MapPin, Calendar, ArrowUpRight, ArrowDownRight,
    Shield, User, ChevronDown, Loader2, Database, Landmark, BarChart2,
    Presentation, FileDown
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { API_BASE } from '../utils/apiConfig';
import { exportPerformanceExcel, exportCumulativeExcel } from '../utils/excelGenerator';
import { exportAnalyticsDoc, exportAnalyticsPDF, exportAnalyticsPPT } from '../utils/analyticsReportGenerator';

const formatIndianCurrency = (value) => {
    if (value === null || value === undefined) return '₹0';
    const absVal = Math.abs(value);
    if (absVal >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (absVal >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (absVal >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${Math.floor(value)}`;
};

const CumulativeFinanceSummary = ({ history, loading }) => {
    if (loading) return (
        <div className="bg-white/10 backdrop-blur-md p-12 rounded-[32px] border border-white/10 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Calculating Financial Year...</span>
        </div>
    );

    if (!history || history.length === 0) return null;

    const processedHistory = useMemo(() => {
        let runningBalance = 0;
        return (history || []).map(item => {
            const stats = item.stats || {};

            const inflow = (stats.totalLoanRecovered || 0) + (stats.totalSavings || 0) +
                (stats.totalPenalties || 0) + (stats.otherSavings || 0);

            const outflow = (stats.totalLoansTaken || 0) + (stats.totalReturned || 0);

            const opening = runningBalance;
            const closing = opening + inflow - outflow;
            runningBalance = closing;

            return {
                ...item,
                opening,
                inflow,
                outflow,
                closing
            };
        });
    }, [history]);

    const getMonthName = (m) => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months[m - 1] || m;
    };

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Cumulative Financial Summary</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Jan to Current Month Breakdown</p>
                    </div>
                </div>
                <button
                    onClick={() => exportCumulativeExcel(processedHistory)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
                >
                    <Download className="w-4 h-4" />
                    Download Summary
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest">Month</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-right">Opening Balance</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-right">Current (Inflow)</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-right">Closing Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {processedHistory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-8 py-4 font-black text-gray-900 text-xs uppercase tracking-tight">
                                    {getMonthName(item.month)} {item.year}
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <span className="text-gray-500 font-bold text-xs">{formatIndianCurrency(item.opening)}</span>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-emerald-600 font-black text-xs">+{formatIndianCurrency(item.inflow)}</span>
                                        <span className="text-rose-500 font-bold text-[9px]">-{formatIndianCurrency(item.outflow)}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <span className={`font-black text-xs ${item.closing >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {formatIndianCurrency(item.closing)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AnalyticsPage = ({ filterProps }) => {
    const {
        selectedDistrict,
        setSelectedDistrict,
        selectedMandal,
        setSelectedMandal,
        selectedVillage,
        setSelectedVillage,
        filterMonth,
        setFilterMonth,
        filterYear,
        setFilterYear
    } = filterProps;

    const filters = useMemo(() => ({
        district: selectedDistrict,
        mandal: selectedMandal,
        village: selectedVillage,
        month: filterMonth,
        year: filterYear
    }), [selectedDistrict, selectedMandal, selectedVillage, filterMonth, filterYear]);

    // Local Stats State
    const [summary, setSummary] = useState(null);
    const [trends, setTrends] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Payment Analytics State
    const [paymentData, setPaymentData] = useState(null);
    const [paymentTrends, setPaymentTrends] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // UI State
    const [activeView, setActiveView] = useState('charts');
    const [activeMetric, setActiveMetric] = useState('totalCollections');
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isSSEConnected, setIsSSEConnected] = useState(false);

    // Download Dropdown State
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(null); // 'doc' | 'ppt' | null
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const downloadButtonRef = useRef(null);
    const downloadPanelRef = useRef(null);

    // Toast Notification State
    const [toast, setToast] = useState(null);

    // SSE State & Refs
    const [sseErrorCount, setSSEErrorCount] = useState(0);
    const sseTimeoutRef = useRef(null);
    const refreshTimeoutRef = useRef(null);

    const showToast = (type, message, duration = 5000) => {
        setToast({ type, message });
        if (type !== 'loading') {
            setTimeout(() => setToast(null), duration);
        }
    };
    const clearToast = () => setToast(null);

    // User Role Info
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch { return {}; }
    }, []);

    const role = (user.role || '').toLowerCase();
    const isAdmin = role.includes('admin') || role.includes('developer');
    const isAPM = role.includes('admin - apm');
    const isCC = role.includes('admin - cc');

    // Fetch Summary & Trends & Payment Analytics
    useEffect(() => {
        let isMounted = true;

        const fetchAll = async () => {
            const token = localStorage.getItem('token');
            const isGeographicFiltered =
                filters.district !== 'all' || filters.mandal !== 'all' || filters.village !== 'all';
            const params = new URLSearchParams({ ...filters }).toString();

            const now = new Date();
            const historyParams = { ...filters };
            if (parseInt(filters.year) === now.getFullYear()) {
                historyParams.month = now.getMonth() + 1;
            } else {
                historyParams.month = 12;
            }
            const histParams = new URLSearchParams(historyParams).toString();

            if (isGeographicFiltered) {
                setSummary(null);
                setPaymentData(null);
                setPaymentTrends([]);
                setTrends([]);
            }

            setIsHistoryLoading(true);
            const [sumResult, trendResult, payResult, payTrendResult, histResult] =
                await Promise.allSettled([
                    fetch(`${API_BASE}/api/analytics/v2/summary?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                    fetch(`${API_BASE}/api/analytics/v2/trends?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                    fetch(`${API_BASE}/api/payments/summary?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                    fetch(`${API_BASE}/api/payments/trends?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                    fetch(`${API_BASE}/api/payments/history?${histParams}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                ]);

            if (!isMounted) return;

            if (sumResult.status === 'fulfilled' && sumResult.value?.success) {
                setSummary(sumResult.value.summary);
                setIsRefreshing(sumResult.value.stale || false);
            } else if (sumResult.status === 'rejected') {
                console.error("Failed to fetch summary:", sumResult.reason);
            }

            if (trendResult.status === 'fulfilled' && trendResult.value?.success) {
                setTrends(trendResult.value.data);
            } else if (trendResult.status === 'rejected') {
                console.error("Failed to fetch trends:", trendResult.reason);
            }

            if (payResult.status === 'fulfilled') {
                if (payResult.value?.success) {
                    setPaymentData(payResult.value.data);
                } else {
                    console.warn("⚠ Payment summary not successful:", payResult.value);
                }
            } else {
                console.error("Failed to fetch payment summary:", payResult.reason);
            }

            if (payTrendResult.status === 'fulfilled') {
                if (payTrendResult.value?.success) {
                    setPaymentTrends(payTrendResult.value.data || []);
                } else {
                    console.warn("⚠ Payment trends not successful:", payTrendResult.value);
                    setPaymentTrends([]);
                }
            } else {
                console.error("Failed to fetch payment trends:", payTrendResult.reason);
                setPaymentTrends([]);
            }

            if (histResult.status === 'fulfilled' && histResult.value?.success) {
                setHistoryData(histResult.value.data || []);
            } else if (histResult.status === 'rejected') {
                console.error("Failed to fetch history:", histResult.reason);
            }

            setIsHistoryLoading(false);
        };

        fetchAll();

        return () => { isMounted = false; };
    }, [filters, refreshKey]);

    // Debounced refresh to batch multiple SSE signals
    const debouncedRefresh = useCallback(() => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = setTimeout(() => {
            setRefreshKey(prev => prev + 1);
        }, 500);
    }, []);

    // SSE Real-time Updates
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        let eventSource = null;

        const connectSSE = () => {
            try {
                const url = `${API_BASE}/api/analytics/v2/stream?token=${token}`;
                eventSource = new EventSource(url);

                eventSource.onmessage = (event) => {
                    if (event.data === 'refresh') {
                        console.log("Real-time refresh signal received");
                        debouncedRefresh();
                    } else if (event.data === 'connected') {
                        setIsSSEConnected(true);
                    }
                };

                eventSource.onerror = (err) => {
                    console.error("✗ SSE Error:", err);
                    setIsSSEConnected(false);
                    eventSource.close();

                    const delay = Math.min(1000 * Math.pow(2, sseErrorCount), 30000);
                    console.log(`Reconnecting in ${delay}ms`);

                    sseTimeoutRef.current = setTimeout(() => {
                        setSSEErrorCount(prev => prev + 1);
                    }, delay);
                };
            } catch (err) {
                console.error("Failed to create EventSource:", err);
                const delay = Math.min(1000 * Math.pow(2, sseErrorCount), 30000);
                sseTimeoutRef.current = setTimeout(() => {
                    setSSEErrorCount(prev => prev + 1);
                }, delay);
            }
        };

        connectSSE();

        return () => {
            if (sseTimeoutRef.current) {
                clearTimeout(sseTimeoutRef.current);
                sseTimeoutRef.current = null;
            }
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [sseErrorCount, debouncedRefresh]);

    // Cleanup all timeouts on unmount
    useEffect(() => {
        return () => {
            if (sseTimeoutRef.current) clearTimeout(sseTimeoutRef.current);
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        };
    }, []);

    // Fetch Initial Table Data (Root Level Only)
    useEffect(() => {
        if (activeView !== 'table') return;
        const fetchTable = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const params = new URLSearchParams({
                    ...filters,
                    level: 'root'
                }).toString();

                const res = await fetch(`${API_BASE}/api/analytics/v2/hierarchy?${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.success) {
                    setTableData(data.data || []);
                }
            } catch (err) {
                setError("Could not load initial hierarchy.");
            } finally {
                setLoading(false);
            }
        };

        fetchTable();
    }, [filters, refreshKey, activeView]);

    const handleDetailedDownload = async (item, loadedChildren = []) => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 8000;

        const fetchBreakdown = async (url, retryCount = 0) => {
            const token = localStorage.getItem('token');
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();

            if (data.success && data.coldStart) {
                if (retryCount < MAX_RETRIES) {
                    const remaining = MAX_RETRIES - retryCount;
                    showToast('loading', `⏳ Financial data is being calculated... Auto-retrying in 8s (${remaining} attempt${remaining > 1 ? 's' : ''} left)`);
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    return fetchBreakdown(url, retryCount + 1);
                } else {
                    clearToast();
                    showToast('error', '❌ Financial data is still building. Please try downloading again in 30 seconds.', 7000);
                    return null;
                }
            }
            return data;
        };

        try {
            const token = localStorage.getItem('token');
            const isVO = item.role === 'VO';
            const isCC = item.role === 'CC';
            const isAPM = item.role === 'APM';

            showToast('loading', `⏳ Calculating dependent flows for ${item.role} report: ${item.name}... (This may take a moment)`);

            const baseParams = {
                month: filters.month,
                year: filters.year,
            };

            if (isAPM) {
                let ccs = loadedChildren.filter(c => c.role === 'CC' || c.clusterID);
                if (ccs.length === 0) {
                    const hierarchyParams = new URLSearchParams({
                        ...filters,
                        level: 'apm',
                        parentId: item.userID || item.id
                    }).toString();
                    const hRes = await fetch(`${API_BASE}/api/analytics/v2/hierarchy?${hierarchyParams}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const hData = await hRes.json();
                    ccs = (hData.success ? hData.data : []) || [];
                }

                const ccIDs = ccs.map(c => c.clusterID || c.id).filter(Boolean);
                const params = new URLSearchParams({
                    ...baseParams,
                    level: 'apm',
                    parentId: item.userID || item.id,
                    ccIDs: ccIDs.join(',')
                }).toString();

                const data = await fetchBreakdown(`${API_BASE}/api/payments/deep-breakdown?${params}`);
                if (!data) return;
                if (data.success) {
                    clearToast();
                    exportPerformanceExcel(data.data, data.level, ccs, item);
                    showToast('success', `✅ APM report for "${item.name}" downloaded successfully!`, 4000);
                } else {
                    clearToast();
                    showToast('error', data.message || 'Failed to fetch CC data', 5000);
                }

            } else if (isCC) {
                const params = new URLSearchParams({
                    ...baseParams,
                    level: 'cc',
                    parentId: item.clusterID || item.id
                }).toString();

                const data = await fetchBreakdown(`${API_BASE}/api/payments/deep-breakdown?${params}`);
                if (!data) return;
                if (data.success) {
                    clearToast();
                    exportPerformanceExcel(data.data, data.level, [], item);
                    showToast('success', `✅ CC report for "${item.name}" downloaded successfully!`, 4000);
                } else {
                    clearToast();
                    showToast('error', data.message || 'Failed to fetch VO data', 5000);
                }

            } else if (isVO) {
                const voParams = new URLSearchParams({
                    ...baseParams,
                    level: 'vo',
                    parentId: item.voID || item.id
                }).toString();

                const voData = await fetchBreakdown(`${API_BASE}/api/payments/deep-breakdown?${voParams}`);
                if (!voData) return;
                if (voData.success) {
                    clearToast();
                    exportPerformanceExcel(voData.data, voData.level, [], item);
                    showToast('success', `✅ VO report for "${item.name}" downloaded successfully!`, 4000);
                } else {
                    clearToast();
                    showToast('error', voData.message || 'Failed to fetch SHG data', 5000);
                }
            } else {
                clearToast();
                showToast('error', 'Download not supported for this level.', 4000);
            }
        } catch (err) {
            console.error('Download Error:', err);
            clearToast();
            showToast('error', 'Failed to download report. Please check connection and try again.', 5000);
        }
    };

    // Close download menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            const clickedButton = downloadButtonRef.current?.contains(e.target);
            const clickedPanel  = downloadPanelRef.current?.contains(e.target);
            if (!clickedButton && !clickedPanel) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDownloadMenu = () => {
        if (!showDownloadMenu && downloadButtonRef.current) {
            const rect = downloadButtonRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
        setShowDownloadMenu(prev => !prev);
    };

    const handleExportDoc = async () => {
        setShowDownloadMenu(false);
        setIsExporting('doc');
        showToast('loading', '⏳ Generating detailed analytics document...');
        try {
            await new Promise(r => setTimeout(r, 100));
            await exportAnalyticsDoc({ summary, paymentData, paymentTrends, historyData, trends, filters });
            clearToast();
            showToast('success', '✅ Analytics document downloaded successfully!', 4000);
        } catch (err) {
            console.error('Doc export error:', err);
            clearToast();
            showToast('error', '❌ Failed to generate document. Please try again.', 5000);
        } finally {
            setIsExporting(null);
        }
    };

    const handleExportPPT = async () => {
        setShowDownloadMenu(false);
        setIsExporting('ppt');
        showToast('loading', '⏳ Building PowerPoint presentation...');
        try {
            await exportAnalyticsPPT({ summary, paymentData, paymentTrends, historyData, filters });
            clearToast();
            showToast('success', '✅ PowerPoint presentation downloaded successfully!', 4000);
        } catch (err) {
            console.error('PPT export error:', err);
            clearToast();
            showToast('error', '❌ Failed to generate presentation. Please try again.', 5000);
        } finally {
            setIsExporting(null);
        }
    };

    const handleExportPDF = async () => {
        setShowDownloadMenu(false);
        setIsExporting('pdf');
        showToast('loading', '⏳ Generating detailed PDF report...');
        try {
            await new Promise(r => setTimeout(r, 100));
            await exportAnalyticsPDF({ summary, paymentData, paymentTrends, historyData, trends, filters });
            clearToast();
            showToast('success', '✅ PDF report downloaded successfully!', 4000);
        } catch (err) {
            console.error('PDF export error:', err);
            clearToast();
            showToast('error', '❌ Failed to generate report. Please try again.', 5000);
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <div className="min-h-screen text-white p-4 lg:p-8 animate-in fade-in duration-700 pb-16">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300 ${toast.type === 'loading' ? 'bg-indigo-900 border-indigo-700 text-white' :
                    toast.type === 'success' ? 'bg-emerald-900 border-emerald-700 text-white' :
                        toast.type === 'error' ? 'bg-rose-900 border-rose-700 text-white' :
                            'bg-slate-900 border-slate-700 text-white'
                    }`}>
                    {toast.type === 'loading' && <Loader2 className="w-4 h-4 text-indigo-300 animate-spin mt-0.5 shrink-0" />}
                    {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                    {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />}
                    <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
                    <button onClick={clearToast} className="ml-auto text-white/40 hover:text-white/80 transition-colors shrink-0 mt-0.5">✕</button>
                </div>
            )}

            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row bg-white/[0.03] backdrop-blur-3xl p-8 rounded-[32px] border border-white/10 shadow-2xl justify-between items-start lg:items-center gap-6 mb-8">
                <div className="w-[25rem]">
                    <h2 className="text-5xl font-black text-white px-2 tracking-tighter flex items-center gap-3 drop-shadow-2xl">
                        Analytics
                    </h2>
                </div>

                <div className="flex flex-nowrap items-center gap-3 w-full lg:w-auto pr-4">
                    {/* Tab Switcher */}
                    <div className="flex bg-white/5 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
                        {[
                            { id: 'charts', icon: PieChartIcon, label: 'Performance Charts' },
                            { id: 'table', icon: List, label: 'Unit Performance Details' }
                        ].map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setActiveView(v.id)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${activeView === v.id
                                    ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] translate-y-[-1px]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <v.icon className="w-4 h-4" />
                                {v.label}
                            </button>
                        ))}
                    </div>

                    {/* Download Button — dropdown panel rendered at root level via fixed position */}
                    <button
                        ref={downloadButtonRef}
                        onClick={toggleDownloadMenu}
                        disabled={!!isExporting}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all duration-300 border shadow-lg
                            ${ isExporting
                                ? 'bg-indigo-700/50 border-indigo-500/30 text-indigo-300 cursor-not-allowed'
                                : showDownloadMenu
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/30 scale-[1.02]'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white hover:shadow-indigo-500/20'
                            }`}
                    >
                        {isExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {isExporting === 'doc' ? 'Generating Doc...' : isExporting === 'pdf' ? 'Building PDF...' : isExporting === 'ppt' ? 'Building PPT...' : 'Download'}
                        {!isExporting && (
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showDownloadMenu ? 'rotate-180' : ''}`} />
                        )}
                    </button>
                </div>
            </div>

            {/* Download Dropdown Panel — fixed position to escape backdrop-blur stacking context */}
            {showDownloadMenu && !isExporting && (
                <div
                    ref={downloadPanelRef}
                    className="fixed w-72 bg-[#0f1035] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ top: dropdownPos.top, right: dropdownPos.right, zIndex: 999999 }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-[0.2em]">Export Report</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {filters?.month && filters?.year
                                ? `${new Date(0, parseInt(filters.month) - 1).toLocaleString('default', { month: 'long' })} ${filters.year}`
                                : 'Current Period'}
                        </p>
                    </div>

                    {/* PDF Option */}
                    <button
                        onClick={handleExportPDF}
                        className="w-full flex items-start gap-4 px-4 py-4 hover:bg-white/5 transition-all duration-200 group border-b border-white/5"
                    >
                        <div className="p-2.5 bg-rose-600/20 group-hover:bg-rose-600/40 rounded-xl transition-colors shrink-0 mt-0.5">
                            <FileText className="w-5 h-5 text-rose-400 group-hover:text-rose-300" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-white group-hover:text-rose-200 transition-colors">PDF Report</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">High-fidelity portable report — best for tablets, mobile & printing</p>
                            <span className="inline-block mt-1.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">.pdf format</span>
                        </div>
                    </button>

                    {/* Document Option */}
                    {/* <button
                        onClick={handleExportDoc}
                        className="w-full flex items-start gap-4 px-4 py-4 hover:bg-white/5 transition-all duration-200 group border-b border-white/5"
                    >
                        <div className="p-2.5 bg-indigo-600/20 group-hover:bg-indigo-600/40 rounded-xl transition-colors shrink-0 mt-0.5">
                            <FileDown className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-white group-hover:text-indigo-200 transition-colors">Word Document</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">Editable text report — optimized for MS Word processing</p>
                            <span className="inline-block mt-1.5 text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">.doc format</span>
                        </div>
                    </button> */}

                    {/* PPT Option */}
                    <button
                        onClick={handleExportPPT}
                        className="w-full flex items-start gap-4 px-4 py-4 hover:bg-white/5 transition-all duration-200 group"
                    >
                        <div className="p-2.5 bg-violet-600/20 group-hover:bg-violet-600/40 rounded-xl transition-colors shrink-0 mt-0.5">
                            <Presentation className="w-5 h-5 text-violet-400 group-hover:text-violet-300" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-white group-hover:text-violet-200 transition-colors">Presentation (PPT)</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">Executive 9-slide deck with charts & visuals</p>
                            <span className="inline-block mt-1.5 text-[9px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">.pptx format</span>
                        </div>
                    </button>

                    {/* Footer hint */}
                    <div className="px-4 py-2.5 bg-white/[0.015] border-t border-white/5">
                        <p className="text-[9px] text-gray-600 text-center">Uses currently applied filters &amp; date range</p>
                    </div>
                </div>
            )}

            {/* Role-Adaptive Filter Bar */}
            <div className="mb-10">
                <AnalyticsFilters filterProps={filterProps} user={user} />
            </div>

            {/* Interactive Map Section */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-1000 overflow-hidden mb-5">
                <InteractiveAPMap
                    forceCalibration={false}
                    summary={(() => {
                        const rawMapStats = summary?.mapStats || {};
                        const conv = summary?.conversion || {};
                        return {
                            ...rawMapStats,
                            all: {
                                uploaded: summary?.shgStats?.uploaded,
                                pending: summary?.shgStats?.pending,
                                total: summary?.shgStats?.total,
                                approved: summary?.ccActions?.approved,
                                converted: conv.converted,
                                sentToDB: conv.sentToDB,
                                failed: conv.failed,
                                convPending: conv.pending,
                                convProcessing: conv.processing,
                                financeStats: paymentData?.financeStats
                            }
                        };
                    })()}
                    filters={filters}
                    locked={isAPM || isCC}
                    onDistrictSelect={(d) => {
                        setSelectedDistrict(d || 'all');
                        setSelectedMandal('all');
                        setSelectedVillage('all');
                    }}
                    onMandalSelect={(m) => {
                        setSelectedMandal(m || 'all');
                        setSelectedVillage('all');
                    }}
                />
            </div>

            {activeView === 'charts' && (
                <div className="flex flex-col gap-8">
                    {role.includes('developer') && (
                        <div className="bg-indigo-600/10 border border-indigo-500/20 px-6 py-4 rounded-2xl flex items-center justify-between shadow-lg max-w-sm ml-auto animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-xl">
                                    <Database className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest leading-none mb-1">Developer Insights</p>
                                    <h4 className="text-white text-sm font-bold">Files Sent to DB</h4>
                                </div>
                            </div>
                            <div className="text-2xl font-black text-white">
                                {summary?.conversion?.sentToDB || 0}
                            </div>
                        </div>
                    )}
                    <FinanceAnalytics
                        data={paymentData}
                        activeMetric={activeMetric}
                        onMetricChange={setActiveMetric}
                        isExpanded={isCollectionsExpanded}
                        setIsExpanded={setIsCollectionsExpanded}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                        <div className="lg:col-span-2">
                            <PaymentTrendChart data={paymentTrends} />
                        </div>
                        <div className="lg:col-span-1">
                            <UnifiedDistributionCard
                                data={paymentData?.distributions}
                                activeMetric={activeMetric}
                                level={paymentData?.distKey}
                            />
                        </div>
                    </div>


                    <div className="mb-8">
                        <CumulativeFinanceSummary
                            history={historyData}
                            loading={isHistoryLoading}
                        />
                    </div>

                    <div className="mb-8">
                        <Page2FinanceBarChart 
                            data={paymentData?.financeStats?.page2Finance || summary?.financeStats?.page2Finance} 
                            breakdown={paymentData?.financeStats?.page2Breakdown || summary?.financeStats?.page2Breakdown}
                            distributions={paymentData?.financeStats?.page2Distributions || summary?.financeStats?.page2Distributions}
                            month={filters.month} 
                            year={filters.year} 
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TrendChart data={trends} />
                        <DistributionCharts summary={summary} month={filters.month} year={filters.year} />
                    </div>
                </div>
            )}

            {activeView === 'table' && (
                <DetailedTable
                    data={tableData}
                    loading={loading}
                    handleDetailedDownload={handleDetailedDownload}
                    filters={filters}
                    refreshKey={refreshKey}
                    isSSEConnected={isSSEConnected}
                />
            )}
        </div>
    );
};

const AnalyticsFilters = ({ filterProps, user }) => {
    const {
        selectedDistrict,
        setSelectedDistrict,
        selectedMandal,
        setSelectedMandal,
        selectedVillage,
        setSelectedVillage,
        filterMonth,
        setFilterMonth,
        filterYear,
        setFilterYear
    } = filterProps;
    const [locations, setLocations] = useState({ districts: [], mandals: [], villages: [] });
    const role = (user.role || '').toLowerCase();
    const isAPM = role.includes('apm');
    const isCC = role.includes('cc');

    useEffect(() => {
        const isScoped = isAPM || isCC;
        if (isScoped && user) {
            if (user.district && (!selectedDistrict || selectedDistrict === 'all')) {
                setSelectedDistrict(user.district);
            }
            if (user.mandal && (!selectedMandal || selectedMandal === 'all')) {
                setSelectedMandal(user.mandal);
            }
        }
    }, [isAPM, isCC, user, selectedDistrict, selectedMandal, setSelectedDistrict, setSelectedMandal]);

    useEffect(() => {
        const loadDistricts = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/districts`);
                const data = await res.json();
                if (data.success) setLocations(prev => ({ ...prev, districts: data.districts }));
            } catch { }
        };
        loadDistricts();
    }, []);

    useEffect(() => {
        if (selectedDistrict && selectedDistrict !== 'all') {
            const loadMandals = async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/mandals?district=${selectedDistrict}`);
                    const data = await res.json();
                    if (data.success) setLocations(prev => ({ ...prev, mandals: data.mandals }));
                } catch { }
            };
            loadMandals();
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedDistrict && selectedDistrict !== 'all' && selectedMandal && selectedMandal !== 'all') {
            const loadVillages = async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/villages?mandal=${selectedMandal}&district=${selectedDistrict}`);
                    const data = await res.json();
                    if (data.success) setLocations(prev => ({ ...prev, villages: data.villages }));
                } catch { }
            };
            loadVillages();
        }
    }, [selectedDistrict, selectedMandal]);

    const selectStyle = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500/50 focus:bg-white/10 outline-none transition-all appearance-none cursor-pointer hover:bg-white/10";
    const labelStyle = "text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em] ml-1 mb-2 block";

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 bg-white/[0.03] backdrop-blur-3xl p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="space-y-1 relative z-10">
                <label className={labelStyle}>Month</label>
                <div className="relative">
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className={selectStyle}
                    >
                        {Array.from({ length: 12 }, (_, i) => {
                            const m = String(i + 1).padStart(2, '0');
                            return (
                                <option key={m} value={m} className="bg-[#1a1c4b] text-white">
                                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                </option>
                            );
                        })}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400/50 pointer-events-none" />
                </div>
            </div>

            <div className="space-y-1 relative z-10">
                <label className={labelStyle}>Year</label>
                <div className="relative">
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className={selectStyle}
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="bg-[#1a1c4b] text-white">{y}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400/50 pointer-events-none" />
                </div>
            </div>

            {(!isAPM && !isCC) ? (
                <>
                    <div className="space-y-1 relative z-10">
                        <label className={labelStyle}>District</label>
                        <div className="relative">
                            <select
                                value={selectedDistrict}
                                onChange={(e) => {
                                    setSelectedDistrict(e.target.value);
                                    setSelectedMandal('all');
                                    setSelectedVillage('all');
                                }}
                                className={selectStyle}
                            >
                                <option value="all" className="bg-[#1a1c4b] text-white">All Districts</option>
                                {locations.districts.map(d => <option key={d.id} value={d.name} className="bg-[#1a1c4b] text-white">{d.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400/50 pointer-events-none" />
                        </div>
                    </div>

                    <div className="space-y-1 relative z-10">
                        <label className={`${labelStyle} ${selectedDistrict === 'all' ? 'opacity-40' : ''}`}>Mandal</label>
                        <div className="relative">
                            <select
                                value={selectedMandal}
                                onChange={(e) => {
                                    setSelectedMandal(e.target.value);
                                    setSelectedVillage('all');
                                }}
                                disabled={selectedDistrict === 'all'}
                                className={`${selectStyle} ${selectedDistrict === 'all' ? 'opacity-40 cursor-not-allowed border-white/5 bg-transparent' : ''}`}
                            >
                                <option value="all" className="bg-[#1a1c4b] text-white">All Mandals</option>
                                {locations.mandals.map(m => <option key={m.id} value={m.name} className="bg-[#1a1c4b] text-white">{m.name}</option>)}
                            </select>
                            <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-all ${selectedDistrict === 'all' ? 'opacity-20' : 'text-indigo-400/50 pointer-events-none'}`} />
                        </div>
                    </div>
                </>
            ) : (
                <div className="lg:col-span-2 flex items-end pb-1 relative z-10 pr-4">
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-6 py-3 w-full flex items-center gap-3 shadow-lg shadow-indigo-500/5 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12" />
                        <MapPin className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div>
                            <p className="text-[10px] font-black text-indigo-300/50 uppercase tracking-widest leading-none mb-1">Scope</p>
                            <p className="text-sm font-black text-white truncate max-w-[200px]">
                                {selectedDistrict} {selectedMandal !== 'all' ? `• ${selectedMandal}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-1 relative z-10">
                <label className={`${labelStyle} ${selectedMandal === 'all' ? 'opacity-40' : ''}`}>Village</label>
                <div className="relative">
                    <select
                        value={selectedVillage}
                        onChange={(e) => setSelectedVillage(e.target.value)}
                        disabled={selectedMandal === 'all'}
                        className={`${selectStyle} ${selectedMandal === 'all' ? 'opacity-40 cursor-not-allowed border-white/5 bg-transparent' : ''}`}
                    >
                        <option value="all" className="bg-[#1a1c4b] text-white">All Villages</option>
                        {locations.villages.map(v => <option key={v.id} value={v.name} className="bg-[#1a1c4b] text-white">{v.name}</option>)}
                    </select>
                    <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-all ${selectedMandal === 'all' ? 'opacity-20' : 'text-indigo-400/50 pointer-events-none'}`} />
                </div>
            </div>
        </div>
    );
};

const FinanceAnalytics = ({ data, activeMetric, onMetricChange, isExpanded, setIsExpanded }) => {
    if (!data || !data.financeStats) return null;

    const {
        totalSavings, totalLoanRecovered,
        totalLoansTaken, totalReturned,
        totalPenalties, loanRecoveryBreakdown,
        loanCount
    } = data.financeStats;

    const formatFull = (val) => (val || 0).toLocaleString('en-IN');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Collections Breakdown */}
            <div
                onClick={() => onMetricChange('totalCollections')}
                className={`bg-white/90 backdrop-blur-xl px-4 py-6 rounded-[32px] border transition-all duration-300 cursor-pointer overflow-hidden group shadow-xl hover:shadow-2xl ${activeMetric === 'totalCollections' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/20'}`}
            >
                <div
                    className="flex justify-between items-center gap-2 group/header w-full"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                        onMetricChange('totalCollections');
                        document.getElementById('chart-totalCollections')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 whitespace-nowrap">Total Collections</p>
                        <h4 className="text-lg font-black text-gray-900 group-hover/header:text-indigo-600 transition-colors whitespace-nowrap tabular-nums">
                            ₹{formatFull(totalLoanRecovered)}
                        </h4>
                    </div>
                    <div className={`p-2.5 flex-shrink-0 rounded-2xl transition-all duration-300 ${isExpanded ? 'bg-indigo-600 text-white rotate-180' : 'bg-indigo-50 text-indigo-600 group-hover/header:bg-indigo-100'}`}>
                        <ChevronDown className="w-5 h-5" />
                    </div>
                </div>

                <div className={`grid transition-all duration-500 overflow-hidden ${isExpanded ? 'grid-rows-[1fr] mt-6' : 'grid-rows-[0fr] mt-0'}`}>
                    <div className="min-h-0">
                        <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                            {[
                                { label: 'Bank Loan', val: loanRecoveryBreakdown?.bankLoan },
                                { label: 'SHG Internal', val: loanRecoveryBreakdown?.shgInternal },
                                { label: 'Streenidhi Micro', val: loanRecoveryBreakdown?.streenidhiMicro },
                                { label: 'Streenidhi Tenny', val: loanRecoveryBreakdown?.streenidhiTenni },
                                { label: 'Unnati (SCSP)', val: loanRecoveryBreakdown?.unnatiSCSP },
                                { label: 'Unnati (TSP)', val: loanRecoveryBreakdown?.unnatiTSP },
                                { label: 'CIF Loan', val: loanRecoveryBreakdown?.cif },
                                { label: 'VO Internal', val: loanRecoveryBreakdown?.voInternal }
                            ].map((item) => (
                                <div key={item.label} className="flex justify-between items-center gap-2 group/item hover:bg-gray-50 p-1 rounded-lg transition-colors">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover/item:text-gray-600 transition-colors truncate">{item.label}</span>
                                    <span className="text-[11px] font-black text-gray-900 flex-shrink-0 tabular-nums">₹{formatFull(item.val)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Member Deposits */}
            <div
                onClick={() => {
                    onMetricChange('memberDeposits');
                    document.getElementById('chart-memberDeposits')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`bg-white/90 backdrop-blur-xl px-4 py-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'memberDeposits' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 whitespace-nowrap">Member Deposits</p>
                <h4 className="text-lg font-black text-gray-900 whitespace-nowrap tabular-nums">₹{formatFull(totalSavings)}</h4>
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[9px] text-gray-400 font-bold uppercase flex items-center gap-2">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        Monthly Savings
                    </p>
                </div>
            </div>

            {/* Loans Sanctioned */}
            <div
                onClick={() => {
                    onMetricChange('loansSanctioned');
                    document.getElementById('chart-loansSanctioned')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`bg-white/90 backdrop-blur-xl px-4 py-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'loansSanctioned' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-white/20'}`}
            >
                <div className="flex justify-between items-start mb-1 gap-2">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest whitespace-nowrap">Loans Sanctioned</p>
                    <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-rose-100 flex-shrink-0">
                        {loanCount || 0}
                    </span>
                </div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Number of loans taken</p>
                <h4 className="text-lg font-black text-gray-900 whitespace-nowrap tabular-nums">₹{formatFull(totalLoansTaken)}</h4>
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-3 h-3 text-rose-500" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Capital Outflow</span>
                    </div>
                </div>
            </div>

            {/* Savings Withdrawal */}
            <div
                onClick={() => {
                    onMetricChange('savingsWithdrawal');
                    document.getElementById('chart-savingsWithdrawal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`bg-white/90 backdrop-blur-xl px-4 py-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'savingsWithdrawal' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 whitespace-nowrap">Savings Withdrawal</p>
                <h4 className="text-lg font-black text-gray-900 whitespace-nowrap tabular-nums">₹{formatFull(totalReturned)}</h4>
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Member Repayments</span>
                    </div>
                </div>
            </div>

            {/* Late Penalties */}
            <div
                onClick={() => {
                    onMetricChange('latePenalties');
                    document.getElementById('chart-latePenalties')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`bg-white/90 backdrop-blur-xl px-4 py-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'latePenalties' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 whitespace-nowrap">Late Penalties</p>
                <h4 className="text-lg font-black text-gray-900 whitespace-nowrap tabular-nums">₹{formatFull(totalPenalties)}</h4>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-3">
                    <div className="p-2 bg-amber-50 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase leading-tight">Deferred Payment Surcharges</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TrendChart = ({ data }) => {
    return (
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
                    <FileBarChart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Uploads Trend</h3>
            </div>

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontWeight: 'bold', fontSize: 10 }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 'bold' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                            itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="uploads" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorUploads)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const PaymentTrendChart = ({ data }) => {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-lg h-full flex flex-col" id="payment-trends">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Financial Performance</h3>
                </div>
                <div className="flex flex-wrap gap-4">
                    {[
                        { label: 'Collections', color: '#10b981' },
                        { label: 'Deposits', color: '#4f46e5' },
                        { label: 'Loans', color: '#f43f5e' },
                        { label: 'Withdrawal', color: '#f97316' },
                        { label: 'Penalties', color: '#f59e0b' }
                    ].map(m => (
                        <div key={m.label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }}></div>
                            <span className="text-[9px] font-black text-gray-400 uppercase">{m.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-grow w-full min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontWeight: 'bold' }}
                            tickFormatter={(value) => formatIndianCurrency(value).replace('₹', '')}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                            itemStyle={{ fontWeight: 'bold' }}
                            cursor={{ fill: '#f8fafc' }}
                            formatter={(value) => formatIndianCurrency(value)}
                        />
                        <Bar dataKey="collections" name="Collections" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                        <Bar dataKey="deposits" name="Member Deposits" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                        <Bar dataKey="loans" name="Loans Sanctioned" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                        <Bar dataKey="withdrawals" name="Savings Withdrawal" fill="#f97316" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                        <Bar dataKey="penalties" name="Late Penalties" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const UnifiedDistributionCard = ({ data, activeMetric, level }) => {
    if (!data) return null;

    const METRIC_CONFIG = {
        totalCollections: { label: 'Collections', color: '#4f46e5' },
        memberDeposits: { label: 'Deposits', color: '#10b981' },
        loansSanctioned: { label: 'Loans', color: '#f43f5e' },
        savingsWithdrawal: { label: 'Withdrawal', color: '#f97316' },
        latePenalties: { label: 'Penalties', color: '#f59e0b' }
    };

    return (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border border-white/20 shadow-2xl h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
                    <PieChartIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase leading-none">Finance Contribution</h3>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Contribution of Finance</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                    <div
                        key={key}
                        id={`chart-${key}`}
                        className={`flex flex-col items-center transition-all duration-500 rounded-2xl p-2 ${activeMetric === key ? 'bg-indigo-50/50 ring-1 ring-indigo-500/20 scale-105 shadow-lg' : 'opacity-80'}`}
                    >
                        <div className="flex items-center gap-2 mb-2 w-full">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }}></div>
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-tighter truncate">{config.label}</span>
                        </div>
                        <MiniPaymentPie
                            data={data[key] || []}
                            color={config.color}
                            level={level}
                            metricLabel={config.label}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

const MiniPaymentPie = ({ data, color, level, metricLabel }) => {
    const LEVEL_LABELS = {
        district: 'District', mandal: 'Mandal', village: 'Village',
        voID: 'VO', clusterID: 'CC', shg_mbk_id: 'SHG'
    };
    const levelLabel = LEVEL_LABELS[level] || level || 'Group';

    const cleanData = (data || []).filter(d => {
        if (!d.name || d.value <= 0) return false;
        const name = String(d.name).toUpperCase().trim();
        if (['UNKNOWN', 'N/A', '', 'NULL', 'UNDEFINED'].includes(name)) return false;

        if (['district', 'mandal', 'village'].includes(level)) {
            if (/^\d+$/.test(d.name)) return false;
        }

        if (/^\d{10,}$/.test(d.name)) return false;
        return true;
    });

    const COLORS = [
        '#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6',
        '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6',
        '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#d946ef',
        '#64748b', '#1e293b', '#0f172a', '#475569', '#334155',
        '#7c3aed', '#db2777', '#dc2626', '#ca8a04', '#16a34a'
    ];
    const total = cleanData.reduce((a, b) => a + (b.value || 0), 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-2xl z-[1000]">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 border-b border-white/5 pb-1">
                        {levelLabel}
                    </p>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white truncate max-w-[120px]">{item.name || item.label}</p>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-[8px] text-slate-400 uppercase">{metricLabel}</span>
                            <span className="text-[9px] font-black text-white">{formatIndianCurrency(item.value)}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!cleanData.length) {
        return (
            <div className="w-full aspect-square relative min-h-[120px] flex flex-col items-center justify-center opacity-40">
                <div className="w-16 h-16 rounded-full border-4 border-dashed border-gray-200 animate-[spin_10s_linear_infinite]"></div>
                <span className="text-[7px] font-black text-gray-400 uppercase mt-2 tracking-widest">No Records Found</span>
            </div>
        );
    }

    return (
        <div className="w-full aspect-square relative min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={cleanData}
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {cleanData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        content={<CustomTooltip />}
                        wrapperStyle={{ zIndex: 10001, outline: 'none' }}
                        useTranslate3d={true}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <span className="text-[7px] font-black text-gray-400 uppercase leading-none">Total</span>
                <span className="text-[10px] font-black text-gray-900 mt-1">{formatIndianCurrency(total)}</span>
            </div>
        </div>
    );
};

const UploadCompletionPieChart = ({ conversion, month, year }) => {
    if (!conversion) return null;

    const { bothPagesCount = 0, page1OnlyCount = 0, page2OnlyCount = 0 } = conversion;
    const total = bothPagesCount + page1OnlyCount + page2OnlyCount;

    const currYear = parseInt(year);
    const currMonth = parseInt(month);
    const isAfterFeb2026 = (currYear > 2026) || (currYear === 2026 && currMonth > 2);

    const data = isAfterFeb2026 ? [
        { name: 'Complete (P1+P2)', value: bothPagesCount, color: '#10b981', label: 'సంఘం వివరాలు మరియు ఫైనాన్సియల్ లెడ్జర్ అప్లోడ్ అయినవి' },
        { name: 'Page 2 Pending', value: page1OnlyCount, color: '#f59e0b', label: 'ఫైనాన్సియల్ లెడ్జర్ అప్లోడ్ కావాల్సి ఉంది' },
        { name: 'Page 1 Pending', value: page2OnlyCount, color: '#6366f1', label: 'సంఘం వివరాలు అప్లోడ్ కావాల్సి ఉంది' }
    ] : [
        { name: 'Complete (Page 1)', value: bothPagesCount + page1OnlyCount, color: '#10b981', label: 'సంఘం వివరాలు అప్లోడ్ అయినవి (Feb 2026 నిబంధన)' },
        { name: 'Page 1 Pending', value: page2OnlyCount, color: '#6366f1', label: 'సంఘం వివరాలు అప్లోడ్ కావాల్సి ఉంది' }
    ];

    const filteredData = data.filter(d => d.value > 0 || total === 0);

    return (
        <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Page Upload Status</h4>
            <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <Pie
                            data={filteredData.length > 0 ? filteredData : [{ name: 'No Data', value: 1, color: '#f1f5f9' }]}
                            innerRadius={60}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {filteredData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip 
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1">{d.name}</p>
                                            <p className="text-lg font-black text-white leading-none mb-2">{d.value}</p>
                                            <p className="text-[9px] font-bold text-gray-400 border-t border-white/5 pt-2">{d.label}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
                {filteredData.map(d => (
                    <div key={d.name} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl group hover:bg-white transition-all shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-[10px] font-black text-gray-500 uppercase">{d.name}</span>
                        </div>
                        <span className="text-sm font-black" style={{ color: d.color }}>{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DEBUG_ID_MAP = {
    "17": "Member Savings",
    "31": "Revolving Fund",
    "36": "Aadhaar/Pension Grants",
    "19": "VO Share Capital",
    "26": "VO Savings",
    "33": "Streenidhi Shares",
    "38": "Bank/Other Deposits",
    "46": "VO Loan Recovery",
    "51": "Streenidhi Loan Recovery",
    "56": "Bank Loan Recovery",
    "61": "Unnathi Loan Recovery",
    "48": "VO Entrance Fee",
    "53": "Travel Expenses",
    "58": "Honorarium",
    "63": "Stationery/Audit",
    "68": "Bank Charges",
    "72": "Misc. Expenses",
    "76": "Member Returns",
    "80": "Member Interest Paid",
    "87": "Bank Interest",
    "91": "Deposit Interest",
    "89": "Bank Principal",
    "93": "Streenidhi Principal",
    "97": "Unnathi Principal",
    "101": "CIF Principal",
    "105": "VO Principal",
    "109": "Bank Interest Paid",
    "113": "Streenidhi Interest Paid"
};

const Page2FinanceBarChart = ({ data, breakdown, distributions, month, year }) => {
    const formatMonth = (m) => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months[parseInt(m) - 1] || m;
    };
    
    const safeData = data || {
        savingsReceived: 0,
        fundsReceived: 0,
        investments: 0,
        recoveriesReceived: 0,
        expenses: 0,
        incomesReceived: 0,
        loanRecoveriesPaid: 0
    };

    const safeBreakdown = breakdown || {};
    const safeDist = distributions || [];

    const chartData = [
        { name: 'Savings Received', value: safeData.savingsReceived, breakdown: safeBreakdown.savingsReceived || {}, color: '#6366f1', key: 'savingsReceived' },
        { name: 'Funds Received', value: safeData.fundsReceived, breakdown: safeBreakdown.fundsReceived || {}, color: '#8b5cf6', key: 'fundsReceived' },
        { name: 'Group Investments', value: safeData.investments, breakdown: safeBreakdown.investments || {}, color: '#ec4899', key: 'investments' },
        { name: 'Recoveries Received', value: safeData.recoveriesReceived, breakdown: safeBreakdown.recoveriesReceived || {}, color: '#f43f5e', key: 'recoveriesReceived' },
        { name: 'Group Expenses', value: safeData.expenses, breakdown: safeBreakdown.expenses || {}, color: '#f59e0b', key: 'expenses' },
        { name: 'Group Incomes', value: safeData.incomesReceived, breakdown: safeBreakdown.incomesReceived || {}, color: '#10b981', key: 'incomesReceived' },
        { name: 'Loan Recoveries Paid', value: safeData.loanRecoveriesPaid, breakdown: safeBreakdown.loanRecoveriesPaid || {}, color: '#3b82f6', key: 'loanRecoveriesPaid' }
    ];

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* 1. Manual Ledger Summary Card */}
            <div className="lg:col-span-2 bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 hover:shadow-2xl transition-all duration-500 overflow-hidden relative h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-indigo-600 shadow-lg shadow-indigo-200 rounded-2xl">
                            <BarChart2 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Manual Ledger Summary</h3>
                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Data for {formatMonth(month)} {year}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 backdrop-blur-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Live Financial Insights</span>
                    </div>
                </div>

                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/50 relative z-10">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Category Volume</span>
                        </div>
                    </div>
                    <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 65 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                    angle={-35}
                                    textAnchor="end"
                                    interval={0}
                                    height={70}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                    tickFormatter={(value) => formatIndianCurrency(value).replace('₹', '')}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                                    wrapperStyle={{ zIndex: 1000 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const entry = payload[0].payload;
                                            const breakdownItems = Object.entries(entry.breakdown || {});
                                            
                                            return (
                                                <div className="bg-white/95 backdrop-blur-md p-5 rounded-[24px] shadow-2xl border border-indigo-50 min-w-[240px] animate-in zoom-in-95 duration-200">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{entry.name}</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-slate-900 mb-4">{formatIndianCurrency(entry.value)}</p>
                                                    
                                                    {breakdownItems.length > 0 && (
                                                        <div className="space-y-3 pt-4 border-t border-slate-100">
                                                            {breakdownItems.map(([id, val]) => (
                                                                <div key={id} className="flex items-center justify-between group">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-indigo-600 transition-colors">{DEBUG_ID_MAP[id] || `Field ${id}`}</span>
                                                                    <span className="text-[11px] font-black text-slate-800">{formatIndianCurrency(val)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    radius={[12, 12, 4, 4]}
                                    isAnimationActive={true}
                                    barSize={40}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 2. Regional Contribution Card */}
            <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 hover:shadow-2xl transition-all duration-500 overflow-hidden relative h-full flex flex-col">
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/20 blur-[80px] rounded-full -ml-20 -mb-20 pointer-events-none" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-indigo-500 shadow-lg shadow-indigo-100 rounded-2xl">
                            <PieChartIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Regional Contribution</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/50 relative z-10 flex-1 overflow-y-auto custom-scrollbar">
                    {Object.keys(distributions || {}).some(k => (distributions[k] || []).length > 0) ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {chartData.map((catInfo, idx) => {
                                const distData = distributions[catInfo.key] || [];
                                if (distData.length === 0) return null;

                                const totalVal = distData.reduce((acc, cur) => acc + cur.value, 0);

                                // Per-category color palettes anchored to each category's accent color
                                const CAT_PALETTES = {
                                    savingsReceived:    ['#6366f1','#818cf8','#a5b4fc','#4f46e5','#3730a3','#4338ca','#7c3aed','#8b5cf6','#6d28d9','#c7d2fe'],
                                    fundsReceived:      ['#8b5cf6','#a78bfa','#c4b5fd','#7c3aed','#6d28d9','#9333ea','#a855f7','#c026d3','#d946ef','#e879f9'],
                                    investments:        ['#ec4899','#f472b6','#f9a8d4','#db2777','#be185d','#e11d48','#f43f5e','#fb7185','#fda4af','#ff6b81'],
                                    recoveriesReceived: ['#f43f5e','#fb7185','#fda4af','#e11d48','#be123c','#f97316','#fb923c','#fdba74','#ef4444','#dc2626'],
                                    expenses:           ['#f59e0b','#fbbf24','#fcd34d','#d97706','#b45309','#f97316','#fb923c','#ea580c','#c2410c','#ef4444'],
                                    incomesReceived:    ['#10b981','#34d399','#6ee7b7','#059669','#047857','#14b8a6','#2dd4bf','#06b6d4','#0891b2','#22c55e'],
                                    loanRecoveriesPaid: ['#3b82f6','#60a5fa','#93c5fd','#2563eb','#1d4ed8','#0ea5e9','#38bdf8','#7dd3fc','#06b6d4','#0891b2'],
                                };
                                const catColors = CAT_PALETTES[catInfo.key] || COLORS;

                                return (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className="flex items-center gap-2 mb-2 w-full pb-2 border-b" style={{ borderColor: catInfo.color + '33' }}>
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catInfo.color }} />
                                            <span className="text-[9px] font-black uppercase tracking-tighter truncate" style={{ color: catInfo.color }}>{catInfo.name}</span>
                                        </div>
                                        
                                        <div className="w-full aspect-square relative min-h-[120px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={distData}
                                                        innerRadius={35}
                                                        outerRadius={50}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {distData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={catColors[index % catColors.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        wrapperStyle={{ zIndex: 10001, outline: 'none' }}
                                                        useTranslate3d={true}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const { name, value } = payload[0].payload;
                                                                const percent = ((value / totalVal) * 100).toFixed(1);
                                                                return (
                                                                    <div className="bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-2xl border border-white/10 flex flex-col gap-0.5 items-start min-w-[120px]">
                                                                        <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: catInfo.color }}>{name}</span>
                                                                        <span className="text-sm font-black text-white">{formatIndianCurrency(value)}</span>
                                                                        <span className="text-[8px] font-bold text-slate-400">{percent}% of Category</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                                                <span className="text-[7px] font-black text-gray-400 uppercase leading-none">Total</span>
                                                <span className="text-[10px] font-black mt-1" style={{ color: catInfo.color }}>{formatIndianCurrency(totalVal)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-32">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center opacity-40 animate-pulse">
                                <Activity className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Awaiting Data</p>
                                <p className="text-sm font-bold text-slate-300">No categorical regional data found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DistributionCharts = ({ summary, month, year }) => {
    if (!summary) return null;

    const pieData = [
        { name: 'Uploaded', value: summary.shgStats.uploaded, color: '#10b981' },
        { name: 'Pending', value: summary.shgStats.pending, color: '#f59e0b' }
    ];

    const conversionData = [
        { name: 'Done', value: summary.conversion.converted, color: '#8b5cf6' },
        { name: 'Failed', value: summary.conversion.failed, color: '#ef4444' },
        { name: 'Pending', value: summary.conversion.pending, color: '#94a3b8' },
        { name: 'Processing', value: summary.conversion.processing, color: '#06b6d4' }
    ];

    return (
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-lg space-y-8 h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Capture Stats</h4>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                <Pie
                                    data={pieData}
                                    innerRadius={60}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2">
                        {pieData.map(d => (
                            <div key={d.name} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl">
                                <span className="text-[10px] font-black text-gray-500 uppercase">{d.name}</span>
                                <span className="text-sm font-black" style={{ color: d.color }}>{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Conversion Status</h4>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                <Pie
                                    data={conversionData}
                                    innerRadius={60}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {conversionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2">
                        {conversionData.map(d => (
                            <div key={d.name} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl">
                                <span className="text-[10px] font-black text-gray-500 uppercase">{d.name}</span>
                                <span className="text-sm font-black" style={{ color: d.color }}>{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* New Upload Completion Pie Chart */}
                <UploadCompletionPieChart conversion={summary.conversion} month={month} year={year} />
            </div>
        </div>
    );
};

const RowStats = ({ stats }) => (
    <>
        <td className="px-8 py-6">
            <div className="flex flex-col items-center gap-1.5">
                <div className="flex gap-2 items-center">
                    <span className="text-gray-900 font-black text-xs">{stats?.uploads?.uploaded || 0}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-400 font-bold text-[10px]">{stats?.uploads?.total || 0}</span>
                </div>
                <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${(stats?.uploads?.uploaded / Math.max(stats?.uploads?.total || 0, 1)) * 100}%` }}
                    ></div>
                </div>
            </div>
        </td>
        <td className="px-8 py-6">
            <div className="flex flex-col items-center gap-1.5">
                <div className="flex gap-1.5 font-black text-[10px]">
                    <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">{stats?.conversion?.converted || 0}C</span>
                    <span className="text-rose-500 bg-red-50 px-2 py-0.5 rounded-lg">{stats?.conversion?.failed || 0}F</span>
                </div>
            </div>
        </td>
    </>
);

const HierarchicalRow = ({ item, handleDetailedDownload, level = 0, filters, refreshKey }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState(item.children || []);
    const [loadingChildren, setLoadingChildren] = useState(false);
    const hasChildren = (item.role === 'APM' || item.role === 'CC') &&
        (item.hasChildren || (item.children && item.children.length > 0));

    const fetchChildren = async (force = false) => {
        if (!force && children.length > 0) return;
        if (!hasChildren) return;

        setLoadingChildren(true);
        try {
            const token = localStorage.getItem('token');
            const nextLevel = item.role.toLowerCase();
            const parentId = item.role === 'APM' ? (item.userID || item.id) : (item.role === 'CC' ? (item.clusterID || item.id) : (item.voID || item.id));

            const params = new URLSearchParams({
                ...filters,
                level: nextLevel,
                parentId: parentId
            }).toString();

            const res = await fetch(`${API_BASE}/api/analytics/v2/hierarchy?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setChildren(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch children:", err);
        } finally {
            setLoadingChildren(false);
        }
    };

    const getLoadingText = () => {
        if (item.role === 'APM') return "Loading Clusters...";
        if (item.role === 'CC') return "Loading VOs...";
        return "Loading...";
    };

    useEffect(() => {
        if (isExpanded) {
            fetchChildren(true);
        }
    }, [isExpanded, refreshKey]);

    const getIcon = () => {
        if (item.role === 'APM') return <Shield className="w-4 h-4 text-indigo-600" />;
        if (item.role === 'CC') return <Users className="w-4 h-4 text-emerald-600" />;
        return <User className="w-4 h-4 text-gray-400" />;
    };

    return (
        <>
            <tr className={`hover:bg-gray-50/80 transition-all border-b border-gray-100/50 group ${level === 0 ? 'bg-indigo-50/20 font-black' : level === 1 ? 'bg-emerald-50/5 font-bold' : ''}`}>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-4" style={{ paddingLeft: `${level * 24}px` }}>
                        <div className="flex items-center gap-3">
                            {hasChildren ? (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1 hover:bg-white rounded-lg transition-all shadow-sm border border-gray-100"
                                >
                                    {isExpanded ? <ChevronDown className="w-3 h-3 text-indigo-600" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                                </button>
                            ) : (
                                <div className="w-5" />
                            )}
                            <div className={`p-2 rounded-xl scale-90 ${level === 0 ? 'bg-indigo-100' : level === 1 ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                {getIcon()}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-sm tracking-tight ${level === 0 ? 'text-indigo-900 underline decoration-indigo-200 underline-offset-4' : 'text-gray-900'}`}>
                                    {item.name}
                                </span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                    <span className="text-indigo-600 font-black">
                                        {item.role === 'VO' ? `VO:${item.voID}` : (item.role === 'CC' ? `CID:${item.clusterID}` : (item.role === 'APM' ? `UID:${item.userID}` : ''))}
                                    </span>
                                    <span className="text-gray-300">|</span>
                                    {item.details}
                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${level === 0 ? 'bg-indigo-600 text-white' : level === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{item.role}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </td>
                <RowStats stats={item.stats} />
                <td className="px-8 py-6 text-center">
                    {(item.role === 'VO' || item.role === 'CC' || item.role === 'APM') && (
                        <button
                            onClick={() => handleDetailedDownload(item, children)}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 inline-flex items-center gap-2 group/btn"
                            title={`Download Detailed Finance Excel for ${item.role}`}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                </td>
            </tr>
            {isExpanded && loadingChildren && (
                <tr>
                    <td colSpan="4" className="px-8 py-4">
                        <div className="flex items-center gap-3" style={{ paddingLeft: `${(level + 1) * 24}px` }}>
                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">{getLoadingText()}</span>
                        </div>
                    </td>
                </tr>
            )}
            {hasChildren && isExpanded && children.map(child => (
                <HierarchicalRow key={child.id} item={child} handleDetailedDownload={handleDetailedDownload} level={level + 1} filters={filters} refreshKey={refreshKey} />
            ))}
        </>
    );
};

const DetailedTable = ({ data, loading, handleDetailedDownload, filters, refreshKey, isSSEConnected }) => {
    return (
        <div className="bg-white/80 backdrop-blur-md rounded-[32px] shadow-lg border border-white/20 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Users</h3>
                <div className="flex items-center gap-3">
                    {isSSEConnected && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-pulse">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
                        </div>
                    )}
                    <div className="flex items-center bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                        <Users className="w-4 h-4 text-indigo-600 ml-2 mr-2" />
                        <span className="px-3 py-1 text-[10px] font-black text-gray-900 uppercase tracking-widest border-l border-gray-100">{data?.length || 0} Units Tracked</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full text-left min-w-[1000px]">
                    <thead>
                        <tr className="bg-indigo-900 text-white">
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-left">User (Hierarchy)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Uploads (U/P/T)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Conversion (C/F)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Initializing Dashboard...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data?.length > 0 ? (
                            data.map((item) => <HierarchicalRow key={item.id} item={item} handleDetailedDownload={handleDetailedDownload} filters={filters} refreshKey={refreshKey} />)
                        ) : (
                            <tr>
                                <td colSpan="6" className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-6 bg-gray-50 rounded-[32px]">
                                            <List className="w-12 h-12 text-gray-200" />
                                        </div>
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">No Activity Records Found</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AnalyticsPage;