import React, { useState, useEffect } from 'react';
import { FileText, LogOut, BarChart, Users, CheckCircle, Clock, Filter } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

// DashboardTab Component with Server Status and Location Loading
const DashboardTab = ({ filterProps }) => {
  const { selectedDistrict, setSelectedDistrict, selectedMandal, setSelectedMandal, selectedVillage, setSelectedVillage, serverStatus, userRole } = filterProps;

  // Location data states
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingMandals, setLoadingMandals] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: -1, y: -1 });

  // Month and Year filtering
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Handle auto-fill for restricted roles
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        const role = (userData?.role || '').toLowerCase();
        const isRestricted = role.includes('admin - apm') || role.includes('admin - cc');

        if (isRestricted) {
          if (userData.district && (!selectedDistrict || selectedDistrict === 'all')) {
            setSelectedDistrict(userData.district);
          }
          if (userData.mandal && (!selectedMandal || selectedMandal === 'all')) {
            setSelectedMandal(userData.mandal);
          }
        }
      }
    } catch (e) {
      console.error('Failed to auto-fill dashboard location', e);
    }
  }, [selectedDistrict, selectedMandal, setSelectedDistrict, setSelectedMandal]);

  // Load districts
  useEffect(() => {
    const loadDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const response = await fetch(`${API_BASE}/api/districts`);
        const data = await response.json();

        if (data.success) {
          setDistricts(data.districts);
        }
      } catch (error) {
        console.error('Failed to load districts:', error);
      } finally {
        setLoadingDistricts(false);
      }
    };

    loadDistricts();
  }, []);

  // Load mandals when district changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'all') {
      const loadMandals = async () => {
        setLoadingMandals(true);
        setMandals([]);
        setVillages([]);
        setSelectedMandal('all');
        setSelectedVillage('all');

        try {
          const response = await fetch(`${API_BASE}/api/mandals?district=${encodeURIComponent(selectedDistrict)}`);
          const data = await response.json();

          if (data.success) {
            setMandals(data.mandals);
          }
        } catch (error) {
          console.error('Failed to load mandals:', error);
        } finally {
          setLoadingMandals(false);
        }
      };

      loadMandals();
    } else {
      setMandals([]);
      setVillages([]);
      setSelectedMandal('all');
      setSelectedVillage('all');
    }
  }, [selectedDistrict, setSelectedMandal, setSelectedVillage]);

  // Load villages when mandal changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'all' && selectedMandal && selectedMandal !== 'all') {
      const loadVillages = async () => {
        setLoadingVillages(true);
        setVillages([]);
        setSelectedVillage('all');

        try {
          const response = await fetch(
            `${API_BASE}/api/villages?district=${encodeURIComponent(selectedDistrict)}&mandal=${encodeURIComponent(selectedMandal)}`
          );
          const data = await response.json();

          if (data.success) {
            setVillages(data.villages);
          }
        } catch (error) {
          console.error('Failed to load villages:', error);
        } finally {
          setLoadingVillages(false);
        }
      };

      loadVillages();
    } else {
      setVillages([]);
      setSelectedVillage('all');
    }
  }, [selectedMandal, selectedDistrict, setSelectedVillage]);

  // Stats data state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSHGs: 0,
    filesUploaded: 0,
    filesPending: 0,
    validated: 0,
    loading: true
  });

  // Chart data states
  const [uploadTrends, setUploadTrends] = useState([]);
  const [trendWindow, setTrendWindow] = useState(30);
  const [districtStats, setDistrictStats] = useState([]);

  // Load dashboard statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          console.warn('No token found, skipping stats load');
          setStats(prev => ({ ...prev, loading: false }));
          return;
        }

        // Load users count with filters
        let usersUrl = `${API_BASE}/api/users/count`;
        const userParams = new URLSearchParams();
        if (selectedDistrict !== 'all') userParams.append('district', selectedDistrict);
        if (selectedMandal !== 'all') userParams.append('mandal', selectedMandal);
        if (selectedVillage !== 'all') userParams.append('village', selectedVillage);
        if (userParams.toString()) usersUrl += `?${userParams.toString()}`;

        // Load uploads data with filters
        let uploadsUrl = `${API_BASE}/api/uploads/stats`;
        const params = new URLSearchParams();
        if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
        if (selectedMandal !== 'all') params.append('mandal', selectedMandal);
        if (selectedVillage !== 'all') params.append('village', selectedVillage);
        params.append('month', selectedMonth);
        params.append('year', selectedYear);
        if (params.toString()) uploadsUrl += `?${params.toString()}`;

        const [usersResponse, uploadsResponse] = await Promise.all([
          fetch(usersUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(uploadsUrl, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (usersResponse.status === 401 || uploadsResponse.status === 401) {
          console.warn('Token expired or invalid. Redirecting to login...');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '#/login';
          return;
        }

        const [usersData, uploadsData] = await Promise.all([
          usersResponse.json(),
          uploadsResponse.json()
        ]);

        setStats({
          totalUsers: usersData.count || 0,
          totalSHGs: uploadsData.totalSHGs || 0,
          filesUploaded: uploadsData.uploaded || 0,
          filesPending: uploadsData.pending || 0,
          validated: uploadsData.validated || 0,
          loading: false
        });

        // Set chart data
        setUploadTrends(uploadsData.dailyTrends || []);
        setDistrictStats(uploadsData.districtBreakdown || []);

      } catch (error) {
        console.error('Failed to load stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    if (serverStatus.active) {
      loadStats();
    }
  }, [serverStatus.active, selectedDistrict, selectedMandal, selectedVillage, selectedMonth, selectedYear]);

  const performanceTitle =
    selectedVillage !== 'all' ? 'Village Performance' :
      selectedMandal !== 'all' ? 'Mandal Performance' :
        selectedDistrict !== 'all' ? 'District Performance' :
          'Overall Performance';

  return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-4 sm:p-6 border border-white/40 hover:shadow-2xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-500 tracking-wider">Total VOs</p>
              {stats.loading ? (
                <div className="h-8 sm:h-10 w-16 sm:w-20 bg-gray-100 animate-pulse rounded-lg mt-2"></div>
              ) : (
                <p className="text-2xl sm:text-4xl font-black text-gray-900 mt-1">{stats.totalUsers}</p>
              )}
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 sm:p-4 rounded-2xl shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-4 sm:p-6 border border-white/40 hover:shadow-2xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-500 tracking-wider">Total SHGs</p>
              {stats.loading ? (
                <div className="h-8 sm:h-10 w-16 sm:w-20 bg-gray-100 animate-pulse rounded-lg mt-2"></div>
              ) : (
                <p className="text-2xl sm:text-4xl font-black text-gray-900 mt-1">{stats.totalSHGs}</p>
              )}
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 sm:p-4 rounded-2xl shadow-lg shadow-green-200 group-hover:rotate-6 transition-transform">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-4 sm:p-6 border border-white/40 hover:shadow-2xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-500 tracking-wider">SHGs Uploaded</p>
              {stats.loading ? (
                <div className="h-8 sm:h-10 w-16 sm:w-20 bg-gray-100 animate-pulse rounded-lg mt-2"></div>
              ) : (
                <>
                  <p className="text-2xl sm:text-4xl font-black text-gray-900 mt-1">{stats.filesUploaded}</p>
                </>
              )}
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 sm:p-4 rounded-2xl shadow-lg shadow-green-200 group-hover:rotate-6 transition-transform">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
              <span>Progress</span>
              <span>{stats.totalSHGs > 0 ? Math.round((stats.filesUploaded / stats.totalSHGs) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${stats.totalSHGs > 0 ? Math.round((stats.filesUploaded / stats.totalSHGs) * 100) : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/40 hover:shadow-2xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-500 tracking-wider">SHGs Pending</p>
              {stats.loading ? (
                <div className="h-8 sm:h-10 w-16 sm:w-20 bg-gray-100 animate-pulse rounded-lg mt-2"></div>
              ) : (
                <p className="text-2xl sm:text-4xl font-black text-gray-900 mt-1">{stats.filesPending}</p>
              )}
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 sm:p-4 rounded-2xl shadow-lg shadow-orange-200 group-hover:rotate-6 transition-transform">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <div className="mt-4 text-xs font-bold text-orange-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Requires Attention
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        <div className="bg-indigo-50/50 px-5 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-xl shadow-md">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">Data Analytics Filters</h3>
              <p className="text-[10px] sm:text-sm text-gray-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Refine statistics by time and location</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
          {/* Time Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Select Month</label>
              <div className="relative group">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <Filter className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-bold text-gray-700 ml-1">Select Year</label>
              <div className="relative group">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white text-sm sm:text-base"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Location Filter Row */}
          {!(userRole?.toLowerCase().includes('admin - apm') || userRole?.toLowerCase().includes('admin - cc')) ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">District</label>
                <div className="relative group">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      setSelectedMandal('all');
                      setSelectedVillage('all');
                    }}
                    disabled={loadingDistricts}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white disabled:opacity-60"
                  >
                    <option value="all">All Districts</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.name}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                    {loadingDistricts ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <Filter className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Mandal</label>
                <div className="relative group">
                  <select
                    value={selectedMandal}
                    onChange={(e) => {
                      setSelectedMandal(e.target.value);
                      setSelectedVillage('all');
                    }}
                    disabled={loadingMandals || selectedDistrict === 'all' || mandals.length === 0}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white disabled:opacity-60"
                  >
                    <option value="all">All Mandals</option>
                    {mandals.map((mandal) => (
                      <option key={mandal.id} value={mandal.name}>
                        {mandal.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                    {loadingMandals ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <Filter className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Village</label>
                <div className="relative group">
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    disabled={loadingVillages || selectedMandal === 'all' || villages.length === 0}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white disabled:opacity-60 text-sm sm:text-base"
                  >
                    <option value="all">All Villages</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.name}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                    {loadingVillages ? <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* If restricted, we still want to show the Village filter if they are APM */
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 pt-6 border-t border-gray-100">
              <div className="space-y-2 max-w-md mx-auto w-full">
                <label className="text-sm font-bold text-gray-700 ml-1">Refine by Village</label>
                <div className="relative group">
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    disabled={loadingVillages || selectedMandal === 'all' || villages.length === 0}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 group-hover:bg-white disabled:opacity-60 text-sm sm:text-base"
                  >
                    <option value="all">All Villages</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.name}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                    {loadingVillages ? <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Upload Trends Chart */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg">
                <BarChart className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 leading-tight">Upload Trends</h3>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl sm:rounded-2xl self-start">
              {[10, 15, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTrendWindow(days)}
                  className={`px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-lg sm:rounded-xl transition-all ${trendWindow === days
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
          {stats.loading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-lg"></div>
            </div>
          ) : uploadTrends.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
              No trend data available for this selection
            </div>
          ) : (
            <div className="h-[250px] sm:h-[400px]">
              <div className="h-full relative">
                {(() => {
                  const filteredTrends = uploadTrends.slice(-trendWindow);
                  if (filteredTrends.length === 0) return null;

                  const maxValue = Math.max(...filteredTrends.map(t => t.count), 5);
                  const getPoints = () => filteredTrends.map((item, i) => ({
                    x: 60 + (i * (680 / Math.max(filteredTrends.length - 1, 1))),
                    y: 320 - (item.count / maxValue * 240)
                  }));

                  const points = getPoints();
                  if (points.length < 2) return null;

                  // Build smooth curve path
                  let pathData = `M ${points[0].x},${points[0].y}`;
                  for (let i = 0; i < points.length - 1; i++) {
                    const curr = points[i];
                    const next = points[i + 1];
                    const cp1x = curr.x + (next.x - curr.x) / 3;
                    const cp2x = curr.x + 2 * (next.x - curr.x) / 3;
                    pathData += ` C ${cp1x},${curr.y} ${cp2x},${next.y} ${next.x},${next.y}`;
                  }

                  const areaPath = `${pathData} L ${points[points.length - 1].x},320 L ${points[0].x},320 Z`;

                  // More aggressive label skipping on very small screens
                  const isMobile = window.innerWidth < 640;
                  const labelSkip = isMobile
                    ? (trendWindow > 15 ? 7 : (trendWindow > 10 ? 4 : 2))
                    : (trendWindow > 15 ? 5 : (trendWindow > 10 ? 2 : 1));

                  return (
                    <svg className="w-full h-full" viewBox={isMobile ? "0 0 800 450" : "0 0 800 400"} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                          <feOffset dx="0" dy="4" result="offsetblur" />
                          <feComponentTransfer>
                            <feFuncA type="linear" slope="0.3" />
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Grid lines & Y-Axis Labels */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <g key={i}>
                          <line
                            x1="60" y1={80 + i * 60} x2="740" y2={80 + i * 60}
                            stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6,4"
                          />
                          <text
                            x="50"
                            y={80 + i * 60 + (isMobile ? 8 : 5)}
                            textAnchor="end"
                            fontSize={isMobile ? "24" : "14"}
                            fontWeight="bold"
                            fill="#94a3b8"
                          >
                            {Math.round(maxValue * (1 - i / 4))}
                          </text>
                        </g>
                      ))}

                      {/* Path & Fill */}
                      <path d={areaPath} fill="url(#areaGradient)" />
                      <path d={pathData} fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" filter="url(#shadow)" />

                      {/* Points & Labels */}
                      {points.map((p, i) => {
                        const item = filteredTrends[i];
                        const isLast = i === filteredTrends.length - 1;
                        const isPeak = item.count === Math.max(...filteredTrends.map(t => t.count)) && item.count > 0;
                        const shouldShowLabel = i % labelSkip === 0 || isLast || isPeak;

                        return (
                          <g key={i}>
                            <circle
                              cx={p.x} cy={p.y} r={isMobile ? "10" : "8"}
                              fill="white" stroke="#2563eb" strokeWidth={isMobile ? "5" : "4"}
                              onMouseEnter={(e) => {
                                setHoveredPoint({ ...item, x: p.x, y: p.y, index: i });
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => {
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                              className="hover:r-12 hover:stroke-width-6"
                            />

                            {shouldShowLabel && (
                              <g>
                                <text
                                  x={p.x}
                                  y={p.y - (isMobile ? 25 : 20)}
                                  textAnchor="middle"
                                  fontSize={isMobile ? "24" : "16"}
                                  fontStyle="italic"
                                  fontWeight="black"
                                  fill="#1e40af"
                                >
                                  {item.count}
                                </text>
                                <text
                                  x={p.x}
                                  y={isMobile ? "365" : "350"}
                                  textAnchor="middle"
                                  fontSize={isMobile ? "20" : "14"}
                                  fontWeight="bold"
                                  fill="#64748b"
                                  transform={`rotate(${isMobile ? 45 : 45}, ${p.x}, ${isMobile ? 365 : 350})`}
                                >
                                  {new Date(item.date).getDate()} {new Date(item.date).toLocaleString('default', { month: 'short' })}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Mandal Performance Chart */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-purple-600 p-2 rounded-xl shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{performanceTitle}</h3>
          </div>

          {stats.loading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent shadow-lg"></div>
            </div>
          ) : districtStats.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
              No performance data available
            </div>
          ) : (
            <div className="h-[300px] sm:h-[400px] overflow-y-auto pr-2 sm:pr-4 custom-scrollbar">
              <div className="space-y-4 sm:space-y-6">
                {districtStats.map((district, index) => {
                  const maxValue = Math.max(...districtStats.map(d => d.uploaded), 1);
                  const uploadedPercent = (district.uploaded / maxValue) * 100;
                  const pendingPercent = (district.pending / maxValue) * 100;
                  const completionRate = district.total > 0
                    ? Math.round((district.uploaded / district.total) * 100)
                    : 0;

                  return (
                    <div
                      key={index}
                      className="space-y-3 relative group"
                      onMouseEnter={(e) => {
                        setHoveredDistrict(index);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredDistrict(null)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                          {district.name}
                        </span>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-[10px] sm:text-xs font-bold text-gray-400">
                            {district.uploaded}/{district.total}
                          </span>
                          <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${completionRate >= 80 ? 'bg-green-100 text-green-600' :
                            completionRate >= 50 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                            }`}>
                            {completionRate}%
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex gap-1.5 h-8 relative cursor-pointer"
                        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                      >
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-[10px] text-white font-black transition-all shadow-lg shadow-green-100 group-hover:shadow-green-200"
                          style={{
                            width: `${uploadedPercent}%`,
                            opacity: hoveredDistrict === index ? 0.9 : 1
                          }}
                        >
                          {uploadedPercent > 10 && <span className="drop-shadow-sm">{district.uploaded}</span>}
                        </div>

                        <div
                          className="bg-gradient-to-r from-orange-400 to-red-400 rounded-xl flex items-center justify-center text-[10px] text-white font-black transition-all shadow-lg shadow-orange-100 group-hover:shadow-orange-200"
                          style={{
                            width: `${pendingPercent}%`,
                            opacity: hoveredDistrict === index ? 0.9 : 1
                          }}
                        >
                          {pendingPercent > 10 && <span className="drop-shadow-sm">{district.pending}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-10 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-gray-100">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-md"></div>
                  <span className="text-xs sm:text-sm font-bold text-gray-600">Uploaded</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-orange-400 to-red-400 rounded-lg shadow-md"></div>
                  <span className="text-xs sm:text-sm font-bold text-gray-600">Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Unified Tooltip Rendering - Positioned at end to escape overflow:hidden clipping */}
      {
        (hoveredPoint || hoveredDistrict !== null) && tooltipPos.x !== -1 && (
          <div
            className={`fixed bg-gray-900/95 backdrop-blur-md border border-white/20 text-white rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 shadow-2xl pointer-events-none z-[10000] whitespace-nowrap animate-in fade-in zoom-in duration-200 flex flex-col min-w-[120px] sm:min-w-[140px] transition-opacity ${tooltipPos.x === -1 ? 'opacity-0' : 'opacity-100'}`}
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transformOrigin: 'top left',
              transform: `translate(${tooltipPos.x + 200 > window.innerWidth ? '-100%' : '15px'}, ${tooltipPos.y + 150 > window.innerHeight ? '-100%' : '15px'}) scale(${window.innerWidth < 640 ? 0.9 : 1})`
            }}
          >
            {hoveredPoint && (
              <>
                <div className="font-black text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">
                  {new Date(hoveredPoint.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></div>
                  <span className="font-black text-xs uppercase tracking-tight">Uploads: <span className="text-blue-400 text-sm">{hoveredPoint.count}</span></span>
                </div>
              </>
            )}
            {hoveredDistrict !== null && districtStats[hoveredDistrict] && (
              <>
                <div className="font-black text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">
                  {districtStats[hoveredDistrict].name}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center gap-6">
                    <span className="text-[9px] font-black text-gray-500 uppercase">Uploaded</span>
                    <span className="text-green-400 font-black text-xs">{districtStats[hoveredDistrict].uploaded}</span>
                  </div>
                  <div className="flex justify-between items-center gap-6">
                    <span className="text-[9px] font-black text-gray-500 uppercase">Pending</span>
                    <span className="text-orange-400 font-black text-xs">{districtStats[hoveredDistrict].pending}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1.5 mt-1 flex justify-between items-center gap-6">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Completion</span>
                    <span className="text-indigo-400 font-black text-xs">
                      {districtStats[hoveredDistrict].total > 0
                        ? Math.round((districtStats[hoveredDistrict].uploaded / districtStats[hoveredDistrict].total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      }
    </div>
  );
};

export default DashboardTab;