import React, { useState, useEffect, useMemo } from 'react';
import {
    Download, FileBarChart, PieChart, Activity, Clock, CheckCircle,
    FileText, Filter, LayoutGrid, List, ChevronRight, AlertCircle,
    TrendingUp, Users, MapPin, Calendar, ArrowUpRight, ArrowDownRight,
    Shield, User, ChevronDown, Loader2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { API_BASE } from '../utils/apiConfig';

const AnalyticsPage = () => {
    // Local Stats State
    const [summary, setSummary] = useState(null);
    const [trends, setTrends] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter State
    const [filters, setFilters] = useState({
        district: 'all',
        mandal: 'all',
        village: 'all',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    // UI State
    const [activeView, setActiveView] = useState('charts'); // charts, table

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

    // Fetch Summary & Trends
    useEffect(() => {
        const fetchGlobalStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const params = new URLSearchParams(filters).toString();

                const [sumRes, trendRes] = await Promise.all([
                    fetch(`${API_BASE}/api/analytics/v2/summary?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE}/api/analytics/v2/trends?${params}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                const sumData = await sumRes.json();
                const trendData = await trendRes.json();

                if (sumData.success) setSummary(sumData.summary);
                if (trendData.success) setTrends(trendData.data);
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
                    setTableData(data.data);
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
        <div className="space-y-8 animate-in fade-in duration-700 pb-16">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        Analytics
                    </h2>
                    <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        Live System Pulse & Behavioral Intelligence
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-gray-200">
                        {[
                            { id: 'charts', icon: PieChart, label: 'Performance Charts' },
                            { id: 'table', icon: List, label: 'Unit Performance Details' }
                        ].map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setActiveView(v.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeView === v.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                            >
                                <v.icon className="w-4 h-4" />
                                {v.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all hover:-translate-y-1 active:scale-95 border-2 border-indigo-500 shadow-lg shadow-indigo-100"
                    >
                        <Download className="w-4 h-4" />
                        Download Report
                    </button>
                </div>
            </div>

            {/* Role-Adaptive Filter Bar */}
            <AnalyticsFilters filters={filters} setFilters={setFilters} user={user} />

            {/* Sections based on Active View */}
            {/* Removed Metric Summary Cards per user request */}

            {activeView === 'charts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <TrendChart data={trends} />
                    <DistributionCharts summary={summary} />
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

const AnalyticsFilters = ({ filters, setFilters, user }) => {
    const [locations, setLocations] = useState({ districts: [], mandals: [], villages: [] });
    const role = (user.role || '').toLowerCase();

    // Load location logic (Same as DashboardTab)
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
        if (filters.district !== 'all') {
            const loadMandals = async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/mandals?district=${filters.district}`);
                    const data = await res.json();
                    if (data.success) setLocations(prev => ({ ...prev, mandals: data.mandals }));
                } catch { }
            };
            loadMandals();
        }
    }, [filters.district]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[32px] border border-white/20 shadow-lg">
            {/* Time Filters */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Period (Month)</label>
                <select
                    value={filters.month}
                    onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none transition-all"
                >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Context (Year)</label>
                <select
                    value={filters.year}
                    onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none transition-all"
                >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Location Filters - Role Adaptive */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Regional (District)</label>
                <select
                    value={filters.district}
                    disabled={role.includes('apm') || role.includes('cc')}
                    onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value, mandal: 'all', village: 'all' }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                >
                    <option value="all">All Districts</option>
                    {locations.districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Administrative (Mandal)</label>
                <select
                    value={filters.mandal}
                    disabled={role.includes('cc') || (role.includes('apm') && filters.mandal !== 'all')}
                    onChange={(e) => setFilters(prev => ({ ...prev, mandal: e.target.value, village: 'all' }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                >
                    <option value="all">All Mandals</option>
                    {locations.mandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Locale (Village)</label>
                <select
                    value={filters.village}
                    onChange={(e) => setFilters(prev => ({ ...prev, village: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none transition-all"
                >
                    <option value="all">All Villages</option>
                    {locations.villages.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
            </div>
        </div>
    );
};

const MetricCards = ({ summary, loading }) => {
    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-44 bg-gray-100 animate-pulse rounded-[32px]"></div>
            ))}
        </div>
    );

    const cards = [
        { label: "Deployment Scope", value: summary.totalVOs, sub: "Active VO Units", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Upload Velocity", value: summary.shgStats.uploaded, sub: `${summary.shgStats.total} Total Targets`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "CC Verification", value: summary.ccActions.approved, sub: `${summary.ccActions.pending} Pending Action`, icon: CheckCircle, color: "text-indigo-600", bg: "bg-indigo-50" },
        { label: "Digital Success", value: summary.conversion.converted, sub: "Successfully Converted", icon: Activity, color: "text-purple-600", bg: "bg-purple-50" }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((c, i) => (
                <div key={i} className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] border border-white/30 hover:-translate-y-1 transition-all group overflow-hidden relative">
                    <div className={`absolute top-0 right-0 w-32 h-32 ${c.bg} rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 opacity-50`}></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{c.label}</p>
                            <h4 className="text-4xl font-black text-gray-900 mb-2">{c.value.toLocaleString()}</h4>
                            <p className="text-xs font-bold text-gray-500">{c.sub}</p>
                        </div>
                        <div className={`${c.bg} ${c.color} p-4 rounded-2xl group-hover:rotate-12 transition-transform shadow-sm`}>
                            <c.icon size={28} />
                        </div>
                    </div>
                </div>
            ))}
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
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Upload Ingestion Trend</h3>
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

const DistributionCharts = ({ summary }) => {
    if (!summary) return null;

    const pieData = [
        { name: 'Uploaded', value: summary.shgStats.uploaded, color: '#10b981' },
        { name: 'Pending', value: summary.shgStats.pending, color: '#f59e0b' }
    ];

    const conversionData = [
        { name: 'Done', value: summary.conversion.converted, color: '#8b5cf6' },
        { name: 'Failed', value: summary.conversion.failed, color: '#ef4444' },
        { name: 'Pending', value: summary.conversion.pending, color: '#94a3b8' }
    ];

    return (
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-lg space-y-8">
            <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Capture Stats</h4>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
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
                            </RePieChart>
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
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Digital Integrity</h4>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
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
                            </RePieChart>
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
                <td className="px-8 py-6 text-right">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${(item.stats?.uploads?.pending || 0) === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {(item.stats?.uploads?.pending || 0) === 0 ? 'Optimal' : 'Active'}
                    </span>
                </td>
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
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Performance Hierarchy (APM &gt; CC &gt; VO)</h3>
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
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Conversion (C/F/P)</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-right">Status</th>
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
