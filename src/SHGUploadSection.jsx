


// SHGUploadSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, CheckCircle, X, FileText, Search, AlertCircle, Eye, Filter, RotateCw, RotateCcw, Camera, AlertTriangle, Activity, ScanLine } from 'lucide-react';
import { API_BASE } from './utils/apiConfig';
import { analyzeImage } from './utils/imageQualityCheck';
import SmartCamera from './smartcamera';
import SHGUploadCard from './components/SHGUploadCard';
import { processDocumentAndValidate, stitchImages } from './utils/documentProcessor';

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
  const [permanentlyUploadedFiles, setPermanentlyUploadedFiles] = useState([]);
  const [isViewingPermanent, setIsViewingPermanent] = useState(false);

  // Detect if device is mobile/tablet
  useEffect(() => {
    const checkIfMobileDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|pad/i;
      const isMobile = mobileRegex.test(userAgent.toLowerCase());
      const hasTouch = () => {
        return (('ontouchstart' in window) ||
          (navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints > 0));
      };
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

  const isDeveloper = user?.role?.toLowerCase().includes('developer') || (user?.voID && String(user.voID).length === 4);
  const isTestMode = window.location.pathname.startsWith('/Test');
  const hasAIFeatures = isTestMode && isDeveloper;

  // Smart Preview Logic
  useEffect(() => {
    if (!previewFile) {
      if (smartPreviewUrl) URL.revokeObjectURL(smartPreviewUrl);
      setSmartPreviewUrl(null);
      return;
    }

    const generateSmartPreview = async () => {
      if (previewFile.fromServer) {
        setSmartPreviewUrl(previewFile.previewUrl);
        setIsProcessingPreview(false);
        return;
      }

      setSmartPreviewUrl(null);
      setIsProcessingPreview(true);
      try {
        if (previewFile.rotation && previewFile.rotation % 360 !== 0) {
          const processedFile = await processFileRotation(previewFile, { quality: 0.9 });
          const url = URL.createObjectURL(processedFile);
          if (smartPreviewUrl) URL.revokeObjectURL(smartPreviewUrl);
          setSmartPreviewUrl(url);
        } else {
          setSmartPreviewUrl(previewFile.previewUrl);
        }
      } catch (err) {
        console.error("❌ Smart preview generation failed:", err);
        setSmartPreviewUrl(previewFile.previewUrl);
      } finally {
        setIsProcessingPreview(false);
      }
    };

    generateSmartPreview();
  }, [previewFile, previewRotation]);

  useEffect(() => {
    const initializeData = async () => {
      if (!user?.voID) return;
      if (selectedMonth && selectedYear) {
        loadSHGDataFromBackend();
      } else {
        setLoading(false);
      }
    };
    initializeData();
  }, [user?.voID, selectedMonth, selectedYear]);

  const fetchPermanentlyUploadedFiles = async () => {
    if (!selectedMonth || !selectedYear) return;
    try {
      const token = localStorage.getItem('token');
      const voIdParam = user?.voID ? `&voID=${user.voID}` : '';
      const url = `${API_BASE}/api/uploads?month=${selectedMonth}&year=${selectedYear}${voIdParam}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        const files = Array.isArray(data.files) ? data.files : Array.isArray(data) ? data : [];
        setPermanentlyUploadedFiles(files);
      }
    } catch (e) {
      console.error('Failed to fetch permanent uploads', e);
    }
  };

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      fetchPermanentlyUploadedFiles();
    }
  }, [selectedMonth, selectedYear, user?.voID, serverProgress?.uploadedShgIds]);

  const handleViewPermanentlyUploadedFile = async (shgId, page = null) => {
    if (isViewingPermanent) return;
    setIsViewingPermanent(true);

    const targetId = shgId?.toString().toLowerCase();

    const findUpload = (fileList) => {
      const shgMatches = fileList.filter(u => {
        const uId = (u.shgID || u.shgId || u.metadata?.shgID || u.metadata?.shgId || '').toString().toLowerCase();
        return uId === targetId || uId.includes(targetId) || targetId.includes(uId);
      });
      if (shgMatches.length === 0) return null;

      const matches = shgMatches.filter(u => {
        if (page !== null) {
          const uPage = u.page || u.metadata?.page || 1;
          if (parseInt(uPage) !== parseInt(page)) return false;
        }
        const rawDate = u.date || u.uploadTimestamp || u.metadata?.uploadTimestamp;
        let sanitizedDate = rawDate;
        if (typeof rawDate === 'string' && rawDate.includes('T') && !rawDate.endsWith('Z') && !rawDate.includes('+')) {
          sanitizedDate = rawDate + 'Z';
        }
        const uploadDate = new Date(sanitizedDate);
        if (isNaN(uploadDate.getTime())) return false;
        const uploadMonth = String(uploadDate.getMonth() + 1).padStart(2, '0');
        const uploadYear = String(uploadDate.getFullYear());
        return uploadMonth === selectedMonth && uploadYear === selectedYear;
      });

      return matches.length > 0 ? matches[0] : null;
    };

    let upload = findUpload(permanentlyUploadedFiles);

    if (!upload) {
      try {
        const token = localStorage.getItem('token');
        const voIdParam = user?.voID ? `&voID=${user.voID}` : '';
        const url = `${API_BASE}/api/uploads?month=${selectedMonth}&year=${selectedYear}${voIdParam}`;
        const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (resp.ok) {
          const data = await resp.json();
          const files = Array.isArray(data.files) ? data.files : [];
          upload = findUpload(files);
          if (upload) setPermanentlyUploadedFiles(files);
        }
      } catch (err) { console.error('Fallback fetch failed:', err); }
    }

    if (!upload) {
      alert(t?.('upload.fileNotFound') || 'Upload information not found for this SHG');
      setIsViewingPermanent(false);
      return;
    }

    let url = upload.url || upload.s3Url || upload.metadata?.s3Url || upload.metadata?.url;
    if ((!url || (typeof url === 'string' && url.includes('amazonaws.com') && !url.includes('X-Amz-Signature'))) && upload._id) {
      try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`${API_BASE}/api/uploads/${upload._id}/presign`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.url) url = data.url;
        }
      } catch (e) { console.error('Presign fetch failed', e); }
    }

    if (!url) {
      alert(t?.('upload.viewError') || 'Could not retrieve image URL');
      setIsViewingPermanent(false);
      return;
    }

    setPreviewFile({
      fileName: upload.filename || upload.originalFilename || 'Uploaded Document',
      previewUrl: url,
      id: shgId,
      shgId: shgId,
      shgName: upload.shgName || upload.metadata?.shgName || 'Unknown SHG',
      fromServer: true
    });
    setPreviewRotation(0);
    setIsViewingPermanent(false);
  };

  useEffect(() => {
    const loadFailedUploads = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/vo/uploads/failed?month=${selectedMonth}&year=${selectedYear}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }

        if (!res.ok) return;

        const data = await res.json();
        if (data.success) {
          setFailedUploads(data.failed || []);
        }
      } catch (err) {
        console.error('Failed to load rejected uploads:', err);
      }
    };

    if (user?.voID) loadFailedUploads();
  }, [user?.voID, selectedMonth, selectedYear]);

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
        return failedUploads.some(failed => failed.shgID === shg.shgId);
      });
    }

    setFilteredShgData(filtered);
  }, [searchTerm, shgData, uploadStatus, showUploadedOnly, showPendingOnly, showFailedOnly, failedUploads]);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: allFilesValidated — requires BOTH pages uploaded AND both validated
  // Previously this could pass if only 1 SHG had both pages, ignoring others.
  // Now also requires at least one SHG to have both pages ready.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const shgIds = Object.keys(uploadedFiles);

    // No files uploaded at all → not validated
    if (shgIds.length === 0) {
      setAllFilesValidated(false);
      return;
    }

    const allValidated = shgIds.every(shgId => {
      const p1 = uploadedFiles[shgId]?.page1;
      const p2 = uploadedFiles[shgId]?.page2;
      // Both pages must exist AND both must be validated
      return (
        p1 && p2 &&
        p1.validated === true &&
        p2.validated === true
      );
    });

    setAllFilesValidated(allValidated);
  }, [uploadedFiles]);

  const fetchUploadProgress = async () => {
    if (!selectedMonth || !selectedYear) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '#/login';
        return;
      }

      if (response.ok) {
        const progress = await response.json();
        setServerProgress(progress);

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
        body: JSON.stringify({ month: selectedMonth, year: selectedYear })
      });

      if (response.status === 401) {
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
        window.location.href = '#/login';
        return;
      }

      const response = await fetch(`${API_BASE}/api/upload-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear, shgId })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '#/login';
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setServerProgress(data.progress);
      } else if (response.status === 422) {
        const errorData = await response.json();
        if (errorData.action === 'REFRESH_SHG_LIST') {
          alert(errorData.message || t?.('upload.invalidShgIdRefresing') || 'The SHG ID is not valid. Refreshing the list...');
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
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Session expired. Please log in again.');
        setLoading(false);
        window.location.href = '#/login';
        return;
      }

      const voIdParam = user?.voID ? `&voID=${user.voID}` : '';
      const requestUrl = `${API_BASE}/api/shg-list?month=${selectedMonth}&year=${selectedYear}${voIdParam}`;

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError('Session expired. Please log in again.');
        setLoading(false);
        window.location.href = '#/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
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

      setShgData(data.shgList);
      setFilteredShgData(data.shgList);
      await initializeProgress();
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

  const handleSmartCameraCapture = async (file, shgId, shgName, pageIndex) => {
    const pageKey = pageIndex === 1 ? 'page1' : 'page2';

    setAnalyzingMap(prev => ({ ...prev, [shgId]: { ...(prev[shgId] || {}), [pageKey]: true } }));

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(r => img.onload = r);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);

      const validationResult = await processDocumentAndValidate(canvas, pageIndex);

      if (!validationResult.ok) {
        alert(validationResult.message);
        return;
      }

      const fileData = {
        file,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        shgName,
        shgId,
        validated: true,  // auto-validated: passed the pipeline
        rotation: 0,
        width: img.width,
        height: img.height,
        previewUrl: img.src,
        classification: validationResult.classification
      };

      setUploadedFiles(prev => ({
        ...prev,
        [shgId]: { ...(prev[shgId] || {}), [pageKey]: fileData }
      }));

    } catch (err) {
      console.error("Pipeline error", err);
      alert("An error occurred during document processing: " + err.message);
    } finally {
      setAnalyzingMap(prev => ({ ...prev, [shgId]: { ...(prev[shgId] || {}), [pageKey]: false } }));
      setShowSmartCamera(false);
      setShowUploadModal(false);
      setPendingUploadShgId(null);
      setPendingUploadShgName(null);
    }
  };

  const handleFileSelect = async (shgId, shgName, pageIndex, event, analysisResults = null) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const pageKey = pageIndex === 1 ? 'page1' : 'page2';

    if (uploadedFiles[shgId]?.[pageKey]) {
      alert(t?.('upload.alreadyUploaded') || 'File already uploaded for this slot');
      event.target.value = '';
      return;
    }

    if (uploadStatus[shgId]?.uploaded) {
      alert(t?.('upload.alreadyUploadedLocked') || 'This SHG file is already uploaded and locked.');
      event.target.value = '';
      return;
    }

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

    if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
      setAnalyzingMap(prev => ({ ...prev, [shgId]: { ...(prev[shgId] || {}), [pageKey]: true } }));

      try {
        let analysis = analysisResults;
        if (!analysis) analysis = await analyzeImage(file);

        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          img.onload = () => {
            const newFile = {
              file,
              fileName: file.name,
              fileSize: file.size,
              uploadDate: new Date().toISOString(),
              shgName,
              shgId,
              validated: false,
              rotation: 0,
              width: img.width,
              height: img.height,
              previewUrl: e.target.result,
              analysis,
            };

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);

            processDocumentAndValidate(canvas, pageIndex).then(validationResult => {
              // ─────────────────────────────────────────────────────────────
              // FIX: If AI validation passes, set validated=true immediately.
              // The user should NOT need to manually click validate for a file
              // that already passed the pipeline — the button should disappear.
              // If AI rejects, validated stays false and the manual validate
              // button remains available as a human override.
              // ─────────────────────────────────────────────────────────────
              const validatedFile = {
                ...newFile,
                validated: validationResult.ok,
                classification: validationResult.classification,
                validationMessage: validationResult.message
              };

              setUploadedFiles(prev => ({
                ...prev,
                [shgId]: { ...(prev[shgId] || {}), [pageKey]: validatedFile }
              }));

              setAnalyzingMap(prev => ({
                ...prev,
                [shgId]: { ...(prev[shgId] || {}), [pageKey]: false }
              }));

              // If AI rejected the file, inform the user with the reason
              if (!validationResult.ok) {
                alert(validationResult.message || t?.('upload.validationFailedManual') || 'Document validation failed. You may manually validate if correct.');
              }
            }).catch(err => {
              console.error("Gallery validation error:", err);
              setUploadedFiles(prev => ({
                ...prev,
                [shgId]: { ...(prev[shgId] || {}), [pageKey]: newFile }
              }));
              setAnalyzingMap(prev => ({
                ...prev,
                [shgId]: { ...(prev[shgId] || {}), [pageKey]: false }
              }));
            });

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
      }

    } else {
      // PDF and other non-image files
      const newFile = {
        file,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        shgName,
        shgId,
        validated: false,
        rotation: 0,
        previewUrl: null
      };

      setUploadedFiles(prev => ({
        ...prev,
        [shgId]: { ...(prev[shgId] || {}), [pageKey]: newFile }
      }));

      if (fileInputRefs.current[shgId]) {
        fileInputRefs.current[shgId].value = '';
      }

      setShowUploadModal(false);
      setPendingUploadShgId(null);
      setPendingUploadShgName(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: handleValidateFile — manual override for files that failed AI check.
  // Only callable when validated=false. SHGUploadCard must hide the button
  // when validated=true (see renderSHGCard below for how we enforce this).
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // handleValidateFile — manual trigger for files that failed AI check or were rotated.
  // Now ASYNC: re-runs the full AI pipeline on the CURRENT oriented/rotated image.
  // ─────────────────────────────────────────────────────────────────────────
  const handleValidateFile = async (shgId, pageIndex) => {
    const pageKey = pageIndex === 1 ? 'page1' : 'page2';
    const fileData = uploadedFiles[shgId]?.[pageKey];
    if (!fileData || fileData.validated) return;

    setAnalyzingMap(prev => ({ ...prev, [shgId]: { ...(prev[shgId] || {}), [pageKey]: true } }));

    try {
      // 1. Get the current rotated/cropped version of the file
      const rotatedFile = await processFileRotation(fileData);

      // 2. Load into canvas for validation
      const img = new Image();
      const objectUrl = URL.createObjectURL(rotatedFile);
      img.src = objectUrl;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      // 3. Re-run validation pipeline
      const validationResult = await processDocumentAndValidate(canvas, pageIndex);

      // 4. Update state with new validation result
      setUploadedFiles(prev => {
        const shg = prev[shgId];
        if (!shg || !shg[pageKey]) return prev;
        return {
          ...prev,
          [shgId]: {
            ...shg,
            [pageKey]: {
              ...shg[pageKey],
              validated: validationResult.ok,
              validationMessage: validationResult.message,
              classification: validationResult.classification
            }
          }
        };
      });

      if (!validationResult.ok) {
        alert(validationResult.message);
      }
    } catch (err) {
      console.error("Manual validation error:", err);
      alert("Validation failed. Please ensure the image is clear and try again.");
    } finally {
      setAnalyzingMap(prev => ({ ...prev, [shgId]: { ...(prev[shgId] || {}), [pageKey]: false } }));
    }
  };

  const handleValidateAll = () => {
    const newUploadedFiles = { ...uploadedFiles };
    let hasChanges = false;

    Object.keys(uploadedFiles).forEach(shgId => {
      ['page1', 'page2'].forEach(pageKey => {
        const fileData = uploadedFiles[shgId][pageKey];
        if (fileData && !fileData.validated) {
          newUploadedFiles[shgId] = {
            ...newUploadedFiles[shgId],
            [pageKey]: { ...fileData, validated: true }
          };
          hasChanges = true;
        }
      });
    });

    if (hasChanges) setUploadedFiles(newUploadedFiles);
  };

  const handleViewFile = (shgId, pageIndex) => {
    const pageKey = pageIndex === 1 ? 'page1' : 'page2';
    const fileData = uploadedFiles[shgId]?.[pageKey];
    if (!fileData) return;

    setPreviewFile({ ...fileData, id: shgId, pageKey });
    setPreviewRotation(fileData.rotation || 0);
  };

  const rotatePreviewImage = (direction) => {
    if (!previewFile) return;
    const rotationIncrement = direction === 'right' ? 90 : -90;
    const newRotation = (previewRotation + rotationIncrement) % 360;
    setPreviewRotation(newRotation);

    setUploadedFiles(prev => ({
      ...prev,
      [previewFile.id]: {
        ...prev[previewFile.id],
        [previewFile.pageKey]: {
          ...prev[previewFile.id][previewFile.pageKey],
          rotation: newRotation
        }
      }
    }));

    setPreviewFile(prev => ({ ...prev, rotation: newRotation }));
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewRotation(0);
  };

  const handleRemoveFile = (shgId, pageIndex) => {
    const pageKey = pageIndex === 1 ? 'page1' : 'page2';
    const confirmed = window.confirm(t?.('upload.confirmRemove') || 'Are you sure you want to remove this file?');
    if (!confirmed) return;

    const newFiles = { ...uploadedFiles };

    if (newFiles[shgId]?.[pageKey]?.previewUrl) {
      URL.revokeObjectURL(newFiles[shgId][pageKey].previewUrl);
    }

    if (newFiles[shgId]) {
      delete newFiles[shgId][pageKey];
      if (!newFiles[shgId].page1 && !newFiles[shgId].page2) {
        delete newFiles[shgId];
      }
    }

    setUploadedFiles(newFiles);

    if (previewFile?.id === shgId && previewFile?.pageKey === pageKey) {
      closePreview();
    }
  };

  const processFileRotation = async (fileData, options = {}) => {
    const { useSmartCrop = false, quality = 0.95 } = options;
    if (!fileData.previewUrl) return fileData.file;
    if ((!fileData.rotation || fileData.rotation % 360 === 0) && !useSmartCrop) return fileData.file;

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

      let sourceX = 0, sourceY = 0, sourceW = img.width, sourceH = img.height;
      if (useSmartCrop && fileData.contentBox) {
        const box = fileData.contentBox;
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
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, -sourceW / 2, -sourceH / 2, sourceW, sourceH);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
      return new File([blob], fileData.fileName, { type: 'image/jpeg' });
    } catch (err) {
      console.error("Error processing rotation/crop:", err);
      return fileData.file;
    }
  };

  const uploadFileWithRetry = async (shgData, token, maxRetries = 2) => {
    const { page1, page2 } = shgData;

    const uploadPage = async (pageData, pageNumber) => {
      const file = await processFileRotation(pageData);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('month', selectedMonth);
      formData.append('year', selectedYear);
      formData.append('shgId', pageData.shgId);
      formData.append('shgName', pageData.shgName);
      formData.append('page', pageNumber);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          return { response, success: response.ok, pageNumber };
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    };

    try {
      const res1 = await uploadPage(page1, 1);
      const res2 = await uploadPage(page2, 2);
      return {
        success: res1.success && res2.success,
        results: [res1, res2],
        shgData
      };
    } catch (err) {
      console.error("Failed preparing upload for SHG", page1.shgId, err);
      return { success: false, error: err, shgData };
    }
  };

  const uploadFilesInParallel = async (filesToUpload, token, concurrency = 3) => {
    const results = [];
    const queue = [...filesToUpload];
    const inProgress = [];

    while (queue.length > 0 || inProgress.length > 0) {
      while (inProgress.length < concurrency && queue.length > 0) {
        const shgData = queue.shift();
        const promise = uploadFileWithRetry(shgData, token)
          .then(result => {
            results.push(result);
            const idx = inProgress.indexOf(promise);
            if (idx > -1) inProgress.splice(idx, 1);
            return result;
          });
        inProgress.push(promise);
      }
      if (inProgress.length > 0) await Promise.race(inProgress);
    }

    return results;
  };

  const formatShgLabel = (shgData) =>
    `${shgData.page1.shgName} (${shgData.page1.shgId})`;

  const handleUploadAllFiles = async () => {
    const validatedFiles = Object.keys(uploadedFiles)
      .filter(shgId => {
        const p1 = uploadedFiles[shgId].page1;
        const p2 = uploadedFiles[shgId].page2;
        return p1?.validated && p2?.validated && !uploadStatus[shgId]?.uploaded;
      })
      .map(shgId => uploadedFiles[shgId]);

    if (validatedFiles.length === 0) {
      alert(t?.('upload.noValidatedFiles') || 'No strictly validated and complete packages to upload.');
      return;
    }

    if (!selectedMonth || !selectedYear) {
      alert(t?.('upload.selectMonthYear') || 'Please select month and year');
      return;
    }

    setIsUploading(true);
    let successCount = 0, failCount = 0, uploadedShgs = [];

    try {
      const token = localStorage.getItem('token');
      try { await fetchUploadProgress(); } catch { }

      const filesToUpload = validatedFiles.filter(f => !uploadStatus[f.page1.shgId]?.uploaded);

      if (filesToUpload.length === 0) {
        alert(t?.('upload.alreadyUploadedSynced') || 'All files have already been uploaded. Your session state has been updated.');
        setIsUploading(false);
        return;
      }

      const uploadResults = await uploadFilesInParallel(filesToUpload, token, 3);

      for (const result of uploadResults) {
        const { success, shgData, error } = result;
        const shgId = shgData.page1.shgId;

        if (!success) {
          failCount++;
          console.error(`Upload exception for ${shgId}:`, error);
          continue;
        }

        try {
          successCount++;
          uploadedShgs.push(formatShgLabel(shgData));
          await updateUploadProgress(shgId);

          setUploadStatus(prev => ({
            ...prev,
            [shgId]: { uploaded: true, uploadDate: new Date().toISOString(), fileName: "Page 1 & Page 2" }
          }));

          setUploadedFiles(prev => {
            const copy = { ...prev };
            delete copy[shgId];
            return copy;
          });
        } catch (err) {
          failCount++;
        }
      }

      if (successCount > 0) {
        const message = uploadedShgs.length === 1
          ? t('upload.uploadSuccessSingle').replace('{{shg}}', uploadedShgs[0])
          : t('upload.uploadSuccessMultiple').replace('{{count}}', uploadedShgs.length);
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
    const shgData = uploadedFiles[shgId];
    if (!shgData?.page1 || !shgData?.page2) {
      alert(t?.('upload.dualUploadRequired') || "Both Page 1 and Page 2 must be uploaded before submitting.");
      return false;
    }

    if (!selectedMonth || !selectedYear) {
      alert(t?.('upload.selectMonthYear') || 'Please select month and year');
      return false;
    }

    if (!shgData.page1.validated || !shgData.page2.validated) {
      alert(t?.('upload.dualValidationRequired') || 'Both pages must be validated before uploading.');
      return false;
    }

    if (uploadStatus[shgId]?.uploaded) {
      alert(t?.('upload.alreadyUploaded') || 'This file is already uploaded.');
      return false;
    }

    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      const result = await uploadFileWithRetry(shgData, token);

      if (result.success) {
        await updateUploadProgress(shgId);

        setUploadStatus(prev => ({
          ...prev,
          [shgId]: { uploaded: true, uploadDate: new Date().toISOString(), fileName: "Page 1 & Page 2" }
        }));

        setUploadedFiles(prev => {
          const copy = { ...prev };
          delete copy[shgId];
          return copy;
        });

        alert(t('upload.uploadSuccessSingle').replace('{{shg}}', formatShgLabel(shgData)));
        fetchPermanentlyUploadedFiles();
        return true;
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert(t?.('upload.uploadError') || 'Upload failed. Please try again.');
      return false;
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

  const pendingShgs = filteredShgData.filter(shg => {
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;
    return !isPermanentlyUploaded;
  });

  const uploadedShgs = filteredShgData.filter(shg => {
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;
    return isPermanentlyUploaded;
  });

  const failedShgs = failedUploads.filter(failed => {
    if (shgData.length === 0) return true;
    return shgData.some(shg => shg.shgId === failed.shgID);
  });

  const renderSHGCard = (shg) => {
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;

    const targetId = shg.shgId?.toString().toLowerCase();
    const matchedHistoryUploads = permanentlyUploadedFiles.filter(u => {
      const uId = (u.shgID || u.shgId || u.metadata?.shgID || u.metadata?.shgId || '').toString().toLowerCase();
      const idMatch = uId === targetId || uId.includes(targetId) || targetId.includes(uId);
      if (!idMatch) return false;

      const uM = String(u.month || u.metadata?.month || '').padStart(2, '0');
      const uY = String(u.year || u.metadata?.year || '');
      const timestamp = u.uploadTimestamp || u.metadata?.uploadTimestamp;
      let dateMatch = uM === selectedMonth && uY === selectedYear;

      if (!dateMatch && timestamp) {
        const d = new Date(timestamp);
        dateMatch = String(d.getMonth() + 1).padStart(2, '0') === selectedMonth && String(d.getFullYear()) === selectedYear;
      }
      return dateMatch;
    });

    const rejectionInfo = !isPermanentlyUploaded && failedUploads.find(failed => failed.shgID === shg.shgId);
    const filesData = uploadedFiles[shg.shgId] || {};
    const shgAnalyzingState = analyzingMap[shg.shgId] || {};

    // ─────────────────────────────────────────────────────────────────────
    // FIX: Pass null for onValidateFile when a page is already validated.
    // SHGUploadCard should check if this prop is null and hide the button.
    // This prevents the validate button from showing after auto-validation.
    // ─────────────────────────────────────────────────────────────────────
    const page1Validated = filesData.page1?.validated === true;
    const page2Validated = filesData.page2?.validated === true;

    const handleValidatePage = (shgId, pageIndex) => {
      const isAlreadyValidated = pageIndex === 1 ? page1Validated : page2Validated;
      if (isAlreadyValidated) return; // no-op if already validated
      handleValidateFile(shgId, pageIndex);
    };

    return (
      <SHGUploadCard
        key={shg.shgId}
        shg={shg}
        filesData={filesData}
        isPermanentlyUploaded={isPermanentlyUploaded}
        historyUploads={matchedHistoryUploads}
        rejectionInfo={rejectionInfo}
        analyzingState={shgAnalyzingState}
        isViewingPermanent={isViewingPermanent}
        isMobileDevice={isMobileDevice}
        isUploading={isUploading}
        t={t}
        formatBytes={formatBytes}
        // ── Validation state flags (new) ──────────────────────────────────
        // These tell SHGUploadCard whether each page's validate button
        // should be rendered. When true, the card must hide the button.
        page1Validated={page1Validated}
        page2Validated={page2Validated}
        // ─────────────────────────────────────────────────────────────────
        onOpenCamera={(shgId, shgName, page) => {
          setCameraTarget({ id: shgId, name: shgName, page });
          setShowSmartCamera(true);
        }}
        onFileSelect={handleFileSelect}
        onValidateFile={handleValidatePage}
        onViewFile={handleViewFile}
        onRemoveFile={handleRemoveFile}
        onUploadSingleShg={handleUploadSingleFile}
        onViewPermanentlyUploadedFile={handleViewPermanentlyUploadedFile}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
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
              {user?.role?.toLowerCase() === 'vo' && (
                <span className="ml-2 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{t?.('upload.currentPastOnly') || 'Current & Past Only'}</span>
              )}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                const selectedM = parseInt(e.target.value);
                const selectedY = parseInt(selectedYear);

                if (user?.role?.toLowerCase() === 'vo') {
                  if (selectedY > currentYear || (selectedY === currentYear && selectedM > currentMonth)) return;
                }
                onMonthChange?.(e.target.value);
              }}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-white/30 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-white bg-white/95 appearance-none cursor-pointer font-semibold text-sm sm:text-base"
            >
              <option value="">{t?.('upload.selectMonth') || 'Select Month'}</option>
              {[
                { val: "01", label: t?.('months.january') || 'January' },
                { val: "02", label: t?.('months.february') || 'February' },
                { val: "03", label: t?.('months.march') || 'March' },
                { val: "04", label: t?.('months.april') || 'April' },
                { val: "05", label: t?.('months.may') || 'May' },
                { val: "06", label: t?.('months.june') || 'June' },
                { val: "07", label: t?.('months.july') || 'July' },
                { val: "08", label: t?.('months.august') || 'August' },
                { val: "09", label: t?.('months.september') || 'September' },
                { val: "10", label: t?.('months.october') || 'October' },
                { val: "11", label: t?.('months.november') || 'November' },
                { val: "12", label: t?.('months.december') || 'December' }
              ].map(m => {
                const now = new Date();
                const isFuture = parseInt(selectedYear) > now.getFullYear() ||
                  (parseInt(selectedYear) === now.getFullYear() && parseInt(m.val) > (now.getMonth() + 1));
                const disabled = user?.role?.toLowerCase() === 'vo' && isFuture;
                return <option key={m.val} value={m.val} disabled={disabled}>{m.label} {disabled ? `(${t?.('upload.locked') || 'Locked'})` : ''}</option>;
              })}
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
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - 1 + i;
                const isFutureYear = y > new Date().getFullYear();
                const disabled = user?.role?.toLowerCase() === 'vo' && isFutureYear;
                return <option key={y} value={y} disabled={disabled}>{y} {disabled ? `(${t?.('upload.locked') || 'Locked'})` : ''}</option>;
              })}
            </select>
          </div>

          {/* Stats Cards */}
          {!error && (() => {
            const totalCount = serverProgress?.total || shgData.length;
            const uploadedCount = shgData.filter(shg =>
              serverProgress?.uploadedShgIds?.includes(shg.shgId) ||
              uploadStatus[shg.shgId]?.uploaded === true
            ).length;
            const pendingCount = Math.max(0, totalCount - uploadedCount);

            return (
              <div className="w-full flex gap-5 sm:gap-4 flex-wrap mt-4 sm:mt-0">
                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">{t?.('upload.totalSHGs') || 'Total SHGs'}</p>
                      <p className="text-xl sm:text-3xl font-bold text-white">{totalCount}</p>
                    </div>
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="sm:hidden text-cyan-500" />
                      <FileText size={24} className="hidden sm:block text-cyan-500" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">{t?.('upload.uploaded') || 'Uploaded'}</p>
                      <p className="text-xl sm:text-3xl font-bold text-white">{uploadedCount}</p>
                    </div>
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="sm:hidden text-green-500" />
                      <CheckCircle size={24} className="hidden sm:block text-green-500" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">{t?.('upload.pending') || 'Pending'}</p>
                      <p className="text-xl sm:text-3xl font-bold text-white">{pendingCount}</p>
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
            <p>{t?.('upload.errorHelp') || 'Please try selecting a different month or year using the dropdowns above.'}</p>
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

            <div className="w-full sm:w-auto flex flex-wrap gap-2">
              {/* Upload All Button */}
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

              {/* Filter buttons */}
              <button
                onClick={() => { setShowUploadedOnly(!showUploadedOnly); if (!showUploadedOnly) { setShowPendingOnly(false); setShowFailedOnly(false); } }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showUploadedOnly ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <Filter size={16} className="sm:hidden" /><Filter size={18} className="hidden sm:block" />
                {t?.('upload.uploaded') || 'Uploaded'}
              </button>

              <button
                onClick={() => { setShowPendingOnly(!showPendingOnly); if (!showPendingOnly) { setShowUploadedOnly(false); setShowFailedOnly(false); } }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showPendingOnly ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <Filter size={16} className="sm:hidden" /><Filter size={18} className="hidden sm:block" />
                {t?.('upload.pending') || 'Pending'}
              </button>

              <button
                onClick={() => { setShowFailedOnly(!showFailedOnly); if (!showFailedOnly) { setShowUploadedOnly(false); setShowPendingOnly(false); } }}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${showFailedOnly ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <Filter size={16} className="sm:hidden" /><Filter size={18} className="hidden sm:block" />
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

      {/* SHG Sections */}
      {!loading && !error && shgData.length > 0 && (
        <div className="space-y-8">
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
                {failedShgs.map(failed => renderSHGCard({ shgId: failed.shgID, shgName: failed.shgName }))}
              </div>
            </div>
          )}

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

          {uploadedShgs.length > 0 && !showFailedOnly && (
            <div>
              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-gray-200">
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

      {!loading && !error && filteredShgData.length === 0 && shgData.length > 0 && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={36} className="sm:hidden text-gray-400" />
            <Search size={48} className="hidden sm:block text-gray-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{t?.('upload.noSHGsFound') || 'No SHGs Found'}</h3>
          <p className="text-sm sm:text-base text-gray-600 px-4">
            {searchTerm ? t?.('upload.adjustSearch') || 'Try adjusting your search terms' : t?.('upload.noSHGsAvailable') || 'No SHGs available'}
          </p>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && createPortal(
        <div className={`fixed inset-0 flex items-center justify-center z-[9999] p-2 sm:p-4 animate-in fade-in duration-300 ${previewFile.fromServer ? 'bg-slate-900/90 backdrop-blur-sm' : 'bg-black/80 backdrop-blur-sm'}`}>
          <div className={`bg-white rounded-xl sm:rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden ${previewFile.fromServer ? 'max-w-4xl max-h-[90vh]' : 'max-w-5xl max-h-[95vh] sm:max-h-[90vh]'}`}>
            <div className={`flex items-center justify-between p-3 sm:p-4 ${previewFile.fromServer ? 'bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6' : 'border-b bg-white'}`}>
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-bold text-sm sm:text-lg truncate">
                  {previewFile.fromServer ? (
                    <>{previewFile.shgName} <span className="text-blue-100/80 font-normal ml-1">({previewFile.shgId})</span></>
                  ) : previewFile.fileName}
                </h3>
                {previewFile.fromServer && (
                  <p className="text-xs text-blue-100 truncate mt-0.5 opacity-80">{previewFile.fileName}</p>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {!previewFile.fromServer && (
                  <>
                    <button onClick={() => rotatePreviewImage('left')} className="p-1.5 sm:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg" title="Rotate Left">
                      <RotateCcw size={18} className="sm:hidden" /><RotateCcw size={20} className="hidden sm:block" />
                    </button>
                    <button onClick={() => rotatePreviewImage('right')} className="p-1.5 sm:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg" title="Rotate Right">
                      <RotateCw size={18} className="sm:hidden" /><RotateCw size={20} className="hidden sm:block" />
                    </button>
                  </>
                )}
                <button onClick={closePreview} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${previewFile.fromServer ? 'hover:bg-white/10 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`} title={t?.('common.close') || 'Close'}>
                  <X size={18} className="sm:hidden" /><X size={20} className="hidden sm:block" />
                </button>
              </div>
            </div>

            {previewFile.fromServer ? (
              <div className="flex-1 overflow-auto bg-slate-50 p-4">
                <img src={previewFile.previewUrl} alt="Document" className="max-w-full mx-auto border rounded shadow" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-gray-100 flex flex-col relative p-2 sm:p-4 min-h-[300px]">
                {isProcessingPreview && !smartPreviewUrl ? (
                  <div className="m-auto flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="font-semibold text-gray-600 text-sm">{t?.('upload.processing') || 'Smart Processing...'}</p>
                  </div>
                ) : smartPreviewUrl ? (
                  <img src={smartPreviewUrl} alt={previewFile.fileName} className="max-w-full max-h-full object-contain m-auto bg-white transition-opacity duration-300"
                    onError={() => setSmartPreviewUrl(previewFile.previewUrl)} />
                ) : (
                  <img src={previewFile.previewUrl} alt={previewFile.fileName} className="max-w-full max-h-full object-contain m-auto bg-white transition-opacity duration-300" />
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* SmartCamera Portal */}
      {showSmartCamera && createPortal(
        <SmartCamera
          open={showSmartCamera}
          onCapture={(file) => handleSmartCameraCapture(file, cameraTarget.id, cameraTarget.name, cameraTarget.page)}
          onClose={() => setShowSmartCamera(false)}
          isUploading={isUploading}
          shgId={cameraTarget.id}
          shgName={cameraTarget.name}
          page={cameraTarget.page}
          debugMode={true}
          t={t}
        />,
        document.body
      )}
    </div>
  );
};

export default SHGUploadSection;