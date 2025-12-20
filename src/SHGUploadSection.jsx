// SHGUploadSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, X, FileText, Search, AlertCircle, Eye, Filter, RotateCw, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE } from './utils/apiConfig';

const SHGUploadSection = ({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  user,
  onUploadComplete,
  t
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
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [allFilesValidated, setAllFilesValidated] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [serverProgress, setServerProgress] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);


  // Load SHG data from Excel on component mount or when user/month/year changes
  useEffect(() => {
    const initializeData = async () => {
      if (!user?.voID) {
        console.log('No user VO ID, skipping initialization');
        return;
      }

      // If no month/year selected, discover and set the latest available
      if (!selectedMonth || !selectedYear) {
        console.log('No month/year selected, discovering available data...');
        setLoading(true);

        const latest = await discoverAvailableData();

        if (latest) {
          console.log(`Setting latest: ${latest.month}/${latest.year}`);
          onMonthChange?.(latest.month);
          onYearChange?.(latest.year);
        } else {
          console.log('No data files found');
          setError('No SHG data files found. Please contact your administrator.');
          setLoading(false);
        }
      } else {
        // Month and year are selected, load the data
        console.log(`Month/year already selected: ${selectedMonth}/${selectedYear}`);
        loadSHGDataFromExcel();
      }
    };

    initializeData();
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

    setFilteredShgData(filtered);
  }, [searchTerm, shgData, uploadStatus, showUploadedOnly, showPendingOnly]);

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
      const response = await fetch(
        `${API_BASE}/api/upload-progress?month=${selectedMonth}&year=${selectedYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

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

  const initializeProgress = async (totalShgs) => {
    if (!selectedMonth || !selectedYear) return;

    setIsInitializing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/initialize-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          totalShgs: totalShgs
        })
      });

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
          total: shgData.length  // Current total from CSV
        })
      });

      if (response.ok) {
        const data = await response.json();
        setServerProgress(data.progress);
      }
    } catch (err) {
      console.error('Error updating upload progress:', err);
    }
  };

  const loadSHGDataFromExcel = async () => {
    setLoading(true);
    setError('');

    if (!selectedMonth || !selectedYear) {
      setError('Please select both month and year first.');
      setLoading(false);
      return;
    }

    try {
      // Construct path based on selected month/year
      let basePath = '';
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
          basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
        }
      } catch (e) {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/SMD')) {
          basePath = '/SMD';
        } else {
          const pathParts = currentPath.split('/').filter(p => p);
          if (pathParts.length > 0) {
            basePath = '/' + pathParts[0];
          }
        }
      }

      console.log(`\n=== Loading SHG Data ===`);
      console.log(`Selected: ${selectedMonth}/${selectedYear}`);

      // Try both extensions
      const extensions = ['xlsx', 'xlsm'];
      let excelData = null;
      let successfulPath = null;

      for (const ext of extensions) {
        const dataPath = `${basePath}/SHG_data/${selectedYear}/${selectedMonth}/shg-data.${ext}`;
        console.log(`Trying: ${dataPath}`);

        try {
          const response = await fetch(`${dataPath}?t=${Date.now()}`);

          if (!response.ok) {
            console.log(`  ✗ Not found (${response.status})`);
            continue;
          }

          console.log(`  ✓ File found, loading...`);
          const arrayBuffer = await response.arrayBuffer();

          if (arrayBuffer.byteLength === 0) {
            console.log(`  ✗ Empty file`);
            continue;
          }

          const workbook = XLSX.read(arrayBuffer, { type: 'array' });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            console.log(`  ✗ No sheets in workbook`);
            continue;
          }

          const firstSheetName = workbook.SheetNames[0];
          console.log(`  Sheet name: ${firstSheetName}`);

          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData && jsonData.length > 0) {
            excelData = jsonData;
            successfulPath = dataPath;
            console.log(`  ✓ Loaded ${jsonData.length} rows`);
            break; // Success!
          } else {
            console.log(`  ✗ No data rows`);
          }
        } catch (err) {
          console.log(`  ✗ Error: ${err.message}`);
          continue;
        }
      }

      if (!excelData) {
        // Primary file not found, try fallback
        console.log(`Primary file not found for ${selectedMonth}/${selectedYear}. Attempting fallback discovery...`);

        const fallback = await discoverAvailableData(parseInt(selectedYear), parseInt(selectedMonth));

        if (fallback) {
          console.log(`Fallback found: ${fallback.month}/${fallback.year}`);
          // Load fallback data
          const response = await fetch(`${fallback.path}?t=${Date.now()}`);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData && jsonData.length > 0) {
              excelData = jsonData;
              successfulPath = fallback.path;
              console.log(`  ✓ Loaded fallback data from: ${fallback.path}`);
            }
          }
        }
      }

      if (!excelData) {
        // No data found even after fallback
        setShgData([]);
        setFilteredShgData([]);
        setServerProgress(null); // Clear progress stats
        setError(`No SHG data found for ${selectedMonth}/${selectedYear} or any previous dates.`);
        setLoading(false);
        return;
      }

      console.log(`\nSuccessfully loaded from: ${successfulPath}`);

      // Process Excel data - filter by VO ID
      const voId = user.voID;
      console.log(`Filtering for VO ID: ${voId}`);

      // Log first row to see column names
      if (excelData.length > 0) {
        console.log('Excel columns:', Object.keys(excelData[0]));
      }

      const filteredData = excelData.filter(row => {
        const rowVoId = row['VO ID'] || row['VOID'] || row['voID'] || row['vo_id'];
        return rowVoId && String(rowVoId).trim() === String(voId).trim();
      });

      console.log(`Found ${filteredData.length} SHGs for VO ID: ${voId}`);

      if (filteredData.length === 0) {
        console.warn(`⚠ No SHGs found for VO ID: ${voId}`);
        console.log('Total rows in file:', excelData.length);
        if (excelData.length > 0) {
          console.log('Sample VO IDs in file:', excelData.slice(0, 5).map(r => r['VO ID'] || r['VOID'] || r['voID'] || r['vo_id']));
        }
      }

      const shgList = filteredData.map((row, index) => {
        const shgId = String(row['SHG ID'] || row['SHGID'] || row['shgID'] || row['shg_id'] || '').trim();
        const shgName = String(row['SHG Name'] || row['SHGName'] || row['shgName'] || row['shg_name'] || '').trim();

        return {
          shgId: shgId || `SHG_${index + 1}`,
          shgName: shgName || `SHG ${index + 1}`,
          district: user.district,
          mandal: user.mandal,
          village: user.village,
          voId: voId,
          voName: user.voName
        };
      });

      setShgData(shgList);
      await initializeProgress(shgList.length);
      await fetchUploadProgress();
      loadUploadStatus(shgList);
      setLoading(false);
      console.log('=== Load Complete ===\n');

    } catch (err) {
      console.error('Error loading Excel data:', err);
      setError(err.message || 'Failed to load SHG data.');
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
      if (currentPath.startsWith('/SMD')) {
        basePath = '/SMD';
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

  const handleFileSelect = (shgId, shgName, event) => {
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
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Store file with uploaded status
          const newFile = {
            file: file,
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString(),
            shgName: shgName,
            shgId: shgId,
            validated: false,
            rotation: 0,
            width: img.width,
            height: img.height,
            previewUrl: e.target.result
          };

          setUploadedFiles(prev => ({
            ...prev,
            [shgId]: newFile
          }));

          // Reset file input
          if (fileInputRefs.current[shgId]) {
            fileInputRefs.current[shgId].value = '';
          }
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
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
    }
  };

  const handleValidateFile = (shgId) => {
    const fileData = uploadedFiles[shgId];
    if (!fileData) return;

    // Check landscape orientation for images
    if (fileData.width && fileData.height) {
      const currentRotation = fileData.rotation % 360;
      const effectiveWidth = (currentRotation === 90 || currentRotation === 270) ? fileData.height : fileData.width;
      const effectiveHeight = (currentRotation === 90 || currentRotation === 270) ? fileData.width : fileData.height;

      if (effectiveWidth < effectiveHeight) {
        alert(t?.('upload.portraitError') || 'File must be in landscape orientation (width > height). Please rotate the image and try again.');
        return;
      }
    }

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
      if (fileData.width && fileData.height) {
        const currentRotation = fileData.rotation % 360;
        const effectiveWidth = (currentRotation === 90 || currentRotation === 270) ? fileData.height : fileData.width;
        const effectiveHeight = (currentRotation === 90 || currentRotation === 270) ? fileData.width : fileData.height;

        if (effectiveWidth < effectiveHeight) {
          invalidCount++;
          return;
        }
      }

      newUploadedFiles[shgId] = { ...fileData, validated: true };
    });

    setUploadedFiles(newUploadedFiles);

    if (invalidCount > 0) {
      alert(t?.('upload.portraitErrorMultiple') || `${invalidCount} file(s) could not be validated. They must be in landscape orientation.`);
    }
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

    try {
      const token = localStorage.getItem('token');

      for (const fileData of validatedFiles) {
        try {
          if (uploadStatus[fileData.shgId]?.uploaded) continue;

          const formData = new FormData();
          let fileToUpload = fileData.file;

          // Rotation handling
          if (fileData.rotation !== 0 && fileData.previewUrl) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            await new Promise((res, rej) => {
              img.onload = res;
              img.onerror = rej;
              img.src = fileData.previewUrl;
            });

            const r = fileData.rotation % 360;
            canvas.width = r === 90 || r === 270 ? img.height : img.width;
            canvas.height = r === 90 || r === 270 ? img.width : img.height;

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((r * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            const blob = await new Promise(r =>
              canvas.toBlob(r, 'image/jpeg', 0.95)
            );

            fileToUpload = new File([blob], fileData.fileName, {
              type: 'image/jpeg'
            });
          }

          formData.append('file', fileToUpload);
          formData.append('month', selectedMonth);
          formData.append('year', selectedYear);
          formData.append('shgId', fileData.shgId);
          formData.append('shgName', fileData.shgName);

          const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });

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
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        let message;

        if (uploadedShgs.length === 1) {
          message = t('upload.uploadSuccessSingle')
            .replace('{{shg}}', uploadedShgs[0]);
        } else {
          message = t('upload.uploadSuccessMultiple')
            .replace('{{shg}}', uploadedShgs[0])
            .replace('{{count}}', uploadedShgs.length - 1);
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
      let fileToUpload = fileData.file;

      if (fileData.rotation !== 0 && fileData.previewUrl) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = fileData.previewUrl;
        });

        const r = fileData.rotation % 360;
        canvas.width = r === 90 || r === 270 ? img.height : img.width;
        canvas.height = r === 90 || r === 270 ? img.width : img.height;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((r * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        const blob = await new Promise(r =>
          canvas.toBlob(r, 'image/jpeg', 0.95)
        );

        fileToUpload = new File([blob], fileData.fileName, {
          type: 'image/jpeg'
        });
      }

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

      if (!res.ok) throw new Error('Upload failed');

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

    } catch (e) {
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

  const renderSHGCard = (shg) => {
    const fileData = uploadedFiles[shg.shgId];
    const isTempUploaded = !!fileData;
    const isPermanentlyUploaded = serverProgress?.uploadedShgIds?.includes(shg.shgId) || uploadStatus[shg.shgId]?.uploaded === true;

    return (
      <div
        key={shg.shgId}
        className={`relative bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 transition-all ${isPermanentlyUploaded
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
          <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 sm:border-4 border-white z-10">
            <CheckCircle size={24} className="text-white" />
          </div>
        )}

        <div className="p-4 sm:p-5">
          {/* SHG Header */}
          <div className="mb-3 sm:mb-4">
            <h3
              className="font-bold text-base sm:text-lg text-gray-800 mb-1 line-clamp-2 break-words"
              title={shg.shgName}
            >
              {shg.shgName}
            </h3>
            <p className="text-xs text-gray-600 font-mono break-all">
              {shg.shgId}
            </p>
          </div>

          {/* ================= UPLOAD SECTION ================= */}
          {isPermanentlyUploaded ? (
            /* 🔒 FINAL LOCKED STATE */
            <div className="flex flex-col items-center justify-center py-6 text-green-700">
              <CheckCircle size={36} className="mb-2" />
              <p className="font-bold text-sm sm:text-base text-center">
                {t?.('upload.successfullyUploaded') || 'Successfully Uploaded'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {selectedMonth} / {selectedYear}
              </p>
            </div>
          ) : !isTempUploaded ? (
            /* 🟦 INITIAL STATE */
            <div>
              <input
                ref={(el) => (fileInputRefs.current[shg.shgId] = el)}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,.tiff,.tif,.bmp,.webp"
                onChange={(e) =>
                  handleFileSelect(shg.shgId, shg.shgName, e)
                }
                className="hidden"
                id={`file-input-${shg.shgId}`}
              />
              <label
                htmlFor={`file-input-${shg.shgId}`}
                className="flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg sm:rounded-xl font-semibold cursor-pointer transition-all shadow-md text-sm sm:text-base"
              >
                <Upload size={18} className="sm:hidden" />
                <Upload size={20} className="hidden sm:block" />
                {t?.('upload.uploadFile') || 'Upload File'}
              </label>
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
                      title={fileData.fileName}
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
      </div>
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

          {!error && (
            <div className="w-full flex gap-5 sm:gap-4 flex-wrap mt-4 sm:mt-0">
              {/* Total SHGs Card */}
              <div className="flex-1 sm:min-w-[140px] bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white/80 text-[10px] sm:text-xs font-semibold mb-1 truncate">
                      {t?.('upload.totalSHGs') || 'Total SHGs'}
                    </p>
                    <p className="text-xl sm:text-3xl font-bold text-white">
                      {serverProgress?.total || shgData.length}
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
                      {serverProgress?.uploaded || 0}
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
                      {serverProgress?.pending || shgData.length}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={16} className="sm:hidden text-orange-500" />
                    <AlertCircle size={24} className="hidden sm:block text-orange-500" />
                  </div>
                </div>
              </div>
            </div>
          )}
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
            onClick={loadSHGDataFromExcel}
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
                  if (!showUploadedOnly) setShowPendingOnly(false);
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
                  if (!showPendingOnly) setShowUploadedOnly(false);
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

      {/* SHG Upload Sections (Pending & Uploaded) */}
      {!loading && !error && shgData.length > 0 && (
        <div className="space-y-8">

          {/* Pending Section */}
          {pendingShgs.length > 0 && (
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
          {uploadedShgs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4 flex items-center gap-2 mb-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 border-2 border-gray-200">
                <CheckCircle className="text-green-500" size={24} />
                <h3 className="text-xl font-bold text-gray-800">
                  {t?.('upload.completedUploads') || 'Completed Uploads'}
                  <span className="ml-2 text-sm font-normal text-gray-500">({uploadedShgs.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-bold text-sm sm:text-lg truncate">{previewFile.fileName}</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {previewFile.width} × {previewFile.height}
                  {previewRotation !== 0 && ` (Rotated ${previewRotation}°)`}
                </p>
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
                  title="Close"
                >
                  <X size={18} className="sm:hidden" />
                  <X size={20} className="hidden sm:block" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center bg-gray-100">
              {previewFile.previewUrl && (
                <img
                  src={previewFile.previewUrl}
                  alt={previewFile.fileName}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `rotate(${previewRotation}deg)`,
                    transition: 'transform 0.3s ease'
                  }}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t bg-gray-50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className='text-xs sm:text-sm text-gray-600 w-full sm:w-auto'>
                  <p>{t?.('upload.autoSave') || 'Image orientation will be automatically saved.'}</p>
                </div>
                <div className="text-xs sm:text-sm text-gray-600 w-full sm:w-auto">
                  {(() => {
                    const rotation = previewRotation % 360;
                    const effectiveWidth = (rotation === 90 || rotation === 270) ? previewFile.height : previewFile.width;
                    const effectiveHeight = (rotation === 90 || rotation === 270) ? previewFile.width : previewFile.height;

                    if (effectiveWidth < effectiveHeight) {
                      return (
                        <div className="flex items-center gap-2 text-red-600 font-semibold">
                          <AlertCircle size={16} className="sm:hidden flex-shrink-0" />
                          <AlertCircle size={18} className="hidden sm:block flex-shrink-0" />
                          <span className="text-xs sm:text-sm break-words">{t?.('upload.portraitWarning') || 'Portrait orientation detected. Rotate to landscape before validating.'}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                          <CheckCircle size={16} className="sm:hidden flex-shrink-0" />
                          <CheckCircle size={18} className="hidden sm:block flex-shrink-0" />
                          <span className="text-xs sm:text-sm">{t?.('upload.landscapeConfirmed') || 'Landscape orientation confirmed.'}</span>
                        </div>
                      );
                    }
                  })()}
                </div>
                <button
                  onClick={closePreview}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base"
                >
                  {t?.('common.close') || 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SHGUploadSection;