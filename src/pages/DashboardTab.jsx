import React, { useState, useEffect } from 'react';
import { FileText, LogOut, BarChart, Users, CheckCircle, Clock, Filter } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

// DashboardTab Component with Server Status and Location Loading
const DashboardTab = ({ filterProps }) => {
  const { selectedDistrict, setSelectedDistrict, selectedMandal, setSelectedMandal, selectedVillage, setSelectedVillage, serverStatus } = filterProps;

  // Location data states
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingMandals, setLoadingMandals] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);

  // Month and Year filtering
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
  }, [selectedDistrict]);

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
  }, [selectedMandal, selectedDistrict]);

  // Stats data state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFiles: 0,
    filesUploaded: 0,
    filesPending: 0,
    validated: 0,
    loading: true
  });

  // Chart data states
  const [uploadTrends, setUploadTrends] = useState([]);
  const [districtStats, setDistrictStats] = useState([]);

  // Load dashboard statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const token = localStorage.getItem('token');

        // Load users count
        const usersResponse = await fetch(`${API_BASE}/api/users/count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const usersData = await usersResponse.json();

        // Load uploads data with filters
        let uploadsUrl = `${API_BASE}/api/uploads/stats`;
        const params = new URLSearchParams();
        if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
        if (selectedMandal !== 'all') params.append('mandal', selectedMandal);
        if (selectedVillage !== 'all') params.append('village', selectedVillage);
        params.append('month', selectedMonth);
        params.append('year', selectedYear);
        if (params.toString()) uploadsUrl += `?${params.toString()}`;

        const uploadsResponse = await fetch(uploadsUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const uploadsData = await uploadsResponse.json();

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              {stats.loading ? (
                <div className="h-9 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              )}
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total SHGs</p>
              {stats.loading ? (
                <div className="h-9 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{stats.totalSHGs}</p>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SHGs Uploaded</p>
              {stats.loading ? (
                <div className="h-9 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-900">{stats.filesUploaded}</p>
                  <p className="text-sm text-gray-500">
                    {stats.totalSHGs > 0 ? Math.round((stats.filesUploaded / stats.totalSHGs) * 100) : 0}% complete
                  </p>
                </>
              )}
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <CheckCircle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SHGs Pending</p>
              {stats.loading ? (
                <div className="h-9 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{stats.filesPending}</p>
              )}
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5" />
          Time Filter
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Month Select */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 mt-4">
          <Filter className="w-5 h-5" />
          Location Filter
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* District Select */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={loadingDistricts}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="all">All Districts</option>
              {districts.map((district) => (
                <option key={district.id} value={district.name}>
                  {district.name}
                </option>
              ))}
            </select>
            {loadingDistricts && (
              <p className="text-xs text-gray-500 mt-1">Loading districts...</p>
            )}
          </div>

          {/* Mandal Select */}
          <div>
            <select
              value={selectedMandal}
              onChange={(e) => setSelectedMandal(e.target.value)}
              disabled={loadingMandals || selectedDistrict === 'all' || mandals.length === 0}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="all">All Mandals</option>
              {mandals.map((mandal) => (
                <option key={mandal.id} value={mandal.name}>
                  {mandal.name}
                </option>
              ))}
            </select>
            {loadingMandals && (
              <p className="text-xs text-gray-500 mt-1">Loading mandals...</p>
            )}
          </div>

          {/* Village Select */}
          <div>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={loadingVillages || selectedMandal === 'all' || villages.length === 0}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="all">All Villages</option>
              {villages.map((village) => (
                <option key={village.id} value={village.name}>
                  {village.name}
                </option>
              ))}
            </select>
            {loadingVillages && (
              <p className="text-xs text-gray-500 mt-1">Loading villages...</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Upload Trends Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upload Trends (Last 30 Days)</h3>
          {stats.loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : uploadTrends.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data available
            </div>
          ) : (
            <div className="h-64">
              <div className="h-64 relative">
                <svg className="w-full h-full" viewBox="0 0 800 240">
                  {/* Grid lines - keep as is */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={i}
                      x1="40"
                      y1={40 + i * 50}
                      x2="780"
                      y2={40 + i * 50}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Line chart - keep as is */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    points={uploadTrends.map((item, i) => {
                      const x = 40 + (i * (740 / (uploadTrends.length - 1)));
                      const maxValue = Math.max(...uploadTrends.map(t => t.count), 1);
                      const y = 240 - (item.count / maxValue * 180);
                      return `${x},${y}`;
                    }).join(' ')}
                  />

                  {/* REPLACE Data points section with this */}
                  {uploadTrends.map((item, i) => {
                    const x = 40 + (i * (740 / (uploadTrends.length - 1)));
                    const maxValue = Math.max(...uploadTrends.map(t => t.count), 1);
                    const y = 240 - (item.count / maxValue * 180);
                    return (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredPoint({ ...item, x, y, index: i })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={hoveredPoint?.index === i ? "6" : "4"}
                          fill="#3b82f6"
                          style={{ transition: 'r 0.2s', pointerEvents: 'none' }}
                        />
                        {i % 5 === 0 && (
                          <text x={x} y="230" textAnchor="middle" fontSize="10" fill="#6b7280">
                            {new Date(item.date).getDate()}/{new Date(item.date).getMonth() + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Y-axis labels - keep as is */}
                </svg>

                {/* ADD Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg pointer-events-none z-10"
                    style={{
                      left: `${(hoveredPoint.x / 800) * 100}%`,
                      top: `${(hoveredPoint.y / 240) * 100}%`,
                      transform: 'translate(-50%, -120%)'
                    }}
                  >
                    <div className="font-semibold">
                      {new Date(hoveredPoint.date).toLocaleDateString()}
                    </div>
                    <div className="text-blue-300">
                      Uploads: {hoveredPoint.count}
                    </div>
                  </div>
                )}

                {/* Legend*/}
                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Uploads per day</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* District Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">District Performance</h3>
          {stats.loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : districtStats.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data available
            </div>
          ) : (
            <div className="h-64">
              <div className="space-y-4">
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
                      className="space-y-2 relative"
                      onMouseEnter={() => setHoveredDistrict(index)}
                      onMouseLeave={() => setHoveredDistrict(null)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {district.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {district.uploaded}/{district.total} ({completionRate}%)
                        </span>
                      </div>

                      <div className="flex gap-1 h-6 relative" style={{ cursor: 'pointer' }}>
                        <div
                          className="bg-green-500 rounded-l flex items-center justify-center text-xs text-white font-medium transition-all"
                          style={{
                            width: `${uploadedPercent}%`,
                            opacity: hoveredDistrict === index ? 0.8 : 1
                          }}
                          title={`Uploaded: ${district.uploaded}`}
                        >
                          {uploadedPercent > 15 && district.uploaded}
                        </div>

                        <div
                          className="bg-orange-400 rounded-r flex items-center justify-center text-xs text-white font-medium transition-all"
                          style={{
                            width: `${pendingPercent}%`,
                            opacity: hoveredDistrict === index ? 0.8 : 1
                          }}
                          title={`Pending: ${district.pending}`}
                        >
                          {pendingPercent > 15 && district.pending}
                        </div>
                      </div>

                      {/* ADD Hover tooltip */}
                      {hoveredDistrict === index && (
                        <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-10 whitespace-nowrap">
                          <div className="font-semibold mb-1">{district.name}</div>
                          <div className="text-green-300">✓ Uploaded: {district.uploaded}</div>
                          <div className="text-orange-300">⏳ Pending: {district.pending}</div>
                          <div className="text-gray-300 mt-1">Completion: {completionRate}%</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-xs text-gray-600">Uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-400 rounded"></div>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;