import React, { useState, useEffect } from 'react';
import { FileText, LogOut, BarChart, Users, CheckCircle, Activity, Loader2, Settings, X, Shield, AlertCircle, AlertTriangle, Wrench, ChevronDown, Trash2 } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import DashboardTab from './DashboardTab';
import UsersTab from './UsersTab';
import OCRValidationTab from './OCRValidationTab';
import AnalyticsPage from './AnalyticsPage';
import ConversionView from './ConversionView';
import HierarchyTab from './HierarchyTab';
import SettingsTab from './SettingsTab';



const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [userRole, setUserRole] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.role || '';
    } catch {
      return '';
    }
  });
  const [username, setUsername] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.voName || 'Administrator';
    } catch {
      return 'Admin';
    }
  });
  const [selectedDistrict, setSelectedDistrict] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const role = (user?.role || '').toLowerCase();
      if (role === 'admin - apm') {
        return user.district || 'all';
      }
      return sessionStorage.getItem('dashboardSelectedDistrict') || 'all';
    } catch {
      return 'all';
    }
  });
  const [selectedMandal, setSelectedMandal] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const role = (user?.role || '').toLowerCase();
      if (role === 'admin - apm') {
        return user.mandal || 'all';
      }
      return sessionStorage.getItem('dashboardSelectedMandal') || 'all';
    } catch {
      return 'all';
    }
  });
  const [selectedVillage, setSelectedVillage] = useState(() => sessionStorage.getItem('dashboardSelectedVillage') || 'all');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(() => localStorage.getItem('selectedUserId') || null);
  const [selectedUserName, setSelectedUserName] = useState(() => localStorage.getItem('selectedUserName') || '');

  // Centralized time and search filters
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = String(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(() => {
    const saved = sessionStorage.getItem('dashboardFilterMonth');
    if (saved && !isNaN(saved) && saved.length > 0) {
      return saved.padStart(2, '0');
    }
    return currentMonth;
  });
  const [filterYear, setFilterYear] = useState(() => sessionStorage.getItem('dashboardFilterYear') || currentYear);
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('dashboardSearchTerm') || '');

  // Initial location setup based on role
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const role = (user?.role || '').toLowerCase();
        if (role === 'admin - apm') {
          if (user.district) setSelectedDistrict(user.district);
          if (user.mandal) setSelectedMandal(user.mandal);
        }
      }
    } catch (e) {
      console.error('Failed to initialize location filters', e);
    }
  }, []);

  // Server status state
  const [serverStatus, setServerStatus] = useState({
    active: false,
    checking: true,
    message: 'Checking...'
  });

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();

        if (data.status === 'healthy') {
          setServerStatus({
            active: true,
            checking: false,
            message: 'Server Active'
          });
        } else {
          setServerStatus({
            active: false,
            checking: false,
            message: 'Server Error'
          });
        }
      } catch (error) {
        setServerStatus({
          active: false,
          checking: false,
          message: 'Server Offline'
        });
      }
    };

    checkServerStatus();
    // Check every 30 seconds
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Consistency Helper
  const isAdmin = (role) => {
    if (!role) return false;
    const r = role.toLowerCase();
    return r.includes('admin') || r.includes('district') || r.includes('super');
  };

  // Persist dashboard state
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem('selectedUserId', selectedUserId);
    } else {
      localStorage.removeItem('selectedUserId');
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedUserName) {
      localStorage.setItem('selectedUserName', selectedUserName);
    } else {
      localStorage.removeItem('selectedUserName');
    }
  }, [selectedUserName]);

  // Persist location filters
  useEffect(() => {
    sessionStorage.setItem('dashboardSelectedDistrict', selectedDistrict);
  }, [selectedDistrict]);

  useEffect(() => {
    sessionStorage.setItem('dashboardSelectedMandal', selectedMandal);
  }, [selectedMandal]);

  useEffect(() => {
    sessionStorage.setItem('dashboardSelectedVillage', selectedVillage);
  }, [selectedVillage]);

  useEffect(() => {
    sessionStorage.setItem('dashboardFilterMonth', filterMonth);
  }, [filterMonth]);

  useEffect(() => {
    sessionStorage.setItem('dashboardFilterYear', filterYear);
  }, [filterYear]);

  useEffect(() => {
    sessionStorage.setItem('dashboardSearchTerm', searchTerm);
  }, [searchTerm]);

  // Check if user is Admin and redirect if not
  useEffect(() => {
    if (userRole && !isAdmin(userRole)) {
      window.location.hash = '/scanner';
    }
  }, [userRole]);

  // If user is NOT Admin, show loading while redirecting
  if (!userRole || !isAdmin(userRole)) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Redirecting to Scanner...</p>
        </div>
      </div>
    );
  }

  const filterProps = {
    selectedDistrict,
    setSelectedDistrict,
    selectedMandal,
    setSelectedMandal,
    selectedVillage,
    setSelectedVillage,
    serverStatus,
    setSelectedUserId,
    setSelectedUserName,
    setActiveTab,
    userRole,
    filterMonth,
    setFilterMonth,
    filterYear,
    setFilterYear,
    searchTerm,
    setSearchTerm
  };


  const renderContent = () => {
    const isDev = userRole.toLowerCase().includes('developer');

    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab filterProps={filterProps} />;
      case 'users':
        return isDev || userRole.toLowerCase().includes('admin') ? <UsersTab filterProps={filterProps} /> : <DashboardTab filterProps={filterProps} />;
      case 'conversion':
        return <ConversionView userId={selectedUserId} userName={selectedUserName} filterProps={filterProps} onClose={() => setActiveTab('users')} />;
      case 'validation':

        return isDev ? <OCRValidationTab /> : <DashboardTab filterProps={filterProps} />;
      case 'analytics':
        const isPrivileged = isDev || userRole.toLowerCase().includes('admin');
        return isPrivileged ? <AnalyticsPage filterProps={filterProps} /> : <DashboardTab filterProps={filterProps} />;
      case 'hierarchy':
        return isDev || userRole.toLowerCase().includes('admin') ? <HierarchyTab /> : <DashboardTab filterProps={filterProps} />;
      case 'settings':
        return isDev ? <SettingsTab /> : <DashboardTab filterProps={filterProps} />;
      default:
        return <DashboardTab filterProps={filterProps} />;
    }
  };

  const handleLogOut = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE}/api/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setTimeout(() => {
        const basePath = import.meta.env.BASE_URL || '/';
        window.location.href = basePath + '#/login';
      }, 100);
    }
  };

  // Integrity Check Logic
  const [integrityTask, setIntegrityTask] = useState(null);
  const [isIntegrityChecking, setIsIntegrityChecking] = useState(false);
  const [showIntegrityResults, setShowIntegrityResults] = useState(false);

  const [fixTask, setFixTask] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [showActionPlan, setShowActionPlan] = useState(false);

  const handleStartIntegrityCheck = async () => {
    if (isIntegrityChecking) return;

    // Prompt for period
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const period = prompt('Enter Year-Month to check (YYYY-MM)', defaultPeriod);
    if (!period) return;

    const [y, m] = period.split('-');
    if (!y || !m || isNaN(y) || isNaN(m)) {
      alert('Invalid format. Use YYYY-MM');
      return;
    }

    setIsIntegrityChecking(true);
    setIntegrityTask(null);
    setFixTask(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/maintenance/integrity-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: parseInt(m),
          year: parseInt(y)
        })
      });
      const data = await res.json();
      if (data.success && data.taskId) {
        pollIntegrityTask(data.taskId);
      } else {
        alert(data.error || 'Failed to start integrity check');
        setIsIntegrityChecking(false);
      }
    } catch (err) {
      console.error('Error starting integrity check:', err);
      setIsIntegrityChecking(false);
    }
  };

  const pollIntegrityTask = async (taskId) => {
    const token = localStorage.getItem('token');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/maintenance/integrity-check/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setIntegrityTask(data.task);
          if (data.task.status === 'completed' || data.task.status === 'failed') {
            clearInterval(interval);
            setIsIntegrityChecking(false);
            setShowIntegrityResults(true);
          }
        } else {
          clearInterval(interval);
          setIsIntegrityChecking(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(interval);
        setIsIntegrityChecking(false);
      }
    }, 2000);
  };

  const handleApplyFixes = async () => {
    if (!integrityTask || integrityTask.status !== 'completed' || isFixing) return;

    setIsFixing(true);
    setFixTask(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/maintenance/integrity-check/${integrityTask.id}/fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.taskId) {
        pollFixTask(data.taskId);
      } else {
        alert(data.error || 'Failed to start fixing');
        setIsFixing(false);
      }
    } catch (err) {
      console.error('Fix error:', err);
      setIsFixing(false);
    }
  };

  const pollFixTask = async (taskId) => {
    const token = localStorage.getItem('token');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/maintenance/integrity-check/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setFixTask(data.task);
          if (data.task.status === 'completed' || data.task.status === 'failed') {
            clearInterval(interval);
            setIsFixing(false);
            // Refresh main scan task result
            const mainRes = await fetch(`${API_BASE}/api/maintenance/integrity-check/${integrityTask.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const mainData = await mainRes.json();
            if (mainData.success) setIntegrityTask(mainData.task);
          }
        } else {
          clearInterval(interval);
          setIsFixing(false);
        }
      } catch (err) {
        console.error('Fix polling error:', err);
        clearInterval(interval);
        setIsFixing(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 overflow-hidden mb-6 sm:mb-8">
          {/* TOP BAR */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              {/* LEFT */}
              <div className="flex items-start sm:items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl border border-white/30 shadow-lg">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>

                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                    SMD SHG Admin Panel
                  </h1>

                  <p className="text-xs sm:text-sm text-blue-100 font-medium">
                    Administration System
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    {serverStatus.checking ? (
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400 animate-pulse" />
                    ) : (
                      <div
                        className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${serverStatus.active
                          ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                          : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'
                          }`}
                      />
                    )}
                    <span className="text-[10px] sm:text-xs font-bold text-white/90">
                      {serverStatus.message}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6">

                {/* DEV BUTTON */}
                {userRole.toLowerCase().includes('developer') && (
                  <button
                    onClick={() =>
                      isIntegrityChecking
                        ? setShowIntegrityResults(true)
                        : handleStartIntegrityCheck()
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black transition-all border shadow-sm ${isIntegrityChecking
                      ? 'bg-amber-100 text-amber-600 border-amber-200 animate-pulse'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    title={
                      isIntegrityChecking
                        ? 'View Live Results'
                        : 'Run System Integrity Check'
                    }
                  >
                    {isIntegrityChecking ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {integrityTask?.progress || 0}%
                      </>
                    ) : (
                      <>
                        <Activity className="w-3 h-3" />
                        Integrity Check
                      </>
                    )}
                  </button>
                )}

                {/* USER (HIDDEN ON MOBILE) */}
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white">{username}</p>
                  <p className="text-xs text-blue-100 font-medium">
                    Role: {userRole}
                  </p>
                </div>

                {/* LOGOUT */}
                <button
                  className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-all border border-white/20 shadow-lg group"
                  onClick={() => setShowLogoutModal(true)}
                  title="Log Out"
                >
                  <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* NAVIGATION */}
          {(userRole.toLowerCase().includes('developer') ||
            userRole.toLowerCase().includes('admin')) && (
              <nav className="px-2 sm:px-6 border-t border-gray-100/10 bg-white/5 backdrop-blur-md">
                <div className="flex justify-between sm:justify-start sm:space-x-1 overflow-x-auto scrollbar-hide">

                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: BarChart },
                    { id: 'users', label: 'Users', icon: Users },
                    { id: 'validation', label: 'OCR Validation', icon: CheckCircle, developerOnly: true },
                    { id: 'analytics', label: 'Analytics', icon: FileText, privilegedOnly: true },
                    { id: 'settings', label: 'Settings', icon: Wrench, developerOnly: true }
                  ]
                    .filter(tab => {
                      const lowerRole = userRole.toLowerCase();
                      const isDev = lowerRole.includes('developer');
                      const isAdmin = lowerRole.includes('admin') && !lowerRole.includes('apm') && !lowerRole.includes('cc');
                      const isAPM = lowerRole.includes('admin - apm');

                      if (tab.developerOnly && !isDev) return false;
                      if (tab.privilegedOnly && !(isDev || isAdmin || isAPM)) return false;
                      return true;
                    })
                    .map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 sm:py-4 px-2 sm:px-4 font-bold text-[10px] sm:text-sm whitespace-nowrap flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all relative flex-1 sm:flex-none ${activeTab === tab.id
                          ? 'text-indigo-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        <tab.icon
                          className={`w-5 h-5 sm:w-4 sm:h-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'
                            }`}
                        />
                        <span className="hidden xs:inline sm:inline">{tab.label}</span>

                        {activeTab === tab.id && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_-2px_4px_rgba(79,70,229,0.3)]" />
                        )}
                      </button>
                    ))}
                </div>
              </nav>
            )}
        </header>

        {/* Main Content */}
        <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderContent()}
        </main>
      </div>

      {/* Integrity Check Results Modal */}
      {showIntegrityResults && integrityTask && (
        <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 relative">
            {/* Header - Fixed */}
            <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
              <button
                onClick={() => setShowIntegrityResults(false)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${integrityTask.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : integrityTask.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {integrityTask.status === 'completed' ? <CheckCircle size={32} /> : integrityTask.status === 'failed' ? <AlertTriangle size={32} /> : <Activity size={32} className="animate-pulse" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Integrity Check Result</h3>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
                    Period: {integrityTask.month}/{integrityTask.year} • Status: {integrityTask.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">

              {isIntegrityChecking && (
                <div className="flex items-center gap-3 bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-100 mb-6 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-black uppercase tracking-wider">Scan in Progress (Detection Phase)</span>
                </div>
              )}

              {integrityTask.results ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Scanned', val: integrityTask.results.scanned_uploads, color: 'text-gray-900' },
                      { label: 'Broken', val: integrityTask.results.broken_metadata, color: 'text-red-600' },
                      { label: 'Corrupted', val: integrityTask.results.stats_corruption, color: 'text-purple-600' },
                      { label: 'Missing', val: integrityTask.results.missing_shgs, color: 'text-amber-600' },
                      { label: 'Wrong VO', val: integrityTask.results.wrong_assignments, color: 'text-orange-600' },
                      { label: 'Deletions', val: integrityTask.proposed_fixes?.deletions?.length || 0, color: 'text-rose-600' }
                    ].map((res, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                        <div className={`text-lg font-black ${res.color}`}>{res.val}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{res.label}</div>
                      </div>
                    ))}
                  </div>

                  {(integrityTask.results.wrong_assignments > 0 || integrityTask.results.stats_corruption > 0 || (integrityTask.proposed_fixes?.deletions?.length > 0)) && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Wrench className="w-5 h-5 text-indigo-600 shrink-0" />
                          <div>
                            <span className="text-sm font-bold text-indigo-800 block">Repairable Issues Detected</span>
                            <span className="text-[10px] text-indigo-600 font-medium">VO assignments and negative pending stats can be auto-fixed.</span>
                          </div>
                        </div>
                        <button
                          onClick={handleApplyFixes}
                          disabled={isFixing || integrityTask.status !== 'completed'}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-[10px] font-black rounded-xl transition-all shadow-md shrink-0 uppercase tracking-widest"
                        >
                          {isFixing ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Fixing...</span>
                            </div>
                          ) : 'Apply Auto-Fixes'}
                        </button>
                      </div>

                      {fixTask && (
                        <div className="space-y-2 pt-2 border-t border-indigo-100">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-500">
                            <span className="animate-pulse">{fixTask.message}</span>
                            <span>{fixTask.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-indigo-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-indigo-600 transition-all duration-500 ${fixTask.status === 'running' ? 'progress-shimmer' : ''}`}
                              style={{ width: `${fixTask.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-800">Fixed Issues</span>
                    </div>
                    <span className="text-lg font-black text-emerald-600">{integrityTask.results.fixed_issues}</span>
                  </div>

                  {integrityTask.proposed_fixes && (integrityTask.proposed_fixes.vo_assignments.length > 0 || integrityTask.proposed_fixes.progress_stats.length > 0 || integrityTask.proposed_fixes.deletions?.length > 0) && (
                    <div className="space-y-4">
                      <button
                        onClick={() => setShowActionPlan(!showActionPlan)}
                        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all group"
                      >
                        <div className="flex items-center gap-3 text-gray-700">
                          <Wrench className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-black uppercase tracking-widest">Proposed Action Plan (Transparency View)</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showActionPlan ? 'rotate-180' : ''}`} />
                      </button>

                      {showActionPlan && (
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 animate-in slide-in-from-top-2 duration-300">
                          {integrityTask.proposed_fixes.vo_assignments.map((fix, i) => (
                            <div key={`vo-${i}`} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-[11px] font-medium text-indigo-900 leading-relaxed shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <Shield size={12} className="text-indigo-600" />
                                <span className="font-black uppercase text-[9px] tracking-tight">VO Assignment Fix</span>
                              </div>
                              {fix.details}
                            </div>
                          ))}
                          {integrityTask.proposed_fixes.progress_stats.map((fix, i) => (
                            <div key={`stat-${i}`} className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-[11px] font-medium text-purple-900 leading-relaxed shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <BarChart size={12} className="text-purple-600" />
                                <span className="font-black uppercase text-[9px] tracking-tight">Stats Repair (Legacy)</span>
                              </div>
                              {fix.details}
                            </div>
                          ))}
                          {integrityTask.proposed_fixes.deletions?.map((fix, i) => (
                            <div key={`del-${i}`} className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-[11px] font-medium text-rose-900 leading-relaxed shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <Trash2 size={12} className="text-rose-600" />
                                <span className="font-black uppercase text-[9px] tracking-tight">Deletion (Corrupt Data)</span>
                              </div>
                              {fix.details}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {integrityTask.results.errors?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Error Logs</h4>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                        {integrityTask.results.errors.map((err, i) => (
                          <div key={i} className="text-[11px] text-gray-600 font-medium flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-100/50">
                            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500 font-bold">{integrityTask.message || 'Processing results...'}</p>
                </div>
              )}

              <button
                onClick={() => setShowIntegrityResults(false)}
                className="w-full mt-4 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200 border border-white/20">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-50 rounded-2xl mb-6 shadow-inner">
              <LogOut className="text-red-500" size={32} />
            </div>

            <h3 className="text-2xl font-black text-center text-gray-900 mb-2">
              Log Out
            </h3>

            <p className="text-center text-gray-600 mb-8 font-medium">
              Are you sure you want to log out?
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogOut();
                }}
                className="flex-1 px-6 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;