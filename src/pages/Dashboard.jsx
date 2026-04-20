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

  // Hierarchy persistence states
  const [users, setUsers] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userCounts, setUserCounts] = useState({ admin: 0, vo: 0, developer: 0, apm: 0, cc: 0, total: 0 });
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [loadingNodes, setLoadingNodes] = useState(new Set());

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
    setSearchTerm,
    // Hierarchy persistence props
    users,
    setUsers,
    staffUsers,
    setStaffUsers,
    totalPages,
    setTotalPages,
    totalUsers,
    setTotalUsers,
    userCounts,
    setUserCounts,
    expandedRows,
    setExpandedRows,
    loadingNodes,
    setLoadingNodes
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

  const getPanelTitle = () => {
    const roleLower = userRole.toLowerCase();
    if (roleLower.includes('developer')) return 'SMD SHG Developers Panel';
    if (roleLower.includes('apm')) return 'SMD SHG APM Panel';
    if (roleLower.includes('cc')) return 'SMD SHG CC Panel';
    return 'SMD SHG Admin Panel';
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
                    {getPanelTitle()}
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