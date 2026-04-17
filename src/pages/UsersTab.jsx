import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, FileSymlink, Filter, Loader2, X, Shield, User, MapPin, Phone, Lock, Unlock, CheckCircle, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, Calendar, AlertCircle, AlertTriangle, Settings, Power, Clock, Download, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import { formatDateTime } from '../utils/dateUtils';
const REJECTION_REASONS = [];

// Helper Component for Grouped Uploads in Admin View
const AdminUploadCard = ({ group, currentUserRole, uploading, handleQuickStatusUpdate, openStatusModal, openImageViewer, downloadImage }) => {
  const [pageIndex, setPageIndex] = React.useState(1);
  const pages = Object.keys(group.pages).map(Number).sort((a, b) => a - b);
  const currentPage = group.pages[pageIndex] || group.pages[pages[0]];
  const hasMultiplePages = pages.length > 1;

  // Use the status of the CURRENTLY SELECTED page
  const status = currentPage?.status || 'pending';
  const borderColor = status === 'pending' ? 'border-orange-300' : 'border-green-300';
  const bgColor = status === 'pending' ? 'bg-orange-50' : 'bg-green-50';
  const badgeColor = status === 'pending' ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800';

  const getStatusColor = (s) => {
    if (s === 'validated') return 'bg-emerald-500';
    return 'bg-orange-500';
  };

  return (
    <div className={`relative border-2 ${borderColor} ${bgColor} rounded-2xl p-4 transition-all hover:shadow-lg hover:border-indigo-400 flex flex-col`}>
      {/* Page Tabs with status dots */}
      {hasMultiplePages && (
        <div className="flex gap-1 mb-3">
          {pages.map(p => {
            const pageStatus = group.pages[p]?.status || 'pending';
            return (
              <button
                key={p}
                onClick={() => setPageIndex(p)}
                className={`relative px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${pageIndex === p ? 'bg-indigo-600 text-white' : 'bg-white/50 text-gray-600 border border-gray-200'}`}
              >
                P{p}
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white ${getStatusColor(pageStatus)} shadow-sm`}></div>
              </button>
            );
          })}
          <div className="ml-auto text-[8px] font-bold text-gray-400 uppercase self-center">
            {pages.length} Pages
          </div>
        </div>
      )}

      {/* Thumbnail */}
      {currentPage.s3Url && (
        <div className="h-48 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl border-b border-gray-100 bg-black/5 relative group/img">
          <img src={currentPage.s3Url} alt="" className="w-full h-full object-contain" />
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 text-white text-[9px] font-black rounded-md">
            Page {currentPage.page || 1}
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-gray-900 truncate">{currentPage.shgName}</h4>
          <p className="text-[10px] text-gray-600">ID: '{currentPage.shgID}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${badgeColor}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-[11px] mb-3 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-3 h-3" />
          <span>{formatDateTime(currentPage.uploadTimestamp)}</span>
        </div>
        <div className="text-gray-400 truncate opacity-60" title={currentPage.originalFilename}>
          {currentPage.originalFilename}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {/* Main View All Button */}
        <button
          onClick={() => openImageViewer(Object.values(group.pages))}
          className="w-full px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-black text-[10px] transition-all shadow-sm flex items-center justify-center gap-1"
        >
          <Eye size={12} /> View Document Package
        </button>

        {/* Page Specific Actions */}
        <div className="flex gap-2">
          {status === 'pending' && currentUserRole !== 'admin - apm' && (
            <button
              onClick={() => handleQuickStatusUpdate(currentPage, 'validated')}
              disabled={uploading}
              className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] transition-all shadow-sm flex items-center justify-center gap-1"
              title={`Approve Page ${currentPage.page || 1}`}
            >
              <CheckCircle size={12} /> Approve P{currentPage.page || 1}
            </button>
          )}

          {(status === 'validated') && currentUserRole !== 'admin - apm' && (
            <button
              onClick={() => openStatusModal(currentPage)}
              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] transition-all shadow-sm flex items-center justify-center gap-1"
            >
              <Settings size={12} /> Page Details
            </button>
          )}
        </div>

        {/* Bulk Approve option if multiple pages and at least one is pending */}
        {hasMultiplePages && pages.some(p => group.pages[p]?.status === 'pending') && currentUserRole !== 'admin - apm' && (
          <button
            onClick={async () => {
              for (const p of pages) {
                const up = group.pages[p];
                if (up.status === 'pending') {
                  await handleQuickStatusUpdate(up, 'validated');
                }
              }
            }}
            disabled={uploading}
            className="w-full py-1 text-[9px] font-black text-emerald-600 hover:text-emerald-700 transition-all uppercase tracking-widest border border-emerald-200 border-dashed rounded-lg bg-emerald-50/50"
          >
            Mark both as approved
          </button>
        )}
      </div>
    </div>
  );
};

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

      // [FIX]: Handle 1970 marker from backend logout
      if (date.getFullYear() <= 1970) return 'Never';

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return formatDate(date);
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

  const downloadSummaryExcel = async (user) => {
    try {
      const roleLower = (user.role || '').toLowerCase();
      const isAPM = roleLower.includes('apm');
      const isCC = roleLower.includes('cc');

      // 1. Prepare hierarchy data
      const token = localStorage.getItem('token');
      const fetchChildren = async (parentId, parentRole) => {
        const params = new URLSearchParams();
        params.append('parentId', parentId);
        params.append('parentRole', parentRole);
        if (filterMonth) params.append('month', filterMonth);
        if (filterYear) params.append('year', filterYear);
        const res = await fetch(`${API_BASE}/api/users?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        return data.success ? data.users : [];
      };

      let ccs = [];
      let vos = [];

      if (isAPM) {
        setLoadingNodes(prev => new Set(prev).add(user._id));
        ccs = user.ccs || [];
        if (ccs.length === 0) {
          ccs = await fetchChildren(user._id, user.role);
        }
        // Deep fetch VOs for each CC
        ccs = await Promise.all(ccs.map(async (cc) => {
          let ccVos = cc.vos || [];
          if (ccVos.length === 0) {
            ccVos = await fetchChildren(cc._id, cc.role);
          }
          return { ...cc, vos: ccVos };
        }));
        setLoadingNodes(prev => { const next = new Set(prev); next.delete(user._id); return next; });
      } else if (isCC) {
        vos = user.vos || [];
        if (vos.length === 0) {
          setLoadingNodes(prev => new Set(prev).add(user._id));
          vos = await fetchChildren(user._id, user.role);
          setLoadingNodes(prev => { const next = new Set(prev); next.delete(user._id); return next; });
        }
      }

      // 2. Generate HTML content for styling (colors/merges)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthNameShort = monthNames[parseInt(filterMonth) - 1] || filterMonth;

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const hh = String(now.getHours() % 12 || 12).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      const generatingTime = `${dd}.${mm}.${yy}: ${hh}.${min} ${ampm}`;

      const headerTitle = `Annexure - II Capturing ${monthNameShort}-${filterYear} Month status report as on ${generatingTime}`;

      // Standard Office Palette (Professional/Compatible)
      const colors = {
        header: '#D9D9D9',      // Light Gray
        subHeader: '#F2F2F2',   // Lighter Gray
        apm: '#D9E1F2',         // Light Blue
        cc: '#FFF2CC',          // Light Yellow
        border: '#000000',      // High contrast black border
        // Pending Status (Saturated Palette)
        green: '#E2EFDA',       // 0%
        lime: '#F2F7E5',        // <= 10%
        yellow: '#FFF9C4',      // <= 25%
        orange: '#FFCC99',      // <= 50%
        red: '#FF4D4D'          // > 50% (Saturated True Red)
      };

      const commonStyle = 'border: .5pt solid windowtext; padding: 6px; text-align: center; mso-number-format:"\\@"; font-family: Calibri, Arial, sans-serif; font-size: 10pt;';
      const titleStyle = 'border: .5pt solid windowtext; padding: 10px; text-align: center; font-family: Calibri, Arial, sans-serif; font-size: 14pt; font-weight: bold;';

      const getPendingBg = (pending, total) => {
        if (!total || pending === 0) return colors.green;
        const ratio = pending / total;
        if (ratio <= 0.10) return colors.lime;
        if (ratio <= 0.25) return colors.yellow;
        if (ratio <= 0.50) return colors.orange;
        return colors.red;
      };

      const getPerf = (u) => u.performanceStats || { uploads: { approved: 0 }, conversion: { success: 0 } };

      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Summary</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; table-layout: fixed; border: .5pt solid windowtext; }
          td, th { border: .5pt solid windowtext; mso-number-format:"\\@"; text-align: center; }
        </style>
      </head>
      <body>
        <table border="1" style="width: 100%;">
          <colgroup>
            <col width="80"><col width="250"><col width="150"><col width="100"><col width="100"><col width="100"><col width="120">
          </colgroup>
      `;

      // Main Header
      html += `<tr><th colspan="7" bgcolor="${colors.header}" style="${titleStyle}">${headerTitle}</th></tr>`;

      // Column Headers
      const subHeaderStyle = `bgcolor="${colors.subHeader}" style="${commonStyle} font-weight: bold;"`;
      html += `<tr>
        <th ${subHeaderStyle}>Type</th>
        <th ${subHeaderStyle}>Name</th>
        <th ${subHeaderStyle}>Mandal</th>
        <th ${subHeaderStyle}>Total SHGs</th>
        <th ${subHeaderStyle}>Uploaded</th>
        <th ${subHeaderStyle}>Converted</th>
        <th ${subHeaderStyle}>Pending at VOA</th>
      </tr>`;

      if (isAPM) {
        // APM Top Row
        const apmPerf = getPerf(user);
        const apmStyle = `bgcolor="${colors.apm}" style="${commonStyle} font-weight: bold;"`;

        html += `<tr>
          <td ${apmStyle}>APM</td>
          <td ${apmStyle}>${user.voName || user.name || 'MS Co-Ordinator'}</td>
          <td ${apmStyle}>${user.mandal || ''}</td>
          <td ${apmStyle}>${user.totalFiles || 0}</td>
          <td ${apmStyle}>${user.uploadedFiles || 0}</td>
          <td ${apmStyle}>${apmPerf.conversion.success || 0}</td>
          <td ${apmStyle}>${user.pendingFiles || 0}</td>
        </tr>`;

        // Empty spacing row
        html += '<tr><td colspan="7" style="height: 10px; border: none;"></td></tr>';

        ccs.forEach(cc => {
          const ccPerf = getPerf(cc);
          const ccStyle = `bgcolor="${colors.cc}" style="${commonStyle} font-weight: bold;"`;

          html += `<tr>
            <td ${ccStyle}>CC</td>
            <td ${ccStyle}>${cc.voName || cc.name}</td>
            <td ${ccStyle}>${cc.mandal || ''}</td>
            <td ${ccStyle}>${cc.totalFiles || 0}</td>
            <td ${ccStyle}>${cc.uploadedFiles || 0}</td>
            <td ${ccStyle}>${ccPerf.conversion.success || 0}</td>
            <td ${ccStyle}>${cc.pendingFiles || 0}</td>
          </tr>`;

          (cc.vos || []).forEach(vo => {
            const voPerf = getPerf(vo);
            const voStyle = `style="${commonStyle}"`;
            const pendingCell = `bgcolor="${getPendingBg(vo.pendingFiles, vo.totalFiles)}" style="${commonStyle}"`;

            html += `<tr>
              <td ${voStyle}>VO</td>
              <td ${voStyle}>${vo.voName || vo.name}</td>
              <td ${voStyle}>${vo.mandal || ''}</td>
              <td ${voStyle}>${vo.totalFiles || 0}</td>
              <td ${voStyle}>${vo.uploadedFiles || 0}</td>
              <td ${voStyle}>${voPerf.conversion.success || 0}</td>
              <td ${pendingCell}>${vo.pendingFiles || 0}</td>
            </tr>`;
          });
          html += '<tr><td colspan="7" style="height: 10px; border: none;"></td></tr>';
        });
      } else {
        const topRow = user;
        const topPerf = getPerf(topRow);
        const childrenList = isCC ? vos : [];
        const topBg = isCC ? colors.cc : '';
        const topStyle = `bgcolor="${topBg}" style="${commonStyle} ${isCC ? 'font-weight: bold;' : ''}"`;
        const topPendingStyle = isCC ? topStyle : `bgcolor="${getPendingBg(topRow.pendingFiles, topRow.totalFiles)}" style="${commonStyle}"`;

        html += `<tr>
          <td ${topStyle}>${isCC ? 'CC' : 'VO'}</td>
          <td ${topStyle}>${topRow.voName || topRow.name}</td>
          <td ${topStyle}>${topRow.mandal || ''}</td>
          <td ${topStyle}>${topRow.totalFiles || 0}</td>
          <td ${topStyle}>${topRow.uploadedFiles || 0}</td>
          <td ${topStyle}>${topPerf.conversion.success || 0}</td>
          <td ${topPendingStyle}>${topRow.pendingFiles || 0}</td>
        </tr>`;

        if (isCC && childrenList.length > 0) {
          html += '<tr><td colspan="7" style="height: 10px; border: none;"></td></tr>';
          childrenList.forEach(vo => {
            const voPerf = getPerf(vo);
            const voStyle = `style="${commonStyle}"`;
            const pendingCell = `bgcolor="${getPendingBg(vo.pendingFiles, vo.totalFiles)}" style="${commonStyle}"`;

            html += `<tr>
              <td ${voStyle}>VO</td>
              <td ${voStyle}>${vo.voName || vo.name}</td>
              <td ${voStyle}>${vo.mandal || ''}</td>
              <td ${voStyle}>${vo.totalFiles || 0}</td>
              <td ${voStyle}>${vo.uploadedFiles || 0}</td>
              <td ${voStyle}>${voPerf.conversion.success || 0}</td>
              <td ${pendingCell}>${vo.pendingFiles || 0}</td>
            </tr>`;
          });
        }
      }

      html += '</table></body></html>';

      // 3. Download as .xls (Excel interprets HTML tables as sheets)
      const fileName = `${user.voName || user.name || 'User'}_Report_${monthNameShort}_${filterYear}.xls`;
      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error generating Excel:', err);
      alert('Failed to generate Excel report');
    }
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
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(filterMonth) - 1] || filterMonth;
        link.setAttribute('download', `${user.voName}_VOs_${monthName}_${filterYear}.csv`);
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
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(filterMonth) - 1] || filterMonth;
        link.setAttribute('download', `${user.voName}_${monthName}_${filterYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error downloading user data:', err);
      alert('Failed to download user data');
    }
  };

  const {
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
    filterMonth,
    setFilterMonth,
    filterYear,
    setFilterYear,
    searchTerm,
    setSearchTerm,
    // [ADD]: New shared states for persistence
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
    setLoadingNodes,
    userRole
  } = filterProps;


  // [MOVED TO PROPS]: users, staffUsers, totalPages, totalUsers, userCounts, expandedRows, loadingNodes
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
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const [limit] = useState(10);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Search state
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // User uploads modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserUploads, setShowUserUploads] = useState(false);
  const [userUploads, setUserUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsSummary, setUploadsSummary] = useState(null);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);

  const openImageViewer = (uploads) => {
    const uploadsArray = Array.isArray(uploads) ? uploads : [uploads];
    const images = uploadsArray.map(u => ({
      url: u.s3Url,
      title: u.shgName,
      subtitle: `SHG ID: '${u.shgID} - Page ${u.page || 1}`,
      filename: `${u.shgName}_${u.shgID}_Page${u.page || 1}.jpg`
    }));
    setViewerImages(images);
    setCurrentViewerIndex(0);
    setShowImageViewer(true);
  };

  const groupedUserUploads = React.useMemo(() => {
    // 1. Group all uploads by shgID regardless of status
    const shgGroups = {};

    userUploads.forEach(u => {
      if (!shgGroups[u.shgID]) {
        shgGroups[u.shgID] = {
          shgID: u.shgID,
          shgName: u.shgName,
          pages: {}
        };
      }
      shgGroups[u.shgID].pages[u.page || 1] = u;
    });

    // 2. Assign each SHG group to a section based on "most pending" status
    const sections = {
      pending: [],
      rejected: [],
      validated: []
    };

    Object.values(shgGroups).forEach(group => {
      const pageUploads = Object.values(group.pages);
      const statuses = pageUploads.map(p => p.status || 'pending');

      if (statuses.includes('pending')) {
        sections.pending.push(group);
      } else if (statuses.includes('rejected')) {
        sections.rejected.push(group);
      } else {
        sections.validated.push(group);
      }
    });

    return sections;
  }, [userUploads]);

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
    userName: '',
    assignedCC: '',   // CC clusterID to assign this VO to
    shgList: []       // [{shgID, shgName}] for shg_master_data
  });

  // CC dropdown list state (auto-loaded when district+mandal change for VO role)
  const [ccList, setCcList] = useState([]);
  const [ccListLoading, setCcListLoading] = useState(false);

  // Modal-specific location states to avoid overriding global filters
  const [modalMandals, setModalMandals] = useState([]);
  const [modalVillages, setModalVillages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [shgListLoading, setShgListLoading] = useState(false);
  const [deletedShgIds, setDeletedShgIds] = useState([]);

  const [maintenanceStatus, setMaintenanceStatus] = useState({ is_active: false, message: 'Server is under maintenance', end_time: null });
  const [lastSynced, setLastSynced] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);
  const [isMaintenanceCollapsed, setIsMaintenanceCollapsed] = useState(true);

  // Approval Gate States
  const [gateStatus, setGateStatus] = useState({ isOpen: false, message: '', lastUpdatedAt: null, lastUpdatedBy: null });
  const [showGateModal, setShowGateModal] = useState(false);
  const [isTogglingGate, setIsTogglingGate] = useState(false);
  const [gateMessage, setGateMessage] = useState('');
  const [isGateCollapsed, setIsGateCollapsed] = useState(true);
  // [MOVED TO PROPS]: expandedRows, loadingNodes

  // VO Upload Access States
  // [CLEANUP]: Unified into direct toggle logic
  const [updatingAccessId, setUpdatingAccessId] = useState(null);

  // Helper to update children in a nested tree
  const updateTreeWithChildren = (parentId, children) => {
    const updateNodes = (list) => {
      if (!list) return [];
      return list.map(node => {
        if (node._id === parentId) {
          const role = (node.role || '').toLowerCase();
          if (role.includes('apm')) return { ...node, ccs: children };
          if (role.includes('cc')) return { ...node, vos: children };
          return { ...node, vos: children }; // fallback
        }
        if (node.ccs) return { ...node, ccs: updateNodes(node.ccs) };
        if (node.vos) return { ...node, vos: updateNodes(node.vos) };
        return node;
      });
    };
    setUsers(prev => updateNodes(prev));
  };

  const findParentId = (targetId, list) => {
    if (!list) return null;
    for (const node of list) {
      const children = node.ccs || node.vos;
      if (children) {
        if (children.some(c => c._id === targetId)) return node._id;
        const found = findParentId(targetId, children);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchNodeBranch = async (userId, userRole) => {
    setLoadingNodes(prev => new Set(prev).add(userId));
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('parentId', userId);
      params.append('parentRole', userRole);
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

      const res = await fetch(`${API_BASE}/api/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.users) {
        updateTreeWithChildren(userId, data.users);
      }
    } catch (err) {
      console.error("Fetch Branch Error:", err);
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const toggleRow = async (user) => {
    const userId = typeof user === 'string' ? user : user._id;
    const isExpanding = !expandedRows.has(userId);

    if (isExpanding && typeof user === 'object' && user.isHierarchical) {
      const hasChildren = (user.ccs && user.ccs.length > 0) || (user.vos && user.vos.length > 0);

      if (!hasChildren) {
        await fetchNodeBranch(userId, user.role);
      }
    }

    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
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

  // Load CC list when district+mandal change (for VO assignment)
  useEffect(() => {
    if (formData.role === 'VO' && formData.district && formData.mandal) {
      const fetchCCList = async () => {
        setCcListLoading(true);
        try {
          const token = localStorage.getItem('token');
          const params = new URLSearchParams();
          params.append('district', formData.district);
          params.append('mandal', formData.mandal);
          const res = await fetch(`${API_BASE}/api/cc-list?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) setCcList(data.ccs || []);
          else setCcList([]);
        } catch {
          setCcList([]);
        } finally {
          setCcListLoading(false);
        }
      };
      fetchCCList();
    } else {
      setCcList([]);
    }
  }, [formData.district, formData.mandal, formData.role]);

  useEffect(() => {
    localStorage.setItem(PAGE_KEY, page);
    setPageInput(String(page));
  }, [page]);

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

  // ✅ CRITICAL: Listen for tree refresh events from backend (approval broadcasts)
  useEffect(() => {
    const initSSE = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      // 1️⃣ create connection
      const res = await fetch(`${API_BASE}/api/sse/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      const connectionId = data.connection_id;

      // 2️⃣ open SSE stream
      const eventSource = new EventSource(
        `${API_BASE}/api/sse/stream/${connectionId}`
      );

      const handleTreeRefresh = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'tree_refresh') {
            console.log('📡 Received tree_refresh event:', message);

            // 1. Refresh basic tree state in background
            await fetchUsers({ isBackground: true });
            
            // 2. Surgical stats sync (refresh numbers)
            // This ensures Case 1 (APM/CC) and Case 2 (VO) stats update immediately
            await syncVisibleStats();

            console.log(`✅ Tree refreshed due to: ${message.reason}`);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.addEventListener('message', handleTreeRefresh);

      // cleanup
      return () => {
        eventSource.removeEventListener('message', handleTreeRefresh);
        eventSource.close();
      };
    };

    let cleanup;

    initSSE().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Explicit handlers for user-initiated filter changes
  const onDistrictChange = (value) => {
    setSelectedDistrict(value);
    setSelectedMandal("all");
    setSelectedVillage("all");
    setPage(1);
  };

  const onMandalChange = (value) => {
    setSelectedMandal(value);
    setSelectedVillage("all");
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

    // Helper to find node role by ID from current users state
    const findNodeRole = (nodeId, nodes) => {
      if (!nodes) return null;
      for (const node of nodes) {
        if (node._id === nodeId) return node.role;
        const children = node.ccs || node.vos;
        if (children) {
          const found = findNodeRole(nodeId, children);
          if (found) return found;
        }
      }
      return null;
    };

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
      if (selectedMandal !== 'all') params.append('mandal', selectedMandal);
      if (selectedVillage !== 'all') params.append('village', selectedVillage);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      params.append('page', page);
      params.append('limit', limit);
      if (filterMonth) params.append('month', filterMonth);
      if (filterYear) params.append('year', filterYear);

      // Add lazy flag for initial load or non-search loads to speed up API
      if (!debouncedSearchTerm) {
        params.append('lazy', 'true');

        // If explicitly fetching a child node's data
        if (options.parentId) {
          params.append('parentId', options.parentId);
          const role = findNodeRole(options.parentId, users);
          if (role) params.append('parentRole', role);
        }
        // [UI STATE PERSISTENCE]: Don't reset expansions when returning to root view 
        // to preserve state from ConversionView navigation back.
        // if (!options.isBackground) {
        //   setExpandedRows(new Set());
        // }
      }

      const res = await fetch(`${API_BASE}/api/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // [REFRESH/PERSISTENCE FIX]: Always attempt to preserve existing children if IDs match
        setUsers(prevUsers => {
          // SCENARIO 1: Targeted Update for a specific Parent's children
          if (options.parentId) {
            const updateChildrenRecursive = (list) => {
              if (!list) return [];
              return list.map(u => {
                if (u._id === options.parentId) {
                  const role = (u.role || '').toLowerCase();
                  if (role.includes('apm')) return { ...u, ccs: data.users };
                  return { ...u, vos: data.users };
                }
                const children = u.ccs || u.vos;
                if (children) {
                  if (u.ccs) return { ...u, ccs: updateChildrenRecursive(u.ccs) };
                  if (u.vos) return { ...u, vos: updateChildrenRecursive(u.vos) };
                }
                return u;
              });
            };
            return updateChildrenRecursive(prevUsers);
          }

          // SCENARIO 2: Root Refresh - Preserve all existing expanded children
          const childMap = {}; // parentId -> children
          const collectChildren = (list) => {
            if (!list) return;
            list.forEach(u => {
              const children = u.ccs || u.vos;
              if (children && children.length > 0) {
                childMap[u._id] = children;
                collectChildren(children);
              }
            });
          };
          collectChildren(prevUsers);

          const reInjectChildren = (list) => {
            if (!list) return [];
            return list.map(u => {
              const existingChildren = childMap[u._id];
              if (existingChildren) {
                const role = (u.role || '').toLowerCase();
                if (role.includes('apm')) return { ...u, ccs: reInjectChildren(existingChildren) };
                return { ...u, vos: reInjectChildren(existingChildren) };
              }
              return u;
            });
          };
          return reInjectChildren(data.users);
        });

        setStaffUsers(data.staff || []);
        setTotalPages(data.pagination.pages);
        setTotalUsers(data.pagination.total);

        // [AUTO-EXPAND]: If search is active, automatically expand any folder that contains results
        if (debouncedSearchTerm && data.users && data.users.length > 0) {
          const newExpanded = new Set(expandedRows);
          const collectExpandables = (list) => {
            if (!list) return;
            list.forEach(u => {
              const children = u.ccs || u.vos;
              if (children && children.length > 0) {
                newExpanded.add(u._id);
                collectExpandables(children);
              }
            });
          };
          collectExpandables(data.users);
          setExpandedRows(newExpanded);
        }

        // [FIX]: Auto-reset pagination if current page exceeds available pages
        // This happens when switching from a user with many pages (Admin) to one with few (CC)
        if (data.pagination.pages > 0 && page > data.pagination.pages) {
          console.warn(`Current page ${page} > Total pages ${data.pagination.pages}. Resetting to 1.`);
          setPage(1);
        }
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

  const syncVisibleStats = async () => {
    if (!serverStatus.active) return;
    // 1. Collect all visible IDs from the current tree
    const visibleIds = [];
    const collectIds = (list) => {
      if (!list) return;
      list.forEach(u => {
        visibleIds.push(u._id);
        const children = u.ccs || u.vos;
        if (children) collectIds(children);
      });
    };
    collectIds(usersRef.current);

    if (visibleIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users/sync-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: visibleIds,
          month: filterMonth,
          year: filterYear
        })
      });
      const data = await res.json();
      if (data.success && data.stats) {
        // 2. Surgical "In-Place" Update
        setUsers(prevUsers => {
          const updateStatsRecursive = (list) => {
            if (!list) return [];
            return list.map(u => {
              const newStats = data.stats[String(u._id)];
              const updatedUser = newStats ? {
                ...u,
                totalFiles: newStats.stats?.total ?? u.totalFiles,
                uploadedFiles: newStats.stats?.uploaded ?? u.uploadedFiles,
                pendingFiles: newStats.stats?.pending ?? u.pendingFiles,
                performanceStats: newStats.performance ? {
                  uploads: {
                    approved: newStats.performance.uploads?.approved ?? 0,
                    pending: newStats.performance.uploads?.pending ?? 0
                  },
                  conversion: {
                    success: newStats.performance.conversion?.success ?? 0,
                    failed: newStats.performance.conversion?.failed ?? 0,
                    pending: newStats.performance.conversion?.pending ?? 0,
                    processing: newStats.performance.conversion?.processing ?? 0
                  }
                } : u.performanceStats
              } : u;

              const children = u.ccs || u.vos;
              if (children) {
                if (u.ccs) return { ...updatedUser, ccs: updateStatsRecursive(u.ccs) };
                if (u.vos) return { ...updatedUser, vos: updateStatsRecursive(u.vos) };
              }
              return updatedUser;
            });
          };
          return updateStatsRecursive(prevUsers);
        });
      }
    } catch (err) {
      console.error('Error syncing stats:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUserCounts();
    // Immediate deep sync when filters change to avoid "Data Ghosting"
    syncVisibleStats();
  }, [serverStatus.active, page, limit, debouncedSearchTerm, selectedDistrict, selectedMandal, selectedVillage, filterMonth, filterYear]);

  // Periodic refresh for users list (to update online status dots & stats)
  useEffect(() => {
    if (!serverStatus.active) return;

    const interval = setInterval(() => {
      // Refresh counts and surgical sync
      fetchUserCounts();
      syncVisibleStats();
    }, 15000); // 15s sync

    return () => clearInterval(interval);
  }, [serverStatus.active, filterMonth, filterYear]);

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

  // Conversion Gate Functions
  useEffect(() => {
    fetchGateStatus();
    const interval = setInterval(fetchGateStatus, 15000); // Sync every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchGateStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/approval-gate/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setGateStatus(data.gateStatus);
      }
    } catch (err) {
      console.error('Error fetching gate status:', err);
    }
  };

  const handleToggleGate = async () => {
    setIsTogglingGate(true);
    try {
      const token = localStorage.getItem('token');
      const newStatus = !gateStatus.isOpen;

      // If opening gate and it has a backlog, auto-process
      const autoProcessBacklog = newStatus; // Auto-process when opening

      const res = await fetch(`${API_BASE}/api/approval-gate/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isOpen: newStatus,
          message: gateMessage,
          autoProcessBacklog: autoProcessBacklog
        })
      });

      const data = await res.json();
      if (data.success) {
        setGateStatus(data.gateStatus);
        setShowGateModal(false);
        setGateMessage('');

        const statusMsg = newStatus ? 'OPENED' : 'CLOSED';
        const backlogMsg = data.gateStatus.backlogQueued > 0
          ? ` and queued ${data.gateStatus.backlogQueued} previously approved uploads`
          : '';
        alert(`Gate ${statusMsg} successfully!${backlogMsg}`);
      } else {
        alert(data.message || 'Failed to toggle gate');
      }
    } catch (err) {
      console.error('Error toggling gate:', err);
      alert('Error toggling conversion gate');
    } finally {
      setIsTogglingGate(false);
    }
  };

  const handleToggleUploadAccess = async (targetUser) => {
    if (updatingAccessId) return;

    setUpdatingAccessId(targetUser._id);
    try {
      const token = localStorage.getItem('token');
      const currentMode = targetUser.uploadAccessMode || 'default';
      const newMode = currentMode === 'default' ? 'restricted' : 'default';

      const payload = {
        userId: targetUser._id,
        mode: newMode,
        month: filterMonth,
        year: filterYear,
        applyToBranch: !targetUser.role?.toLowerCase().includes('vo') // APM/CC always apply to branch
      };

      const res = await fetch(`${API_BASE}/api/admin/vo/upload-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Direct local state update for both individual VO and branch-level toggles (CC/APM)
        setUsers(prevUsers => {
          const updateInBranch = (list, forceMode = null) => {
            if (!list) return [];
            return list.map(u => {
              // Should we force this node to the new mode? (e.g. child of a toggled CC)
              if (forceMode) {
                const updated = {
                  ...u,
                  uploadAccessMode: forceMode.mode,
                  restrictedMonth: forceMode.month,
                  restrictedYear: forceMode.year
                };
                if (u.ccs) updated.ccs = updateInBranch(u.ccs, forceMode);
                if (u.vos) updated.vos = updateInBranch(u.vos, forceMode);
                return updated;
              }

              // Is this the target node?
              if (u._id === targetUser._id) {
                const updated = {
                  ...u,
                  uploadAccessMode: payload.mode,
                  restrictedMonth: payload.month,
                  restrictedYear: payload.year
                };
                // If applying to branch, force all children to follow the same state
                if (payload.applyToBranch) {
                  if (u.ccs) updated.ccs = updateInBranch(u.ccs, { mode: payload.mode, month: payload.month, year: payload.year });
                  if (u.vos) updated.vos = updateInBranch(u.vos, { mode: payload.mode, month: payload.month, year: payload.year });
                }
                return updated;
              }

              // Otherwise continue searching
              const updated = { ...u };
              if (u.ccs) updated.ccs = updateInBranch(u.ccs);
              if (u.vos) updated.vos = updateInBranch(u.vos);
              return updated;
            });
          };
          return updateInBranch(prevUsers);
        });
      } else {
        alert(data.message || 'Failed to update access');
      }
    } catch (err) {
      console.error('Toggle Access Error:', err);
    } finally {
      setUpdatingAccessId(null);
    }
  };

  const handleApproveAndQueue = async (uploadId, userId) => {
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`${API_BASE}/api/approval-gate/approve-and-queue/${uploadId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (data.success) {
        alert('Upload approved and queued for conversion!');
        if (selectedUser && selectedUser._id === userId) {
          fetchUserUploads(userId, { isBackground: true });

          // 🔄 LIVE UPDATE: Refresh user stats immediately
          await refreshUserStatsInTree(userId);
        }
      } else {
        alert(data.message || 'Failed to approve upload');
      }
    } catch (err) {
      console.error('Error approving upload:', err);
      alert('Error approving upload');
    }
  };

  // 🔄 NEW: Refresh user stats in the tree dynamically (ALL LEVELS: VO, CC, APM)
  const refreshUserStatsInTree = async (userId) => {
    try {
      const token = localStorage.getItem('token');

      // ✅ Step 1: Find ENTIRE hierarchy chain - VO → CC → APM
      // This ensures we refresh the approved VO AND recalculate parent aggregates
      const userIdsToSync = [userId];
      let currentParentId = findParentId(userId, users);
      while (currentParentId) {
        userIdsToSync.push(currentParentId);
        currentParentId = findParentId(currentParentId, users);
      }

      // ✅ Step 2: Fetch fresh stats for entire chain
      const res = await fetch(`${API_BASE}/api/users/sync-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: userIdsToSync,
          month: filterMonth,
          year: filterYear
        })
      });

      const data = await res.json();
      if (data.success && data.stats) {
        console.log('📊 Received refreshed stats:', data.stats);

        // ✅ Step 3: Update tree with new stats - keeps structure intact!
        // IMPORTANT: Updates ALL levels (VO gets direct stats, CC/APM get recalculated aggregates)
        setUsers(prevUsers => {
          const updateRecursive = (list) => {
            if (!list) return [];
            return list.map(u => {
              // Create updated version starting with current state
              let updated = { ...u };

              // ✅ ALWAYS recurse into both CC and VO children (all hierarchy levels!)
              if (u.ccs && u.ccs.length > 0) {
                updated.ccs = updateRecursive(u.ccs);
              }
              if (u.vos && u.vos.length > 0) {
                updated.vos = updateRecursive(u.vos);
              }

              // ✅ If this user has updated stats, apply them (VO, CC, or APM)
              if (data.stats[u._id]) {
                const newStats = data.stats[u._id];
                console.log(`✅ Updating stats for ${u._id}:`, newStats);

                updated = {
                  ...updated,
                  stats: newStats.stats,
                  performance: newStats.performance,
                  // ✅ Update display fields for table - works for all levels!
                  totalFiles: newStats.stats?.total || 0,
                  uploadedFiles: newStats.stats?.uploaded || 0,
                  pendingFiles: newStats.stats?.pending || 0,
                  performanceStats: {
                    uploads: {
                      approved: newStats.performance?.uploads?.approved || 0,
                      rejected: newStats.performance?.uploads?.rejected || 0,
                      pending: newStats.performance?.uploads?.pending || 0
                    },
                    conversion: {
                      success: newStats.performance?.conversion?.success || 0,
                      failed: newStats.performance?.conversion?.failed || 0,
                      pending: newStats.performance?.conversion?.pending || 0,
                      processing: newStats.performance?.conversion?.processing || 0
                    }
                  }
                };
              } else {
                console.warn(`⚠️ No stats found for ${u._id} - may not be in refresh set`);
              }

              return updated;
            });
          };
          return updateRecursive(prevUsers);
        });

        console.log('✅ Tree stats refresh complete - all levels updated!');
      }
    } catch (err) {
      console.error('❌ Error refreshing user stats:', err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Construct final role
      const finalRole = formData.isDeveloper ? `${formData.role} - Developer` : formData.role;
      const { isDeveloper, assignedCC, shgList, ...submitData } = { ...formData, role: finalRole };

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
        // --- Post-creation: CC-VO mapping ---
        if (formData.role === 'VO' && assignedCC && formData.voID) {
          try {
            await fetch(`${API_BASE}/api/cc-vo-mapping`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ ccID: assignedCC, voID: formData.voID })
            });
          } catch (mappingErr) {
            console.warn('CC-VO mapping failed (non-critical):', mappingErr);
          }
        }

        // --- Post-creation: SHG master data ---
        if (formData.role === 'VO' && shgList && shgList.length > 0) {
          try {
            const shgsPayload = shgList
              .filter(s => s.shgID && s.shgName)
              .map(s => ({
                shgID: s.shgID,
                shgName: s.shgName,
                voID: formData.voID,
                voName: formData.voName,
                district: formData.district,
                mandal: formData.mandal,
                village: formData.village,
                month: 1,
                year: 2025
              }));
            if (shgsPayload.length > 0) {
              await fetch(`${API_BASE}/api/shg-master`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ shgs: shgsPayload })
              });
            }
          } catch (shgErr) {
            console.warn('SHG master data failed (non-critical):', shgErr);
          }
        }

        setShowAddModal(false);
        setFormData({
          voName: '', phone: '', password: '', role: 'VO', isDeveloper: false,
          district: '', mandal: '', village: '',
          voID: '', voaName: '',
          clusterID: '', clusterName: '',
          userID: '', userName: '',
          assignedCC: '', shgList: []
        });
        setCcList([]);

        // 🔄 Optimized Refersh: Find parent and refresh only that branch
        let refreshedBranch = false;
        if (formData.role === 'VO' && formData.assignedCC) {
          // Find the CC node in the tree to refresh its branch
          const findAndRefresh = (list) => {
            if (!list) return false;
            for (const node of list) {
              if (node.clusterID === formData.assignedCC || node.voID === formData.assignedCC) {
                fetchNodeBranch(node._id, node.role);
                return true;
              }
              const children = node.ccs || node.vos;
              if (children && findAndRefresh(children)) return true;
            }
            return false;
          };
          refreshedBranch = findAndRefresh(users);
        }

        if (!refreshedBranch) {
          fetchUsers(); // Fallback to full refresh
        }

        fetchUserCounts();
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
      const { isDeveloper, shgList, ...submitData } = { ...formData, role: finalRole };

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
        // --- Sync SHG Master Data ---
        if (formData.role === 'VO') {
          // 1. Handle Deletions
          for (const shgId of deletedShgIds) {
            try {
              await fetch(`${API_BASE}/api/shg-master/${shgId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
            } catch (err) { console.warn(`Failed to delete SHG ${shgId}:`, err); }
          }

          // 2. Handle Updates & New Entries
          const newShgs = [];
          for (const shg of formData.shgList) {
            if (shg._id) {
              // Existing SHG -> Update
              try {
                await fetch(`${API_BASE}/api/shg-master/${shg._id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    'SHG Name': shg['SHG Name'] || shg.shgName,
                    'endMonth': shg.endMonth,
                    'endYear': shg.endYear
                  })
                });
              } catch (err) { console.warn(`Failed to update SHG ${shg._id}:`, err); }
            } else {
              // New SHG -> Queue for batch create
              newShgs.push(shg);
            }
          }

          if (newShgs.length > 0) {
            try {
              const shgsPayload = newShgs
                .filter(s => s.shgID && s.shgName)
                .map(s => ({
                  shgID: s.shgID,
                  shgName: s.shgName,
                  voID: formData.voID,
                  voName: formData.voName,
                  district: formData.district,
                  mandal: formData.mandal,
                  village: formData.village,
                  month: 1,
                  year: 2025,
                  endMonth: s.endMonth || null,
                  endYear: s.endYear || null
                }));
              if (shgsPayload.length > 0) {
                await fetch(`${API_BASE}/api/shg-master`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ shgs: shgsPayload })
                });
              }
            } catch (err) { console.warn('Failed to add new SHGs:', err); }
          }
        }

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
        // --- OPTIMIZED FRONTEND REMOVAL ---

        let deletedUser = null;
        let parentId = null;

        // 🔍 Step 1: Find user and parent before removing
        const findAndTrace = (list, pid = null) => {
          if (!list) return false;
          for (const u of list) {
            if (u._id === userId) {
              deletedUser = u;
              parentId = pid;
              return true;
            }
            const children = u.ccs || u.vos;
            if (children && findAndTrace(children, u._id)) return true;
          }
          return false;
        };

        findAndTrace(users);
        if (!deletedUser) {
          deletedUser = staffUsers.find(u => u._id === userId);
          // Note: Staff users are root level in this context
        }

        if (!deletedUser) {
          // Fallback if local lookup fails
          fetchUsers();
          return;
        }

        // Determine role for count decrement
        const rawRole = (deletedUser.role || '').toLowerCase();
        let roleKey = 'vo';
        if (rawRole.includes('apm')) roleKey = 'apm';
        else if (rawRole.includes('cc')) roleKey = 'cc';

        // 🔄 Step 2: Recursive remove and stats decrement
        const removeFromTree = (list) => {
          if (!list) return [];
          return list
            .filter(u => u._id !== userId)
            .map(u => {
              const updatedNode = { ...u };

              // Recurse into children
              if (u.ccs) updatedNode.ccs = removeFromTree(u.ccs);
              if (u.vos) updatedNode.vos = removeFromTree(u.vos);

              // 📊 Subtract stats from parent node
              if (u._id === parentId && (deletedUser.totalFiles || deletedUser.uploadedFiles)) {
                // Main display fields
                updatedNode.totalFiles = Math.max(0, (u.totalFiles || 0) - (deletedUser.totalFiles || 0));
                updatedNode.uploadedFiles = Math.max(0, (u.uploadedFiles || 0) - (deletedUser.uploadedFiles || 0));
                updatedNode.pendingFiles = Math.max(0, (u.pendingFiles || 0) - (deletedUser.pendingFiles || 0));

                // Deep stats object
                if (u.stats) {
                  updatedNode.stats = {
                    ...u.stats,
                    total: Math.max(0, (u.stats.total || 0) - (deletedUser.totalFiles || 0)),
                    uploaded: Math.max(0, (u.stats.uploaded || 0) - (deletedUser.uploadedFiles || 0)),
                    pending: Math.max(0, (u.stats.pending || 0) - (deletedUser.pendingFiles || 0))
                  };
                }
              }

              return updatedNode;
            });
        };

        // 🚀 Step 3: Apply State Updates
        setUsers(prev => removeFromTree(prev));
        setStaffUsers(prev => prev.filter(u => u._id !== userId));
        setTotalUsers(prev => Math.max(0, prev - 1));
        setUserCounts(prev => ({
          ...prev,
          [roleKey]: Math.max(0, (prev[roleKey] || 0) - 1)
        }));
        fetchUserCounts(); // 🔄 Also refresh from server to ensure filter consistency

      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete User error:', err);
      alert('Error deleting user');
    }
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    // Explicitly handle "None" or missing roles
    const roleRaw = (user.role && user.role.toLowerCase() !== 'none') ? user.role : 'VO';
    const isDeveloper = roleRaw.toUpperCase().includes('DEVELOPER');
    // Correctly extract base role by removing " - Developer" suffix if it exists
    let baseRole = isDeveloper ? roleRaw.replace(/ - Developer$/i, '') : roleRaw;

    // Normalize baseRole to match dropdown values (VO, Admin, Admin - CC, Admin - APM)
    const knownRoles = ['VO', 'Admin', 'Admin - CC', 'Admin - APM'];
    const matchedRole = knownRoles.find(r => r.toLowerCase() === baseRole.toLowerCase());
    if (matchedRole) baseRole = matchedRole;

    setFormData({
      voName: user.voName || user.userName || user.name || '',
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
      userName: user.userName || user.voName || '',
      assignedCC: '',
      shgList: []
    });
    setDeletedShgIds([]);
    setShowPassword(false);
    setCcList([]);
    setShowEditModal(true);

    // Fetch SHGs if it's a VO
    if (baseRole === 'VO' && user.voID) {
      const fetchVOShgs = async () => {
        setShgListLoading(true);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/api/shg-master/vo/${user.voID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            setFormData(prev => ({ ...prev, shgList: data.shgs || [] }));
          }
        } catch (err) {
          console.error('Failed to fetch SHGs:', err);
        } finally {
          setShgListLoading(false);
        }
      };
      fetchVOShgs();
    }
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
      userName: '',
      assignedCC: '',
      shgList: []
    });
    setShowPassword(false);
    setCcList([]);
    setShowAddModal(true);
  };

  // Fetch user uploads
  const fetchUserUploads = async (userId, options = {}) => {
    const isBackground = options.isBackground || false;
    if (!isBackground) setUploadsLoading(true);
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
      if (!isBackground) alert('Failed to fetch uploads');
    } finally {
      if (!isBackground) setUploadsLoading(false);
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
        rejectionReason,
        viaGate: finalStatus === 'validated'
      });

      // If approving (validating), use the gated approval endpoint
      if (finalStatus === 'validated') {
        const res = await fetch(
          `${API_BASE}/api/approval-gate/approve/${selectedUpload._id}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await res.json();
        if (data.success) {
          const message = data.upload.queued
            ? 'Upload approved and queued for conversion!'
            : 'Upload approved! Conversion queuing is skipped (gate is CLOSED).';
          alert(message);
          setShowStatusModal(false);
          setSelectedUpload(null);
          setStatus('pending');
          setRejectionReason('');
          fetchUserUploads(selectedUser._id, { isBackground: true });

          // 🔄 LIVE UPDATE: Refresh tree immediately
          await refreshUserStatsInTree(selectedUser._id);
        } else {
          // Check if it's an already-validated error
          if (res.status === 409) {
            alert('Upload was already validated by another admin.');
          } else {
            alert(data.message || 'Failed to approve upload');
          }
        }
      } else {
        // Rejection flow - use regular endpoint
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
          fetchUserUploads(selectedUser._id, { isBackground: true });

          // 🔄 LIVE UPDATE: Refresh tree immediately
          await refreshUserStatsInTree(selectedUser._id);
        }
        else {
          alert(data.message || 'Failed to update status');
        }
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

      let url;
      let method;
      let bodyData;

      if (status === 'validated') {
        // Use the dedicated approval gate endpoint for validation
        url = `${API_BASE}/api/approval-gate/approve/${upload._id}`;
        method = 'POST';
        bodyData = null;
      } else {
        // Use regular status update for rejection/pending
        url = `${API_BASE}/api/admin/uploads/${upload._id}/status`;
        method = 'PUT';
        bodyData = {
          status: status,
          rejectionReason: reason
        };
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: bodyData ? JSON.stringify(bodyData) : undefined
      });

      const data = await res.json();
      if (data.success) {
        // Refresh uploads in background
        fetchUserUploads(selectedUser._id, { isBackground: true });

        // 🔄 LIVE UPDATE: Refresh tree immediately
        await refreshUserStatsInTree(selectedUser._id);
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
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">User Management</h2>
            <p className="text-[10px] sm:text-sm text-gray-500 font-bold mt-1">
              {(() => {
                const counts = [
                  { key: 'apm', label: 'APMs' },
                  { key: 'cc', label: 'CCs' },
                  { key: 'vo', label: 'VOs' }
                ];
                const activeCounts = counts.filter(c => userCounts[c.key] > 0);

                if (activeCounts.length === 0) return "No users found";

                return (
                  <>
                    Managing {activeCounts.map((c, idx) => (
                      <React.Fragment key={c.key}>
                        <span className="text-indigo-600 font-black">{userCounts[c.key]}</span> {c.label}
                        {idx < activeCounts.length - 2 ? ', ' : idx === activeCounts.length - 2 ? ' and ' : ''}
                      </React.Fragment>
                    ))}
                    {totalPages > 1 && (
                      <> across <span className="text-indigo-600 font-black">{totalPages}</span> pages</>
                    )}
                  </>
                );
              })()}
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

        {/* Conversion Gate Controls - Admin/Dev Only */}
        {isDeveloperUser && (
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${gateStatus.isOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {gateStatus.isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-2">
                    Conversion Gate
                    <span className={`text-xs font-black px-2 py-1 rounded-full ${gateStatus.isOpen
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                      }`}>
                      {gateStatus.isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                    {gateStatus.lastUpdatedAt
                      ? `Last updated by ${gateStatus.lastUpdatedByName || gateStatus.lastUpdatedBy} at ${new Date(gateStatus.lastUpdatedAt).toLocaleTimeString()}`
                      : 'Gate status'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                <button
                  onClick={() => setIsGateCollapsed(!isGateCollapsed)}
                  className="px-4 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-100 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {isGateCollapsed ? 'Open Controls' : 'Close Controls'}
                </button>
                <button
                  onClick={() => setShowGateModal(true)}
                  disabled={isTogglingGate}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${gateStatus.isOpen
                    ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white'
                    }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{gateStatus.isOpen ? 'Close Gate' : 'Open Gate'}</span>
                </button>
              </div>
            </div>

            {!isGateCollapsed && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-widest">Gate Message (Optional)</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={gateMessage}
                      onChange={(e) => setGateMessage(e.target.value)}
                      placeholder="e.g., Maintenance in progress, wait for approval"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {gateStatus.message && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 text-[10px] font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Current message: "{gateStatus.message}"
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 text-[10px] font-bold">
                  <Shield className="w-4 h-4 shrink-0" />
                  {gateStatus.isOpen
                    ? '✓ Gate is OPEN. New approvals will be queued for conversion automatically.'
                    : '⚠️ Gate is CLOSED. New approvals will succeed, but conversion will NOT be queued.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VO Upload Access Gateway - Admin/APM/CC/Dev */}

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
                  {!showFilters && (selectedDistrict !== 'all') && (
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse border-2 border-white"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Filters Section */}
            <div className={`space-y-6 sm:space-y-8 transition-all duration-500 ease-in-out overflow-hidden ${showFilters ? 'max-h-[1000px] opacity-100 mt-6 pt-6 sm:mt-8 sm:pt-8 border-t border-gray-100' : 'max-h-0 opacity-0'}`}>
              {/* Period Filters row */}
              <div className="">
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
                      value={filterMonth || String(new Date().getMonth() + 1).padStart(2, '0')}
                      onChange={(e) => onMonthChange(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <option key={m} value={m}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m) - 1]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 ml-1 uppercase">Year</label>
                    <select
                      value={filterYear || new Date().getFullYear()}
                      onChange={(e) => onYearChange(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-gray-700 hover:bg-white"
                    >
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
                <div className={`hidden lg:block custom-scrollbar transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                  <div className="overflow-x-auto">
                    {(() => {
                      const renderUserList = (userList, title, isOperational = true) => {
                        const renderUserRow = (u, isNested = false, depth = 0) => {
                          const isExpanded = expandedRows.has(u._id);
                          const uRoleRaw = u.role || 'VO';
                          const uRoleLower = (uRoleRaw.toLowerCase() === 'none') ? 'vo' : uRoleRaw.toLowerCase();
                          const uIsDev = uRoleLower.includes('developer');
                          const uIsAdmin = uRoleLower.includes('admin') && !uIsDev && !uRoleLower.includes('apm') && !uRoleLower.includes('cc');
                          const uIsAPM = uRoleLower.includes('admin - apm');
                          const uIsCC = uRoleLower.includes('admin - cc');
                          const uIsVO = uRoleLower.startsWith('vo') || uRoleLower === 'none' || !u.role;

                          const perf = u.performanceStats || {
                            uploads: { approved: 0, rejected: 0, pending: 0 },
                            conversion: { success: 0, failed: 0, pending: 0, processing: 0 }
                          };

                          return (
                            <tr key={u._id} className={`hover:bg-indigo-50/30 transition-all group ${isNested ? 'bg-indigo-50/10' : ''}`}>
                              <td className="px-4 py-6 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                  {u.isHierarchical ? (
                                    <button
                                      onClick={() => toggleRow(u)}
                                      className="p-1 hover:bg-white rounded-lg transition-all shadow-sm border border-gray-100 group/btn"
                                    >
                                      {loadingNodes.has(u._id) ? (
                                        <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                      ) : isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-indigo-600" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover/btn:text-indigo-500" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-[34px]" />
                                  )}
                                  {depth > 0 && (
                                    <div className="flex" style={{ marginLeft: `${(depth - 1) * 24}px` }}>
                                      <div className="w-px h-12 bg-indigo-200/50 mr-2"></div>
                                    </div>
                                  )}

                                  <div className="flex flex-col items-center gap-2 min-w-[48px]">
                                    <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${uIsDev
                                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-100'
                                      : (uIsAdmin || uIsAPM || uIsCC)
                                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-100'
                                        : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-100'
                                      }`}>
                                      {uIsDev ? <Lock className="w-4 h-4" /> : (uIsAdmin || uIsAPM || uIsCC) ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                      <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border shadow-sm ${uIsDev
                                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                                        : (uIsAdmin || uIsAPM || uIsCC)
                                          ? 'bg-purple-100 text-purple-700 border-purple-200'
                                          : 'bg-blue-100 text-blue-700 border-blue-200'
                                        }`}>
                                        {((u.role && u.role.toLowerCase() !== 'none') ? u.role : 'VO').split(' - ').pop()}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <div
                                      className="text-base font-black text-gray-900 leading-tight cursor-pointer hover:underline flex items-center gap-2"
                                      onClick={() => uIsVO && handleViewUserUploads(u)}
                                    >
                                      {u.voName}
                                      {u.isOnline && (
                                        <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" title="Online"></span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="text-xs font-bold text-gray-500">
                                        {u.village ? `${u.village}, ` : ''}{u.mandal}, {u.district}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1">
                                      {(u.voID || u.userID || u.clusterID) && (
                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                          ID: {u.voID || u.userID || u.clusterID}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-gray-300" />
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Active {formatLastActive(u.lastActiveAt)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-6 text-center border-r border-gray-50">
                                {(uIsAdmin || uIsDev) ? (
                                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">N/A</span>
                                ) : (
                                  <div className="flex justify-center items-center gap-6">
                                    <span className="text-base font-black text-emerald-600 leading-none" title="Uploaded">{u.uploadedFiles || 0}</span>
                                    <span className="text-base font-black text-orange-500 leading-none" title="Pending">{u.pendingFiles || 0}</span>
                                    <span className="text-base font-black text-gray-900 leading-none" title="Total">{u.totalFiles || 0}</span>
                                    <div className="border-l border-gray-100 pl-4">
                                      <span className="text-base font-black text-indigo-500 tracking-tighter" title="Percentage Complete">
                                        {u.totalFiles > 0 ? (((u.uploadedFiles || 0) / u.totalFiles) * 100).toFixed(1) : 0}%
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-6 text-center border-r border-gray-50">
                                {(uIsAdmin || uIsDev) ? (
                                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">N/A</span>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex justify-center items-center gap-6">
                                      <span className="text-base font-black text-emerald-600 leading-none" title="Success">{perf.conversion.success}</span>
                                      <span className="text-base font-black text-red-600 leading-none" title="Failed">{perf.conversion.failed}</span>
                                      <span className="text-base font-black text-orange-500 leading-none" title="In Queue">{perf.conversion.pending + perf.conversion.processing}</span>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-6 whitespace-nowrap text-right">
                                <div className="flex justify-end gap-2 transition-opacity">
                                  {(isDeveloperUser || currentUserRole.includes('admin') || currentUserRole.includes('apm') || currentUserRole.includes('cc')) && (
                                    <button
                                      id={`select-access-${u._id}`}
                                      onClick={() => handleToggleUploadAccess(u)}
                                      disabled={updatingAccessId === u._id}
                                      className={`p-1.5 rounded-lg transition-all shadow-sm ${u.uploadAccessMode === 'restricted'
                                          ? 'bg-orange-600 text-white shadow-orange-200'
                                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                                        }`}
                                      title={u.uploadAccessMode === 'restricted' ? "Upload Access: LOCKED (Click to release)" : "Upload Access: OPEN (Click to lock to current month)"}
                                    >
                                      {updatingAccessId === u._id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : u.uploadAccessMode === 'restricted' ? (
                                        <Lock className="w-4 h-4" />
                                      ) : (
                                        <Unlock className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {(uIsAPM || uIsCC) && (
                                    <button
                                      onClick={() => downloadSummaryExcel(u)}
                                      className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm"
                                      title="Download Performance Summary (Excel)"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canViewUserUploads(u) && (
                                    <button
                                      onClick={() => {
                                        setSelectedUserId(u._id);
                                        setSelectedUserName(u.voName);
                                        setActiveTab('conversion');
                                      }}
                                      className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shadow-sm"
                                      title="View Converted SHGs"
                                    >
                                      <FileSymlink className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canEditUser(u) && (
                                    <button
                                      onClick={() => openEditModal(u)}
                                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm"
                                      title="Edit User"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canDeleteUser(u) && (
                                    <button
                                      onClick={() => handleDeleteUser(u._id)}
                                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm"
                                      title="Delete User"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        };

                        return (
                          <div className="mb-10 last:mb-0">
                            {/* Statistics Legend */}
                            <div className="mb-4 flex flex-wrap items-center justify-end gap-6 px-4 py-3 bg-gray-50/50 rounded-2xl border border-gray-100/50 backdrop-blur-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Uploaded / Success</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"></div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pending / In Queue</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"></div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Failed / Rejection</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-gray-900 shadow-[0_0_8px_rgba(17,24,39,0.2)]"></div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total baseline</span>
                              </div>
                            </div>

                            <table className="w-full text-left border-collapse min-w-[1000px]">
                              <thead>
                                <tr className="bg-indigo-700 text-white">
                                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-[40%]">
                                    {currentUserRole.includes('admin - apm')
                                      ? 'CC Profile'
                                      : currentUserRole.includes('admin - cc')
                                        ? 'VO Profile'
                                        : 'APM Profile'
                                    }
                                  </th>
                                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest border-r border-white/10 text-center w-[25%]" title="Upload Status (U/P/T / %)">
                                    Upload Status (U/P/T / %)
                                  </th>
                                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest border-r border-white/10 text-center w-[20%]">
                                    Conversion (S/F/Q)
                                  </th>
                                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-right w-[15%]">Actions</th>
                                </tr>
                              </thead>
                              <tbody key={page} className="divide-y divide-gray-100">
                                {userList.map((user) => {
                                  const renderUserTree = (u, depth = 0) => {
                                    const isExpandedLocal = expandedRows.has(u._id);
                                    return (
                                      <React.Fragment key={u._id}>
                                        {renderUserRow(u, depth > 0, depth)}
                                        {isExpandedLocal && (
                                          <>
                                            {u.ccs && u.ccs.length > 0 && u.ccs.map(child => renderUserTree(child, depth + 1))}
                                            {u.vos && u.vos.length > 0 && u.vos.map(child => renderUserTree(child, depth + 1))}
                                          </>
                                        )}
                                      </React.Fragment>
                                    );
                                  };
                                  return renderUserTree(user);
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-4">
                          {renderUserList(users, "Operational Hierarchy (APM > CC > VO)", true)}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Technical Staff Section (Table View) - Moved to bottom */}
                  {staffUsers.length > 0 && (
                    <div className="mt-3 mb-10 border-t border-gray-100 pt-10">
                      <div className="flex items-center gap-3 px-8 py-6 bg-amber-50/50 border-b border-gray-100">
                        <div className="bg-amber-100 p-2 rounded-xl">
                          <Lock className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Technical & Administrative Staff</h3>
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-700/90 text-white">
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-[80%]">Staff Profile & Identity</th>
                            <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right w-[20%]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {staffUsers.map(s => {
                            const rLower = (s.role || '').toLowerCase();
                            const sIsDev = rLower.includes('developer');
                            return (
                              <tr key={s._id} className="hover:bg-amber-50/20 transition-all group">
                                <td className="px-8 py-5 whitespace-nowrap">
                                  <div className="flex items-center gap-6">
                                    <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${sIsDev ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                      }`}>
                                      {sIsDev ? <Lock className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                      <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter border shadow-sm ${sIsDev ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                        }`}>
                                        {(s.role || 'Admin').split(' - ').pop()}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-base font-black text-gray-900 leading-tight">{s.voName || s.name}</span>
                                      <div className="flex items-center gap-4 mt-1">
                                        {(s.voID || s.userID || s.clusterID) && (
                                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                            ID: {s.voID || s.userID || s.clusterID}
                                          </span>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="w-3 h-3 text-gray-300" />
                                          <span className="text-[9px] font-bold text-gray-400 uppercase">Active {formatLastActive(s.lastActiveAt)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-right">
                                  <div className="flex justify-end gap-3 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEditUser(s) && (
                                      <button onClick={() => openEditModal(s)} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm">
                                        <Edit className="w-5 h-5" />
                                      </button>
                                    )}
                                    {canDeleteUser(s) && (
                                      <button onClick={() => handleDeleteUser(s._id)} className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm">
                                        <Trash2 className="w-5 h-5" />
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
                  )}
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden p-4 space-y-8">

                  {/* Mobile Ground Hierarchy */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Ground Operational Hierarchy</h3>
                    </div>
                    {users.map((user) => {
                      const renderCardTree = (u, isNested = false) => {
                        const isExpanded = expandedRows.has(u._id);
                        const isLoading = loadingNodes.has(u._id);
                        const uRoleRaw = u.role || 'VO';
                        const uRoleLower = (uRoleRaw.toLowerCase() === 'none') ? 'vo' : uRoleRaw.toLowerCase();
                        const uIsAPM = uRoleLower.includes('admin - apm');
                        const uIsCC = uRoleLower.includes('admin - cc');
                        const uIsVO = uRoleLower.startsWith('vo') || uRoleLower === 'none' || !u.role;

                        const perf = u.performanceStats || {
                          uploads: { approved: 0, pending: 0 },
                          conversion: { success: 0, failed: 0, pending: 0, processing: 0 }
                        };

                        return (
                          <div key={u._id} className="space-y-2">
                            <div className={`${isNested ? 'bg-indigo-50/30' : 'bg-white'} rounded-3xl border border-gray-100 shadow-sm overflow-hidden`}>
                              <div className="p-4 space-y-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className={`relative ${isNested ? 'w-10 h-10' : 'w-11 h-11'} rounded-2xl flex items-center justify-center shadow-md ${uIsDev
                                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                      : (uIsAdmin || uIsAPM || uIsCC)
                                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                        : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                      }`}>
                                      {uIsDev ? <Lock className="w-4 h-4" /> : (uIsAdmin || uIsAPM || uIsCC) ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                      <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase tracking-tighter border shadow-sm ${uIsDev
                                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                                        : (uIsAdmin || uIsAPM || uIsCC)
                                          ? 'bg-purple-100 text-purple-700 border-purple-200'
                                          : 'bg-blue-100 text-blue-700 border-blue-200'
                                        }`}>
                                        {((u.role && u.role.toLowerCase() !== 'none') ? u.role : 'VO').split(' - ').pop()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-black text-gray-900 leading-tight flex items-center gap-2 truncate" onClick={() => uIsVO && handleViewUserUploads(u)}>
                                      {u.voName}
                                      {u.isOnline && <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 text-gray-400" />
                                        <span className="text-[9px] font-bold text-gray-500 truncate max-w-[120px]">{u.village || u.mandal}, {u.district}</span>
                                      </div>
                                      {(u.voID || u.userID || u.clusterID) && (
                                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded">ID: {u.voID || u.userID || u.clusterID}</span>
                                      )}
                                    </div>
                                  </div>
                                  {u.isHierarchical && (
                                    <button onClick={() => toggleRow(u)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl transition-all">
                                      {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                      ) : (
                                        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                      )}
                                    </button>
                                  )}
                                </div>

                                {!(uIsAdmin || uIsDev) && (
                                  <div className="space-y-4 pt-3 border-t border-gray-50">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-white p-2 rounded-2xl border border-gray-100 text-center">
                                        <div className="flex justify-between items-center mb-1 px-1">
                                          <span className="text-[7px] font-black text-gray-400 uppercase">Uploads</span>
                                          <span className="text-[9px] font-black text-indigo-500">
                                            {u.totalFiles > 0 ? (((u.uploadedFiles || 0) / u.totalFiles) * 100).toFixed(1) : 0}% Done
                                          </span>
                                        </div>
                                        <div className="flex gap-4 justify-center items-center py-1">
                                          <div className="text-sm font-black text-emerald-600">{u.uploadedFiles || 0}</div>
                                          <div className="text-sm font-black text-orange-500">{u.pendingFiles || 0}</div>
                                          <div className="flex items-baseline gap-1 border-l border-gray-100 pl-3">
                                            <div className="text-sm font-black text-black">{u.totalFiles || 0}</div>
                                            <div className="text-[9px] font-black text-indigo-500">
                                              ({u.totalFiles > 0 ? (((u.uploadedFiles || 0) / u.totalFiles) * 100).toFixed(1) : 0}%)
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-white p-2 rounded-2xl border border-indigo-100">
                                      <div className="flex justify-between items-center mb-1 px-1">
                                        <span className="text-[7px] font-black text-gray-400 uppercase">Conversion</span>
                                      </div>
                                      <div className="flex justify-center gap-6 py-1">
                                        <div className="text-sm font-black text-emerald-600">{perf.conversion.success}</div>
                                        <div className="text-sm font-black text-red-600">{perf.conversion.failed}</div>
                                        <div className="text-sm font-black text-orange-500">{perf.conversion.pending + perf.conversion.processing}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-1.5 pt-2">
                                  {(uIsAPM || uIsCC) && <button onClick={() => downloadSummaryExcel(u)} className="flex-1 p-1 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center gap-1"><Download className="w-3 h-3" /><span className="text-[7px] font-black">REPORT</span></button>}
                                  {canViewUserUploads(u) && <button onClick={() => { setSelectedUserId(u._id); setSelectedUserName(u.voName); setActiveTab('conversion'); }} className="flex-1 p-1 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center gap-1"><FileSymlink className="w-3 h-3" /><span className="text-[7px] font-black">VIEW</span></button>}
                                  {canEditUser(u) && <button onClick={() => openEditModal(u)} className="flex-1 p-1 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center gap-1"><Edit className="w-3 h-3" /><span className="text-[7px] font-black">EDIT</span></button>}
                                </div>
                              </div>
                            </div>
                            {isExpanded && u.vos && u.vos.length > 0 && (
                              <div className="pl-4 border-l-2 border-indigo-100 space-y-2 my-2 ml-4">
                                {u.vos.map(child => renderCardTree(child, true))}
                              </div>
                            )}
                          </div>
                        );
                      };
                    })}
                  </div>

                  {/* Mobile Staff Section - Moved to bottom */}
                  {staffUsers.length > 0 && (
                    <div className="space-y-4 pt-10 border-t border-gray-100 mt-10">
                      <div className="flex items-center gap-3 px-2">
                        <div className="bg-amber-100 p-2 rounded-xl">
                          <Lock className="w-4 h-4 text-amber-600" />
                        </div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Technical & Administrative Staff</h3>
                      </div>
                      <div className="space-y-3">
                        {staffUsers.map(s => {
                          const rLower = (s.role || '').toLowerCase();
                          const sIsDev = rLower.includes('developer');
                          return (
                            <div key={s._id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                              <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${sIsDev ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                }`}>
                                {sIsDev ? <Lock className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase tracking-tighter border shadow-sm ${sIsDev ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                  }`}>
                                  {(s.role || 'Admin').split(' - ').pop()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-gray-900 text-sm truncate">{s.voName || s.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  {(s.voID || s.userID || s.clusterID) && (
                                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded">
                                      ID: {s.voID || s.userID || s.clusterID}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {canEditUser(s) && (
                                  <button onClick={() => openEditModal(s)} className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteUser(s) && (
                                  <button onClick={() => handleDeleteUser(s._id)} className="p-2 bg-red-50 text-red-600 rounded-xl">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
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

          {/* Modal Portals - Wrapped in zero-size absolute container to prevent any layout insertio n */}
          <div className="absolute h-0 w-0 overflow-hidden pointer-events-none">
            {/* Add/Edit Modal */}
            {
              (showAddModal || showEditModal) && createPortal(
                <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4 !mt-0 animate-in fade-in duration-300">
                  <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-200">
                    <div className="px-4 sm:px-8 py-6 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`p-2 sm:p-3 rounded-2xl shadow-lg ${showAddModal ? 'bg-indigo-600' : 'bg-purple-600'} text-white`}>
                          {showAddModal ? <Plus className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-gray-900 leading-tight">{showAddModal ? 'Add New User' : 'Update User Details'}</h3>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{showAddModal ? 'Create Account' : 'Update Account'}</p>
                        </div>
                      </div>
                      <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 sm:p-2.5 bg-white text-gray-400 hover:text-red-500 hover:shadow-md rounded-xl transition-all border border-gray-100">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={showAddModal ? handleAddUser : handleEditUser} className="p-4 sm:p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                      <div className="space-y-6">
                        {/* SECTION 1: IDENTITY & ROLE */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Identity Card */}
                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <User className="w-5 h-5" />
                              </div>
                              <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Identity</h4>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Full Name</label>
                              <input
                                type="text"
                                required
                                value={formData.voName}
                                onChange={(e) => setFormData({ ...formData, voName: e.target.value })}
                                className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                placeholder={formData.role === 'Admin - CC' ? 'e.g. Cluster Admin' : 'e.g. Navodaya VO'}
                              />
                            </div>

                            {(formData.role === 'Admin' || (formData.role === 'VO' && formData.isDeveloper)) && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">
                                  {formData.role === 'VO' ? 'Phone (for login)' : 'Primary Contact / Login'}
                                </label>
                                <input
                                  type="text"
                                  required={formData.role === 'Admin'}
                                  value={formData.phone}
                                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                  placeholder="+91 XXXXXXXXXX"
                                />
                              </div>
                            )}
                          </div>

                          {/* Access Card */}
                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                                <Shield className="w-5 h-5" />
                              </div>
                              <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Access Control</h4>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">System Role</label>
                              <div className="relative">
                                <select
                                  value={formData.role}
                                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                  className="w-full appearance-none bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
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
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">
                                {showEditModal ? 'Update Password' : 'Password'}
                              </label>
                              <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  required={showAddModal}
                                  value={formData.password}
                                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl pl-12 pr-12 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                  placeholder="**********"
                                />
                                {formData.password && (
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none animate-in fade-in zoom-in duration-200"
                                  >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {isDeveloperUser && (
                              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                                <input
                                  type="checkbox"
                                  id="isDeveloper"
                                  checked={formData.isDeveloper}
                                  onChange={(e) => setFormData({ ...formData, isDeveloper: e.target.checked })}
                                  className="w-5 h-5 rounded-lg border-2 border-amber-300 text-amber-600 focus:ring-amber-500 transition-all cursor-pointer"
                                />
                                <label htmlFor="isDeveloper" className="text-xs font-black text-amber-900 uppercase cursor-pointer select-none">
                                  Developer Access
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTION 2: JURISDICTION & HIERARCHY (Only if applicable) */}
                        {!(formData.role === 'Admin' || formData.isDeveloper) && (
                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Jurisdiction Details</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {!(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) && (
                                <div className="space-y-2 text-center md:text-left">
                                  <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">District</label>
                                  <div className="relative">
                                    <select
                                      value={formData.district}
                                      required
                                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                      className="w-full appearance-none bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                    >
                                      <option value="">Select District</option>
                                      {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </div>
                              )}

                              {!(currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc')) && (
                                <div className="space-y-2 text-center md:text-left">
                                  <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Mandal</label>
                                  <div className="relative">
                                    <select
                                      value={formData.mandal}
                                      required
                                      onChange={(e) => setFormData({ ...formData, mandal: e.target.value, village: '' })}
                                      disabled={!formData.district}
                                      className="w-full appearance-none bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                                    >
                                      <option value="">Select Mandal</option>
                                      {modalMandals.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </div>
                              )}

                              <div className={`space-y-2 text-center md:text-left ${currentUserRole.includes('admin - apm') || currentUserRole.includes('admin - cc') ? 'md:col-span-3' : ''}`}>
                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Village</label>
                                <div className="relative">
                                  <select
                                    value={formData.village}
                                    required={formData.role === 'VO'}
                                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                    disabled={!formData.mandal || (formData.role !== 'VO')}
                                    className="w-full appearance-none bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                                  >
                                    <option value="">{formData.role === 'VO' ? 'Select Village' : 'No Village Required'}</option>
                                    {modalVillages.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>

                            {/* Organizational IDs */}
                            <div className="pt-6 border-t border-gray-100">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Role Specific Identification</h4>
                              </div>

                              {formData.role === 'VO' && (() => {
                                // Developer: 4-digit VO ID; normal: 15-digit
                                const devMode = isDeveloperUser && formData.isDeveloper;
                                const voIdMin = devMode ? 4 : 15;
                                const voIdMax = devMode ? 4 : 15;
                                const voIdLabel = devMode ? 'VO ID (4 Digits – Dev)' : 'Official VO ID (15 Digits)';
                                const voIdPlaceholder = devMode ? '4-digit test ID' : '15-digit ID';
                                // SHG IDs: developer = 9 digits, normal = 18 digits
                                const shgIdLen = devMode ? 9 : 18;
                                return (
                                  <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">{voIdLabel}</label>
                                        <input
                                          type="text"
                                          required
                                          maxLength={voIdMax}
                                          minLength={voIdMin}
                                          disabled={showEditModal} // Don't allow changing VO ID for existing VO
                                          value={formData.voID}
                                          onChange={(e) => setFormData({ ...formData, voID: e.target.value.replace(/\D/g, '') })}
                                          className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all disabled:opacity-60"
                                          placeholder={voIdPlaceholder}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Representative VOA Name</label>
                                        <input
                                          type="text" required
                                          value={formData.voaName}
                                          onChange={(e) => setFormData({ ...formData, voaName: e.target.value })}
                                          className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                          placeholder="VOA Full Name"
                                        />
                                      </div>
                                    </div>

                                    {/* CC Assignment Dropdown */}
                                    {showAddModal && (
                                      <div className="space-y-2 mt-4">
                                        <label className="text-[10px] font-black text-gray-400 ml-1 uppercase flex items-center gap-2">
                                          Assign to CC
                                          {ccListLoading && <span className="text-indigo-400 animate-pulse">Loading...</span>}
                                        </label>
                                        <div className="relative">
                                          <select
                                            value={formData.assignedCC}
                                            onChange={(e) => setFormData({ ...formData, assignedCC: e.target.value })}
                                            className="w-full appearance-none bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                            disabled={ccListLoading || !formData.mandal}
                                          >
                                            <option value="">{formData.mandal ? (ccList.length === 0 && !ccListLoading ? 'No CCs in this mandal' : 'Select CC (optional)') : 'Select mandal first'}</option>
                                            {ccList.map(cc => (
                                              <option key={cc._id} value={cc.clusterID}>
                                                {cc.voName}{cc.clusterID ? ` (${cc.clusterID})` : ''}
                                              </option>
                                            ))}
                                          </select>
                                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                      </div>
                                    )}

                                    {/* SHG List Entry & Management */}
                                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                            <User className="w-4 h-4" />
                                          </div>
                                          <div className="flex flex-col">
                                            <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                              SHG Management
                                            </h4>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                              {showEditModal ? 'Edit existing and add new SHGs' : 'Add initial SHG list (optional)'}
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setFormData(prev => ({ ...prev, shgList: [...prev.shgList, { shgID: '', shgName: '', endMonth: null, endYear: null }] }))}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                                        >
                                          <Plus className="w-3.5 h-3.5" /> Add SHG
                                        </button>
                                      </div>

                                      {shgListLoading ? (
                                        <div className="flex flex-col items-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 gap-2">
                                          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Loading associated SHGs...</p>
                                        </div>
                                      ) : formData.shgList.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 font-bold text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                          No SHGs associated yet. Click "Add SHG" to begin.
                                        </p>
                                      ) : (
                                        <div className="space-y-3">
                                          {formData.shgList.map((shg, idx) => (
                                            <div key={shg._id || idx} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px] font-black shrink-0">
                                                    {idx + 1}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">SHG ID:</span>
                                                      <span className="text-[10px] font-black text-indigo-600 truncate">
                                                        {shg.shgID || shg['SHG ID'] || 'NEW'}
                                                      </span>
                                                    </div>
                                                    <input
                                                      type="text"
                                                      placeholder="SHG Name"
                                                      value={shg.shgName || shg['SHG Name'] || ''}
                                                      onChange={(e) => {
                                                        const updated = [...formData.shgList];
                                                        updated[idx] = { ...updated[idx], shgName: e.target.value, 'SHG Name': e.target.value };
                                                        setFormData(prev => ({ ...prev, shgList: updated }));
                                                      }}
                                                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all mt-1"
                                                    />
                                                  </div>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const warnMsg = shg._id ? 'WARNING: This will permanently delete this SHG from the master list. Are you sure?' : 'Remove this SHG from the list?';
                                                    if (!window.confirm(warnMsg)) return;

                                                    if (shg._id) {
                                                      setDeletedShgIds(prev => [...prev, shg._id]);
                                                    }
                                                    const updated = formData.shgList.filter((_, i) => i !== idx);
                                                    setFormData(prev => ({ ...prev, shgList: updated }));
                                                  }}
                                                  className="p-2 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-2xl transition-all shrink-0"
                                                  title="Remove SHG"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>

                                              {/* Time Controls: End Month/Year */}
                                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Process Ends (Month)</label>
                                                  <select
                                                    value={shg.endMonth || ''}
                                                    onChange={(e) => {
                                                      const val = e.target.value ? parseInt(e.target.value) : null;
                                                      const updated = [...formData.shgList];
                                                      updated[idx] = { ...updated[idx], endMonth: val };
                                                      setFormData(prev => ({ ...prev, shgList: updated }));
                                                    }}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-2 py-1.5 text-[10px] font-bold focus:border-emerald-500 outline-none transition-all"
                                                  >
                                                    <option value="">No End Month</option>
                                                    {Array.from({ length: 12 }, (_, i) => (
                                                      <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Process Ends (Year)</label>
                                                  <select
                                                    value={shg.endYear || ''}
                                                    onChange={(e) => {
                                                      const val = e.target.value ? parseInt(e.target.value) : null;
                                                      const updated = [...formData.shgList];
                                                      updated[idx] = { ...updated[idx], endYear: val };
                                                      setFormData(prev => ({ ...prev, shgList: updated }));
                                                    }}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-2 py-1.5 text-[10px] font-bold focus:border-emerald-500 outline-none transition-all"
                                                  >
                                                    <option value="">No End Year</option>
                                                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                                                      <option key={y} value={y}>{y}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                              </div>

                                              {/* New Entry ID field (if not existing) */}
                                              {!shg._id && (
                                                <div className="space-y-1 bg-indigo-50/50 p-2 rounded-2xl border border-indigo-100">
                                                  <label className="text-[9px] font-black text-indigo-600 uppercase ml-1">New SHG ID ({devMode ? 9 : 18} Digits)</label>
                                                  <input
                                                    type="text"
                                                    placeholder="Enter numerical ID"
                                                    maxLength={devMode ? 9 : 18}
                                                    value={shg.shgID || ''}
                                                    onChange={(e) => {
                                                      const val = e.target.value.replace(/\D/g, '');
                                                      const updated = [...formData.shgList];
                                                      updated[idx] = { ...updated[idx], shgID: val };
                                                      setFormData(prev => ({ ...prev, shgList: updated }));
                                                    }}
                                                    className="w-full bg-white border-2 border-indigo-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:outline-none transition-all"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}

                              {formData.role === 'Admin - CC' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Cluster ID (8 Digits)</label>
                                    <input
                                      type="text" required maxLength={8} minLength={8}
                                      value={formData.clusterID}
                                      onChange={(e) => setFormData({ ...formData, clusterID: e.target.value.replace(/\D/g, '') })}
                                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                      placeholder="8-digit ID"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Cluster Name</label>
                                    <input
                                      type="text" required
                                      value={formData.clusterName}
                                      onChange={(e) => setFormData({ ...formData, clusterName: e.target.value })}
                                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                      placeholder="Full Cluster Name"
                                    />
                                  </div>
                                </div>
                              )}

                              {formData.role === 'Admin - APM' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">User ID (6 Digits)</label>
                                    <input
                                      type="text" required maxLength={6} minLength={6}
                                      value={formData.userID}
                                      onChange={(e) => setFormData({ ...formData, userID: e.target.value.replace(/\D/g, '') })}
                                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                      placeholder="6-digit ID"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">User Name</label>
                                    <input
                                      type="text" required
                                      value={formData.userName}
                                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                                      placeholder="Full User Name"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 pt-6 mt-8">
                        <button
                          type="button"
                          onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                          className="flex-1 px-8 py-4 bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-600 rounded-2xl font-black transition-all"
                        >
                          Discard
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className={`flex-[2] px-8 py-4 rounded-2xl font-black text-white shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.98]'}`}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              <span>{showAddModal ? 'Create Account' : 'Update Details'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )
            }

            {/* User Uploads Modal */}
            {
              showUserUploads && selectedUser && createPortal(
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
                          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0 w-full min-w-0">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 flex-1 min-w-[80px]">
                              <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase truncate">Pending</div>
                              <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.pending}</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-2.5 sm:px-4 py-1 sm:py-2.5 border border-white/20 flex-1 min-w-[80px]">
                              <div className="text-[7px] sm:text-[10px] font-black text-white/70 uppercase truncate">Approved</div>
                              <div className="text-sm sm:text-2xl font-black text-white">{uploadsSummary.validated}</div>
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
                          {groupedUserUploads.pending.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-3 border-2 border-orange-300 shadow-sm">
                                <AlertCircle className="text-orange-500" size={24} />
                                <h4 className="text-lg font-black text-gray-900">
                                  Pending Documents
                                  <span className="ml-2 text-sm font-normal text-gray-500">({groupedUserUploads.pending.length})</span>
                                </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {groupedUserUploads.pending.map((group, idx) => (
                                  <AdminUploadCard
                                    key={idx}
                                    group={group}
                                    status="pending"
                                    currentUserRole={currentUserRole}
                                    uploading={uploading}
                                    handleQuickStatusUpdate={handleQuickStatusUpdate}
                                    openStatusModal={openStatusModal}
                                    openImageViewer={openImageViewer}
                                    downloadImage={downloadImage}
                                  />
                                ))}
                              </div>
                            </div>
                          )}


                          {/* Validated Section */}
                          {groupedUserUploads.validated.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-3 border-2 border-green-300 shadow-sm">
                                <CheckCircle className="text-green-500" size={24} />
                                <h4 className="text-lg font-black text-gray-900">
                                  Approved Documents
                                  <span className="ml-2 text-sm font-normal text-gray-500">({groupedUserUploads.validated.length})</span>
                                </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {groupedUserUploads.validated.map((group, idx) => (
                                  <AdminUploadCard
                                    key={idx}
                                    group={group}
                                    status="validated"
                                    currentUserRole={currentUserRole}
                                    uploading={uploading}
                                    handleQuickStatusUpdate={handleQuickStatusUpdate}
                                    openStatusModal={openStatusModal}
                                    openImageViewer={openImageViewer}
                                    downloadImage={downloadImage}
                                  />
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
              )
            }

            {/* Status Update Modal */}
            {
              showStatusModal && selectedUpload && createPortal(
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
                      {/* Action Selection */}
                      <div>
                        <label className="block text-sm font-black text-gray-700 mb-3">Select Action</label>
                          <button
                            onClick={() => {
                              setStatus('validated');
                              setRejectionReason('');
                            }}
                            className={`p-4 rounded-2xl border-2 transition-all font-black text-sm w-full ${status === 'validated'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Approve & Queue
                            </div>
                            <p className="text-[11px] font-bold text-gray-600 mt-1 opacity-75">Send to conversion</p>
                          </button>
                      </div>

                      {/* Status-Specific UI */}
                      {status === 'validated' && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                          <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            This upload will be approved immediately.
                          </p>
                          <p className="text-xs text-emerald-600 mt-2 font-bold">
                            {gateStatus.isOpen
                              ? '✓ Gate is OPEN → Conversion will be queued automatically'
                              : '⚠️ Gate is CLOSED → Approval only (no conversion queuing)'}
                          </p>
                        </div>
                      )}

                      {status === 'rejected' && (
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">Reason for Rejection</label>
                          <select
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:border-indigo-500 focus:outline-none transition-all"
                          >
                            {REJECTION_REASONS.map((reason, idx) => (
                              <option key={idx} value={reason}>{reason}</option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs text-indigo-600 font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            VO will see this rejection reason and can resubmit.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setShowStatusModal(false)} className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-black transition-all">Cancel</button>
                      <button
                        onClick={handleUpdateStatus}
                        disabled={uploading}
                        className={`flex-1 px-6 py-3 text-white rounded-xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:grayscale shadow-md ${status === 'validated'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-red-600 hover:bg-red-700'
                          }`}
                      >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Approve & Queue'
                          )}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body

              )
            }

            {/* Full Image Viewer Mo dal */}

            {
              showImageViewer && createPortal(
                <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-2 sm:p-4 !mt-0 animate-in fade-in duration-300">
                  <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-200">
                    <div className="px-4 sm:px-8 py-3 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                      <div className="flex justify-between items-center bg-transparent">
                        <div className="bg-transparent">
                          <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">{viewerImages[currentViewerIndex]?.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5 bg-transparent">
                            <p className="text-[9px] sm:text-sm text-white/80 font-bold uppercase tracking-wider">{viewerImages[currentViewerIndex]?.subtitle}</p>
                          </div>
                        </div>
                        <button onClick={() => setShowImageViewer(false)} className="p-1.5 sm:p-2.5 bg-white/20 text-white hover:bg-white/30 hover:shadow-md rounded-xl transition-all border border-white/30">
                          <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50/50 custom-scrollbar flex items-start justify-center p-0 relative">
                      <img src={viewerImages[currentViewerIndex]?.url} alt={viewerImages[currentViewerIndex]?.title} className="w-auto h-auto shadow-2xl" />

                      {/* Navigation Arrows */}
                      {viewerImages.length > 1 && (
                        <div className="absolute inset-0 flex items-center justify-between p-4 pointer-events-none">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCurrentViewerIndex(prev => (prev > 0 ? prev - 1 : viewerImages.length - 1)); }}
                            className="p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all pointer-events-auto shadow-lg"
                          >
                            <ChevronLeft className="w-8 h-8" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCurrentViewerIndex(prev => (prev < viewerImages.length - 1 ? prev + 1 : 0)); }}
                            className="p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all pointer-events-auto shadow-lg"
                          >
                            <ChevronRight className="w-8 h-8" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="px-8 py-4 border-t border-gray-100 bg-white flex justify-between items-center gap-4">
                      {viewerImages.length > 1 && (
                        <div className="text-sm font-black text-gray-400 uppercase tracking-widest">
                          Page {currentViewerIndex + 1} of {viewerImages.length}
                        </div>
                      )}
                      <button onClick={() => downloadImage(viewerImages[currentViewerIndex].url, viewerImages[currentViewerIndex].filename)} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black transition-all shadow-md flex items-center gap-2">
                        <Download size={18} /> Download Original
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            }

            {/* Conversion Gate Toggle Modal */}
            {
              showGateModal && createPortal(
                <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-2 sm:p-4 !mt-0 animate-in fade-in duration-300">
                  <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
                    <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                      <div className="flex justify-between items-center bg-transparent">
                        <div className="bg-transparent">
                          <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                            {gateStatus.isOpen ? 'Close Conversion Gate' : 'Open Conversion Gate'}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-white/70 font-bold uppercase tracking-wider mt-1 bg-transparent">
                            This controls whether new upload approvals are processed
                          </p>
                        </div>
                        <button onClick={() => setShowGateModal(false)} className="p-2 bg-white/20 text-white hover:bg-white/30 rounded-xl transition-all">
                          <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="px-6 sm:px-8 py-6 space-y-6">
                      <div className={`p-4 rounded-2xl border-2 ${gateStatus.isOpen
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                        <p className="text-sm font-bold">
                          {gateStatus.isOpen
                            ? '⚠️ You\'re about to CLOSE the gate. New approvals will NOT be queued.'
                            : '✓ You\'re about to OPEN the gate. New approvals will be queued for conversion.'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-widest">
                          Reason (Optional)
                        </label>
                        <textarea
                          value={gateMessage}
                          onChange={(e) => setGateMessage(e.target.value)}
                          placeholder="e.g., Database maintenance in progress..."
                          className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-gray-400 resize-none h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowGateModal(false);
                            setGateMessage('');
                          }}
                          className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-black transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleToggleGate}
                          disabled={isTogglingGate}
                          className={`flex-1 px-6 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-white ${gateStatus.isOpen
                            ? 'bg-red-600 hover:bg-red-700 disabled:opacity-70'
                            : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70'
                            }`}
                        >
                          {isTogglingGate ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              {gateStatus.isOpen ? 'Close Gate' : 'Open Gate'}
                              {!gateStatus.isOpen && ' (auto-queue backlog)'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersTab;
