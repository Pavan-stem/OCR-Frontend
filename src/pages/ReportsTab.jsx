import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Download, FileBarChart, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

const ReportsTab = ({ user }) => {
  const [filters, setFilters] = useState({
    district: 'all',
    mandal: 'all',
    village: 'all',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const [paymentData, setPaymentData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Request batching - use refs to avoid excessive requests
  const fetchTimeoutRef = useRef(null);
  const lastFetchParamsRef = useRef(null);

  // Debounced fetch function to prevent excessive API calls
  const fetchPaymentData = useCallback(async (filterParams) => {
    const paramsString = JSON.stringify(filterParams);

    // Don't fetch if params haven't changed
    if (lastFetchParamsRef.current === paramsString) {
      return;
    }

    lastFetchParamsRef.current = paramsString;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        district: filterParams.district || 'all',
        mandal: filterParams.mandal || 'all',
        village: filterParams.village || 'all',
        month: filterParams.month,
        year: filterParams.year
      });

      // Batch both requests together
      const [summaryRes, trendsRes] = await Promise.all([
        fetch(`/OCRtest/api/payments/summary?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/OCRtest/api/payments/trends?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!summaryRes.ok || !trendsRes.ok) {
        throw new Error('Failed to fetch payment data');
      }

      const [summaryData, trendsData] = await Promise.all([
        summaryRes.json(),
        trendsRes.json()
      ]);

      if (summaryData.success) {
        setPaymentData(summaryData.data);
        console.log('Payment data loaded:', summaryData.cached ? 'from cache' : 'fresh calculation');
      } else {
        throw new Error(summaryData.message || 'Failed to load payment summary');
      }

      if (trendsData.success) {
        setTrendData(trendsData.data);
      }

    } catch (err) {
      console.error('Payment data fetch error:', err);
      setError(err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced effect - only fetch after filters stabilize for 500ms
  useEffect(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchPaymentData(filters);
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [filters, fetchPaymentData]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Calculate totals from payment data
  const financeStats = useMemo(() => {
    return paymentData?.financeStats || {
      totalSavings: 0,
      totalBankLoanRepaid: 0,
      totalSHGInternalLoan: 0,
      grandTotal: 0
    };
  }, [paymentData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Payment Analytics</h2>
          <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">
            Financial insights and <span className="text-indigo-600 font-black">repayment trends</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[32px] border border-white/20 shadow-lg">
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Period (Month)</label>
          <select
            value={filters.month}
            onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 text-sm bg-white/90 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Context (Year)</label>
          <select
            value={filters.year}
            onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 text-sm bg-white/90 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
          >
            {[2026, 2025, 2024].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Regional (District)</label>
          <select
            value={filters.district}
            onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value, mandal: 'all', village: 'all' }))}
            className="w-full px-4 py-3 text-sm bg-white/90 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
          >
            <option value="all">All Districts</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Sub-Regional (Mandal)</label>
          <select
            value={filters.mandal}
            onChange={(e) => setFilters(prev => ({ ...prev, mandal: e.target.value, village: 'all' }))}
            disabled={filters.district === 'all'}
            className="w-full px-4 py-3 text-sm bg-white/90 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm disabled:opacity-50"
          >
            <option value="all">All Mandals</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Micro (Village)</label>
          <select
            value={filters.village}
            onChange={(e) => setFilters(prev => ({ ...prev, village: e.target.value }))}
            disabled={filters.mandal === 'all'}
            className="w-full px-4 py-3 text-sm bg-white/90 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm disabled:opacity-50"
          >
            <option value="all">All Villages</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[24px] p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-red-900 uppercase tracking-wide mb-1">Connection Error</h4>
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              onClick={() => fetchPaymentData(filters)}
              className="mt-3 text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-800 underline"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[24px] p-6 border border-blue-100 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            {loading && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-2">Total Savings</h3>
          <p className="text-2xl font-black text-blue-700">{formatCurrency(financeStats.totalSavings)}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-[24px] p-6 border border-emerald-100 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-500 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            {loading && <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-2">Loan Repayments</h3>
          <p className="text-2xl font-black text-emerald-700">
            {formatCurrency(financeStats.totalBankLoanRepaid + financeStats.totalSHGInternalLoan)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-[24px] p-6 border border-purple-100 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-500 p-3 rounded-xl">
              <FileBarChart className="w-6 h-6 text-white" />
            </div>
            {loading && <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <h3 className="text-xs font-black text-purple-900 uppercase tracking-wider mb-2">Grand Total</h3>
          <p className="text-2xl font-black text-purple-700">{formatCurrency(financeStats.grandTotal)}</p>
        </div>
      </div>

      {/* Last 3 Months Trend Chart */}
      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Payment Trends</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Last 3 Months Performance</p>
          </div>
          {loading && <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ fontWeight: 900, fontSize: 12 }}
                itemStyle={{ fontWeight: 700, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              <Area type="monotone" dataKey="totalAmount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Total Amount" />
              <Area type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSavings)" name="Savings" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400 font-bold">
            {loading ? 'Loading trend data...' : 'No trend data available'}
          </div>
        )}
      </div>

      {/* Interactive Map with Payment Data */}
      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 p-8">
        <div className="mb-6">
          <h3 className="text-xl font-black text-gray-900">Geographic Distribution</h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">District-wise payment overview</p>
        </div>

        <InteractiveAPMap
          summary={paymentData || {}}
          filters={filters}
          onDistrictSelect={(d) => setFilters(prev => ({ ...prev, district: d || 'all', mandal: 'all', village: 'all' }))}
          onMandalSelect={(m) => setFilters(prev => ({ ...prev, mandal: m, village: 'all' }))}
        />
      </div>
    </div>
  );
};

export default ReportsTab;