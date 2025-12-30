import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Filter, Loader2, X, Shield, User, MapPin, Phone, Lock, CheckCircle, Search, ChevronLeft, ChevronRight, FileText, Calendar, AlertCircle, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const UsersTab = ({ filterProps }) => {
  const { selectedDistrict, setSelectedDistrict, selectedMandal, setSelectedMandal, selectedVillage, setSelectedVillage, serverStatus } = filterProps;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = React.useState('1');
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userCounts, setUserCounts] = useState({ admin: 0, vo: 0, developer: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Sorting state
  const [sortBy, setSortBy] = useState([]);
  const [sortOrders, setSortOrders] = useState({ pending: 'desc', uploaded: 'desc' });

  // User uploads modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserUploads, setShowUserUploads] = useState(false);
  const [userUploads, setUserUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsSummary, setUploadsSummary] = useState(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusFormData, setStatusFormData] = useState({ status: 'pending', rejectionReason: '' });

  // Location data states (local to tab for better control)
  // ... rest of the states ...
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    voName: '',
    phone: '',
    password: '',
    role: 'VO',
    district: '',
    mandal: '',
    village: '',
    voID: '',
    voaName: ''
  });

  // Modal-specific location states to avoid overriding global filters
  const [modalMandals, setModalMandals] = useState([]);
  const [modalVillages, setModalVillages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Check if logged in user is a developer
  const [isLoggedInDev, setIsLoggedInDev] = useState(false);
  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      if (userData && (userData.role || '').toLowerCase().includes('developer')) {
        setIsLoggedInDev(true);
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
    }
  }, []);

  // Load locations (Districts)
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/districts`);
        const data = await res.json();
        if (data.success) setDistricts(data.districts);
      } catch (err) {
        console.error('Failed to fetch districts', err);
      }
    };
    fetchDistricts();
  }, []);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  // Load mandals when district selection changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'all') {
      const fetchMandals = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/mandals?district=${encodeURIComponent(selectedDistrict)}`);
          const data = await res.json();
          if (data.success) setMandals(data.mandals);
        } catch (err) {
          console.error('Failed to fetch mandals', err);
        }
      };
      fetchMandals();
    } else {
      setMandals([]);
      setVillages([]);
    }
    setPage(1); // Reset page on filter change
  }, [selectedDistrict]);

  // Load villages when mandal selection changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'all' && selectedMandal && selectedMandal !== 'all') {
      const fetchVillages = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/villages?district=${encodeURIComponent(selectedDistrict)}&mandal=${encodeURIComponent(selectedMandal)}`);
          const data = await res.json();
          if (data.success) setVillages(data.villages);
        } catch (err) {
          console.error('Failed to fetch villages', err);
        }
      };
      fetchVillages();
    } else {
      setVillages([]);
    }
    setPage(1); // Reset page on filter change
  }, [selectedMandal, selectedDistrict]);

  // Handle Modal Mandal loading
  useEffect(() => {
    if (formData.district) {
      const fetchModalMandals = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/mandals?district=${encodeURIComponent(formData.district)}`);
          const data = await res.json();
          if (data.success) setModalMandals(data.mandals);
        } catch (err) {
          console.error('Failed to fetch modal mandals', err);
        }
      };
      fetchModalMandals();
    } else {
      setModalMandals([]);
    }
  }, [formData.district]);

  // Handle Modal Village loading
  useEffect(() => {
    if (formData.district && formData.mandal) {
      const fetchModalVillages = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/villages?district=${encodeURIComponent(formData.district)}&mandal=${encodeURIComponent(formData.mandal)}`);
          const data = await res.json();
          if (data.success) setModalVillages(data.villages);
        } catch (err) {
          console.error('Failed to fetch modal villages', err);
        }
      };
      fetchModalVillages();
    } else {
      setModalVillages([]);
    }
  }, [formData.district, formData.mandal]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch users from backend
  const fetchUsers = async () => {
    if (!serverStatus.active) return;
    setLoading(true);
    setIsTransitioning(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
      if (selectedMandal !== 'all') params.append('mandal', selectedMandal);
      if (selectedVillage !== 'all') params.append('village', selectedVillage);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      params.append('page', page);
      params.append('limit', limit);
      if (sortBy.length > 0) {
        params.append('sortBy', sortBy.join(','));
        // Send orders for each active sort field
        const activeOrders = sortBy.map(id => sortOrders[id] || 'desc');
        params.append('sortOrder', activeOrders.join(','));
      }

      const res = await fetch(`${API_BASE}/api/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.pages);
        setTotalUsers(data.pagination.total);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  // Fetch user counts breakdown
  const fetchUserCounts = async () => {
    if (!serverStatus.active) return;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
      if (selectedMandal !== 'all') params.append('mandal', selectedMandal);
      if (selectedVillage !== 'all') params.append('village', selectedVillage);

      const res = await fetch(`${API_BASE}/api/users/count?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUserCounts(data.counts || { admin: 0, vo: 0, developer: 0, total: data.count || 0 });
      }
    } catch (err) {
      console.error('Failed to fetch user counts', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUserCounts();
  }, [selectedDistrict, selectedMandal, selectedVillage, debouncedSearchTerm, serverStatus.active, page, sortBy, sortOrders]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Construct final role
      const finalRole = formData.isDeveloper ? `${formData.role} - Developer` : formData.role;
      const { isDeveloper, ...submitData } = { ...formData, role: finalRole };

      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData({ voName: '', phone: '', password: '', role: 'VO', district: '', mandal: '', village: '', voID: '', voaName: '' });
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Error creating user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Construct final role
      const finalRole = formData.isDeveloper ? `${formData.role} - Developer` : formData.role;
      const { isDeveloper, ...submitData } = { ...formData, role: finalRole };

      const res = await fetch(`${API_BASE}/api/users/${currentUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    const roleUpper = (user.role || '').toUpperCase();
    const baseRole = roleUpper.includes('ADMIN') ? 'ADMIN' : 'VO';
    const isDeveloper = roleUpper.includes('DEVELOPER');

    setFormData({
      voName: user.voName || '',
      phone: user.phone || '',
      password: '', // Don't show password
      role: baseRole,
      isDeveloper: isDeveloper,
      district: user.district || '',
      mandal: user.mandal || '',
      village: user.village || '',
      voID: user.voID || '',
      voaName: user.voaName || ''
    });
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setFormData({
      voName: '',
      phone: '',
      password: '',
      role: 'VO',
      isDeveloper: false,
      district: selectedDistrict !== 'all' ? selectedDistrict : '',
      mandal: selectedMandal !== 'all' ? selectedMandal : '',
      village: selectedVillage !== 'all' ? selectedVillage : '',
      voID: '',
      voaName: ''
    });
    setShowAddModal(true);
  };

  // Fetch user uploads
  const fetchUserUploads = async (userId) => {
    setUploadsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/uploads?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUserUploads(data.uploads);
        setUploadsSummary(data.summary);
      } else {
        alert(data.message || 'Failed to fetch uploads');
      }
    } catch (err) {
      console.error('Error fetching user uploads:', err);
      alert('Failed to fetch uploads');
    } finally {
      setUploadsLoading(false);
    }
  };

  const handleViewUserUploads = (user) => {
    setSelectedUser(user);
    setShowUserUploads(true);
    fetchUserUploads(user._id);
  };

  const handleUpdateStatus = async () => {
    setUploading(true);
    if (!selectedUpload) return;
    try {
      const token = localStorage.getItem('token');
      console.log('Update Status Payload:', statusFormData);
      const res = await fetch(`${API_BASE}/api/admin/uploads/${selectedUpload._id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusFormData)
      });
      const data = await res.json();
      if (data.success) {
        alert('Status updated successfully!');
        setShowStatusModal(false);
        setSelectedUpload(null);
        // Refresh uploads
        fetchUserUploads(selectedUser._id);
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    } finally {
      setUploading(false);
    }
  };

  const openStatusModal = (upload) => {
    setSelectedUpload(upload);
    setStatusFormData({
      status: upload.status || 'pending',
      rejectionReason: upload.rejectionReason || ''
    });
    setShowStatusModal(true);
  };

  // Refresh uploads when filters change
  useEffect(() => {
    if (showUserUploads && selectedUser) {
      fetchUserUploads(selectedUser._id);
    }
  }, [filterMonth, filterYear]);

  const commitPage = () => {
    const value = Number(pageInput);

    if (!Number.isInteger(value)) {
      setPageInput(String(page));
      return;
    }

    if (value < 1) {
      setPage(1);
      setPageInput('1');
    } else if (value > totalPages) {
      setPage(totalPages);
      setPageInput(String(totalPages));
    } else {
      setPage(value);
    }
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();

    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-3xl p-4 sm:p-6 shadow-md border border-gray-100">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">VO Management</h2>
          <p className="text-[10px] sm:text-sm text-gray-500 font-bold mt-1">
            Managing <span className="text-indigo-600 font-black">{userCounts.vo}</span> VOs across <span className="text-indigo-600 font-black">{totalPages}</span> pages
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3.5 rounded-2xl hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3 transition-all font-black shadow-lg"
        >
          <div className="bg-white/20 p-1 rounded-lg">
            <Plus className="w-5 h-5" />
          </div>
          Create User
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Administrators', count: userCounts.admin, icon: Shield, color: 'from-purple-500 to-indigo-600' },
          { label: 'Village Orgs (VO)', count: userCounts.vo, icon: User, color: 'from-blue-500 to-cyan-600' },
          { label: 'Developers', count: userCounts.developer, icon: Lock, color: 'from-amber-500 to-orange-600' },
          { label: 'Total Accounts', count: userCounts.total, icon: CheckCircle, color: 'from-emerald-500 to-teal-600' }
        ].map((stat, i) => (
          <div key={i} className={`bg-white rounded-3xl p-4 sm:p-6 shadow-md border border-gray-100 flex items-center gap-4 sm:gap-5 transition-all hover:scale-[1.02]`}>
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg shrink-0`}>
              <stat.icon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 leading-none">{stat.count}</div>
              <div className="text-[9px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters Combined Card */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        <div className="p-8 space-y-8">
          {/* Search & Filter Row */}
          <div className="space-y-3">
            <label className="text-sm font-black text-gray-700 ml-1 uppercase tracking-wider">Quick Search</label>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1 w-full relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search Users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-12 sm:pr-14 py-4 sm:py-5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm sm:text-base font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-gray-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded-xl transition-all"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`w-full sm:w-auto self-stretch flex items-center justify-center gap-2 px-6 rounded-2xl font-black transition-all border-2 ${showFilters
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                  : 'bg-white text-indigo-600 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30'
                  }`}
              >
                <Filter className={`w-5 h-5 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                {!showFilters && (sortBy.length > 0 || selectedDistrict !== 'all') && (
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse border-2 border-white"></div>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Filters Section */}
          <div className={`space-y-6 sm:space-y-8 transition-all duration-500 ease-in-out overflow-hidden ${showFilters ? 'max-h-[1000px] opacity-100 mt-6 pt-6 sm:mt-8 sm:pt-8 border-t border-gray-100' : 'max-h-0 opacity-0'}`}>
            {/* Sort Controls Row */}
            <div className="">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <Filter className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Performance Sorting</h3>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Metric Selector and Individual Order Toggles */}
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {[
                      { id: 'pending', label: 'Pending' },
                      { id: 'uploaded', label: 'Uploaded' }
                    ].map(option => {
                      const active = sortBy.includes(option.id);
                      const currentOrder = sortOrders[option.id] || 'desc';

                      return (
                        <div key={option.id} className="flex bg-gray-100 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-gray-200 gap-1 sm:gap-1.5 items-center">
                          <button
                            onClick={() => {
                              setSortBy(prev =>
                                active ? prev.filter(v => v !== option.id) : [...prev, option.id]
                              );
                              setPage(1);
                            }}
                            className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all ${active
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-100'
                              }`}
                          >
                            {option.label}
                          </button>

                          {active && (
                            <div className="flex bg-white/50 p-1 rounded-lg gap-1 border border-gray-200/50">
                              {[
                                { id: 'desc', label: 'High' },
                                { id: 'asc', label: 'Low' }
                              ].map((order) => (
                                <button
                                  key={order.id}
                                  onClick={() => {
                                    setSortOrders(prev => ({ ...prev, [option.id]: order.id }));
                                    setPage(1);
                                  }}
                                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black transition-all ${currentOrder === order.id
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                    }`}
                                  title={order.id === 'desc' ? 'Highest First' : 'Lowest First'}
                                >
                                  {order.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {sortBy.length > 0 && (
                    <button
                      onClick={() => {
                        setSortBy([]);
                        setPage(1);
                      }}
                      className="px-4 py-2.5 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                    >
                      <X className="w-4 h-4" /> Clear Sorting
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filters Row */}
            <div className="pt-8 border-t border-gray-100/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2 rounded-xl">
                  <Filter className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Location Filters</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 ml-1 uppercase">District</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white"
                  >
                    <option value="all">All Districts</option>
                    {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 ml-1 uppercase">Mandal</label>
                  <select
                    value={selectedMandal}
                    onChange={(e) => setSelectedMandal(e.target.value)}
                    disabled={selectedDistrict === 'all'}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="all">All Mandals</option>
                    {mandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 ml-1 uppercase">Village</label>
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    disabled={selectedMandal === 'all'}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="all">All Villages</option>
                    {villages.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Table Card */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-24 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
            </div>
            <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Syncing user directory...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-24 text-center">
            <div className="bg-gray-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <User className="w-12 h-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">No users identified</h3>
            <p className="text-gray-500 font-medium">Try adjusting your filters or search criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={`hidden lg:block overflow-x-auto custom-scrollbar transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-indigo-700 text-white">
                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">User Profile</th>
                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">Access Level</th>
                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">Jurisdiction</th>
                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50 text-center">Operational Metrics</th>
                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider text-right">Control</th>
                  </tr>
                </thead>
                <tbody key={page} className="divide-y divide-gray-100 animate-slide-in">
                  {users.map((user) => {
                    const roleLower = (user.role || '').toLowerCase();
                    const isDev = roleLower.includes('developer');
                    const isAdmin = roleLower.includes('admin') && !isDev;
                    const isVO = roleLower.startsWith('vo') || roleLower === 'none' || !user.role;

                    return (
                      <tr key={user._id} className="hover:bg-indigo-50/30 transition-all group">
                        <td className="px-4 sm:px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isDev
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-100'
                              : isAdmin
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-100'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-100'
                              }`}>
                              {isDev ? <Lock className="w-5 h-5 sm:w-6 sm:h-6" /> : isAdmin ? <Shield className="w-5 h-5 sm:w-6 sm:h-6" /> : <User className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </div>
                            <div>
                              <div
                                className="text-sm font-black text-gray-900 leading-tight cursor-pointer hover:underline"
                                onClick={() => isVO && handleViewUserUploads(user)}
                              >
                                {user.voName}
                              </div>
                              <div className="flex flex-col mt-0.5">
                                {isVO && user.voID && (
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">ID: {user.voID}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-8 py-5 whitespace-nowrap">
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${isDev
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : isAdmin
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 sm:px-8 py-5">
                          <div className="flex items-start gap-3">
                            <div className="bg-gray-100 p-1.5 rounded-lg mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div className="text-xs">
                              {user.village && <div className="font-black text-gray-800 uppercase tracking-tight">{user.village}</div>}
                              <div className="text-gray-500 font-bold">{user.mandal}, {user.district}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-8 py-5 text-center">
                          {!isVO || isDev || isAdmin ? (
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Administrative Access</span>
                          ) : (
                            <div className="flex justify-center gap-6">
                              <div className="text-center group/metric">
                                <div className="text-base sm:text-lg font-black text-green-600 leading-none group-hover/metric:scale-110 transition-transform">{user.uploadedFiles || 0}</div>
                                <div className="text-[9px] font-black text-gray-400 uppercase mt-1">Uploaded</div>
                              </div>
                              <div className="text-center group/metric">
                                <div className="text-base sm:text-lg font-black text-orange-600 leading-none group-hover/metric:scale-110 transition-transform">{user.pendingFiles || 0}</div>
                                <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mt-1">Pending</div>
                              </div>
                              <div className="text-center group/metric border-l border-gray-100 pl-4 sm:pl-6">
                                <div className="text-base sm:text-lg font-black text-gray-900 leading-none group-hover/metric:scale-110 transition-transform">{user.totalFiles || 0}</div>
                                <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mt-1">Total</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 sm:px-8 py-5 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                              title="Edit User"
                            >
                              <Edit className="w-4.5 h-4.5" />
                            </button>
                            {(!isDev || isLoggedInDev) && (
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm"
                                title="Delete User"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden p-4 space-y-4">
              {users.map((user) => {
                const roleLower = (user.role || '').toLowerCase();
                const isDev = roleLower.includes('developer');
                const isAdmin = roleLower.includes('admin') && !isDev;
                const isVO = roleLower.startsWith('vo') || roleLower === 'none' || !user.role;

                return (
                  <div key={user._id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-slide-in">
                    <div className="p-5 space-y-4">
                      {/* Header Info */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${isDev
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                            : isAdmin
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                              : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            }`}>
                            {isDev ? <Lock className="w-6 h-6" /> : isAdmin ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
                          </div>
                          <div>
                            <div
                              className="text-base font-black text-gray-900 leading-tight"
                              onClick={() => isVO && handleViewUserUploads(user)}
                            >
                              {user.voName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${isDev
                                ? 'bg-amber-100 text-amber-700'
                                : isAdmin
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                                }`}>
                                {user.role}
                              </span>
                              {isVO && user.voID && (
                                <span className="text-[10px] font-black text-gray-400 uppercase">ID: {user.voID}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl"
                          >
                            <Edit className="w-4.5 h-4.5" />
                          </button>
                          {(!isDev || isLoggedInDev) && (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="p-2 bg-red-50 text-red-600 rounded-xl"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="bg-gray-50 rounded-2xl p-3 flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] font-bold text-gray-600">
                          {user.village && <span className="text-gray-900 font-black">{user.village}, </span>}
                          {user.mandal}, {user.district}
                        </div>
                      </div>

                      {/* Metrics */}
                      {isVO && !isDev && !isAdmin && (
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className="bg-green-50 rounded-2xl p-2.5 text-center">
                            <div className="text-lg font-black text-green-600 leading-none">{user.uploadedFiles || 0}</div>
                            <div className="text-[8px] font-black text-green-700/50 uppercase mt-1 tracking-tighter">Uploaded</div>
                          </div>
                          <div className="bg-orange-50 rounded-2xl p-2.5 text-center">
                            <div className="text-lg font-black text-orange-600 leading-none">{user.pendingFiles || 0}</div>
                            <div className="text-[8px] font-black text-orange-700/50 uppercase mt-1 tracking-tighter">Pending</div>
                          </div>
                          <div className="bg-indigo-50 rounded-2xl p-2.5 text-center">
                            <div className="text-lg font-black text-gray-900 leading-none">{user.totalFiles || 0}</div>
                            <div className="text-[8px] font-black text-indigo-700/50 uppercase mt-1 tracking-tighter">Total</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {isVO && !isDev && !isAdmin && (
                      <button
                        onClick={() => handleViewUserUploads(user)}
                        className="w-full py-3 bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                      >
                        View All Uploads
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="px-4 sm:px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest text-center sm:text-left transition-all">
              Showing <span className="text-indigo-600">{(page - 1) * limit + 1}</span> - <span className="text-indigo-600">{Math.min(page * limit, totalUsers)}</span> of <span className="text-gray-900">{totalUsers}</span> users
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2.5 rounded-xl border-2 border-gray-200 bg-white hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-400 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1 mx-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`min-w-[36px] h-[36px] sm:min-w-[44px] sm:h-[44px] font-black text-xs sm:text-sm rounded-lg sm:rounded-xl transition-all ${page === i + 1
                      ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-200 scale-110 z-10'
                      : 'bg-white text-gray-500 border-2 border-gray-100 hover:border-indigo-300'
                      }`}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2.5 rounded-xl border-2 border-gray-200 bg-white hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-400 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 ml-0 sm:ml-4 border-l-0 sm:border-l border-gray-200 pl-0 sm:pl-4">
                <span className="text-[10px] font-black text-gray-400 uppercase hidden xs:inline">Jump</span>
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={commitPage}
                  onKeyDown={(e) => e.key === 'Enter' && commitPage()}
                  className="w-10 h-8 sm:w-12 sm:h-9 bg-white border-2 border-gray-100 rounded-lg text-center text-[10px] sm:text-xs font-black focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {
        (showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4 !mt-0 animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-200">
              <div className="px-4 sm:px-8 py-6 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-2xl shadow-lg ${showAddModal ? 'bg-indigo-600' : 'bg-purple-600'} text-white`}>
                    {showAddModal ? <Plus className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 leading-tight">{showAddModal ? 'Register New User' : 'Update User Account'}</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{showAddModal ? 'System Onboarding' : 'Modify Credentials'}</p>
                  </div>
                </div>
                <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 sm:p-2.5 bg-white text-gray-400 hover:text-red-500 hover:shadow-md rounded-xl transition-all border border-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={showAddModal ? handleAddUser : handleEditUser} className="p-4 sm:p-8 overflow-y-auto space-y-6 sm:space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        {formData.role === 'VO' ? 'Village Org Name' : 'Administrator Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.voName}
                        onChange={(e) => setFormData({ ...formData, voName: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                        placeholder="e.g. Navodaya VO"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        Primary Contact / Login
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                        placeholder="+91"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        {showEditModal ? 'New Access Key (Optional)' : 'Secret Access Key'}
                      </label>
                      <input
                        type="password"
                        required={showAddModal}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        System Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      >
                        <option value="VO">Village Organization (VO)</option>
                        <option value="ADMIN">Administrator</option>
                      </select>

                      {isLoggedInDev && (
                        <div className="mt-4 flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <input
                            type="checkbox"
                            id="isDeveloper"
                            checked={formData.isDeveloper}
                            onChange={(e) => setFormData({ ...formData, isDeveloper: e.target.checked })}
                            className="w-5 h-5 rounded-lg border-2 border-amber-300 text-amber-600 focus:ring-amber-500 transition-all cursor-pointer"
                          />
                          <label htmlFor="isDeveloper" className="text-sm font-black text-amber-900 cursor-pointer select-none">
                            Enable Developer Access
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location & VO Details */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        District Jurisdiction
                      </label>
                      <select
                        value={formData.district}
                        required
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      >
                        <option value="">Select District</option>
                        {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-700 ml-1 uppercase">Mandal</label>
                        <select
                          value={formData.mandal}
                          required
                          onChange={(e) => setFormData({ ...formData, mandal: e.target.value, village: '' })}
                          disabled={!formData.district}
                          className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                        >
                          <option value="">Select Mandal</option>
                          {modalMandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-700 ml-1 uppercase">Village</label>
                        <select
                          value={formData.village}
                          required
                          onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                          disabled={!formData.mandal}
                          className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                        >
                          <option value="">Select Village</option>
                          {modalVillages.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {formData.role === 'VO' && (
                      <div className="bg-indigo-50/50 p-6 rounded-[24px] border border-indigo-100 space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                            Official VO ID
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.voID}
                            onChange={(e) => setFormData({ ...formData, voID: e.target.value })}
                            className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all"
                            placeholder="Unique VO Identifier"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            Representative VOA Name
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.voaName}
                            onChange={(e) => setFormData({ ...formData, voaName: e.target.value })}
                            className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all"
                            placeholder="Full Name"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-100 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                    className="flex-1 px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black min-h-[56px] transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-[2] px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black min-h-[56px] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-70 disabled:grayscale"
                  >
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (showAddModal ? <Plus className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />)}
                    {showAddModal ? 'Initialize User' : 'Update Credentials'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* User Uploads Modal */}
      {
        showUserUploads && selectedUser && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 !mt-0 animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20">
              {/* Header */}
              <div className="px-4 sm:px-8 py-3 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex justify-between items-center mb-2 sm:mb-4">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">{selectedUser.voName}'s Uploads</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] sm:text-sm text-white/80 font-bold uppercase tracking-wider">VO ID: {selectedUser.voID}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUserUploads(false)} className="p-1.5 sm:p-2.5 bg-white/20 text-white hover:bg-white/30 hover:shadow-md rounded-xl transition-all border border-white/30">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Filters and Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
                  <div className='flex items-center gap-2 sm:gap-3'>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2.5 border-2 border-white/30 rounded-xl bg-white/95 text-[11px] sm:text-sm font-bold focus:border-white focus:outline-none transition-all text-gray-700 w-28 sm:w-36"
                    >
                      <option value="">All Months</option>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <option key={m} value={m}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m) - 1]}</option>
                      ))}
                    </select>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2.5 border-2 border-white/30 rounded-xl bg-white/95 text-[11px] sm:text-sm font-bold focus:border-white focus:outline-none transition-all text-gray-700 w-24 sm:w-32"
                    >
                      <option value="">All Years</option>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {uploadsSummary && (
                    <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 min-w-[70px] sm:min-w-0">
                        <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase">Pending</div>
                        <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.pending}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 min-w-[70px] sm:min-w-0">
                        <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase">Validated</div>
                        <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.validated}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 min-w-[70px] sm:min-w-0">
                        <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase">Rejected</div>
                        <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.rejected}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50/50 custom-scrollbar">
                {uploadsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-3" />
                      <p className="text-gray-600 font-bold">Loading uploads...</p>
                    </div>
                  </div>
                ) : userUploads.length === 0 ? (
                  <div className="text-center py-20">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 font-bold text-lg">No uploads found</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Pending Section */}
                    {userUploads.filter(u => u.status === 'pending').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-3 border-2 border-orange-300 shadow-sm">
                          <AlertCircle className="text-orange-500" size={24} />
                          <h4 className="text-lg font-black text-gray-900">
                            Pending Uploads
                            <span className="ml-2 text-sm font-normal text-gray-500">({userUploads.filter(u => u.status === 'pending').length})</span>
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userUploads.filter(u => u.status === 'pending').map(upload => (
                            <div key={upload._id} className="relative border-2 border-orange-300 bg-orange-50 rounded-2xl p-4 transition-all hover:shadow-lg hover:border-orange-400">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-gray-900 truncate">{upload.shgName}</h4>
                                  <p className="text-xs text-gray-600">SHG ID: {upload.shgID}</p>
                                </div>
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-orange-200 text-orange-800">
                                  Pending
                                </span>
                              </div>

                              <div className="space-y-2 text-xs mb-3">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                                <div className="text-gray-600 truncate" title={upload.originalFilename}>
                                  {upload.originalFilename}
                                </div>
                              </div>

                              <button
                                onClick={() => openStatusModal(upload)}
                                className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                              >
                                Update Status
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validated Section */}
                    {userUploads.filter(u => u.status === 'validated').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-3 border-2 border-green-300 shadow-sm">
                          <CheckCircle className="text-green-500" size={24} />
                          <h4 className="text-lg font-black text-gray-900">
                            Validated Uploads
                            <span className="ml-2 text-sm font-normal text-gray-500">({userUploads.filter(u => u.status === 'validated').length})</span>
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {userUploads.filter(u => u.status === 'validated').map(upload => (
                            <div key={upload._id} className="relative border-2 border-green-300 bg-green-50 rounded-2xl p-3 transition-all hover:shadow-lg hover:border-green-400">
                              <div className="mb-2">
                                <h4 className="font-bold text-xs text-gray-900 truncate">{upload.shgName}</h4>
                                <p className="text-[10px] text-gray-600">SHG ID: {upload.shgID}</p>
                              </div>

                              <div className="space-y-1 text-[10px] mb-2">
                                <div className="flex items-center gap-1 text-gray-600">
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => openStatusModal(upload)}
                                className="w-full px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[10px] transition-all"
                              >
                                Details
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rejected Section */}
                    {userUploads.filter(u => u.status === 'rejected').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-3 border-2 border-red-300 shadow-sm">
                          <AlertTriangle className="text-red-500" size={24} />
                          <h4 className="text-lg font-black text-gray-900">
                            Rejected Uploads
                            <span className="ml-2 text-sm font-normal text-gray-500">({userUploads.filter(u => u.status === 'rejected').length})</span>
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userUploads.filter(u => u.status === 'rejected').map(upload => (
                            <div key={upload._id} className="relative border-2 border-red-300 bg-red-50 rounded-2xl p-4 transition-all hover:shadow-lg hover:border-red-400">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-gray-900 truncate">{upload.shgName}</h4>
                                  <p className="text-xs text-gray-600">SHG ID: {upload.shgID}</p>
                                </div>
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-red-200 text-red-800">
                                  Rejected
                                </span>
                              </div>

                              <div className="space-y-2 text-xs mb-3">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                                {upload.rejectionReason && (
                                  <div className="bg-white rounded-lg p-2 border-l-4 border-red-500">
                                    <p className="text-[10px] font-bold text-red-600 mb-1">Reason:</p>
                                    <p className="text-xs text-gray-800">{upload.rejectionReason}</p>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => openStatusModal(upload)}
                                className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                              >
                                Update Status
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-4 border-t border-gray-100 bg-white">
                <button
                  onClick={() => setShowUserUploads(false)}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black transition-all shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Status Update Modal */}
      {
        showStatusModal && selectedUpload && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Update Upload Status</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedUpload.shgName} ({selectedUpload.shgID})</p>
                </div>
                <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview */}
              {selectedUpload.s3Url && (
                <div className="mb-6 bg-gray-50 rounded-2xl overflow-hidden border-2 border-gray-200">
                  <img
                    src={selectedUpload.s3Url}
                    alt={selectedUpload.shgName}
                    className="w-full max-h-96 object-contain"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFormData.status}
                    onChange={(e) => setStatusFormData({ ...statusFormData, status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    <option value="pending">Pending</option>
                    <option value="validated">Validated</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {statusFormData.status === 'rejected' && (
                  <div>
                    <label className="block text-sm font-black text-gray-700 mb-2">Reason for Rejection</label>
                    <textarea
                      value={statusFormData.rejectionReason}
                      onChange={(e) => setStatusFormData({ ...statusFormData, rejectionReason: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 focus:outline-none transition-all"
                      rows="3"
                      placeholder="e.g., Poor image quality, Blurry, Incomplete data, Please ensure document is clear and complete"
                    />
                    <p className="mt-1 text-xs text-gray-600 font-bold">
                      This will be shown to VO users. Leave empty to show default guidelines.
                    </p>
                    <p className="mt-2 text-xs text-red-600 font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Warning: File will be permanently deleted from database when rejected
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-black transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={uploading}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:grayscale shadow-md"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default UsersTab;
