import React, { useState, useEffect, useMemo } from 'react';
import {
    Download, FileBarChart, ChartPie as PieChartIcon, Activity, Clock, CheckCircle,
    FileText, Filter, LayoutGrid, List, ChevronRight, AlertCircle,
    TrendingUp, Users, MapPin, Calendar, ArrowUpRight, ArrowDownRight,
    Shield, User, ChevronDown, Loader2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { API_BASE } from '../utils/apiConfig';

const formatIndianCurrency = (value) => {
    if (value === null || value === undefined) return '₹0';
    const absVal = Math.abs(value);
    if (absVal >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (absVal >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (absVal >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${Math.floor(value)}`;
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

    // UI State
    const [activeView, setActiveView] = useState('charts'); // charts, table
    const [activeMetric, setActiveMetric] = useState('totalCollections');
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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
                const params = new URLSearchParams(filters).toString();

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

                // If any response is stale, set isRefreshing to true
                setIsRefreshing(
                    sumData.stale ||
                    trendData.stale ||
                    paymentResData.stale ||
                    paymentTrendData.stale
                );
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            }
        };

        fetchGlobalStats();
    }, [filters]);

    // Fetch Table Data
    useEffect(() => {
        const fetchTable = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const params = new URLSearchParams({ ...filters }).toString();

                const res = await fetch(`${API_BASE}/api/analytics/v2/table?${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.success) {
                    setTableData(data.hierarchy || []);
                    if (data.stale) setIsRefreshing(true);
                }
            } catch (err) {
                setError("Could not load detailed table data.");
            } finally {
                setLoading(false);
            }
        };

        fetchTable();
    }, [filters]);

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

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto pr-4">
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
                        className="flex items-center gap-3 px-2 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all hover:scale-[1.02] active:scale-95 border border-indigo-500/50 shadow-[0_0_25px_rgba(79,70,229,0.3)]"
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
                    summary={{
                        ...(summary?.mapStats || {}),
                        all: {
                            uploaded: summary?.shgStats?.uploaded,
                            pending: summary?.shgStats?.pending,
                            total: summary?.shgStats?.total,
                            approved: summary?.ccActions?.approved,
                            rejected: summary?.ccActions?.rejected,
                            ccPending: summary?.ccActions?.pending,
                            converted: summary?.conversion?.converted,
                            failed: summary?.conversion?.failed,
                            convPending: summary?.conversion?.pending,
                            convProcessing: summary?.conversion?.processing,
                            financeStats: paymentData?.financeStats
                        }
                    }}
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
                    <FinanceAnalytics
                        data={paymentData}
                        activeMetric={activeMetric}
                        onMetricChange={setActiveMetric}
                        isExpanded={isCollectionsExpanded}
                        setIsExpanded={setIsCollectionsExpanded}
                    />

                    {/* Unified Multi-Metric Visualization - Perfect Alignment */}
                    <div className="flex flex-col xl:flex-row gap-8 items-stretch">
                        <div className="flex-1 min-h-[500px] flex flex-col">
                            <PaymentTrendChart data={paymentTrends} />
                        </div>
                        <div className="xl:w-[400px] flex flex-col">
                            <UnifiedDistributionCard
                                data={paymentData?.distributions}
                                activeMetric={activeMetric}
                                level={filters.village !== 'all' ? 'cc' : filters.mandal !== 'all' ? 'village' : filters.district !== 'all' ? 'mandal' : 'district'}
                            />
                        </div>
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

    // Initialize APM filters if needed
    useEffect(() => {
        if (isAPM) {
            if (user.district && (!selectedDistrict || selectedDistrict === 'all')) {
                setSelectedDistrict(user.district);
            }
            if (user.mandal && (!selectedMandal || selectedMandal === 'all')) {
                setSelectedMandal(user.mandal);
            }
        }
    }, [isAPM, user.district, user.mandal, setSelectedDistrict, setSelectedMandal]);

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
                        <label className={labelStyle}>Mandal</label>
                        <div className="relative">
                            <select
                                value={selectedMandal}
                                onChange={(e) => {
                                    setSelectedMandal(e.target.value);
                                    setSelectedVillage('all');
                                }}
                                className={selectStyle}
                            >
                                <option value="all" className="bg-[#1a1c4b] text-white">All Mandals</option>
                                {locations.mandals.map(m => <option key={m.id} value={m.name} className="bg-[#1a1c4b] text-white">{m.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400/50 pointer-events-none" />
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
                <label className={labelStyle}>Village</label>
                <div className="relative">
                    <select
                        value={selectedVillage}
                        onChange={(e) => setSelectedVillage(e.target.value)}
                        className={selectStyle}
                    >
                        <option value="all" className="bg-[#1a1c4b] text-white">All Villages</option>
                        {locations.villages.map(v => <option key={v.id} value={v.name} className="bg-[#1a1c4b] text-white">{v.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400/50 pointer-events-none" />
                </div>
            </div>
        </div>
    );
};

const FinanceAnalytics = ({ data, activeMetric, onMetricChange, isExpanded, setIsExpanded }) => {
    if (!data || !data.financeStats) return null;

    const {
        totalSavings, totalLoanRecovered,
        totalLoansTaken, totalSavingsRepaid,
        totalPenalties, loanRecoveryBreakdown,
        loanCount
    } = data.financeStats;

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
                            ₹{totalLoanRecovered.toLocaleString('en-IN')}
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
                                { label: 'Bank Loan', val: loanRecoveryBreakdown.bankLoan },
                                { label: 'SHG Internal', val: loanRecoveryBreakdown.shgInternal },
                                { label: 'Streenidhi Micro', val: loanRecoveryBreakdown.streenidhiMicro },
                                { label: 'Streenidhi Tenny', val: loanRecoveryBreakdown.streenidhiTenni },
                                { label: 'Unnati (SCSP)', val: loanRecoveryBreakdown.unnatiSCSP },
                                { label: 'Unnati (TSP)', val: loanRecoveryBreakdown.unnatiTSP },
                                { label: 'CIF Loan', val: loanRecoveryBreakdown.cif },
                                { label: 'VO Internal', val: loanRecoveryBreakdown.voInternal }
                            ].map((item) => (
                                <div key={item.label} className="flex justify-between items-center group/item hover:bg-gray-50 p-1 rounded-lg transition-colors">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover/item:text-gray-600 transition-colors">{item.label}</span>
                                    <span className="text-[11px] font-black text-gray-900">₹{item.val.toLocaleString('en-IN')}</span>
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
                <h4 className="text-2xl font-black text-gray-900">₹{totalSavings.toLocaleString('en-IN')}</h4>
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
                <h4 className="text-2xl font-black text-gray-900">₹{totalLoansTaken.toLocaleString('en-IN')}</h4>
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
                <h4 className="text-2xl font-black text-gray-900">₹{totalSavingsRepaid.toLocaleString('en-IN')}</h4>
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
                <h4 className="text-2xl font-black text-gray-900">₹{totalPenalties.toLocaleString('en-IN')}</h4>
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
    // Broad, high-contrast palette for many segments (20-30+)
    const COLORS = [
        '#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6',
        '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6',
        '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#d946ef',
        '#64748b', '#1e293b', '#0f172a', '#475569', '#334155',
        '#020617', '#111827', '#1f2937', '#374151', '#4b5563',
        '#7c3aed', '#db2777', '#dc2626', '#ca8a04', '#16a34a'
    ];
    const total = data.reduce((a, b) => a + (b.value || 0), 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-2xl z-[1000]">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 border-b border-white/5 pb-1">
                        {level.toUpperCase()}
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

    return (
        <div className="w-full aspect-square relative min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
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
                    <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{stats?.conversion?.pending || 0}P</span>
                    <span className="text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg">{stats?.conversion?.processing || 0}Pr</span>
                </div>
            </div>
        </td>
    </>
);

const HierarchicalRow = ({ item, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(level < 1); // APM expanded by default
    const hasChildren = item.children && item.children.length > 0;

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
                                    {item.details}
                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${level === 0 ? 'bg-indigo-600 text-white' : level === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{item.role}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </td>
                <RowStats stats={item.stats} />
            </tr>
            {hasChildren && isExpanded && item.children.map(child => (
                <HierarchicalRow key={child.id} item={child} level={level + 1} />
            ))}
        </>
    );
};

const DetailedTable = ({ data, loading }) => {
    return (
        <div className="bg-white/80 backdrop-blur-md rounded-[32px] shadow-lg border border-white/20 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Users</h3>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                        <Users className="w-4 h-4 text-indigo-600 ml-2 mr-2" />
                        <span className="px-3 py-1 text-[10px] font-black text-gray-900 uppercase tracking-widest border-l border-gray-100">{data?.length || 0} Units Tracked</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-indigo-900 text-white">
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-left">User (Hierarchy)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Uploads (U/P/T)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Approved (A/R/P)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Conversion (C/F/P/Pr)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Reconstructing Hierarchy...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data?.length > 0 ? (
                            data.map((item) => <HierarchicalRow key={item.id} item={item} />)
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-8 py-32 text-center">
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
