import React, { useState, useEffect, useMemo } from 'react';
import {
    Download, FileBarChart, ChartPie as PieChartIcon, Activity, Clock, CheckCircle,
    FileText, Filter, LayoutGrid, List, ChevronRight, AlertCircle,
    TrendingUp, Users, MapPin, Calendar, ArrowUpRight, ArrowDownRight,
    Shield, User, ChevronDown, Loader2, Database
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { API_BASE } from '../utils/apiConfig';
import { exportPerformanceExcel, exportCumulativeExcel } from '../utils/excelGenerator';

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

            // inflow = sum of all recoveries + savings + penalties
            const inflow = (stats.totalCollections || 0) + (stats.totalSavings || 0) +
                (stats.totalPenalties || 0) + (stats.otherSavings || 0);

            // outflow = loans taken + returns
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
    const [activeView, setActiveView] = useState('charts'); // charts, table
    const [activeMetric, setActiveMetric] = useState('totalCollections');
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isSSEConnected, setIsSSEConnected] = useState(false);

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
        const fetchGlobalStats = async () => {
            try {
                const token = localStorage.getItem('token');
                // When a geographic filter is active, always bypass stale cache
                const isFiltered = filters.district !== 'all' || filters.mandal !== 'all' || filters.village !== 'all';
                const params = new URLSearchParams({
                    ...filters,
                    ...(isFiltered ? { refresh: 'true' } : {})
                }).toString();

                // Clear stale map data immediately when switching filters so
                // the old district's values don't flash before the new ones load.
                if (isFiltered) {
                    setSummary(null);
                    setPaymentData(null);
                }

                const [sumRes, trendRes, paymentRes, paymentTrendRes] = await Promise.all([
                    fetch(`${API_BASE}/api/analytics/v2/summary?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE}/api/analytics/v2/trends?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE}/api/payments/summary?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE}/api/payments/trends?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                const sumData = await sumRes.json();
                const trendData = await trendRes.json();
                const paymentResData = await paymentRes.json();
                const paymentTrendData = await paymentTrendRes.json();

                if (sumData.success) setSummary(sumData.summary);
                if (trendData.success) setTrends(trendData.data);
                if (paymentResData.success) setPaymentData(paymentResData.data);
                if (paymentTrendData.success) setPaymentTrends(paymentTrendData.data);

                // Only mark as refreshing for non-filtered (global) views — filtered views are always live
                setIsRefreshing(!isFiltered && (
                    sumData.stale ||
                    trendData.stale ||
                    paymentResData.stale ||
                    paymentTrendData.stale
                ));
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            }
        };

        fetchGlobalStats();
    }, [filters, refreshKey]);


    // SSE Real-time Updates
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const url = `${API_BASE}/api/analytics/v2/stream?token=${token}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            if (event.data === 'refresh') {
                console.log("Real-time refresh signal received");
                setRefreshKey(prev => prev + 1);
            } else if (event.data === 'connected') {
                setIsSSEConnected(true);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Error:", err);
            setIsSSEConnected(false);
            eventSource.close();
        };

        return () => eventSource.close();
    }, []);

    // Fetch History for Cumulative Summary
    useEffect(() => {
        const fetchHistory = async () => {
            setIsHistoryLoading(true);
            try {
                const token = localStorage.getItem('token');
                const historyParams = { ...filters };
                // Ensure history always shows up to the current month for the selected year
                const now = new Date();
                if (parseInt(filters.year) === now.getFullYear()) {
                    historyParams.month = now.getMonth() + 1;
                } else {
                    historyParams.month = 12; // Show full year for past years
                }

                const params = new URLSearchParams(historyParams).toString();

                const res = await fetch(`${API_BASE}/api/payments/history?${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setHistoryData(data.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
            } finally {
                setIsHistoryLoading(false);
            }
        };

        fetchHistory();
    }, [filters, refreshKey]);

    // Fetch Initial Table Data (Root Level Only)
    useEffect(() => {
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
    }, [filters, refreshKey]);

    /*
    useEffect(() => {
        let interval;
        if (isRefreshing) {
            interval = setInterval(() => {
                setRefreshKey(prev => prev + 1);
            }, 5000); // 5 seconds
        }
        return () => clearInterval(interval);
    }, [isRefreshing]);
    */

    const handleDownload = async () => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_BASE}/api/analytics/v2/download?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Analytics_Report_${filters.year}_${filters.month}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            alert("Failed to download report.");
        }
    };

    const handleDetailedDownload = async (item, loadedChildren = []) => {
        try {
            const token = localStorage.getItem('token');
            const isVO = item.role === 'VO';
            const isCC = item.role === 'CC';
            const isAPM = item.role === 'APM';

            const baseParams = {
                district: item.location?.district || filters.district || 'all',
                mandal: item.location?.mandal || filters.mandal || 'all',
                month: filters.month,
                year: filters.year,
                refresh: 'true'
            };

            if (isAPM) {
                // Use the already-loaded hierarchy children from HierarchicalRow state.
                // These have the correct CC names (same as what shows in the table) and clusterIDs.
                // If not yet expanded, fetch them now using the same fetchChildren logic.
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

                // Extract clusterIDs and names exactly as hierarchy gives them
                const ccIDs = ccs.map(c => c.clusterID || c.id).filter(Boolean);

                const params = new URLSearchParams({
                    ...baseParams,
                    groupBy: 'clusterID',
                    filterField: 'mandal',
                    filterId: item.location?.mandal || filters.mandal,
                    ccIDs: ccIDs.join(',')
                }).toString();

                const response = await fetch(`${API_BASE}/api/payments/breakdown?${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                    if (data.coldStart) {
                        alert('⏳ Financial data is still being calculated for this month. Please retry in 15–30 seconds to get the full data.');
                        return;
                    }
                    exportPerformanceExcel(data.data, data.level, ccs, item);
                } else {
                    alert(data.message || "Failed to fetch CC data");
                }

            } else if (isCC) {
                // CC -> VOs, filter by clusterID
                const params = new URLSearchParams({
                    ...baseParams,
                    groupBy: 'voID',
                    filterField: 'clusterID',
                    filterId: item.clusterID || item.id
                }).toString();
                const response = await fetch(`${API_BASE}/api/payments/breakdown?${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                    if (data.coldStart) {
                        alert('⏳ Financial data is still being calculated for this month. Please retry in 15–30 seconds to get the full data.');
                        return;
                    }
                    exportPerformanceExcel(data.data, data.level, [], item);
                } else {
                    alert(data.message || "Failed to fetch VO data");
                }

            } else if (isVO) {
                // VO download → Excel contains SHG rows (groupBy shg_mbk_id)
                const voParams = new URLSearchParams({
                    ...baseParams,
                    groupBy: 'shg_mbk_id',
                    filterField: 'voID',
                    filterId: item.voID || item.id
                }).toString();
                const voResponse = await fetch(`${API_BASE}/api/payments/breakdown?${voParams}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const voData = await voResponse.json();
                if (voData.success) {
                    if (voData.coldStart) {
                        alert('⏳ Financial data is still being calculated for this month. Please retry in 15–30 seconds to get the full data.');
                        return;
                    }
                    exportPerformanceExcel(voData.data, voData.level, [], item);
                } else {
                    alert(voData.message || "Failed to fetch VO data");
                }
            } else {
                // fallback (should not reach for known roles)
                alert("Download not supported for this level.");
            }
        } catch (err) {
            console.error("Download Error:", err);
            alert("Failed to download detailed report.");
        }
    };

    return (
        <div className="min-h-screen text-white p-4 lg:p-8 animate-in fade-in duration-700 pb-16">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row bg-white/[0.03] backdrop-blur-3xl p-8 rounded-[32px] border border-white/10 shadow-2xl justify-between items-start lg:items-center gap-6 mb-8">
                <div className="w-[25rem]">
                    <h2 className="text-5xl font-black text-white px-2 tracking-tighter flex items-center gap-3 drop-shadow-2xl">
                        Analytics
                        {isRefreshing && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full animate-pulse ml-4">
                                <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Refreshing</span>
                            </div>
                        )}
                    </h2>
                </div>

                <div className="flex flex-nowrap items-center gap-2 w-full lg:w-auto pr-4">
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

                    <button
                        onClick={handleDownload}
                        className="flex shrink-0 items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all hover:scale-[1.02] active:scale-95 border border-indigo-500/50 shadow-[0_0_25px_rgba(79,70,229,0.3)]"
                    >
                        <Download className="w-4 h-4" />
                        Download Report
                    </button>
                </div>
            </div>

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
                                rejected: summary?.ccActions?.rejected,
                                ccPending: summary?.ccActions?.pending,
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

            {/* Sections based on Active View */}
            {/* Removed Metric Summary Cards per user request */}

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

                    {/* Unified Multi-Metric Visualization - Perfect Alignment */}
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

                    {/* Cumulative Financial Summary */}
                    <div className="mb-8">
                        <CumulativeFinanceSummary
                            history={historyData}
                            loading={isHistoryLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TrendChart data={trends} />
                        <DistributionCharts summary={summary} />
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

            {/* Always show a small summary if in chart view etc? No, let's keep it toggleable. */}
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

    // Initialize scoped filters for APM and CC roles
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

    // Load location logic
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

            {/* Time Filters */}
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

            {/* Location Filters - Role Adaptive */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Collections Breakdown */}
            <div
                onClick={() => onMetricChange('totalCollections')}
                className={`bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border transition-all duration-300 cursor-pointer overflow-hidden group shadow-xl hover:shadow-2xl ${activeMetric === 'totalCollections' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/20'}`}
            >
                <div
                    className="flex justify-between items-center group/header"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                        onMetricChange('totalCollections');
                        document.getElementById('chart-totalCollections')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                >
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Total Collections</p>
                        <h4 className="text-2xl font-black text-gray-900 group-hover/header:text-indigo-600 transition-colors">
                            ₹{formatFull(totalLoanRecovered)}
                        </h4>
                    </div>
                    <div className={`p-3 rounded-2xl transition-all duration-300 ${isExpanded ? 'bg-indigo-600 text-white rotate-180' : 'bg-indigo-50 text-indigo-600 group-hover/header:bg-indigo-100'}`}>
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
                                <div key={item.label} className="flex justify-between items-center group/item hover:bg-gray-50 p-1 rounded-lg transition-colors">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover/item:text-gray-600 transition-colors">{item.label}</span>
                                    <span className="text-[11px] font-black text-gray-900">₹{formatFull(item.val)}</span>
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
                className={`bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'memberDeposits' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Member Deposits</p>
                <h4 className="text-2xl font-black text-gray-900">₹{formatFull(totalSavings)}</h4>
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
                className={`bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'loansSanctioned' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-white/20'}`}
            >
                <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Loans Sanctioned</p>
                    <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-rose-100">
                        {loanCount || 0} Loans
                    </span>
                </div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Number of loans taken</p>
                <h4 className="text-2xl font-black text-gray-900">₹{formatFull(totalLoansTaken)}</h4>
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
                className={`bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'savingsWithdrawal' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Savings Withdrawal</p>
                <h4 className="text-2xl font-black text-gray-900">₹{formatFull(totalReturned)}</h4>
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
                className={`bg-white/90 backdrop-blur-xl p-6 rounded-[32px] border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl ${activeMetric === 'latePenalties' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-white/20'}`}
            >
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Late Penalties</p>
                <h4 className="text-2xl font-black text-gray-900">₹{formatFull(totalPenalties)}</h4>
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

    // Filter out unknown/empty/NA/numeric IDs more robustly
    const cleanData = (data || []).filter(d => {
        if (!d.name || d.value <= 0) return false;
        const name = String(d.name).toUpperCase().trim();
        if (['UNKNOWN', 'N/A', '', 'NULL', 'UNDEFINED'].includes(name)) return false;

        // GEOGRAPHIC NUMERIC GUARD: Skip numeric strings if we are viewing geography levels
        // This prevents raw IDs from leaking as Mandal/District/Village names
        if (['district', 'mandal', 'village'].includes(level)) {
            if (/^\d+$/.test(d.name)) return false;
        }

        // Also skip numeric strings that look like long IDs (large numbers) for other levels
        if (/^\d{10,}$/.test(d.name)) return false;
        return true;
    });

    // Broad, high-contrast palette for many segments (20-30+)
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

const DistributionCharts = ({ summary }) => {
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
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-lg space-y-8">
            <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Capture Stats</h4>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={60}
                                    outerRadius={80}
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
                            <PieChart>
                                <Pie
                                    data={conversionData}
                                    innerRadius={60}
                                    outerRadius={80}
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
                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{stats?.ccActions?.approved || 0}A</span>
                    <span className="text-rose-500 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{stats?.ccActions?.rejected || 0}R</span>
                    <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">{stats?.ccActions?.pending || 0}P</span>
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
    // VOs do NOT expand in the table (SHGs are only in the downloaded Excel)
    const hasChildren = item.role !== 'VO' && (item.hasChildren || (item.children && item.children.length > 0));

    const fetchChildren = async (force = false) => {
        if (!force && children.length > 0) return;
        if (!hasChildren) return;

        setLoadingChildren(true);
        try {
            const token = localStorage.getItem('token');
            // Level mapping: 
            // If current item is APM, we want its children (CCs) -> level='apm'
            // If current item is CC, we want its children (VOs) -> level='cc'
            // If current item is VO, we want its children (SHGs) -> level='vo'
            const nextLevel = item.role.toLowerCase();
            // Refined parentId logic: APMs use userID, CCs use clusterID, VOs use voID
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
        if (item.role === 'VO') return "Loading SHGs...";
        return "Loading...";
    };

    useEffect(() => {
        if (isExpanded) {
            fetchChildren(true); // Force refresh if already expanded
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
                    <td colSpan="5" className="px-8 py-4">
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
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Approved (A/R/P)</th>
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
