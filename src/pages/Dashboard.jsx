import React, { useState, useEffect } from 'react';
import { FileText, LogOut, BarChart, Users, CheckCircle } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import DashboardTab from './DashboardTab';
import UsersTab from './UsersTab';
import OCRValidationTab from './OCRValidationTab';
import ReportsTab from './ReportsTab';


const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
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
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedMandal, setSelectedMandal] = useState('all');
  const [selectedVillage, setSelectedVillage] = useState('all');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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

  // Check if user is Admin and redirect if not
  useEffect(() => {
    if (userRole && !isAdmin(userRole)) {
      window.location.hash = '/scanner';
    }
  }, [userRole]);

  // If user is NOT Admin, show loading while redirecting
  if (!userRole || !isAdmin(userRole)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to Scanner...</p>
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
    serverStatus
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab filterProps={filterProps} />;
      case 'users':
        return <UsersTab filterProps={filterProps} />;
      case 'validation':
        return <OCRValidationTab />;
      case 'reports':
        return <ReportsTab />;
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

  return (
    <div>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">OCR Admin Console</h1>
                  <p className="text-sm text-gray-600">Administration & Reporting System</p>
                  <div className="flex items-center gap-2">
                    {serverStatus.checking ? (
                      <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${serverStatus.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {serverStatus.message}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{username}</p>
                  <p className="text-xs text-gray-600">Role: {userRole}</p>
                </div>
                <button className="text-gray-600 hover:text-gray-800" onClick={() => setShowLogoutModal(true)}>
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart },
                { id: 'users', label: 'Users', icon: Users },
                // { id: 'validation', label: 'OCR Validation', icon: CheckCircle },
                { id: 'reports', label: 'Reports', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </main>
      </div>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <LogOut className="text-red-600 dark:text-red-400" size={24} />
            </div>

            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Log Out
            </h3>

            <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to log out?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogOut();
                }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all"
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