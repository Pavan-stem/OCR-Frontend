// SHGUploadSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, CheckCircle, X, FileText, Search, AlertCircle, Eye, Filter, RotateCw, RotateCcw, Camera, AlertTriangle, Activity, ScanLine } from 'lucide-react';
import { API_BASE } from './utils/apiConfig';
import { analyzeImage } from './utils/imageQualityCheck';

const SHGUploadSection = ({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  user,
  onUploadComplete,
  t,
  setMaintenance
}) => {
  const [shgData, setShgData] = useState([]);
  const [filteredShgData, setFilteredShgData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadStatus, setUploadStatus] = useState({});
  const [showUploadedOnly, setShowUploadedOnly] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fileInputRefs = useRef({});
  const nativeCameraInputRefs = useRef({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [allFilesValidated, setAllFilesValidated] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [serverProgress, setServerProgress] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [analyzingMap, setAnalyzingMap] = useState({});
  const [smartPreviewUrl, setSmartPreviewUrl] = useState(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  const [failedUploads, setFailedUploads] = useState([]);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [activeShgId, setActiveShgId] = useState(null);
  const [activeShgName, setActiveShgName] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingUploadShgId, setPendingUploadShgId] = useState(null);
  const [pendingUploadShgName, setPendingUploadShgName] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isCameraCapture, setIsCameraCapture] = useState(false);
  const [showSmartCamera, setShowSmartCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState({ id: null, name: null });
  // Action Sheet removed

  // Detect if device is mobile/tablet
  useEffect(() => {
    const checkIfMobileDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      // Check for mobile/tablet user agents
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|pad/i;
      const isMobile = mobileRegex.test(userAgent.toLowerCase());

      // Also check for touch capability as secondary indicator
      const hasTouch = () => {
        return (('ontouchstart' in window) ||
          (navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints > 0));
      };

      // Device is mobile if it matches user agent OR has touch AND small screen
      const isSmallScreen = window.innerWidth <= 1024;
      setIsMobileDevice(isMobile || (hasTouch() && isSmallScreen));
    };

    checkIfMobileDevice();
    window.addEventListener('resize', checkIfMobileDevice);
    return () => window.removeEventListener('resize', checkIfMobileDevice);
  }, []);

  const handleMaintenanceResponse = (data) => {
    if (setMaintenance) {
      const maintenanceData = {
        active: true,
        message: data.message || "Server is under maintenance",
        endTime: data.end_time || null
      };
      setMaintenance(maintenanceData);
      localStorage.setItem('maintenance_mode', JSON.stringify(maintenanceData));
    }
  };

  const isDeveloper = user?.role?.toLowerCase().includes('developer');
  const isTestMode = window.location.pathname.startsWith('/Test');
  const hasAIFeatures = isTestMode && isDeveloper;

  // Smart Preview Logic (Handles hard rotation and cropping for modal)
  useEffect(() => {
    if (!previewFile) {
      if (smartPreviewUrl) URL.revokeObjectURL(smartPreviewUrl);
      setSmartPreviewUrl(null);
      return;
    }

    const generateSmartPreview = async () => {
      console.log('📸 Generating smart preview for:', previewFile.fileName);
      setSmartPreviewUrl(null); // Clear old to show loader
      setIsProcessingPreview(true);
      try {
        // If we have rotation, process it
        if (previewFile.rotation && previewFile.rotation % 360 !== 0) {
          console.log('🔄 Applying rotation:', previewFile.rotation);
          const processedFile = await processFileRotation(previewFile, {
            quality: 0.9
          });

          const url = URL.createObjectURL(processedFile);
          if (smartPreviewUrl) URL.revokeObjectURL(smartPreviewUrl);
          setSmartPreviewUrl(url);
        } else {
          // No rotation needed, just use the original preview URL
          console.log('✅ No rotation needed, using original preview');
          setSmartPreviewUrl(previewFile.previewUrl);
        }
      } catch (err) {
        console.error("❌ Smart preview generation failed:", err);
        // Fallback to original preview URL
        setSmartPreviewUrl(previewFile.previewUrl);
      } finally {
        setIsProcessingPreview(false);
      }
    };

    generateSmartPreview();
  }, [previewFile, previewRotation]); // Re-run when preview file or rotation changes


  // Load SHG data from Excel on component mount or when user/month/year changes
  useEffect(() => {
    const initializeData = async () => {
      if (!user?.voID) {
        console.log('No user VO ID, skipping initialization');
        return;
      }

      // Load data when month and year are selected
      if (selectedMonth && selectedYear) {
        console.log(`Month/year selected: ${selectedMonth}/${selectedYear}`);
        loadSHGDataFromBackend();
      } else {
        console.log('No month/year selected yet');
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.voID, selectedMonth, selectedYear]);

  // Load failed uploads
  useEffect(() => {
    const loadFailedUploads = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          console.warn('⚠️ No token available for loading failed uploads');
          return;
        }

        const res = await fetch(`${API_BASE}/api/vo/uploads/failed?month=${selectedMonth}&year=${selectedYear}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) {
          console.error('❌ 401 UNAUTHORIZED when loading failed uploads');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }

        if (!res.ok) {
          console.warn(`⚠️ Failed to load rejected uploads: ${res.status}`);
          return;
        }

        const data = await res.json();
        if (data.success) {
          setFailedUploads(data.failed || []);
        }
      } catch (err) {
        console.error('Failed to load rejected uploads:', err);
      }
    };

    if (user?.voID) {
      loadFailedUploads();
    }
  }, [user?.voID, selectedMonth, selectedYear]);

  // Filter SHG data based on search and filters
  useEffect(() => {
    let filtered = shgData;

    if (searchTerm) {
      filtered = filtered.filter(shg =>
        shg.shgId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shg.shgName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (showUploadedOnly) {
      filtered = filtered.filter(shg => uploadStatus[shg.shgId]?.uploaded);
    }

    if (showPendingOnly) {
      filtered = filtered.filter(shg => !uploadStatus[shg.shgId]?.uploaded);
    }

    if (showFailedOnly) {
      filtered = filtered.filter(shg => {
        const isFailed = failedUploads.some(failed => failed.shgID === shg.shgId);
        return isFailed;
      });
    }

    setFilteredShgData(filtered);
  }, [searchTerm, shgData, uploadStatus, showUploadedOnly, showPendingOnly, showFailedOnly, failedUploads]);

  // Check if all uploaded files are validated
  useEffect(() => {
    const uploadedShgs = Object.keys(uploadedFiles);
    if (uploadedShgs.length === 0) {
      setAllFilesValidated(false);
      return;
    }

    const allValidated = uploadedShgs.every(shgId => uploadedFiles[shgId]?.validated === true);
    setAllFilesValidated(allValidated);
  }, [uploadedFiles]);

  const fetchUploadProgress = async () => {
    if (!selectedMonth || !selectedYear) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No token found in localStorage!');
        window.location.href = '#/login';
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/upload-progress?month=${selectedMonth}&year=${selectedYear}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 401) {
        console.error('❌ 401 UNAUTHORIZED - Token invalid/expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '#/login';
        return;
      }

      if (response.ok) {
        const progress = await response.json();
        setServerProgress(progress);

        // Sync uploadedShgIds to local uploadStatus
        if (progress.uploadedShgIds && progress.uploadedShgIds.length > 0) {
          const newStatus = {};
          progress.uploadedShgIds.forEach(shgId => {
            newStatus[shgId] = {
              uploaded: true,
              uploadDate: progress.lastUpdatedAt,
              fileName: 'Server Synced'
            };
          });
          setUploadStatus(newStatus);
        } else {
          setUploadStatus({});
        }
      }
    } catch (err) {
      console.error('Error fetching upload progress:', err);
    }
  };

  const initializeProgress = async () => {
    if (!selectedMonth || !selectedYear) return;

    setIsInitializing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No token found in localStorage!');
        setIsInitializing(false);
        window.location.href = '#/login';
        return;
      }

      const response = await fetch(`${API_BASE}/api/initialize-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        })
      });

      if (response.status === 401) {
        console.error('❌ 401 UNAUTHORIZED - Token invalid/expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '#/login';
        setIsInitializing(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setServerProgress(data.progress);
      }
    } catch (err) {
      console.error('Error initializing progress:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const updateUploadProgress = async (shgId) => {
    if (!selectedMonth || !selectedYear || !shgData.length) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No token found in localStorage!');
        window.location.href = '#/login';
        return;
      }

      const response = await fetch(`${API_BASE}/api/upload-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          shgId: shgId,
        })
      });

      if (response.status === 401) {
        console.error('❌ 401 UNAUTHORIZED - Token invalid/expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '#/login';
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setServerProgress(data.progress);
      } else if (response.status === 422) {
        // Handle invalid SHG ID (not found under this VO)
        const errorData = await response.json();
        if (errorData.action === 'REFRESH_SHG_LIST') {
          console.warn('Invalid SHG ID detected. Refreshing SHG list from backend...');
          alert(errorData.message || 'The SHG ID is not valid. Refreshing the list...');
          // Reload the SHG list
          await loadSHGDataFromBackend();
        }
      }
    } catch (err) {
      console.error('Error updating upload progress:', err);
    }
  };

  const loadSHGDataFromBackend = async () => {
    setLoading(true);
    setError('');

    if (!selectedMonth || !selectedYear) {
      setError('Please select both month and year first.');
      setLoading(false);
      return;
    }

    try {
      console.log(`\n=== Loading SHG Data from Backend ===`);
      console.log(`Selected: ${selectedMonth}/${selectedYear}`);

      // Get token from localStorage
      const token = localStorage.getItem('token');

      // Debug: Log token status
      if (!token) {
        console.error('❌ No token found in localStorage!');
        setError('Session expired. Please log in again.');
        setLoading(false);
        // Redirect to login
        window.location.href = '#/login';
        return;
      }

      console.log(`✓ Token found: ${token.substring(0, 20)}...`);
      console.log(`📍 User VO ID: ${user?.voID}`);

      const requestUrl = `${API_BASE}/api/shg-list?month=${selectedMonth}&year=${selectedYear}`;
      console.log(`🔗 Request URL: ${requestUrl}`);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log(`Response status: ${response.status} ${response.statusText}`);

      // Handle 401 specifically
      if (response.status === 401) {
        console.error('❌ 401 UNAUTHORIZED - Token is invalid or expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError('Session expired. Please log in again.');
        setLoading(false);
        window.location.href = '#/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.shgList) {
        setShgData([]);
        setFilteredShgData([]);
        setServerProgress(null);
        setError(data.message || 'No SHG data found for the selected period.');
        setLoading(false);
        return;
      }

      console.log(`✓ Loaded ${data.total} SHGs from backend`);
      console.log(`  Source: ${data.source}`);

      setShgData(data.shgList);
      setFilteredShgData(data.shgList);

      // Initialize progress on backend (backend will calculate total)
      await initializeProgress();

      // Fetch current progress
      await fetchUploadProgress();

      setLoading(false);
    } catch (err) {
      console.error('Error loading SHG data:', err);
      setError(`Failed to load SHG data: ${err.message}`);
      setShgData([]);
      setFilteredShgData([]);
      setLoading(false);
    }
  };

  const discoverAvailableData = async (maxYear = null, maxMonth = null) => {
    let basePath = '';
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
        basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      }
    } catch (e) {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/Test')) {
        basePath = '/Test';
      } else {
        const pathParts = currentPath.split('/').filter(p => p);
        if (pathParts.length > 0) {
          basePath = '/' + pathParts[0];
        }
      }
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    // Use provided bounds or default to current date
    const searchMaxYear = maxYear || currentYear;
    const searchMaxMonth = maxMonth || currentMonth;

    console.log('=== Starting Backward Discovery ===');
    console.log(`Base path: ${basePath}`);
    console.log(`Searching backwards from: ${searchMaxMonth}/${searchMaxYear}`);

    // Search backwards from the max date for up to 10 years
    let year = searchMaxYear;
    let month = searchMaxMonth;
    const limitYear = searchMaxYear - 10;

    while (year >= limitYear) {
      const monthStr = String(month).padStart(2, '0');
      // console.log(`Checking ${monthStr}/${year}...`);

      const extensions = ['xlsx', 'xlsm'];

      for (const ext of extensions) {
        const dataPath = `${basePath}/SHG_data/${year}/${monthStr}/shg-data.${ext}`;

        try {
          const response = await fetch(`${dataPath}?t=${Date.now()}`);

          if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.toLowerCase().includes("text/html")) {
              console.log(`  ✗ Found file but is HTML (likely 404): ${dataPath}`);
              continue;
            }

            const arrayBuffer = await response.arrayBuffer();

            // Check Magic Bytes for ZIP/Excel (PK..)
            // 50 4B 03 04
            if (arrayBuffer.byteLength < 4) continue;

            const uint8Array = new Uint8Array(arrayBuffer.slice(0, 4));
            const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

            if (!isZip) {
              console.log(`  ✗ Found file but invalid format (Not ZIP/Excel): ${dataPath}`);
              continue;
            }

            console.log(`✓ Found closest match: ${year}/${monthStr}/shg-data.${ext}`);
            return {
              year: String(year),
              month: monthStr,
              extension: ext,
              path: dataPath
            };
          }
        } catch (err) {
          // Continue searching
        }
      }

      // Move to previous month
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
    }

    console.log('No fallback data found in 10-year history.');
    return null;
  };

  const loadUploadStatus = (shgList) => {
    const storageKey = `shg_uploads_${user.voID}_${selectedMonth}_${selectedYear}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setUploadStatus(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading upload status:', e);
        setUploadStatus({});
      }
    }
  };

  const saveUploadStatus = (newStatus) => {
    const storageKey = `shg_uploads_${user.voID}_${selectedMonth}_${selectedYear}`;
    localStorage.setItem(storageKey, JSON.stringify(newStatus));
    setUploadStatus(newStatus);
  };

  const handleSmartCapture = async (shgId, shgName, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAnalyzingMap(prev => ({ ...prev, [shgId]: true }));

    try {
      const analysis = await analyzeImage(file);
      setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));

      if (!analysis.isValid) {
        // Show issues
        const issuesText = analysis.issues.join('\n- ');
        const proceed = window.confirm(
          `⚠️ AI Analysis detected potential issues:\n- ${issuesText}\n\nDo you want to use this image anyway?`
        );

        if (!proceed) {
          event.target.value = ''; // Clear input
          return;
        }
      }

      // If valid or user forced proceed, reuse existing handler
      handleFileSelect(shgId, shgName, event, analysis);

    } catch (err) {
      console.error("Smart scan error:", err);
      setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));
      // Fallback to normal handling
      handleFileSelect(shgId, shgName, event);
    }
  };

  /* Smart Camera handler removed */


  const handleFileSelect = async (shgId, shgName, event, analysisResults = null) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if already uploaded
    if (uploadedFiles[shgId]) {
      alert(t?.('upload.alreadyUploaded') || 'File already uploaded for this SHG');
      event.target.value = '';
      return;
    }

    if (uploadStatus[shgId]?.uploaded) {
      alert(t?.('upload.alreadyUploaded') || 'This SHG file is already uploaded and locked.');
      event.target.value = '';
      return;
    }

    // Validate file
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'tiff', 'tif', 'bmp', 'webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !allowedExtensions.includes(ext)) {
      alert(t?.('upload.invalidFileType') || 'Invalid file type. Please upload images or PDF files only.');
      event.target.value = '';
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      alert(t?.('upload.fileTooLarge') || 'File size exceeds 16MB limit.');
      event.target.value = '';
      return;
    }

    // Check image dimensions for landscape orientation
    if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
      setAnalyzingMap(prev => ({ ...prev, [shgId]: true }));

      try {
        let analysis = analysisResults;
        if (!analysis) {
          analysis = await analyzeImage(file);
        }

        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          img.onload = () => {
            // Auto-rotation disabled as per user request
            let initialRotation = 0;

            console.log(`Smart-rotated image for SHG: ${shgId} to ${initialRotation}deg`);

            // Store file with uploaded status
            const newFile = {
              file: file,
              fileName: file.name,
              fileSize: file.size,
              uploadDate: new Date().toISOString(),
              shgName: shgName,
              shgId: shgId,
              validated: false,
              rotation: initialRotation,
              width: img.width,
              height: img.height,
              previewUrl: e.target.result,
              analysis: analysis,
            };

            setUploadedFiles(prev => ({
              ...prev,
              [shgId]: newFile
            }));

            setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));

            // Reset file input
            if (fileInputRefs.current[shgId]) {
              fileInputRefs.current[shgId].value = '';
            }

            // Open preview modal to show cropping and AI options ONLY on mobile devices
            // if (isMobileDevice) {
            //   setPreviewFile({
            //     ...newFile,
            //     id: shgId
            //   });
            //   setPreviewRotation(newFile.rotation || 0);
            // }

            // Close modal after file is processed
            setShowUploadModal(false);
            setPendingUploadShgId(null);
            setPendingUploadShgName(null);
          };
          img.src = e.target.result;
        };

        reader.readAsDataURL(file);

      } catch (err) {
        console.error("Analysis during file select failed:", err);
        setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));
        // Fallback to minimal handling without analysis
      }

    } else {
      // For PDFs and other files, just store them
      const newFile = {
        file: file,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        shgName: shgName,
        shgId: shgId,
        validated: false,
        rotation: 0,
        previewUrl: null
      };

      setUploadedFiles(prev => ({
        ...prev,
        [shgId]: newFile
      }));

      if (fileInputRefs.current[shgId]) {
        fileInputRefs.current[shgId].value = '';
      }

      // Close modal after file is processed
      setShowUploadModal(false);
      setPendingUploadShgId(null);
      setPendingUploadShgName(null);
    }
  };

  const handleValidateFile = (shgId) => {
    const fileData = uploadedFiles[shgId];
    if (!fileData) return;

    // Check landscape orientation for images
    // if (fileData.width && fileData.height) {
    //   const currentRotation = fileData.rotation % 360;
    //   const effectiveWidth = (currentRotation === 90 || currentRotation === 270) ? fileData.height : fileData.width;
    //   const effectiveHeight = (currentRotation === 90 || currentRotation === 270) ? fileData.width : fileData.height;

    //   if (effectiveWidth < effectiveHeight) {
    //     alert(t?.('upload.portraitError') || 'File must be in landscape orientation (width > height). Please rotate the image and try again.');
    //     return;
    //   }
    // }

    setUploadedFiles(prev => ({
      ...prev,
      [shgId]: { ...prev[shgId], validated: true }
    }));
  };

  const handleValidateAll = () => {
    const canValidate = Object.keys(uploadedFiles).some(shgId => !uploadedFiles[shgId].validated);
    if (!canValidate) return;

    let invalidCount = 0;
    const newUploadedFiles = { ...uploadedFiles };

    Object.keys(uploadedFiles).forEach(shgId => {
      const fileData = uploadedFiles[shgId];
      if (fileData.validated) return;

      // Check landscape orientation for images
      // if (fileData.width && fileData.height) {
      //   const currentRotation = fileData.rotation % 360;
      //   const effectiveWidth = (currentRotation === 90 || currentRotation === 270) ? fileData.height : fileData.width;
      //   const effectiveHeight = (currentRotation === 90 || currentRotation === 270) ? fileData.width : fileData.height;

      //   if (effectiveWidth < effectiveHeight) {
      //     invalidCount++;
      //     return;
      //   }
      // }

      newUploadedFiles[shgId] = { ...fileData, validated: true };
    });

    setUploadedFiles(newUploadedFiles);
  };

  const handleViewFile = (shgId) => {
    const fileData = uploadedFiles[shgId];
    if (!fileData) return;

    setPreviewFile({
      ...fileData,
      id: shgId
    });
    setPreviewRotation(fileData.rotation || 0);
  };

  const rotatePreviewImage = (direction) => {
    if (!previewFile) return;

    const rotationIncrement = direction === 'right' ? 90 : -90;
    const newRotation = (previewRotation + rotationIncrement) % 360;
    setPreviewRotation(newRotation);

    // Update the stored file rotation
    setUploadedFiles(prev => ({
      ...prev,
      [previewFile.id]: {
        ...prev[previewFile.id],
        rotation: newRotation
      }
    }));

    // CRITICAL: Also update previewFile to trigger smart preview useEffect correctly
    setPreviewFile(prev => ({
      ...prev,
      rotation: newRotation
    }));
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewRotation(0);
  };

  const handleRemoveFile = (shgId) => {
    const confirmed = window.confirm(t?.('upload.confirmRemove') || 'Are you sure you want to remove this file?');
    if (!confirmed) return;

    const newFiles = { ...uploadedFiles };

    // Revoke preview URL if exists
    if (newFiles[shgId]?.previewUrl) {
      URL.revokeObjectURL(newFiles[shgId].previewUrl);
    }

    delete newFiles[shgId];
    setUploadedFiles(newFiles);

    // Close preview if this file is being previewed
    if (previewFile?.id === shgId) {
      closePreview();
    }
  };

  /**
   * Helper to process image rotation and smart cropping
   * Detects and applies the set rotation and optional content cropping using Canvas
   */
  const processFileRotation = async (fileData, options = {}) => {
    const { useSmartCrop = false, quality = 0.95 } = options;

    if (!fileData.previewUrl) return fileData.file;

    // If no rotation and no smart crop, return original
    if ((!fileData.rotation || fileData.rotation % 360 === 0) && !useSmartCrop) {
      return fileData.file;
    }

    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = fileData.previewUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const r = (fileData.rotation || 0) % 360;

      // Handle Smart Crop logic
      let sourceX = 0, sourceY = 0, sourceW = img.width, sourceH = img.height;
      if (useSmartCrop && fileData.contentBox) {
        const box = fileData.contentBox;
        // Map 1000px analyze box back to original dimensions
        const scaleX = img.width / 1000;
        const scaleY = img.height / 1000;

        sourceX = Math.max(0, box.x * scaleX);
        sourceY = Math.max(0, box.y * scaleY);
        sourceW = Math.min(img.width - sourceX, box.width * scaleX);
        sourceH = Math.min(img.height - sourceY, box.height * scaleY);
      }

      const isSwapped = r === 90 || r === 270 || r === -90 || r === -270;
      canvas.width = isSwapped ? sourceH : sourceW;
      canvas.height = isSwapped ? sourceW : sourceH;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((r * Math.PI) / 180);

      // Draw the cropped portion
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceW, sourceH, // Source
        -sourceW / 2, -sourceH / 2, sourceW, sourceH // Destination
      );

      const blob = await new Promise(r =>
        canvas.toBlob(r, 'image/jpeg', quality)
      );

      return new File([blob], fileData.fileName, {
        type: 'image/jpeg'
      });
    } catch (err) {
      console.error("Error processing rotation/crop:", err);
      return fileData.file;
    }
  };

  // Helper: Upload file with retry logic
  const uploadFileWithRetry = async (fileData, token, maxRetries = 2) => {
    const formData = new FormData();
    const fileToUpload = await processFileRotation(fileData);

    formData.append('file', fileToUpload);
    formData.append('month', selectedMonth);
    formData.append('year', selectedYear);
    formData.append('shgId', fileData.shgId);
    formData.append('shgName', fileData.shgName);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        return { response, fileData, success: true };
      } catch (err) {
        if (attempt === maxRetries) {
          return {
            response: null,
            fileData,
            success: false,
            error: err
          };
        }
        // Exponential backoff: 500ms, 1000ms, etc.
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  };

  // Helper: Process multiple uploads in parallel with concurrency control
  const uploadFilesInParallel = async (filesToUpload, token, concurrency = 3) => {
    const results = [];
    const queue = [...filesToUpload];
    const inProgress = [];

    console.log(`📤 Starting parallel upload: ${filesToUpload.length} files with concurrency=${concurrency}`);

    while (queue.length > 0 || inProgress.length > 0) {
      // Fill up the queue to max concurrency
      while (inProgress.length < concurrency && queue.length > 0) {
        const fileData = queue.shift();
        const promise = uploadFileWithRetry(fileData, token)
          .then(result => {
            results.push(result);
            const idx = inProgress.indexOf(promise);
            if (idx > -1) inProgress.splice(idx, 1);
            return result;
          });
        inProgress.push(promise);
      }

      // Wait for at least one to complete before processing more
      if (inProgress.length > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  };

  const formatShgLabel = (file) =>
    `${file.shgName} (${file.shgId})`;

  const handleUploadAllFiles = async () => {
    const validatedFiles = Object.values(uploadedFiles).filter(
      f => f.validated && !uploadStatus[f.shgId]?.uploaded
    );

    if (validatedFiles.length === 0) {
      alert(t?.('upload.noValidatedFiles') || 'No validated files to upload');
      return;
    }

    if (!selectedMonth || !selectedYear) {
      alert(t?.('upload.selectMonthYear') || 'Please select month and year');
      return;
    }

    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;
    let uploadedShgs = [];
    let skippedDuplicates = [];

    try {
      const token = localStorage.getItem('token');

      // Pre-upload sync: Fetch latest upload status from server to prevent duplicates
      // This handles multiple tabs, race conditions, and stale state
      console.log('Pre-upload sync: Fetching latest upload status from server...');
      try {
        await fetchUploadProgress();
        console.log('Pre-upload sync complete');
      } catch (syncErr) {
        console.warn('Pre-upload sync failed, continuing with local state:', syncErr);
      }

      // Re-filter validated files after sync to exclude any that are now marked as uploaded
      const filesToUpload = validatedFiles.filter(f => !uploadStatus[f.shgId]?.uploaded);

      if (filesToUpload.length === 0) {
        alert('All files have already been uploaded. Your session state has been updated.');
        setIsUploading(false);
        return;
      }

      if (filesToUpload.length < validatedFiles.length) {
        const alreadyUploaded = validatedFiles.length - filesToUpload.length;
        console.log(`Pre-upload sync: Skipping ${alreadyUploaded} already-uploaded SHG(s)`);
      }

      // Process uploads in parallel instead of sequentially
      const uploadResults = await uploadFilesInParallel(filesToUpload, token, 3);

      // Process results
      for (const result of uploadResults) {
        const { response, fileData, success, error } = result;

        if (!success || !response) {
          failCount++;
          console.error(`Upload exception for ${fileData.shgId}:`, error);
          continue;
        }

        try {
          if (response.ok) {
            successCount++;
            uploadedShgs.push(formatShgLabel(fileData));

            await updateUploadProgress(fileData.shgId);

            setUploadStatus(prev => ({
              ...prev,
              [fileData.shgId]: {
                uploaded: true,
                uploadDate: new Date().toISOString(),
                fileName: fileData.fileName
              }
            }));

            setUploadedFiles(prev => {
              const copy = { ...prev };
              delete copy[fileData.shgId];
              return copy;
            });
          } else if (response.status === 503) {
            // Maintenance mode detected
            console.error("Maintenance mode detected during upload loop");
            const data = await response.json().catch(() => ({}));
            handleMaintenanceResponse(data);
            setIsUploading(false);
            return; // EXIT the entire function/loop
          } else if (response.status === 409) {
            // Duplicate upload detected by server
            console.warn(`Duplicate upload blocked for SHG ${fileData.shgId}`);

            try {
              const errorData = await response.json();

              // Mark as uploaded in local state
              setUploadStatus(prev => ({
                ...prev,
                [fileData.shgId]: {
                  uploaded: true,
                  uploadDate: errorData.existingUploadDate || new Date().toISOString(),
                  fileName: 'Already Uploaded'
                }
              }));

              // Remove from pending files
              setUploadedFiles(prev => {
                const copy = { ...prev };
                delete copy[fileData.shgId];
                return copy;
              });

              // Show user-friendly message
              console.log(`Skipped duplicate: ${formatShgLabel(fileData)}`);

              // Don't increment failCount - this is expected behavior
            } catch (parseErr) {
              console.error('Failed to parse duplicate error response:', parseErr);
              failCount++;
            }
          } else {
            // Other error
            failCount++;
            console.error(`Upload failed for ${fileData.shgId}: ${response.status}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Error processing result for ${fileData.shgId}:`, err);
        }
      }

      if (successCount > 0) {
        let message;

        if (uploadedShgs.length === 1) {
          message = t('upload.uploadSuccessSingle')
            .replace('{{shg}}', uploadedShgs[0]);
        } else {
          message = t('upload.uploadSuccessMultiple')
            .replace('{{count}}', uploadedShgs.length);
        }

        alert(message);
      }

      if (onUploadComplete) onUploadComplete();

    } catch (err) {
      alert(t?.('upload.uploadError') || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadSingleFile = async (shgId) => {
    const fileData = uploadedFiles[shgId];
    if (!fileData) return;

    if (!selectedMonth || !selectedYear) {
      alert(t?.('upload.selectMonthYear') || 'Please select month and year');
      return;
    }

    if (!fileData.validated) {
      alert(t?.('upload.validateFirst') || 'Please validate the image before uploading.');
      return;
    }

    if (uploadStatus[shgId]?.uploaded) {
      alert(t?.('upload.alreadyUploaded') || 'This file is already uploaded.');
      return;
    }

    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      // Handle Rotation (including Auto-Rotate)
      const fileToUpload = await processFileRotation(fileData);

      formData.append('file', fileToUpload);
      formData.append('month', selectedMonth);
      formData.append('year', selectedYear);
      formData.append('shgId', fileData.shgId);
      formData.append('shgName', fileData.shgName);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await updateUploadProgress(shgId);

        setUploadStatus(prev => ({
          ...prev,
          [shgId]: {
            uploaded: true,
            uploadDate: new Date().toISOString(),
            fileName: fileData.fileName
          }
        }));

        setUploadedFiles(prev => {
          const copy = { ...prev };
          delete copy[shgId];
          return copy;
        });

        alert(
          t('upload.uploadSuccessSingle')
            .replace('{{shg}}', formatShgLabel(fileData))
        );
        if (onUploadComplete) onUploadComplete();
      } else if (res.status === 503) {
        // Maintenance mode detected
        const data = await res.json().catch(() => ({}));
        handleMaintenanceResponse(data);
        setIsUploading(false);
        return;
      } else if (res.status === 409) {
        // Duplicate detected
        const errorData = await res.json();

        // Mark as uploaded in local state
        setUploadStatus(prev => ({
          ...prev,
          [shgId]: {
            uploaded: true,
            uploadDate: errorData.existingUploadDate || new Date().toISOString(),
            fileName: 'Already Uploaded'
          }
        }));

        setUploadedFiles(prev => {
          const copy = { ...prev };
          delete copy[shgId];
          return copy;
        });

        alert(`ℹ️ ${formatShgLabel(fileData)} has already been uploaded.`);
      } else {
        throw new Error(`Upload failed with status ${res.status}`);
      }

    } catch (e) {
      console.error('Single upload error:', e);
      alert(`❌ ${e.message || t?.('upload.uploadFailed')}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">{t?.('upload.loadingSHGData') || 'Loading SHG data...'}</p>
        </div>
      </div>
    );
  }

  // Group SHGs by status
  const pendingShgs = filteredShgData.filter(shg => {
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;
    return !isPermanentlyUploaded;
  });

  const uploadedShgs = filteredShgData.filter(shg => {
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;
    return isPermanentlyUploaded;
  });

  const failedShgs = failedUploads.filter(failed => {
    // Match failed uploads to SHG data if available, otherwise just show all failed
    if (shgData.length === 0) return true;
    return shgData.some(shg => shg.shgId === failed.shgID);
  });

  const renderSHGCard = (shg) => {
    const fileData = uploadedFiles[shg.shgId];
    const isTempUploaded = !!fileData;
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;

    // Check if this SHG has been rejected (but only show if NOT permanently uploaded - after re-upload, hide rejection)
    const rejectionInfo = !isPermanentlyUploaded && failedUploads.find(failed => failed.shgID === shg.shgId);

    return (
      <div
        key={shg.shgId}
        className={`relative bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 transition-all ${rejectionInfo
          ? 'border-red-400 bg-red-50'
          : isPermanentlyUploaded
            ? 'border-green-400 bg-green-50'
            : isTempUploaded
              ? fileData.validated
                ? 'border-green-400 bg-green-50'
                : 'border-yellow-400 bg-yellow-50'
              : 'border-gray-300 hover:border-blue-400 hover:shadow-xl'
          }`}
      >
        {/* ✅ PERMANENT UPLOAD STATUS BADGE */}
        {isPermanentlyUploaded && (
          <div className="absolute -top-1 -right-1 sm:-top-1 sm:-right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md border border-white z-10">
            <CheckCircle size={14} className="text-white sm:hidden" />
            <CheckCircle size={16} className="text-white hidden sm:block" />
          </div>
        )}

        {/* ❌ REJECTION STATUS BADGE - Hide if successfully re-uploaded */}
        {rejectionInfo && !isPermanentlyUploaded && (
          <div className="absolute -top-1 -right-1 sm:-top-1 sm:-right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-500 flex items-center justify-center shadow-md border border-white z-10">
            <X size={14} className="text-white sm:hidden font-bold" />
            <X size={16} className="text-white hidden sm:block font-bold" />
          </div>
        )}

        <div className={isPermanentlyUploaded ? "p-1.5 sm:p-2" : "p-3 sm:p-4"}>
          {/* SHG Header */}
          <div className={isPermanentlyUploaded ? "mb-0.5" : "mb-2 sm:mb-3"}>
            <h3
              className="font-bold text-sm sm:text-base text-gray-800 mb-0.5 line-clamp-2 break-words"
            >
              {shg.shgName}
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-600 font-mono break-all">
              {shg.shgId}
            </p>
          </div>

          {/* Rejection Info Alert - Show only if no file selected for re-upload */}
          {rejectionInfo && !fileData && (
            <div className="mb-2 sm:mb-3 bg-white rounded-lg p-2 sm:p-3 border-l-4 border-red-500">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-700 mb-1">
                    {t?.('upload.rejectedReason' || 'Rejected Reason:')}
                  </p>
                  <p className="text-xs text-gray-800">
                    {rejectionInfo.rejectionReason || (
                      <>
                        {t?.('upload.failedGuidelines') || 'Please follow upload guidelines: Ensure image is clear, well-lit, and shows complete document.'}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= UPLOAD SECTION ================= */}
          {rejectionInfo ? (
            /* 🔴 REJECTED STATE - Show full upload workflow (validate, view, etc.) */
            !fileData ? (
              // Show re-upload options if no file selected yet
              <div className="space-y-2">
                <input
                  ref={(el) => (fileInputRefs.current[shg.shgId] = el)}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.tiff,.tif,.bmp,.webp"
                  onChange={(e) => handleFileSelect(shg.shgId, shg.shgName, e)}
                  className="hidden"
                />
                <input
                  ref={(el) => (nativeCameraInputRefs.current[shg.shgId] = el)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileSelect(shg.shgId, shg.shgName, e)}
                  className="hidden"
                />

                <div className="flex flex-col gap-2">
                  {isMobileDevice ? (
                    <button
                      onClick={() => nativeCameraInputRefs.current[shg.shgId]?.click()}
                      className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold cursor-pointer transition-all border shadow-md text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-transparent active:scale-95"
                    >
                      <Camera size={18} />
                      <span>{t?.('Upload File') || 'Upload File'}</span>
                    </button>
                  ) : (
                    /* Desktop: Standard Upload */
                    <button
                      onClick={() => fileInputRefs.current[shg.shgId]?.click()}
                      className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold cursor-pointer transition-all border shadow-sm text-xs sm:text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                    >
                      <Upload size={16} />
                      <span>{t?.('Upload File') || 'Upload File'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Once file is selected, show the full workflow (same as normal upload)
              <div className="space-y-2 sm:space-y-3">
                {/* File Info */}
                <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-300">
                  <div className="flex items-start gap-2">
                    <FileText size={18} className="sm:hidden text-blue-600 flex-shrink-0 mt-1" />
                    <FileText size={20} className="hidden sm:block text-blue-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs sm:text-sm font-semibold text-gray-800 truncate"
                      >
                        {fileData.fileName}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-600">
                        {formatBytes(fileData.fileSize)}
                      </p>
                      {fileData.width && fileData.height && (
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {fileData.width} × {fileData.height}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {!fileData.validated && (
                  <div className="flex items-center gap-2 text-xs text-red-600 font-semibold">
                    <AlertCircle size={14} />
                    {t?.('upload.validateError')}
                  </div>
                )}

                {/* Validate & View */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleValidateFile(shg.shgId)}
                    disabled={fileData.validated}
                    className={`px-2 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all ${fileData.validated
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    <CheckCircle size={14} />
                    {fileData.validated
                      ? t?.('upload.validated') || 'Validated'
                      : t?.('upload.validate') || 'Validate'}
                  </button>

                  <button
                    onClick={() => handleViewFile(shg.shgId)}
                    className="px-2 sm:px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                  >
                    <Eye size={14} />
                    {t?.('upload.view') || 'View'}
                  </button>
                </div>

                {/* Upload & Remove */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUploadSingleFile(shg.shgId)}
                    disabled={!fileData.validated || isUploading}
                    className={`px-2 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all ${fileData.validated && !isUploading
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    <Upload size={14} />
                    {isUploading ? (t?.('upload.uploading') || 'Uploading...') : (t?.('upload.uploadFileOne') || 'Upload File')}
                  </button>
                  <button
                    onClick={() => handleRemoveFile(shg.shgId)}
                    className="px-2 sm:px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                  >
                    <X size={14} />
                    {t?.('upload.remove') || 'Remove'}
                  </button>
                </div>
              </div>
            )
          ) : isPermanentlyUploaded ? (
            /* 🔒 FINAL LOCKED STATE */
            <div className="flex flex-col items-center justify-center py-0.5 text-green-700">
              <CheckCircle size={24} className="mb-1" />
              <p className="font-bold text-xs sm:text-sm text-center">
                {t?.('upload.successfullyUploaded') || 'Successfully Uploaded'}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5">
                {selectedMonth} / {selectedYear}
              </p>
            </div>
          ) : !isTempUploaded ? (
            /* 🟦 INITIAL STATE */
            <div>
              <input
                ref={(el) => (fileInputRefs.current[shg.shgId] = el)}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  handleFileSelect(shg.shgId, shg.shgName, e)
                }
                className="hidden"
                id={`file-input-${shg.shgId}`}
              />
              <input
                ref={(el) => (nativeCameraInputRefs.current[shg.shgId] = el)}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) =>
                  handleFileSelect(shg.shgId, shg.shgName, e)
                }
                className="hidden"
                id={`camera-input-${shg.shgId}`}
              />

              {analyzingMap[shg.shgId] ? (
                <button
                  disabled
                  className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold cursor-wait transition-all border shadow-sm text-sm sm:text-base bg-gray-100 text-gray-400 border-gray-200"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                  <span>{t?.('upload.analyzing') || 'Analyzing...'}</span>
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {isMobileDevice ? (
                    <button
                      onClick={() => nativeCameraInputRefs.current[shg.shgId]?.click()}
                      className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold cursor-pointer transition-all border shadow-md text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-transparent active:scale-95"
                    >
                      <Camera size={18} />
                      <span>{t?.('upload.takePhoto') || 'Take Photo'}</span>
                    </button>
                  ) : (
                    /* Desktop: Standard Upload */
                    <button
                      onClick={() => fileInputRefs.current[shg.shgId]?.click()}
                      className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold cursor-pointer transition-all border shadow-sm text-xs sm:text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                    >
                      <Upload size={16} />
                      <span>{t?.('upload.uploadFile') || 'Upload File'}</span>
                    </button>
                  )}
                </div>

              )}
            </div>
          ) : (
            /* 🟨 TEMP STATE (VALIDATE / VIEW / SINGLE UPLOAD / REMOVE) */
            <div className="space-y-2 sm:space-y-3">
              {/* File Info */}
              <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-300">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="sm:hidden text-blue-600 flex-shrink-0 mt-1" />
                  <FileText size={20} className="hidden sm:block text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs sm:text-sm font-semibold text-gray-800 truncate"
                    >
                      {fileData.fileName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-600">
                      {formatBytes(fileData.fileSize)}
                    </p>
                    {fileData.width && fileData.height && (
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {fileData.width} × {fileData.height}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {!fileData.validated && (
                <div className="flex items-center gap-2 text-xs text-red-600 font-semibold">
                  <AlertCircle size={14} />
                  {t?.('upload.validateError')}
                </div>
              )}

              {/* Validate & View */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleValidateFile(shg.shgId)}
                  disabled={fileData.validated}
                  className={`px-2 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all ${fileData.validated
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  <CheckCircle size={14} />
                  {fileData.validated
                    ? t?.('upload.validated') || 'Validated'
                    : t?.('upload.validate') || 'Validate'}
                </button>

                <button
                  onClick={() => handleViewFile(shg.shgId)}
                  className="px-2 sm:px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                >
                  <Eye size={14} />
                  {t?.('upload.view') || 'View'}
                </button>
              </div>

              {/* Single Upload & Remove */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUploadSingleFile(shg.shgId)}
                  disabled={!fileData.validated || isUploading}
                  className={`px-2 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all ${fileData.validated && !isUploading
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <Upload size={14} />
                  {isUploading ? (t?.('upload.uploading') || 'Uploading...') : (t?.('upload.uploadFileOne') || 'Upload File')}
                </button>
                <button
                  onClick={() => handleRemoveFile(shg.shgId)}
                  className="px-2 sm:px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                >
                  <X size={14} />
                  {t?.('upload.remove') || 'Remove'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div >
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Month, Year & Statistics Bar */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl shadow-xl border border-white/30 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
          {/* Month Dropdown */}
          <div className="flex-1 min-w-[140px] sm:min-w-[180px]">
            <label className="block text-xs sm:text-sm font-bold text-white/90 mb-2">
              {t?.('upload.month') || 'Month'} <span className="text-yellow-300">*</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange?.(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-white/30 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-white bg-white/95 appearance-none cursor-pointer font-semibold text-sm sm:text-base"
            >
              <option value="">{t?.('upload.selectMonth') || 'Select Month'}</option>
              <option value="01">{t?.('months.january') || 'January'}</option>
              <option value="02">{t?.('months.february') || 'February'}</option>
              <option value="03">{t?.('months.march') || 'March'}</option>
              <option value="04">{t?.('months.april') || 'April'}</option>
              <option value="05">{t?.('months.may') || 'May'}</option>
              <option value="06">{t?.('months.june') || 'June'}</option>
              <option value="07">{t?.('months.july') || 'July'}</option>
              <option value="08">{t?.('months.august') || 'August'}</option>
              <option value="09">{t?.('months.september') || 'September'}</option>
              <option value="10">{t?.('months.october') || 'October'}</option>
              <option value="11">{t?.('months.november') || 'November'}</option>
              <option value="12">{t?.('months.december') || 'December'}</option>
            </select>
          </div>

          {/* Year Dropdown */}
          <div className="flex-1 min-w-[140px] sm:min-w-[180px]">
            <label className="block text-xs sm:text-sm font-bold text-white/90 mb-2">
              {t?.('upload.year') || 'Year'} <span className="text-yellow-300">*</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange?.(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-white/30 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-white bg-white/95 appearance-none cursor-pointer font-semibold text-sm sm:text-base"
            >
              <option value="">{t?.('upload.selectYear') || 'Select Year'}</option>
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>

          {/* Stats Cards Row */}
          {!error && (() => {
            const totalCount = serverProgress?.total || shgData.length;
            const uploadedCount = shgData.filter(shg =>
              serverProgress?.uploadedShgIds?.includes(shg.shgId) ||
              uploadStatus[shg.shgId]?.uploaded === true
            ).length;
            const pendingCount = Math.max(0, totalCount - uploadedCount);

            return (
              <div className="w-full flex gap-5 sm:gap-4 flex-wrap mt-4 sm:mt-0">
                {/* Total SHGs Card */}
                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">
                        {t?.('upload.totalSHGs') || 'Total SHGs'}
                      </p>
                      <p className="text-xl sm:text-3xl font-bold text-white">
                        {totalCount}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="sm:hidden text-cyan-500" />
                      <FileText size={24} className="hidden sm:block text-cyan-500" />
                    </div>
                  </div>
                </div>

                {/* Uploaded Card */}
                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">
                        {t?.('upload.uploaded') || 'Uploaded'}
                      </p>
                      <p className="text-xl sm:text-3xl font-bold text-white">
                        {uploadedCount}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="sm:hidden text-green-500" />
                      <CheckCircle size={24} className="hidden sm:block text-green-500" />
                    </div>
                  </div>
                </div>

                {/* Pending Card */}
                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">
                        {t?.('upload.pending') || 'Pending'}
                      </p>
                      <p className="text-xl sm:text-3xl font-bold text-white">
                        {pendingCount}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="sm:hidden text-orange-500" />
                      <AlertCircle size={24} className="hidden sm:block text-orange-500" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>


      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle size={32} className="text-red-600 flex-shrink-0" />
            <h3 className="text-lg sm:text-xl font-bold text-red-800">{t?.('upload.errorLoading') || 'No SHG Data Found'}</h3>
          </div>
          <p className="text-sm sm:text-base text-red-700 break-words font-medium">{error}</p>
          <div className="mt-4 p-3 bg-white/50 rounded-lg border border-red-200 text-sm text-red-800">
            <p>Please try selecting a different month or year using the dropdowns above.</p>
          </div>
          <button
            onClick={loadSHGDataFromBackend}
            className="mt-4 px-4 sm:px-6 py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm sm:text-base shadow-lg transition-all"
          >
            {t?.('upload.retry') || 'Retry'}
          </button>
        </div>
      )}

      {/* Search, Filter and Action Bar */}
      {!error && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t?.('upload.searchPlaceholder') || 'Search by SHG ID or SHG Name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              />
            </div>

            {/* Action Buttons - Stack on mobile */}
            <div className="w-full sm:w-auto flex flex-wrap gap-2">
              {/* Upload All Files Button */}
              <button
                onClick={handleUploadAllFiles}
                disabled={!allFilesValidated || isUploading}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${allFilesValidated && !isUploading
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <Upload size={18} className="sm:hidden" />
                <Upload size={20} className="hidden sm:block" />
                {isUploading ? (t?.('upload.uploading') || 'Uploading...') : (t?.('upload.uploadAll') || 'Upload All')}
              </button>

              {/* Filter Buttons */}
              <button
                onClick={() => {
                  setShowUploadedOnly(!showUploadedOnly);
                  if (!showUploadedOnly) {
                    setShowPendingOnly(false);
                    setShowFailedOnly(false);
                  }
                }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showUploadedOnly
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                {t?.('upload.uploaded') || 'Uploaded'}
              </button>

              <button
                onClick={() => {
                  setShowPendingOnly(!showPendingOnly);
                  if (!showPendingOnly) {
                    setShowUploadedOnly(false);
                    setShowFailedOnly(false);
                  }
                }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showPendingOnly
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                {t?.('upload.pending') || 'Pending'}
              </button>

              <button
                onClick={() => {
                  setShowFailedOnly(!showFailedOnly);
                  if (!showFailedOnly) {
                    setShowUploadedOnly(false);
                    setShowPendingOnly(false);
                  }
                }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showFailedOnly
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                {t?.('upload.rejected') || 'Rejected'}
              </button>

              {/* Validate All Button */}
              <button
                onClick={handleValidateAll}
                disabled={Object.keys(uploadedFiles).length === 0 || allFilesValidated}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${Object.keys(uploadedFiles).length > 0 && !allFilesValidated
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <CheckCircle size={16} className="sm:hidden" />
                <CheckCircle size={20} className="hidden sm:block" />
                {t?.('upload.validateAll') || 'Validate All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State for no data in file */}
      {!loading && !error && shgData.length === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 sm:p-6 mx-1 my-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle size={32} className="text-yellow-600 flex-shrink-0" />
            <h3 className="text-lg sm:text-xl font-bold text-yellow-800">{t?.('upload.noSHGsFound') || 'No SHGs Found'}</h3>
          </div>
          <p className="text-sm sm:text-base text-yellow-700 break-words">
            {t?.('upload.noSHGsMessage') || `No SHGs found for VO ID: ${user.voID}. Please contact your administrator.`}
          </p>
        </div>
      )}

      {/* SHG Upload Sections (Rejected if filter active, Pending & Uploaded) */}
      {!loading && !error && shgData.length > 0 && (
        <div className="space-y-8">

          {/* Show Rejected SHGs when filter is active */}
          {showFailedOnly && failedShgs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-red-300">
                <AlertTriangle className="text-red-600" size={24} />
                <h3 className="text-xl font-bold text-gray-800">
                  {t?.('upload.rejectedUploads') || 'Rejected Uploads'}
                  <span className="ml-2 text-sm font-normal text-gray-500">({failedShgs.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {failedShgs.map(failed => {
                  // Convert failed upload object to match SHG format for renderSHGCard
                  const shgObj = {
                    shgId: failed.shgID,
                    shgName: failed.shgName
                  };
                  return renderSHGCard(shgObj);
                })}
              </div>
            </div>
          )}

          {/* Pending Section */}
          {pendingShgs.length > 0 && !showFailedOnly && (
            <div>
              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-gray-200">
                <AlertCircle className="text-orange-500" size={24} />
                <h3 className="text-xl font-bold text-gray-800">
                  {t?.('upload.pendingUploads') || 'Pending Uploads'}
                  <span className="ml-2 text-sm font-normal text-gray-500">({pendingShgs.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {pendingShgs.map(renderSHGCard)}
              </div>
            </div>
          )}

          {/* Uploaded Section */}
          {uploadedShgs.length > 0 && !showFailedOnly && (
            <div>
              <div className="flex items-center gap-2 mb-4 flex items-center gap-2 mb-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-gray-200">
                <CheckCircle className="text-green-500" size={24} />
                <h3 className="text-xl font-bold text-gray-800">
                  {t?.('upload.completedUploads') || 'Completed Uploads'}
                  <span className="ml-2 text-sm font-normal text-gray-500">({uploadedShgs.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2 auto-rows-min">
                {uploadedShgs.map(renderSHGCard)}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredShgData.length === 0 && shgData.length > 0 && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={36} className="sm:hidden text-gray-400" />
            <Search size={48} className="hidden sm:block text-gray-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
            {t?.('upload.noSHGsFound') || 'No SHGs Found'}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 px-4">
            {searchTerm
              ? t?.('upload.adjustSearch') || 'Try adjusting your search terms'
              : t?.('upload.noSHGsAvailable') || 'No SHGs available'}
          </p>
        </div>
      )}
      {/* Preview Modal - Use Portal to ensure full screen coverage */}
      {previewFile && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-bold text-sm sm:text-lg truncate">{previewFile.fileName}</h3>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => rotatePreviewImage('left')}
                  className="p-1.5 sm:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  title="Rotate Left"
                >
                  <RotateCcw size={18} className="sm:hidden" />
                  <RotateCcw size={20} className="hidden sm:block" />
                </button>
                <button
                  onClick={() => rotatePreviewImage('right')}
                  className="p-1.5 sm:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  title="Rotate Right"
                >
                  <RotateCw size={18} className="sm:hidden" />
                  <RotateCw size={20} className="hidden sm:block" />
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 sm:p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                  title={t?.('common.close') || 'Close'}
                >
                  <X size={18} className="sm:hidden" />
                  <X size={20} className="hidden sm:block" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-gray-100 flex flex-col relative p-2 sm:p-4 min-h-[300px]">
              {isProcessingPreview && !smartPreviewUrl ? (
                <div className="m-auto flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="font-semibold text-gray-600 text-sm">{t?.('upload.processing') || 'Smart Processing...'}</p>
                </div>
              ) : smartPreviewUrl ? (
                <img
                  src={smartPreviewUrl}
                  alt={previewFile.fileName}
                  className="max-w-full max-h-full object-contain m-auto bg-white transition-opacity duration-300"
                  onError={() => {
                    console.warn('⚠️ Preview image failed to load, using fallback');
                    setSmartPreviewUrl(previewFile.previewUrl);
                  }}
                />
              ) : previewFile.previewUrl ? (
                <img
                  src={previewFile.previewUrl}
                  alt={previewFile.fileName}
                  className="max-w-full max-h-full object-contain m-auto bg-white transition-opacity duration-300"
                  onError={() => {
                    console.error('❌ Fallback preview also failed to load');
                  }}
                />
              ) : (
                <div className="m-auto text-center flex flex-col gap-2 items-center">
                  <p className="text-gray-400 text-sm">Preview not available</p>
                  <p className="text-xs text-gray-500">File: {previewFile.fileName}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* SmartCamera Removed */}

      {/* Action Sheet Modal */}
      {/* Action Sheet Removed */}


    </div>
  );
};

export default SHGUploadSection;