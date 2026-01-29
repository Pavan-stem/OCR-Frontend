import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Folder, Filter, Loader2, X, Shield, User, MapPin, Phone, Lock, CheckCircle, Search, ChevronLeft, ChevronRight, FileText, Calendar, AlertCircle, AlertTriangle, Settings, Power, Clock, Download, Eye } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
const REJECTION_REASONS = [
  "Follow guidelines",
  "Table was cut off",
  "There are dark shadows",
  "table wasn't visible",
  "wrong table",
  "There was too much blur",
  "There was background noise use plane background",
  "Table was bent",
  "Table was rotated",
  "Wrong Image"
];

const UsersTab = ({ filterProps }) => {
  const formatLastActive = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      // Ensure dateStr is treated as UTC if it's an ISO string without Z/offset
      let sanitizedStr = dateStr;
      if (typeof dateStr === 'string' && dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        sanitizedStr = dateStr + 'Z';
      }
      const date = new Date(sanitizedStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return 'Unknown';
    }
  };

  const currentUserRole = (() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      return (userData?.role || '').toLowerCase();
    } catch (e) {
      return '';
    }
  })();

  const isDeveloperUser = (() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const role = (userData?.role || '').toLowerCase();
      return role.includes('developer');
    } catch (e) {
      return false;
    }
  })();

  // Check if user can edit/delete another user based on permissions
  const canEditUser = (targetUser) => {
    const targetRoleLower = (targetUser?.role || 'vo').toLowerCase();
    const targetIsVO = targetRoleLower.startsWith('vo') || targetRoleLower === 'none' || !targetUser?.role;

    if (currentUserRole.includes('admin - cc')) {
      return false; // CC cannot edit anyone
    }

    if (currentUserRole.includes('admin - apm')) {
      // APM can only edit VOs
      return targetIsVO;
    }

    // Admin and Developer can edit everyone
    return true;
  };

  const canDeleteUser = (targetUser) => {
    const targetRoleLower = (targetUser?.role || 'vo').toLowerCase();
    const targetIsVO = targetRoleLower.startsWith('vo') || targetRoleLower === 'none' || !targetUser?.role;
    const targetIsDev = targetRoleLower.includes('developer');
    const isLoggedInDev = currentUserRole.includes('developer');

    if (currentUserRole.includes('admin - cc')) {
      return false; // CC cannot delete anyone
    }

    if (currentUserRole.includes('admin - apm')) {
      // APM can only delete VOs
      return targetIsVO;
    }

    // Admin can delete non-developers or developers can delete developers
    if (!targetIsDev || isLoggedInDev) {
      return true;
    }

    return false;
  };

  const canViewUserUploads = (targetUser) => {
    const targetRoleLower = (targetUser?.role || 'vo').toLowerCase();
    const targetIsVO = targetRoleLower.startsWith('vo') || targetRoleLower === 'none' || !targetUser?.role;

    // Folder button only shows for VO users (since only VOs have uploads)
    // Admin - CC, Admin - APM, and Admin users can view VO uploads if needed
    return targetIsVO;
  };

  const canCreateUser = (roleToCreate) => {
    const roleToCreateLower = (roleToCreate || 'vo').toLowerCase();

    if (currentUserRole.includes('admin - cc')) {
      return false; // CC cannot create anything
    }

    if (currentUserRole.includes('admin - apm')) {
      // APM can only create VOs
      return roleToCreateLower.startsWith('vo') || roleToCreateLower === 'vo';
    }

    // Admin and Developer can create any role
    return true;
  };

  const downloadImage = (url, filename) => {
    if (!url) return;
    // We now rely on the backend setting Content-Disposition for the presigned URL
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename || 'download.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadUserData = (user) => {
    try {
      const roleLower = (user.role || '').toLowerCase();
      const isCC = roleLower.includes('admin - cc');

      // Prepare data rows
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'VO Name,VO ID,Uploaded,Pending,Total\n';

      if (isCC && user.vos && user.vos.length > 0) {
        // For CC: download all mapped VOs
        let totalUploaded = 0;
        let totalPending = 0;
        let totalShgs = 0;

        user.vos.forEach(vo => {
          csvContent += `"${vo.voName}","'${vo.voID}",${vo.uploadedFiles || 0},${vo.pendingFiles || 0},${vo.totalFiles || 0}\n`;
          totalUploaded += vo.uploadedFiles || 0;
          totalPending += vo.pendingFiles || 0;
          totalShgs += vo.totalFiles || 0;
        });

        // Add total row
        csvContent += `"Total","","${totalUploaded}","${totalPending}","${totalShgs}"\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${user.voName}_VOs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For VO: download single VO data
        csvContent += `"${user.voName}","'${user.voID}",${user.uploadedFiles || 0},${user.pendingFiles || 0},${user.totalFiles || 0}\n`;
        csvContent += `"Total","","${user.uploadedFiles || 0}","${user.pendingFiles || 0}","${user.totalFiles || 0}"\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${user.voName}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error downloading user data:', err);
      alert('Failed to download user data');
    }
  };

  const { selectedDistrict, setSelectedDistrict, selectedMandal, setSelectedMandal, selectedVillage, setSelectedVillage, serverStatus, setSelectedUserId, setSelectedUserName, setActiveTab } = filterProps;


  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination states
  const PAGE_KEY = 'usersTabPage_pigmentation'; // change per tab
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem(PAGE_KEY) || localStorage.getItem('usersTabPage');
    return saved ? parseInt(saved) : 1;
  });
  const [pageInput, setPageInput] = useState(() => {
    const saved = localStorage.getItem(PAGE_KEY) || localStorage.getItem('usersTabPage');
    return saved || '1';
  });
  const isAutoFilling = useRef(true);
  const isFirstRender = useRef(true);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userCounts, setUserCounts] = useState({ admin: 0, vo: 0, developer: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('usersTabSearchTerm') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Sorting state
  const [sortBy, setSortBy] = useState([]);
  const [sortOrders, setSortOrders] = useState({ pending: 'desc', uploaded: 'desc' });

  // User uploads modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserUploads, setShowUserUploads] = useState(false);
  const [userUploads, setUserUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsSummary, setUploadsSummary] = useState(null);
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = String(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(() => sessionStorage.getItem('usersTabFilterMonth') || currentMonth);
  const [filterYear, setFilterYear] = useState(() => sessionStorage.getItem('usersTabFilterYear') || currentYear);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [status, setStatus] = useState('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageData, setViewerImageData] = useState({ url: '', title: '', subtitle: '', filename: '' });

  const openImageViewer = (upload) => {
    setViewerImageData({
      url: upload.s3Url,
      title: upload.shgName,
      subtitle: `SHG ID: '${upload.shgID}`,
      filename: `${upload.shgName}_${upload.shgID}.jpg`
    });
    setShowImageViewer(true);
  };

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

  // Lock body scroll when any modal is open to prevent background scrolling
  // usage of useLayoutEffect prevents flicker/shifting when switching between modals
  useLayoutEffect(() => {
    const isAnyModalOpen = showAddModal || showEditModal || showUserUploads || showStatusModal || showImageViewer;

    if (isAnyModalOpen) {
      // Calculate scrollbar width to prevent content shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(document.body).paddingRight;

      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [showAddModal, showEditModal, showUserUploads, showStatusModal, showImageViewer]);

  // Form state
  const [formData, setFormData] = useState({
    voName: '',
    phone: '',
    password: '',
    role: 'VO',
    isDeveloper: false,
    district: '',
    mandal: '',
    village: '',
    voID: '',
    voaName: '',
    clusterID: '',
    clusterName: '',
    userID: '',
    userName: ''
  });

  // Modal-specific location states to avoid overriding global filters
  const [modalMandals, setModalMandals] = useState([]);
  const [modalVillages, setModalVillages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [maintenanceStatus, setMaintenanceStatus] = useState({ is_active: false, message: 'Server is under maintenance', end_time: null });
  const [lastSynced, setLastSynced] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);
  const [isMaintenanceCollapsed, setIsMaintenanceCollapsed] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (userId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

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

  // No-op - moved to consolidated effect below

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

  // Persist states in sessionStorage and sync UI
  useEffect(() => {
    localStorage.setItem(PAGE_KEY, page);
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    sessionStorage.setItem('usersTabSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    sessionStorage.setItem('usersTabFilterMonth', filterMonth);
  }, [filterMonth]);

  useEffect(() => {
    sessionStorage.setItem('usersTabFilterYear', filterYear);
  }, [filterYear]);

  // Handle Scroll Position Persistence
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('usersTabScrollPos', window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Only reset to page 1 if search term actually changed and it's not the mount
      if (searchTerm !== debouncedSearchTerm && !isFirstRender.current) {
        setPage(1);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Mark mount completed AFTER all on-mount effect cycles
  useEffect(() => {
    isFirstRender.current = false;
    isAutoFilling.current = false;
  }, []);

  // Explicit handlers for user-initiated filter changes
  const onDistrictChange = (value) => {
    setSelectedDistrict(value);
    setPage(1);
  };

  const onMandalChange = (value) => {
    setSelectedMandal(value);
    setPage(1);
  };

  const onVillageChange = (value) => {
    setSelectedVillage(value);
    setPage(1);
  };

  const onMonthChange = (value) => {
    setFilterMonth(value);
    setPage(1);
  };

  const onYearChange = (value) => {
    setFilterYear(value);
    setPage(1);
  };

  // Fetch users from backend
  const fetchUsers = async (options = {}) => {
    const isBackground = options.isBackground || false;
    if (!serverStatus.active) return;

    if (!isBackground) {
      setLoading(true);
      setIsTransitioning(true);
    }

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
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

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
      if (!isBackground) {
        setLoading(false);
        setTimeout(() => {
          setIsTransitioning(false);
          // Restore scroll position after data fetch and UI transition
          const savedScrollPos = sessionStorage.getItem('usersTabScrollPos');
          if (savedScrollPos) {
            window.scrollTo({ top: parseInt(savedScrollPos), behavior: 'instant' });
            // Optionally clear it after restoration if you only want it to happen once per 'back' navigation
            // but for refresh persistence, we keep it.
          }
        }, 300);
      }
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
  }, [serverStatus.active, page, limit, debouncedSearchTerm, selectedDistrict, selectedMandal, selectedVillage, sortBy, sortOrders, filterMonth, filterYear]);

  // Periodic refresh for users list (to update online status dots)
  useEffect(() => {
    if (!serverStatus.active) return;

    const interval = setInterval(() => {
      fetchUsers({ isBackground: true });
      fetchUserCounts();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [serverStatus.active, page, limit, debouncedSearchTerm, selectedDistrict, selectedMandal, selectedVillage, sortBy, sortOrders, filterMonth, filterYear]);

  // Handle auto-fill for restricted roles
  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
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
    } catch (e) {
      console.error('Failed to parse user for auto-fill', e);
    }
  }, [selectedDistrict, selectedMandal, setSelectedDistrict, setSelectedMandal]);

  // Dedicated Maintenance Polling for Admin
  useEffect(() => {
    fetchMaintenanceStatus();
    const interval = setInterval(fetchMaintenanceStatus, 20000); // Sync every 20s
    return () => clearInterval(interval);
  }, []);

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance-status`);
      const data = await res.json();
      if (data.success) {
        setMaintenanceStatus({
          is_active: data.is_active,
          message: data.message,
          end_time: data.end_time
        });
        setLastSynced(new Date());
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Error fetching maintenance status:', err);
      setIsConnected(false);
    }
  };

  const handleUpdateMaintenance = async (payload) => {
    setUpdatingMaintenance(true);
    try {
      const token = localStorage.getItem('token');
      const { end_time, ...rest } = payload;
      let utcEndTime = end_time;
      if (end_time && !end_time.endsWith('Z')) {
        // new Date('2026-01-08T10:00') creates a local date, .toISOString() converts to UTC
        utcEndTime = new Date(end_time).toISOString();
      }

      const res = await fetch(`${API_BASE}/api/maintenance-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...rest, end_time: utcEndTime })
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceStatus(payload);
        alert('Maintenance status updated successfully');
      } else {
        alert(data.error || 'Failed to update maintenance status');
      }
    } catch (err) {
      console.error('Error updating maintenance status:', err);
      alert('Error updating maintenance status');
    } finally {
      setUpdatingMaintenance(false);
    }
  };

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
        setFormData({
          voName: '', phone: '', password: '', role: 'VO', isDeveloper: false,
          district: '', mandal: '', village: '',
          voID: '', voaName: '',
          clusterID: '', clusterName: '',
          userID: '', userName: ''
        });
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
    const roleRaw = user.role || 'VO';
    const baseRole = roleRaw.split(' - ')[0];
    const isDeveloper = roleRaw.toUpperCase().includes('DEVELOPER');

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
      voaName: user.voaName || '',
      clusterID: user.clusterID || '',
      clusterName: user.clusterName || '',
      userID: user.userID || '',
      userName: user.userName || ''
    });
    setShowEditModal(true);
  };

  const openAddModal = () => {
    let initialDistrict = selectedDistrict !== 'all' ? selectedDistrict : '';
    let initialMandal = selectedMandal !== 'all' ? selectedMandal : '';

    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const role = (userData?.role || '').toLowerCase();
      if (role.includes('admin - apm') || role.includes('admin - cc')) {
        initialDistrict = userData.district || initialDistrict;
        initialMandal = userData.mandal || initialMandal;
      }
    } catch (e) {
      console.error('Failed to pre-fill modal location', e);
    }

    setFormData({
      voName: '',
      phone: '',
      password: '',
      role: 'VO',
      isDeveloper: false,
      district: initialDistrict,
      mandal: initialMandal,
      village: selectedVillage !== 'all' ? selectedVillage : '',
      voID: '',
      voaName: '',
      clusterID: '',
      clusterName: '',
      userID: '',
      userName: ''
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

    const finalStatus = 'rejected'; // ← source of truth

    try {
      const token = localStorage.getItem('token');

      console.log('Update Status Payload:', {
        status: finalStatus,
        rejectionReason
      });

      const res = await fetch(
        `${API_BASE}/api/admin/uploads/${selectedUpload._id}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: finalStatus,
            rejectionReason
          })
        }
      );

      const data = await res.json();
      if (data.success) {
        alert('Status updated successfully!');
        setShowStatusModal(false);
        setSelectedUpload(null);
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

  const handleQuickStatusUpdate = async (upload, status, reason = REJECTION_REASONS[0]) => {
    if (uploading) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        status: status,
        rejectionReason: reason
      };

      const res = await fetch(`${API_BASE}/api/admin/uploads/${upload._id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
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
    setStatus(upload.status || 'pending');
    setRejectionReason(upload.rejectionReason || '');
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
    if (!timestamp) return '';

    // Ensure timestamp is treated as UTC if it's an ISO string without Z/offset
    let sanitizedTs = timestamp;
    if (typeof timestamp === 'string' && timestamp.includes('T') && !timestamp.endsWith('Z') && !timestamp.includes('+')) {
      sanitizedTs = timestamp + 'Z';
    }

    const date = new Date(sanitizedTs);

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();

    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  return (
    <div className="relative overflow-x-hidden min-h-screen">
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
          {(() => {
            try {
              const userData = JSON.parse(localStorage.getItem('user'));
              const role = (userData?.role || '').toLowerCase();
              // Check if user can add new users (anyone except CC)
              if (!role.includes('admin - cc')) {
                return (
                  <button
                    onClick={openAddModal}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3.5 rounded-2xl hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3 transition-all font-black shadow-lg"
                  >
                    <div className="bg-white/20 p-1 rounded-lg">
                      <Plus className="w-5 h-5" />
                    </div>
                    Add User
                  </button>
                );
              }
            } catch (e) {
              console.error('Error checking user role', e);
            }
            return null;
          })()}
        </div>

        {/* Maintenance Controls - Admin/Dev Only */}
        {isDeveloperUser && (
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${maintenanceStatus.is_active ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-2">
                    System Maintenance
                    {!isConnected && (
                      <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">
                        <AlertCircle className="w-3 h-3" /> Offline
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                    {isConnected ? `Synced ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connection Lost'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setIsMaintenanceCollapsed(!isMaintenanceCollapsed)}
                  className="px-4 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-100 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {isMaintenanceCollapsed ? 'Open Controls' : 'Close Controls'}
                </button>
                <button
                  onClick={() => handleUpdateMaintenance({ ...maintenanceStatus, is_active: !maintenanceStatus.is_active })}
                  disabled={updatingMaintenance}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${maintenanceStatus.is_active
                    ? 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-600 hover:text-white'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white'
                    }`}
                >
                  <Power className="w-4 h-4" />
                  <div className="flex flex-col items-center">
                    <span>{maintenanceStatus.is_active ? 'Stop Maintenance' : 'Start Maintenance'}</span>
                  </div>
                </button>
              </div>
            </div>

            {!isMaintenanceCollapsed && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-widest">Maintenance Message</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={maintenanceStatus.message}
                        onChange={(e) => setMaintenanceStatus({ ...maintenanceStatus, message: e.target.value })}
                        placeholder="server is under maintenance"
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-widest">Estimated End Time / Timer (Optional)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="datetime-local"
                          value={maintenanceStatus.end_time ?
                            (() => {
                              const d = new Date(maintenanceStatus.end_time);
                              // Format to YYYY-MM-DDTHH:mm in local time
                              return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            })() : ''
                          }
                          onChange={(e) => setMaintenanceStatus({ ...maintenanceStatus, end_time: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                        />
                      </div>
                      <button
                        onClick={() => handleUpdateMaintenance(maintenanceStatus)}
                        disabled={updatingMaintenance}
                        className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-[10px] font-bold">
                  <Shield className="w-4 h-4 shrink-0" />
                  Note: System maintenance will log out all non-admin users and block new logins.
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-6 ${currentUserRole.includes('admin - cc')
          ? 'grid-cols-1 hidden'
          : currentUserRole.includes('admin - apm')
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}>
          {[
            { label: 'Administrators', count: userCounts.admin, icon: Shield, color: 'from-purple-500 to-indigo-600', show: !currentUserRole.includes('admin - cc') && !currentUserRole.includes('admin - apm') },
            { label: 'CCs', count: userCounts.admin, icon: Shield, color: 'from-purple-500 to-indigo-600', show: currentUserRole.includes('admin - apm') },
            { label: 'Village VOs', count: userCounts.vo, icon: User, color: 'from-blue-500 to-cyan-600', show: !currentUserRole.includes('admin - cc') },
            { label: 'Developers', count: userCounts.developer, icon: Lock, color: 'from-amber-500 to-orange-600', show: !currentUserRole.includes('admin - cc') && !currentUserRole.includes('admin - apm') },
            { label: 'Total Accounts', count: userCounts.total, icon: CheckCircle, color: 'from-emerald-500 to-teal-600', show: !currentUserRole.includes('admin - cc') }
          ].filter(stat => stat.show).map((stat, i) => (
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

              {/* Period Filters row */}
              <div className="pt-8 border-t border-gray-100/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Time Period Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 ml-1 uppercase">Month</label>
                    <select
                      value={filterMonth}
                      onChange={(e) => onMonthChange(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white"
                    >
                      <option value="">All Months</option>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <option key={m} value={m}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m) - 1]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 ml-1 uppercase">Year</label>
                    <select
                      value={filterYear}
                      onChange={(e) => onYearChange(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white"
                    >
                      <option value="">All Years</option>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
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
                  {!(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 ml-1 uppercase">District</label>
                        <select
                          value={selectedDistrict}
                          onChange={(e) => onDistrictChange(e.target.value)}
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
                          onChange={(e) => onMandalChange(e.target.value)}
                          disabled={selectedDistrict === 'all'}
                          className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="all">All Mandals</option>
                          {mandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 ml-1 uppercase">Village</label>
                    <select
                      value={selectedVillage}
                      onChange={(e) => onVillageChange(e.target.value)}
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
                      <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">SHG Profile</th>
                      <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">Roles</th>
                      <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50">Location</th>
                      <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider border-r border-indigo-600/50 text-center">Uploads Tracking</th>
                      <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-wider text-right">
                        {currentUserRole.includes('admin - cc') ? 'Conversion' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody key={page} className="divide-y divide-gray-100 animate-slide-in">
                    {users.map((user) => {
                      const roleLower = (user.role || '').toLowerCase();
                      const isDev = roleLower.includes('developer');
                      const isAdmin = roleLower.includes('admin') && !isDev;
                      const isVO = roleLower.startsWith('vo') || roleLower === 'none' || !user.role;
                      const isExpanded = expandedRows.has(user._id);

                      const renderUserRow = (u, isNested = false) => {
                        const uRoleLower = (u.role || '').toLowerCase();
                        const uIsDev = uRoleLower.includes('developer');
                        const uIsAdmin = uRoleLower.includes('admin') && !uIsDev;
                        const uIsVO = uRoleLower.startsWith('vo') || uRoleLower === 'none' || !u.role;

                        return (
                          <tr key={u._id} className={`hover:bg-indigo-50/30 transition-all group ${isNested ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-4 sm:px-8 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3 sm:gap-4">
                                {u.isHierarchical && (
                                  <button
                                    onClick={() => toggleRow(u._id)}
                                    className="p-1.5 hover:bg-indigo-100 rounded-xl transition-all text-indigo-600"
                                  >
                                    <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                  </button>
                                )}
                                {isNested && <div className="ml-8 w-px h-10 bg-indigo-100 hidden sm:block"></div>}
                                <div className={`${isNested ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-10 h-10 sm:w-12 sm:h-12'} rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${uIsDev
                                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-100'
                                  : uIsAdmin
                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-100'
                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-100'
                                  }`}>
                                  {uIsDev ? <Lock className={isNested ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} /> : uIsAdmin ? <Shield className={isNested ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} /> : <User className={isNested ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"} />}
                                </div>
                                <div>
                                  <div
                                    className={`${isNested ? 'text-xs' : 'text-sm'} font-black text-gray-900 leading-tight cursor-pointer hover:underline flex items-center gap-2`}
                                    onClick={() => uIsVO && handleViewUserUploads(u)}
                                  >
                                    {u.voName}
                                    {u.isOnline && (
                                      <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" title="Online"></span>
                                    )}
                                  </div>
                                  <div className="flex flex-col mt-0.5">
                                    {uIsVO && u.voID && (
                                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">ID: {u.voID}</span>
                                    )}
                                    {uRoleLower.includes('admin - apm') && u.userID && (
                                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">ID: {u.userID}</span>
                                    )}
                                    {uRoleLower.includes('admin - cc') && u.clusterID && (
                                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">ID: {u.clusterID}</span>
                                    )}
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="w-2.5 h-2.5 text-gray-400" />
                                      <span className="text-[9px] font-bold text-gray-400 uppercase">Active: {formatLastActive(u.lastActiveAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 sm:px-8 py-5 whitespace-nowrap">
                              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${uIsDev
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : uIsAdmin
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                                }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 sm:px-8 py-5">
                              <div className="flex items-start gap-3">
                                <div className="bg-gray-100 p-1.5 rounded-lg mt-0.5">
                                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                                </div>
                                <div className="text-xs">
                                  {u.village && <div className="font-black text-gray-800 uppercase tracking-tight">{u.village}</div>}
                                  <div className="text-gray-500 font-bold">{u.mandal}, {u.district}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 sm:px-8 py-5 text-center">
                              {uIsDev ? (
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Developer Access</span>
                              ) : (uIsVO || (uIsAdmin && u.uploadedFiles !== undefined)) ? (
                                <div className="flex justify-center gap-6">
                                  <div className="text-center group/metric">
                                    <div className="text-base sm:text-lg font-black text-green-600 leading-none group-hover/metric:scale-110 transition-transform">{u.uploadedFiles || 0}</div>
                                    <div className="text-[9px] font-black text-gray-400 uppercase mt-1">Uploaded</div>
                                  </div>
                                  <div className="text-center group/metric">
                                    <div className="text-base sm:text-lg font-black text-orange-600 leading-none group-hover/metric:scale-110 transition-transform">{u.pendingFiles || 0}</div>
                                    <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mt-1">Pending</div>
                                  </div>
                                  <div className="text-center group/metric border-l border-gray-100 pl-4 sm:pl-6">
                                    <div className="text-base sm:text-lg font-black text-gray-900 leading-none group-hover/metric:scale-110 transition-transform">{u.totalFiles || 0}</div>
                                    <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase mt-1">Total</div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">N/A</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-8 py-5 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-3 transition-opacity">
                                {canViewUserUploads(u) && (
                                  <button
                                    onClick={() => {
                                      setSelectedUserId(u._id);
                                      setSelectedUserName(u.voName);
                                      setActiveTab('conversion');
                                    }}
                                    className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                                    title="View Converted SHGs"
                                  >
                                    <Folder className="w-4.5 h-4.5" />
                                  </button>
                                )}
                                {/* Download Button for CCs - Visible to Admins, Developers, and APMs */}
                                {((currentUserRole.includes('admin') || currentUserRole.includes('developer')) && (u.role || '').toLowerCase().includes('admin - cc')) && (
                                  <button
                                    onClick={() => downloadUserData(u)}
                                    className="p-2.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white rounded-xl transition-all shadow-sm"
                                    title="Download CC Data"
                                  >
                                    <Download className="w-4.5 h-4.5" />
                                  </button>
                                )}
                                {canEditUser(u) && (
                                  <button
                                    onClick={() => openEditModal(u)}
                                    className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                                    title="Edit User"
                                  >
                                    <Edit className="w-4.5 h-4.5" />
                                  </button>
                                )}
                                {canDeleteUser(u) && (
                                  <button
                                    onClick={() => handleDeleteUser(u._id)}
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
                      };

                      return (
                        <React.Fragment key={user._id}>
                          {renderUserRow(user)}
                          {isExpanded && user.vos && user.vos.length > 0 && user.vos.map(vo => renderUserRow(vo, true))}
                        </React.Fragment>
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
                  const isExpanded = expandedRows.has(user._id);

                  const renderUserCard = (u, isNested = false) => {
                    const uRoleLower = (u.role || '').toLowerCase();
                    const uIsDev = uRoleLower.includes('developer');
                    const uIsAdmin = uRoleLower.includes('admin') && !uIsDev;
                    const uIsVO = uRoleLower.startsWith('vo') || uRoleLower === 'none' || !u.role;

                    return (
                      <div key={u._id} className={`${isNested ? 'bg-gray-50/80 mt-2' : 'bg-white'} rounded-3xl border border-gray-100 shadow-sm overflow-hidden`}>
                        <div className="p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className={`${isNested ? 'w-10 h-10' : 'w-12 h-12'} rounded-2xl flex items-center justify-center shadow-md grow-0 shrink-0 ${uIsDev
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                              : uIsAdmin
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                              }`}>
                              {uIsDev ? <Lock className="w-5 h-5" /> : uIsAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-base font-black text-gray-900 leading-tight flex items-center gap-2"
                                onClick={() => uIsVO && handleViewUserUploads(u)}
                              >
                                {u.voName}
                                {u.isOnline && (
                                  <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse shrink-0" title="Online"></span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${uIsDev
                                  ? 'bg-amber-100 text-amber-700'
                                  : uIsAdmin
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-blue-100 text-blue-700'
                                  }`}>
                                  {u.role}
                                </span>
                                {uIsVO && u.voID && (
                                  <span className="text-[10px] font-black text-gray-400 uppercase">ID: {u.voID}</span>
                                )}
                                {uRoleLower.includes('admin - apm') && u.userID && (
                                  <span className="text-[10px] font-black text-gray-400 uppercase">ID: {u.userID}</span>
                                )}
                                {uRoleLower.includes('admin - cc') && u.clusterID && (
                                  <span className="text-[10px] font-black text-gray-400 uppercase">ID: {u.clusterID}</span>
                                )}
                              </div>
                            </div>
                            {u.isHierarchical && (
                              <button
                                onClick={() => toggleRow(u._id)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl transition-all"
                              >
                                <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                          </div>

                          {(uIsVO || (uIsAdmin && u.uploadedFiles !== undefined)) && (
                            <div className="grid grid-cols-3 gap-2 pt-2">
                              <div className="bg-green-50 rounded-2xl p-2.5 text-center">
                                <div className="text-lg font-black text-green-600 leading-none">{u.uploadedFiles || 0}</div>
                                <div className="text-[8px] font-black text-green-700/50 uppercase mt-1 tracking-tighter">Uploaded</div>
                              </div>
                              <div className="bg-orange-50 rounded-2xl p-2.5 text-center">
                                <div className="text-lg font-black text-orange-600 leading-none">{u.pendingFiles || 0}</div>
                                <div className="text-[8px] font-black text-orange-700/50 uppercase mt-1 tracking-tighter">Pending</div>
                              </div>
                              <div className="bg-indigo-50 rounded-2xl p-2.5 text-center">
                                <div className="text-lg font-black text-gray-900 leading-none">{u.totalFiles || 0}</div>
                                <div className="text-[8px] font-black text-indigo-700/50 uppercase mt-1 tracking-tighter">Total</div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-2">
                            {canViewUserUploads(u) && (
                              <button
                                onClick={() => {
                                  setSelectedUserId(u._id);
                                  setSelectedUserName(u.voName);
                                  setActiveTab('conversion');
                                }}
                                className="flex-1 p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                <Folder className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">View</span>
                              </button>
                            )}
                            {((currentUserRole.includes('admin') || currentUserRole.includes('developer')) && (u.role || '').toLowerCase().includes('admin - cc')) && (
                              <button
                                onClick={() => downloadUserData(u)}
                                className="flex-1 p-2.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                <Download className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">Download</span>
                              </button>
                            )}
                            {canEditUser(u) && (
                              <button
                                onClick={() => openEditModal(u)}
                                className="flex-1 p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">Edit</span>
                              </button>
                            )}
                            {canDeleteUser(u) && (
                              <button
                                onClick={() => handleDeleteUser(u._id)}
                                className="flex-1 p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={user._id} className="space-y-2">
                      {renderUserCard(user)}
                      {isExpanded && user.vos && user.vos.length > 0 && (
                        <div className="pl-6 border-l-2 border-indigo-100 space-y-2 my-2">
                          {user.vos.map(vo => renderUserCard(vo, true))}
                        </div>
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
      </div>

      {/* Modal Portals - Wrapped in zero-size absolute container to prevent any layout insertion */}
      <div className="absolute h-0 w-0 overflow-hidden pointer-events-none">
        {/* Add/Edit Modal */}
        {
          (showAddModal || showEditModal) && createPortal(
            <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4 !mt-0 animate-in fade-in duration-300">
              <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-200">
                <div className="px-4 sm:px-8 py-6 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`p-2 sm:p-3 rounded-2xl shadow-lg ${showAddModal ? 'bg-indigo-600' : 'bg-purple-600'} text-white`}>
                      {showAddModal ? <Plus className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 leading-tight">{showAddModal ? 'Add New User' : 'Update User Account'}</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{showAddModal ? 'Create Account' : 'Modify Credentials'}</p>
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
                          {formData.role === 'Admin - CC' ? 'Cluster Administrator Name' : formData.role === 'Admin - APM' ? 'APM Administrator Name' : formData.role === 'VO' ? 'VO Name' : 'Administrator Name'}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.voName}
                          onChange={(e) => setFormData({ ...formData, voName: e.target.value })}
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                          placeholder={formData.role === 'Admin - CC' ? 'e.g. Cluster Admin' : formData.role === 'Admin - APM' ? 'e.g. APM Admin' : 'e.g. Navodaya VO'}
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
                          {!currentUserRole.includes('admin - apm') && (
                            <>
                              <option value="Admin">Admin</option>
                              <option value="Admin - CC">Admin - CC</option>
                              <option value="Admin - APM">Admin - APM</option>
                            </>
                          )}
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
                      {!(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) && (
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
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {!(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) && (
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase">Mandal</label>
                            <select
                              value={formData.mandal}
                              required
                              onChange={(e) => setFormData({ ...formData, mandal: e.target.value, village: '' })}
                              disabled={!formData.district}
                              className={`w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50 ${formData.role === 'Admin - CC' || formData.role === 'Admin - APM' ? 'col-span-2' : ''}`}
                            >
                              <option value="">Select Mandal</option>
                              {modalMandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className={`space-y-2 ${(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) ? 'col-span-2' : ''}`}>
                          <label className="text-xs font-black text-gray-700 ml-1 uppercase">Village</label>
                          <select
                            value={formData.village}
                            required={formData.role === 'VO'}
                            onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                            disabled={!formData.mandal || (formData.role !== 'VO')}
                            className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                          >
                            <option value="">{formData.role === 'VO' ? 'Select Village' : 'No Village Required'}</option>
                            {modalVillages.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Role Specific ID/Name Details */}
                      {formData.role === 'VO' ? (
                        <div className="bg-indigo-50/50 p-6 rounded-[24px] border border-indigo-100 space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                              Official VO ID (15 Digits)
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={15}
                              minLength={15}
                              value={formData.voID}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, voID: val });
                              }}
                              className="w-full bg-white border-2 border-indigo-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all"
                              placeholder="15-digit VO ID"
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
                              placeholder="Representative Full Name"
                            />
                          </div>
                        </div>
                      ) : formData.role === 'Admin - CC' ? (
                        <div className="bg-amber-50/50 p-6 rounded-[24px] border border-amber-100 space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-amber-600" />
                              Cluster ID (8 Digits)
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={8}
                              minLength={8}
                              value={formData.clusterID}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, clusterID: val });
                              }}
                              className="w-full bg-white border-2 border-amber-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:outline-none transition-all"
                              placeholder="8-digit Cluster ID"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-amber-600" />
                              Cluster Name
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.clusterName}
                              onChange={(e) => setFormData({ ...formData, clusterName: e.target.value })}
                              className="w-full bg-white border-2 border-amber-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:outline-none transition-all"
                              placeholder="Full Cluster Name"
                            />
                          </div>
                        </div>
                      ) : (formData.role === 'Admin - APM') ? (
                        <div className="bg-purple-50/50 p-6 rounded-[24px] border border-purple-100 space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                              User ID (6 Digits)
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              minLength={6}
                              value={formData.userID}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, userID: val });
                              }}
                              className="w-full bg-white border-2 border-purple-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 focus:outline-none transition-all"
                              placeholder="6-digit User ID"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1 uppercase flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-purple-600" />
                              User Name
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.userName}
                              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                              className="w-full bg-white border-2 border-purple-100 rounded-xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 focus:outline-none transition-all"
                              placeholder="Full User Name"
                            />
                          </div>
                        </div>
                      ) : null}
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
                      {showAddModal ? 'Add User' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        }

        {/* User Uploads Modal */}
        {showUserUploads && selectedUser && createPortal(
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 !mt-0 animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20">
              {/* Header */}
              <div className="px-4 sm:px-8 py-3 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex justify-between items-center mb-2 sm:mb-4">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">{selectedUser.voName} VO Uploads</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] sm:text-sm text-white/80 font-bold uppercase tracking-wider">VO ID: {selectedUser.voID}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUserUploads(false)} className="p-1.5 sm:p-2.5 bg-white/20 text-white hover:bg-white/30 hover:shadow-md rounded-xl transition-all border border-white/30">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Filters and Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 w-full">

                  {uploadsSummary && (
                    <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 w-full">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 w-full">
                        <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase">Pending</div>
                        <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.pending}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 w-full">
                        <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase">Approved</div>
                        <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.validated}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 w-full">
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
                            <div key={upload._id} className="relative border-2 border-orange-300 bg-orange-50 rounded-2xl p-4 transition-all hover:shadow-lg hover:border-orange-400 flex flex-col">
                              {/* Thumbnail */}
                              {upload.s3Url && (
                                <div className="h-48 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl border-b border-orange-200 bg-black/5">
                                  <img src={upload.s3Url} alt="" className="w-full h-full object-contain" />
                                </div>
                              )}

                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-gray-900 truncate">{upload.shgName}</h4>
                                  <p className="text-xs text-gray-600">SHG ID: '{upload.shgID}</p>
                                </div>
                                {currentUserRole !== 'admin - apm' && (
                                  <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-orange-200 text-orange-800">
                                    Pending
                                  </span>
                                )}
                              </div>

                              <div className="space-y-2 text-xs mb-3 flex-1 overflow-hidden">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                                <div className="text-gray-400 truncate" title={upload.originalFilename}>
                                  {upload.originalFilename}
                                </div>
                              </div>

                              <div className="flex gap-2 mt-auto">
                                {(currentUserRole === 'admin' || currentUserRole === 'admin - developer' || currentUserRole === 'admin - apm') && (
                                  <button
                                    onClick={() => downloadImage(upload.s3Url, `${upload.shgName}_${upload.shgID}.jpg`)}
                                    className={`px-3 py-2 ${currentUserRole === 'admin - apm' ? 'flex-1 bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'} hover:bg-blue-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1`}
                                    title="Download Image"
                                  >
                                    <Download size={14} /> {currentUserRole === 'admin - apm' ? 'Download' : ''}
                                  </button>
                                )}
                                <button
                                  onClick={() => openImageViewer(upload)}
                                  className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                                  title="View Full Image"
                                >
                                  <Eye size={14} /> View
                                </button>
                                {currentUserRole !== 'admin - apm' && (
                                  <>
                                    <button
                                      onClick={() => handleQuickStatusUpdate(upload, 'validated')}
                                      disabled={uploading}
                                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                                    >
                                      <CheckCircle size={14} /> Approve
                                    </button>
                                    <button
                                      onClick={() => openStatusModal(upload)}
                                      disabled={uploading}
                                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                                    >
                                      <X size={14} /> Reject
                                    </button>
                                  </>
                                )}
                              </div>
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
                            <div key={upload._id} className="relative border-2 border-red-300 bg-red-50 rounded-2xl p-4 transition-all hover:shadow-lg hover:border-red-400 flex flex-col">
                              {/* Thumbnail */}
                              {upload.s3Url && (
                                <div className="h-48 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl border-b border-red-200 bg-black/5">
                                  <img src={upload.s3Url} alt="" className="w-full h-full object-contain" />
                                </div>
                              )}

                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-gray-900 truncate">{upload.shgName}</h4>
                                  <p className="text-xs text-gray-600">SHG ID: '{upload.shgID}</p>
                                </div>
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-red-200 text-red-800">
                                  Rejected
                                </span>
                              </div>

                              <div className="space-y-2 text-xs mb-3 flex-1 overflow-hidden">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                                {upload.rejectionReason && (
                                  <div className="bg-white rounded-lg p-2 border-l-4 border-red-500">
                                    <p className="text-[10px] font-bold text-red-600 mb-1">Reason:</p>
                                    <p className="text-xs text-gray-800 line-clamp-2">{upload.rejectionReason}</p>
                                  </div>
                                )}
                                <div className="text-gray-400 truncate" title={upload.originalFilename}>
                                  {upload.originalFilename}
                                </div>
                              </div>

                              <div className="flex gap-2 mt-auto">
                                {(currentUserRole === 'admin' || currentUserRole === 'admin - developer' || currentUserRole === 'admin - apm') && (
                                  <button
                                    onClick={() => downloadImage(upload.s3Url, `${upload.shgName}_${upload.shgID}.jpg`)}
                                    className={`px-3 py-2 ${currentUserRole === 'admin - apm' ? 'flex-1 bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'} hover:bg-blue-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1`}
                                    title="Download Image"
                                  >
                                    <Download size={14} /> {currentUserRole === 'admin - apm' ? 'Download' : ''}
                                  </button>
                                )}
                                <button
                                  onClick={() => openImageViewer(upload)}
                                  className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                                  title="View Full Image"
                                >
                                  <Eye size={14} /> View
                                </button>
                                <button
                                  onClick={() => openStatusModal(upload)}
                                  className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                                >
                                  Update Status
                                </button>
                              </div>
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
                            Approved Uploads
                            <span className="ml-2 text-sm font-normal text-gray-500">({userUploads.filter(u => u.status === 'validated').length})</span>
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userUploads.filter(u => u.status === 'validated').map(upload => (
                            <div key={upload._id} className="relative border-2 border-green-300 bg-green-50 rounded-2xl p-4 transition-all hover:shadow-lg hover:border-green-400 flex flex-col">
                              {/* Thumbnail */}
                              {upload.s3Url && (
                                <div className="h-48 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl border-b border-green-200 bg-black/5">
                                  <img src={upload.s3Url} alt="" className="w-full h-full object-contain" />
                                </div>
                              )}

                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-gray-900 truncate">{upload.shgName}</h4>
                                  <p className="text-xs text-gray-600">SHG ID: '{upload.shgID}</p>
                                </div>
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-green-200 text-green-800">
                                  Approved
                                </span>
                              </div>

                              <div className="space-y-1 text-xs mb-3 flex-1 overflow-hidden">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDateTime(upload.uploadTimestamp)}</span>
                                </div>
                                <div className="text-gray-400 truncate mt-2" title={upload.originalFilename}>
                                  {upload.originalFilename}
                                </div>
                              </div>

                              <div className="flex gap-2 mt-auto">
                                {(currentUserRole === 'admin' || currentUserRole === 'admin - developer' || currentUserRole === 'admin - apm') && (
                                  <button
                                    onClick={() => downloadImage(upload.s3Url, `${upload.shgName}_${upload.shgID}.jpg`)}
                                    className={`px-3 py-2 ${currentUserRole === 'admin - apm' ? 'flex-1 bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'} hover:bg-blue-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1`}
                                    title="Download Image"
                                  >
                                    <Download size={14} /> {currentUserRole === 'admin - apm' ? 'Download' : ''}
                                  </button>
                                )}
                                <button
                                  onClick={() => openImageViewer(upload)}
                                  className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                                  title="View Full Image"
                                >
                                  <Eye size={14} /> View
                                </button>
                                {currentUserRole !== 'admin - apm' && (
                                  <button
                                    onClick={() => openStatusModal(upload)}
                                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-all"
                                  >
                                    Details
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Status Update Modal */}
        {showStatusModal && selectedUpload && createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 !mt-0">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Update Upload Status</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedUpload.shgName} ('{selectedUpload.shgID})</p>
                </div>
                <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedUpload.s3Url && (
                <div className="mb-6 bg-gray-50 rounded-2xl overflow-hidden border-2 border-gray-200">
                  <img src={selectedUpload.s3Url} alt={selectedUpload.shgName} className="w-full max-h-96 object-contain" />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">Reason for Rejection</label>
                  <select
                    value={rejectionReason}
                    onChange={e => {
                      setRejectionReason(e.target.value);
                      setStatus('rejected');
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    {REJECTION_REASONS.map((reason, idx) => (
                      <option key={idx} value={reason}>{reason}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-600 font-bold">This will be shown to VO users. Default is "Follow guidelines".</p>
                  <p className="mt-2 text-xs text-indigo-600 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Note: File will be kept in rejected history and VO will see the rejection reason.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowStatusModal(false)} className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-black transition-all">Cancel</button>
                <button onClick={handleUpdateStatus} disabled={uploading} className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:grayscale shadow-md">Update Status</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Full Image Viewer Modal */}
        {showImageViewer && createPortal(
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-2 sm:p-4 !mt-0 animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-200">
              <div className="px-4 sm:px-8 py-3 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex justify-between items-center bg-transparent">
                  <div className="bg-transparent">
                    <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">{viewerImageData.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5 bg-transparent">
                      <p className="text-[9px] sm:text-sm text-white/80 font-bold uppercase tracking-wider">{viewerImageData.subtitle}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowImageViewer(false)} className="p-1.5 sm:p-2.5 bg-white/20 text-white hover:bg-white/30 hover:shadow-md rounded-xl transition-all border border-white/30">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50/50 custom-scrollbar flex items-start justify-center p-0">
                <img src={viewerImageData.url} alt={viewerImageData.title} className="w-auto h-auto shadow-2xl" />
              </div>
              <div className="px-8 py-4 border-t border-gray-100 bg-white flex justify-end gap-4">
                <button onClick={() => downloadImage(viewerImageData.url, viewerImageData.filename)} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black transition-all shadow-md flex items-center gap-2">
                  <Download size={18} /> Download Original
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default UsersTab;
