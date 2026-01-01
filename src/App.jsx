import React, { useState, useEffect, useRef } from 'react';
import { Eye, FileText, Table2, CheckCircle, AlertCircle, X, Upload, MapPin, RotateCw, RotateCcw, ZoomIn, ZoomOut, Camera, LogOut, CircleUserRound } from 'lucide-react';
import ProfilePage from './ProfilePage';
import DocumentHistory from './DocumentHistory';
import LanguageToggle from './components/LanguageToggle';
import { useLanguage } from './contexts/LanguageContext';
// Add this import at the top of your App.jsx
import SHGUploadSection from './SHGUploadSection';
// import ConvertedResults from './ConvertedResults';
// import DataAnalytics from './DataAnalytics';
// import FinancialAnalytics from './FinancialAnalytics';
import { API_BASE } from './utils/apiConfig';

const STORAGE_KEY_RESULTS = 'ocr_results_v1';
const STORAGE_KEY_FAILED = 'ocr_failed_v1';

const sanitizeValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  return String(value);
};

const convertRowsToCSV = (headers = [], rows = []) => {
  if (!headers.length) return '';
  const escapeValue = (value) => {
    const str = sanitizeValue(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const headerLine = headers.map(escapeValue).join(',');
  const rowLines = rows.map((row) =>
    headers.map((header) => escapeValue(row?.[header] ?? '')).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
};

const escapeHtml = (value) =>
  sanitizeValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildHTMLTable = (headers = [], rows = [], headerRows = null, shgMbkId = '') => {
  if (!headers.length) return '';

  // SHG MBK ID section - left aligned
  // let shgMbkIdHTML = '';
  // if (shgMbkId) {
  //   shgMbkIdHTML = `
  //     <div class="shg-mbk-id-container" style="margin-bottom: 12px; font-weight: 600; font-size: 15px; color: #111827; text-align: left !important; display: block !important; width: 100% !important; padding-left: 0 !important; float: none !important; clear: both !important;">
  //       <span style="color: #1f2937; display: inline-block;">SHG MBK ID :</span>
  //       <span style="color: #111827; margin-left: 6px; display: inline-block;">${escapeHtml(shgMbkId)}</span>
  //     </div>
  //   `;
  // }

  const tableStyle = `
    width: 100%;
    border-collapse: collapse;
    font-family: 'Noto Sans Telugu', 'Poppins', sans-serif;
    font-size: 14px;
    background-color: #fff;
  `;
  const headerCellStyle = `
    background-color: #1f4ab9;
    color: #fff;
    padding: 8px 10px;
    border: 1px solid #d4d8e8;
    text-align: center;
    font-weight: 600;
    white-space: nowrap;
  `;
  const bodyCellBaseStyle = `
    padding: 6px 10px;
    border: 1px solid #d4d8e8;
    color: #1a1a1a;
    text-align: left;
    min-width: 80px;
  `;

  let headerHTML = '';
  if (headerRows && Array.isArray(headerRows) && headerRows.length > 0) {
    headerHTML = '<thead>';
    headerRows.forEach((row, rowIdx) => {
      headerHTML += '<tr>';
      row.forEach((cell) => {
        const colSpan = cell.col_span || 1;
        const rowSpan = cell.row_span || 1;
        headerHTML += `<th style="${headerCellStyle}" colspan="${colSpan}" rowspan="${rowSpan}">${escapeHtml(cell.label || '')}</th>`;
      });
      headerHTML += '</tr>';
    });
    headerHTML += '</thead>';
  } else {
    const headerCells = headers
      .map((header) => `<th style="${headerCellStyle}">${escapeHtml(header)}</th>`)
      .join('');
    headerHTML = `<thead><tr>${headerCells}</tr></thead>`;
  }

  const bodyRows = rows
    .map((row, rowIdx) => {
      const rowBg = rowIdx % 2 === 0 ? '#fefeff' : '#f4f7fb';
      const cells = headers
        .map(
          (header) =>
            `<td style="${bodyCellBaseStyle}background-color:${rowBg};">${escapeHtml(
              row?.[header] ?? ''
            )}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table style="${tableStyle}">${headerHTML}<tbody>${bodyRows}</tbody></table>`;
};

const normalizeStructuredTableData = (tableData = {}) => {
  const baseHeaders = Array.isArray(tableData.column_headers)
    ? tableData.column_headers.map((header, idx) => {
      if (!header) return `Column ${idx + 1}`;
      return (
        (header.label && header.label.trim()) ||
        header.key ||
        `Column ${typeof header.index === 'number' ? header.index + 1 : idx + 1}`
      );
    })
    : [];

  // Use baseHeaders as primary source, only add new headers if they don't exist
  const headers = [...baseHeaders];
  const headerSet = new Set(baseHeaders);

  const addHeader = (label) => {
    if (!label) return;
    if (!headerSet.has(label)) {
      headerSet.add(label);
      headers.push(label);
    }
  };

  const rows = [];
  const dataRows = Array.isArray(tableData.data_rows) ? tableData.data_rows : [];

  dataRows.forEach((row) => {
    const rowObj = {};

    if (Array.isArray(row?.cells) && row.cells.length) {
      // Process cells - use col_index to map to correct header position
      row.cells.forEach((cell) => {
        const colIndex =
          typeof cell?.col_index === 'number' && cell.col_index >= 0 ? cell.col_index : -1;

        // Use header from baseHeaders if colIndex is valid, otherwise use cell label
        let label;
        if (colIndex >= 0 && colIndex < baseHeaders.length) {
          label = baseHeaders[colIndex];
        } else {
          const fallbackLabel = cell?.key || `Column ${colIndex >= 0 ? colIndex + 1 : headers.length + 1}`;
          label = (cell?.label && cell.label.trim()) || fallbackLabel;
          // Only add if not already in headers
          if (!headerSet.has(label)) {
            addHeader(label);
          }
        }
        // Only set value if not already set (prevent overwriting)
        if (!(label in rowObj)) {
          rowObj[label] = sanitizeValue(cell?.text);
        }
      });
    } else {
      // Fallback: if no cells array, process object keys directly
      // But skip internal fields and only add if not already in baseHeaders
      Object.keys(row || {}).forEach((key) => {
        if (['cells', 'confidence', 'row_number', 'row_index'].includes(key)) return;
        const label = key;
        // Only add if not already in headers
        if (!headerSet.has(label)) {
          addHeader(label);
        }
        rowObj[label] = sanitizeValue(row[key]);
      });
    }

    rows.push(rowObj);
  });

  // Remove duplicates and filter empty headers
  const filteredHeaders = Array.from(new Set(headers.filter(Boolean)));
  const csv = convertRowsToCSV(filteredHeaders, rows);
  const headerRows = Array.isArray(tableData.header_rows) ? tableData.header_rows : null;
  const shgMbkId = tableData.shg_mbk_id || '';
  const html = buildHTMLTable(filteredHeaders, rows, headerRows, shgMbkId);

  return {
    dataframe: rows,
    row_count: rows.length,
    col_count: filteredHeaders.length,
    csv,
    html,
    json: JSON.stringify(rows),
    headers: filteredHeaders,
    headerRows: Array.isArray(tableData.header_rows) ? tableData.header_rows : null,
    metadata: {
      shg_mbk_id: tableData.shg_mbk_id || '',
      total_columns: tableData.total_columns || filteredHeaders.length,
      total_rows: tableData.total_rows || rows.length,
    },
  };
};

const renderReactHeaderRows = (headerRowsData, headersList) => {
  if (headerRowsData && Array.isArray(headerRowsData) && headerRowsData.length > 0) {
    const maxRows = headerRowsData.length;
    return (
      <thead>
        {headerRowsData.map((row, rowIdx) => (
          <tr key={`header-row-${rowIdx}`} className="bg-indigo-700 text-white">
            {row.map((cell, cellIdx) => {
              const rowSpan = cell.row_span || 1;
              const isLeaf = rowIdx + rowSpan === maxRows;
              return (
                <th
                  key={`header-cell-${rowIdx}-${cellIdx}`}
                  colSpan={cell.col_span || 1}
                  rowSpan={rowSpan}
                  className={`border-2 border-gray-300 px-2 py-2 text-center font-bold ${isLeaf ? '' : 'text-sm'
                    }`}
                >
                  {cell.label || ''}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
    );
  }
  return (
    <thead>
      <tr className="bg-indigo-700 text-white">
        {headersList.map((header, idx) => (
          <th key={idx} className="border-2 border-gray-300 px-2 py-2 text-center font-bold">
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
};

const normalizeExtractionResponse = (responseData) => {
  if (!responseData || typeof responseData !== 'object') return [];

  if (Array.isArray(responseData.tables)) {
    return responseData.tables;
  }

  const normalized = [];
  const files = Array.isArray(responseData.files) ? responseData.files : [];

  files.forEach((fileEntry = {}) => {
    const pages = Array.isArray(fileEntry.pages) ? fileEntry.pages : [];
    pages.forEach((pageEntry = {}, pageIdx) => {
      if (pageEntry.success && pageEntry.table_data) {
        const normalizedTable = normalizeStructuredTableData(pageEntry.table_data);
        if (normalizedTable.dataframe.length > 0) {
          normalized.push({
            ...normalizedTable,
            source: {
              filename: fileEntry.filename,
              fileType: fileEntry.file_type,
              pageNumber: pageEntry.page ?? pageIdx + 1,
              totalPages: pageEntry.total_pages ?? pages.length,
            },
          });
        }
      }
    });
  });

  return normalized;
};

export default function EnhancedTableOCRSystem() {
  const { t } = useLanguage();
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [toasts, setToasts] = useState([]);
  const [results, setResults] = useState([]);
  const [failedFiles, setFailedFiles] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [resultZoom, setResultZoom] = useState(1);
  const [uploadStats, setUploadStats] = useState({ total: 0, validated: 0, pending: 0 });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [duplicateResultFiles, setDuplicateResultFiles] = useState([]);
  const [showDuplicateUploadModal, setShowDuplicateUploadModal] = useState(false);
  const [duplicateUploadFiles, setDuplicateUploadFiles] = useState([]);
  const [showDuplicateResultModal, setShowDuplicateResultModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [processStartTime, setProcessStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedMandal, setSelectedMandal] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [user, setUser] = useState(null);
  const [systemOnline, setSystemOnline] = useState(false);
  const [timeAgo, setTimeAgo] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!user?.previousLogin) {
      setTimeAgo(t('header.loginTime.now'));
      return;
    }

    const formatDateTime = () => {
      // Ensure we parse the date correctly (handles both ISO strings and Date objects)
      const previousDate = new Date(user.previousLogin);

      // Check if date is valid
      if (isNaN(previousDate.getTime())) {
        console.error('Invalid previousLogin date:', user.previousLogin);
        return t('header.loginTime.now');
      }

      // Format as DD/MM/YY HH:MM AM/PM
      const day = String(previousDate.getDate()).padStart(2, '0');
      const month = String(previousDate.getMonth() + 1).padStart(2, '0');
      const year = String(previousDate.getFullYear());

      let hours = previousDate.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
      const hoursStr = String(hours).padStart(2, '0');

      const minutes = String(previousDate.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
    };

    setTimeAgo(formatDateTime());

    // No need for interval updates since we're showing exact time
  }, [user?.previousLogin, t]);

  // Helper: refresh user state from localStorage and sync location selectors
  const refreshUserFromStorage = () => {
    const now = new Date();
    setSelectedMonth(String(now.getMonth() + 1).padStart(2, '0'));
    setSelectedYear(String(now.getFullYear()));

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Sync selected location fields with stored user values
        if (parsedUser.district) setSelectedDistrict(parsedUser.district);
        if (parsedUser.mandal) setSelectedMandal(parsedUser.mandal);
        if (parsedUser.village) setSelectedVillage(parsedUser.village);
      } catch (e) {
        console.error('Failed to parse user data', e);
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUserFromStorage();
  }, []);

  const fileInputRef = useRef(null);
  const toastTimers = useRef({});
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const MAX_FILE_SIZE = 16 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'tiff', 'tif', 'bmp', 'webp'];

  // Auto-load CSV file & persisted data on component mount
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(() => {
      fetchLocations();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(toastTimers.current || {}).forEach(timerId => clearTimeout(timerId));
      toastTimers.current = {};
    };
  }, []);

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY_RESULTS);
    localStorage.removeItem(STORAGE_KEY_FAILED);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      const isOnline = await checkBackendConnection();
      setSystemOnline(isOnline);
    };

    fetchStatus();
  }, []);

  // Processing timer - track how long current request has been running
  useEffect(() => {
    let timerId = null;

    if (processing && processStartTime) {
      timerId = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - processStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [processing, processStartTime]);

  async function fetchLocations() {
    try {
      // Detect base path - use Vite's BASE_URL if available, otherwise detect from URL
      let basePath = '';
      try {
        // Vite provides import.meta.env.BASE_URL (e.g., '/OCR/')
        if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
          basePath = import.meta.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
        }
      } catch (e) {
        // Fallback: detect from current path
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

      // Build possible paths - prioritize base path for GitHub Pages
      const possiblePaths = [
        // Base path first (for GitHub Pages deployment with /OCR/ base)
        ...(basePath ? [`${basePath}/districts-mandals.csv`] : []),
        // Relative paths (work in local dev)
        "./districts-mandals.csv",
        "districts-mandals.csv",
        // Absolute root path
        "/districts-mandals.csv",
        // Fallback patterns
        "/OCR -Frontend/districts-mandals.csv",
        "OCR-Frontend/districts-mandals.csv"
      ];

      // Remove duplicates while preserving order
      const uniquePaths = Array.from(new Set(possiblePaths));

      let csvText = null;
      let lastError = null;
      let successfulPath = null;

      for (const path of uniquePaths) {
        try {
          const res = await fetch(`${path}?t=${Date.now()}`);
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            const text = await res.text();

            // Validate that we got CSV content, not HTML
            if (text.trim().toLowerCase().startsWith('<!doctype') ||
              text.trim().toLowerCase().startsWith('<html')) {
              console.warn(`Path ${path} returned HTML instead of CSV, trying next path...`);
              continue;
            }

            // Check if it looks like CSV (has comma-separated values)
            if (text.includes(',') || text.includes('mandal') || text.includes('district')) {
              csvText = text;
              successfulPath = path;
              console.log(`Successfully loaded CSV from: ${path}`);
              break;
            } else {
              console.warn(`Path ${path} doesn't appear to be CSV content, trying next path...`);
              continue;
            }
          }
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      if (!csvText) {
        throw new Error(`Failed to load CSV from any path. Last error: ${lastError?.message || 'Unknown'}`);
      }

      const lines = csvText.split('\n').filter(line => line.trim());
      console.log(`CSV loaded: ${lines.length} lines from ${successfulPath}`);
      if (lines.length > 0) {
        console.log(`First line: ${lines[0]}`);
      }
      await loadCSVDataFromText(lines);
    } catch (err) {
      console.warn("Could not auto-load CSV file:", err.message);
    }
  }

  const showToast = (type, title, details) => {
    const id = `${Date.now()}-${Math.random()}`;
    const detailLines = Array.isArray(details) ? details : [details];
    setToasts(prev => [...prev, { id, type, title, details: detailLines }]);
    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimers.current[id];
    }, 4500);
    toastTimers.current[id] = timeoutId;
  };

  const dismissToast = (id) => {
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadCSVDataFromText = async (lines) => {
    try {
      if (lines.length < 2) {
        console.warn('CSV file has insufficient lines:', lines.length);
        return;
      }

      const headerValues = [];
      let current = '';
      let inQuotes = false;
      for (let char of lines[0]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          headerValues.push(current.trim().replace(/^"|"$/g, '').toLowerCase());
          current = '';
        } else {
          current += char;
        }
      }
      headerValues.push(current.trim().replace(/^"|"$/g, '').toLowerCase());

      // Debug: log what headers were found
      console.log('CSV Headers found:', headerValues);

      // More flexible matching - check for both singular and plural forms
      const mandalIdx = headerValues.findIndex(h =>
        h.includes('mandal') || h === 'mandal' || h === 'mandals'
      );
      const districtIdx = headerValues.findIndex(h =>
        h.includes('district') || h === 'district' || h === 'districts'
      );
      const villageIdx = headerValues.findIndex(h =>
        h.includes('village') || h === 'village' || h === 'villages'
      );

      if (districtIdx === -1 || mandalIdx === -1) {
        console.error('CSV must contain mandals and districts columns');
        console.error('Available headers:', headerValues);
        console.error('First line of CSV:', lines[0]);
        return;
      }

      const districtMap = new Map();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = [];
        let current = '';
        let inQuotes = false;

        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));

        const mandalName = values[mandalIdx]?.trim();
        const districtName = values[districtIdx]?.trim();
        const villageName = villageIdx !== -1 ? values[villageIdx]?.trim() : '';

        if (!districtName || !mandalName) continue;

        if (!districtMap.has(districtName)) {
          districtMap.set(districtName, {
            id: `d_${districtName.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '').replace(/[^a-z0-9_]/g, '')}`,
            name: districtName,
            mandals: new Map()
          });
        }

        const district = districtMap.get(districtName);
        const mandalKey = mandalName.toLowerCase();

        if (!district.mandals.has(mandalKey)) {
          district.mandals.set(mandalKey, {
            id: `m_${mandalName.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '').replace(/[^a-z0-9_]/g, '')}`,
            name: mandalName,
            villages: []
          });
        }

        const mandal = district.mandals.get(mandalKey);

        if (villageName) {
          const villageId = `v_${villageName.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '').replace(/[^a-z0-9_]/g, '')}`;
          if (!mandal.villages.some(v => v.id === villageId)) {
            mandal.villages.push({
              id: villageId,
              name: villageName
            });
          }
        } else if (mandal.villages.length === 0) {
          // If no villages specified, add mandal name as default village
          const defaultVillageId = `v_${mandalName.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '').replace(/[^a-z0-9_]/g, '')}`;
          if (!mandal.villages.some(v => v.id === defaultVillageId)) {
            mandal.villages.push({
              id: defaultVillageId,
              name: mandalName
            });
          }
        }
      }

      const districtsArray = Array.from(districtMap.values()).map(d => ({
        ...d,
        mandals: Array.from(d.mandals.values())
          .map(m => ({
            ...m,
            villages: m.villages.sort((a, b) => a.name.localeCompare(b.name))
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.name.localeCompare(b.name));

      setDistricts(districtsArray);

      const totalMandals = districtsArray.reduce((sum, d) => sum + d.mandals.length, 0);
      const totalVillages = districtsArray.reduce((sum, d) =>
        sum + d.mandals.reduce((mSum, m) => mSum + m.villages.length, 0), 0
      );

      console.log('✅ CSV Data loaded successfully:');
      console.log(`📊 Total Districts: ${districtsArray.length}`);
      console.log(`📊 Total Mandals: ${totalMandals}`);
      console.log(`📊 Total Villages: ${totalVillages}`);

      // Debug: Show first few entries
      if (districtsArray.length > 0) {
        console.log('\n📋 Sample Data:');
        districtsArray.slice(0, 2).forEach(d => {
          console.log(`\n  District: ${d.name}`);
          d.mandals.slice(0, 3).forEach(m => {
            console.log(`    - Mandal: ${m.name}`);
            m.villages.slice(0, 3).forEach(v => {
              console.log(`      • Village: ${v.name}`);
            });
            if (m.villages.length > 3) {
              console.log(`      ... and ${m.villages.length - 3} more villages`);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error loading CSV:', error);
    }
  };

  useEffect(() => {
    const validated = files.filter(f => f.validated).length;
    const pending = files.length - validated;
    setUploadStats({ total: files.length, validated, pending });
  }, [files]);

  useEffect(() => {
    if (!selectedDistrict) {
      setMandals([]);
      setVillages([]);
      setSelectedMandal("");
      setSelectedVillage("");
      return;
    }
    // Match by id OR name — some saved user objects store the district name, not the generated id
    const district = districts.find(d => d.id === selectedDistrict || d.name === selectedDistrict);
    if (district) {
      setMandals(district.mandals || []);
      setSelectedMandal("");
      setSelectedVillage("");
      setVillages([]);
    }
  }, [selectedDistrict, districts]);

  useEffect(() => {
    if (!selectedMandal) {
      setVillages([]);
      setSelectedVillage("");
      return;
    }
    // Match mandal by id OR name to handle cases where selectedMandal stores the name
    const mandal = mandals.find(m => m.id === selectedMandal || m.name === selectedMandal);
    if (mandal) {
      setVillages(mandal.villages || []);
      setSelectedVillage("");
    }
  }, [selectedMandal, mandals]);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const duplicates = [];
    const invalidFiles = [];
    const oversizedFiles = [];
    const qualityRejectedFiles = [];
    const validNewFiles = [];

    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        invalidFiles.push(file.name);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
        continue;
      }

      // For image files, run quality checks (blur, shadow, full table, angle)
      // Only run quality checks if this is a camera capture
      if (e.isCameraCapture && isImageFile(file)) {
        const issues = await analyzeImageFileQuality(file);
        if (issues.length > 0) {
          qualityRejectedFiles.push(file.name);
          showToast('warning', `Scan quality issue: ${file.name}`, issues);
          continue;
        }
      }

      // PDF files are allowed and will be processed by the backend
      // No additional validation needed for PDFs

      const isDuplicate = files.some(f =>
        f.name === file.name && f.size === file.size
      );

      if (isDuplicate) {
        duplicates.push(file.name);
      } else {
        validNewFiles.push(file);
      }
    }

    const currentMonthName = selectedMonth
      ? new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })
      : null;
    const currentYearValue = selectedYear ? String(selectedYear) : null;

    const duplicateMonthlyFiles = [];
    const filteredValidNewFiles = validNewFiles.filter(file => {
      if (!currentMonthName || !currentYearValue) return true;
      const duplicateKey = `${file.name}-${currentMonthName}-${currentYearValue}`;
      const exists = results.some(r => r.duplicateKey === duplicateKey);
      if (exists) {
        duplicateMonthlyFiles.push(file.name);
        return false;
      }
      return true;
    });

    const newFiles = filteredValidNewFiles.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      validated: false,
      previewUrl: null,
      rotation: 0
    }));

    let messages = [];
    if (newFiles.length > 0) {
      messages.push(`✅ ${newFiles.length} file(s) added successfully`);
      showToast('success', 'Files ready to upload', [
        `${newFiles.length} file${newFiles.length > 1 ? 's' : ''} added to the queue`
      ]);
    }
    if (duplicates.length > 0) {
      setDuplicateFiles(duplicates);
      setShowDuplicateModal(true);
      const duplicatePreview = duplicates.length > 3
        ? [...duplicates.slice(0, 3), `...and ${duplicates.length - 3} more`]
        : duplicates;
      showToast('warning', 'Duplicate file name(s) skipped', duplicatePreview);
    }
    if (invalidFiles.length > 0) {
      messages.push(`❌ ${invalidFiles.length} invalid file type(s)`);
    }
    if (oversizedFiles.length > 0) {
      messages.push(`❌ ${oversizedFiles.length} file(s) too large (max 16MB)`);
    }
    if (qualityRejectedFiles.length > 0) {
      messages.push(`❌ ${qualityRejectedFiles.length} file(s) rejected due to scan quality. Please rescan with better lighting and full table.`);
    }

    if (messages.length > 0) {
      setMessage(messages.join('\n'));
      setMessageType(newFiles.length > 0 ? 'info' : 'error');
    }

    if (newFiles.length > 0) {
      setFiles([...files, ...newFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (duplicateMonthlyFiles.length > 0) {
      setDuplicateUploadFiles(duplicateMonthlyFiles);
      setShowDuplicateUploadModal(true);
      const monthlyPreview = duplicateMonthlyFiles.length > 3
        ? [...duplicateMonthlyFiles.slice(0, 3), `...and ${duplicateMonthlyFiles.length - 3} more`]
        : duplicateMonthlyFiles;
      showToast('warning', 'Already uploaded for this month', monthlyPreview);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const fakeEvent = { target: { files: droppedFiles } };
    handleFileChange(fakeEvent);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // --- Camera-based document scanner helpers ---
  const SCAN_BLUR_VARIANCE_THRESHOLD = 900;
  const SCAN_SHADOW_DARK_RATIO = 0.3;
  const SCAN_FULLTABLE_INNER_DARK = 0.02;
  const SCAN_FULLTABLE_BORDER_DARK = 0.004;
  const SCAN_NARROW_ASPECT_LOW = 0.6;
  const SCAN_NARROW_ASPECT_HIGH = 1.8;

  const startCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser. Please use a modern browser like Chrome, Edge, or a modern mobile browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError('');
    } catch (err) {
      console.error('Error starting camera', err);
      setCameraError('Unable to access camera. Please check browser permissions and try again.');
    }
  };

  const openCamera = async () => {
    setShowCameraModal(true);
    await startCamera();
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const closeCamera = () => {
    stopCamera();
    setShowCameraModal(false);
  };

  const analyzeScanQuality = (canvas) => {
    const issues = [];
    const ctx = canvas.getContext('2d');
    if (!ctx) return issues;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let sum = 0;
    let sumSq = 0;
    let darkCount = 0;
    let count = 0;

    const borderSize = Math.floor(Math.min(width, height) * 0.06);
    let borderDark = 0;
    let borderTotal = 0;
    let innerDark = 0;
    let innerTotal = 0;

    // Sample every 4th pixel (step 16 in RGBA array)
    for (let i = 0; i < data.length; i += 16) {
      const idx = i / 4;
      const x = idx % width;
      const y = Math.floor(idx / width);

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const v = 0.299 * r + 0.587 * g + 0.114 * b;

      sum += v;
      sumSq += v * v;
      count++;

      if (v < 40) darkCount++;

      const isBorder =
        x < borderSize ||
        x >= width - borderSize ||
        y < borderSize ||
        y >= height - borderSize;

      if (isBorder) {
        borderTotal++;
        if (v < 90) borderDark++;
      } else {
        innerTotal++;
        if (v < 90) innerDark++;
      }
    }

    if (!count) return issues;

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const darkRatio = darkCount / count;
    const borderDarkRatio = borderTotal ? borderDark / borderTotal : 0;
    const innerDarkRatio = innerTotal ? innerDark / innerTotal : 0;

    // Blur check
    if (variance < SCAN_BLUR_VARIANCE_THRESHOLD) {
      issues.push('The scan looks blurred. Please hold the camera steady and refocus, then scan again.');
    }

    // Shadow check
    if (darkRatio > SCAN_SHADOW_DARK_RATIO && mean > 70) {
      issues.push('The scan has strong shadows. Please move to better lighting and avoid shadows over the table.');
    }

    // Full table coverage check
    if (innerDarkRatio > SCAN_FULLTABLE_INNER_DARK && borderDarkRatio < SCAN_FULLTABLE_BORDER_DARK) {
      issues.push('It looks like the full table is not captured. Please include the entire table in the frame.');
    }

    // Narrow angle / perspective check
    const aspect = width / height;
    if (aspect > SCAN_NARROW_ASPECT_HIGH || aspect < SCAN_NARROW_ASPECT_LOW) {
      issues.push('The scan appears narrow-angled. Try holding the camera parallel to the page to reduce perspective distortion.');
    }

    return issues;
  };

  const isImageFile = (file) => {
    if (!file) return false;
    const type = file.type || '';
    if (type.startsWith('image/')) return true;
    const name = (file.name || '').toLowerCase();
    return /\.(png|jpe?g|bmp|webp|tiff?|tif)$/.test(name);
  };

  const analyzeImageFileQuality = async (file) => {
    if (typeof document === 'undefined' || !isImageFile(file)) {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          try {
            const maxDim = 1280;
            let width = img.width;
            let height = img.height;
            const maxSide = Math.max(width, height);
            const scale = maxSide > maxDim ? maxDim / maxSide : 1;

            width = Math.round(width * scale);
            height = Math.round(height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(url);
              resolve([]);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);

            const issues = analyzeScanQuality(canvas);
            resolve(issues);
          } catch (err) {
            console.error('Error analyzing image quality:', err);
            URL.revokeObjectURL(url);
            resolve([]);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve([]);
        };

        img.src = url;
      } catch (err) {
        console.error('Error preparing image for quality analysis:', err);
        resolve([]);
      }
    });
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const qualityIssues = analyzeScanQuality(canvas);

    // If there are quality issues, block upload and show feedback
    if (qualityIssues.length > 0) {
      showToast('warning', 'Scan quality issues detected', qualityIssues);
      // Keep camera open so user can rescan
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `scan-${timestamp}.jpeg`, { type: 'image/jpeg' });
        const fakeEvent = { target: { files: [file] }, isCameraCapture: true };
        handleFileChange(fakeEvent);
        closeCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  const removeFile = (fileId) => {
    const fileToRemove = files.find(f => f.id === fileId);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setFiles(files.filter(f => f.id !== fileId));
  };

  const validateFile = (fileId) => {
    setFiles(files.map(f =>
      f.id === fileId ? { ...f, validated: true } : f
    ));
    setMessage('✅ File validated successfully');
    setMessageType('success');
  };

  const validateAllFiles = () => {
    if (files.length === 0) {
      setMessage('❌ No files to validate');
      setMessageType('error');
      return;
    }
    setFiles(files.map(f => ({ ...f, validated: true })));
    setMessage(`✅ All ${files.length} file(s) validated successfully!`);
    setMessageType('success');
  };

  const previewFileHandler = (fileObj) => {
    if (!fileObj.previewUrl && fileObj.file) {
      fileObj.previewUrl = URL.createObjectURL(fileObj.file);
    }
    if (fileObj.rotation === undefined) {
      fileObj.rotation = 0;
    }
    setPreviewFile({ ...fileObj });
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewZoom(1);
  };

  const rotateImage = (direction) => {
    if (!previewFile) return;

    const rotationIncrement = direction === 'right' ? 90 : -90;
    const newRotation = ((previewFile.rotation || 0) + rotationIncrement) % 360;

    const updatedFile = { ...previewFile, rotation: newRotation };
    setPreviewFile(updatedFile);

    setFiles(files.map(f =>
      f.id === previewFile.id ? { ...f, rotation: newRotation } : f
    ));
  };

  const rotateImageFile = async (file, rotation) => {
    if (!rotation || rotation === 0 || rotation % 360 === 0) {
      return file;
    }

    try {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.onload = () => {
            if (rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270) {
              canvas.width = img.height;
              canvas.height = img.width;
            } else {
              canvas.width = img.width;
              canvas.height = img.height;
            }

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            canvas.toBlob((blob) => {
              if (blob) {
                const rotatedFile = new File([blob], file.name, {
                  type: file.type || 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(rotatedFile);
              } else {
                reject(new Error('Failed to create rotated image'));
              }
            }, file.type || 'image/jpeg', 0.95);
          };
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error rotating image:', error);
      return file;
    }
  };

  // Check backend connection
  const checkBackendConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (err) {
      return false;
    }
  };

  // Helper function to update analytics Excel file
  const updateAnalytics = async (fileData) => {
    try {
      const {
        district,
        mandal,
        village,
        month,
        year,
        shgId = '',
        validationStatus,
        failureReason = null,
        syncedToMbk = false
      } = fileData;

      const response = await fetch(`${API_BASE}/api/analytics/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          district,
          mandal,
          village,
          month,
          year,
          shg_id: shgId,
          validation_status: validationStatus,
          failure_reason: failureReason,
          synced_to_mbk: syncedToMbk
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn('Analytics update failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Error updating analytics:', error);
      return false;
    }
  };

  // Helper function to determine failure reason from validation result
  const getFailureReason = (validation) => {
    if (!validation || !validation.is_valid) {
      const errors = validation?.errors || [];
      const errorMessages = errors.map(e => e.toLowerCase()).join(' ');

      if (errorMessages.includes('incorrect form') || errorMessages.includes('wrong form')) {
        return 'incorrect_form';
      }
      if (errorMessages.includes('incorrect value') || errorMessages.includes('wrong value')) {
        return 'incorrect_values';
      }
      if (errorMessages.includes('missing field') || errorMessages.includes('missing data')) {
        return 'missing_fields';
      }
      if (errorMessages.includes('image quality') || errorMessages.includes('poor quality') ||
        errorMessages.includes('blur') || errorMessages.includes('shadow')) {
        return 'image_quality';
      }
      // Default to missing_fields if validation failed but no specific reason
      return 'missing_fields';
    }
    return null;
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      setMessage('❌ Please select at least one file');
      setMessageType('error');
      return;
    }

    if (!selectedMonth || !selectedYear) {
      setMessage('❌ Please select Month and Year');
      setMessageType('error');
      return;
    }

    // Check backend connection
    setMessage('🔍 Checking backend connection...');
    setMessageType('info');
    const isBackendAvailable = await checkBackendConnection();

    if (!isBackendAvailable) {
      setMessage(
        `❌ Backend Server Not Available\n\n` +
        `Cannot connect to backend server at ${API_BASE}\n\n` +
        `Please start the backend server.`
      );
      setMessageType('error');
      setProcessing(false);
      return;
    }

    try {
      setProcessStartTime(Date.now());
      setElapsedSeconds(0);
      setProcessing(true);
      setMessage('Using Secure Upload...');
      setMessageType('info');

      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('❌ Authentication token missing. Please login again.');
        setMessageType('error');
        setProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const newFailedFiles = [];

      for (const fileObj of files) {
        setMessage(`🚀 Uploading ${files.indexOf(fileObj) + 1}/${files.length}: ${fileObj.name}`);

        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('month', selectedMonth);
        formData.append('year', selectedYear);

        try {
          const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Upload failed with status ${response.status}`);
          }

          successCount++;
          // Mark as validated/success for UI feedback
          setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, validated: true } : f));

        } catch (err) {
          console.error('Upload failed for', fileObj.name, err);
          errorCount++;
          newFailedFiles.push({
            filename: fileObj.name,
            size: fileObj.size,
            error: err.message,
            timestamp: new Date().toLocaleString()
          });
        }
      }

      if (newFailedFiles.length > 0) {
        setFailedFiles(prev => [...prev, ...newFailedFiles]);
      }

      if (successCount > 0) {
        const successMsg = `✅ Upload Completed Successfully!\n\n` +
          `✅ Uploaded: ${successCount} file(s)\n` +
          `${errorCount > 0 ? `❌ Failed: ${errorCount} file(s)\n` : ''}`;

        // Show simplified success message
        setMessage(successMsg);
        setMessageType('success');

        // Clear files after successful upload if desired, or keep them marked as done
        setTimeout(() => {
          setFiles([]);
          setMessage('');
        }, 3000);

      } else {
        setMessage(`❌ All uploads failed. Please check your connection and try again.`);
        setMessageType('error');
      }

    } catch (err) {
      console.error('Processing error:', err);
      setMessage(`❌ Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setProcessing(false);
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

  const exportAsCSV = (result) => {
    const csvContent = result.csvData || '';
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const filenameBase = result.filename.split('.')[0];
    const monthYearSuffix = result.month && result.year ? `_${result.month}_${result.year}` : '';
    link.download = `${filenameBase}_table_${result.tableNumber}${monthYearSuffix}_export.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const updateResultData = (resultId, updatedFields) => {
    setResults(prev =>
      prev.map(result =>
        result.id === resultId ? { ...result, ...updatedFields } : result
      )
    );
    setSelectedResult(prev =>
      prev && prev.id === resultId ? { ...prev, ...updatedFields } : prev
    );
  };

  const viewResult = (result) => {
    setSelectedResult(result);
  };

  const closeModal = () => {
    setSelectedResult(null);
    setResultZoom(1);
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getDisplayFileName = (filename = '') => {
    if (!filename) return '';
    return filename.replace(/\.[^/.]+$/, '');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-700 overflow-hidden">
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl lg:text-4xl font-extrabold mb-2 bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 bg-clip-text text-transparent">
              SOCIETY FOR ELIMINATION OF RURAL POVERTY
            </h2>
            <h3 className="text-lg lg:text-2xl font-semibold text-blue-200">
              Department of Rural Development, Government of Andhra Pradesh
            </h3>
          </div>

          {/* Main Header */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 mb-8 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                    <Table2 size={32} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-4xl font-extrabold text-white tracking-tight">
                      {t('header.dashboard')}
                    </h1>
                    <p className="text-xs lg:text-sm text-blue-100 mt-1">
                      {t('header.subtitle')}
                    </p></div>
                </div>
                <div className="flex items-center gap-2 lg:gap-3 flex-wrap justify-end">
                  <LanguageToggle />
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all shadow-lg"
                  >
                    <CircleUserRound size={20} />
                    <span className="hidden sm:inline">{t('header.profile')}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all shadow-lg"
                  >
                    <FileText size={20} />
                    <span className="hidden sm:inline">{t('header.documentHistory')}</span>
                  </button>
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/90 hover:bg-red-600 text-white rounded-xl font-semibold transition-all shadow-lg"
                  >
                    <LogOut size={20} />
                    <span className="hidden sm:inline">{t('header.logout')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${systemOnline ? "bg-green-500" : "bg-red-500"
                      }`}
                  ></div>
                  <span className="text-gray-700 font-medium">
                    {systemOnline ? t('header.systemOnline') : t('header.systemOffline')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium mr-3">{t('header.importProcessActive')}</span>
                  {user?.previousLogin && (
                    <>
                      <span className="text-xs text-gray-500 font-medium">{t('header.lastLogin')}: </span>
                      <span className="text-xs text-gray-500 font-medium">{timeAgo}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Upload Tab */}
          {/* Upload Tab Content - Always Visible */}
          {activeTab === 'profile' && (
            <ProfilePage onClose={() => setActiveTab('upload')} onUserUpdate={refreshUserFromStorage} user={user} />
          )}
          {activeTab === 'documents' && (
            <DocumentHistory onClose={() => setActiveTab('upload')} />
          )}
          {(
            <>
              {/* Location Information Card */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl border border-white-400 mb-8 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                      <MapPin size={30} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100 uppercase tracking-wider">{t('location.operationalArea')}</h3>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{t('location.district')}:</span>
                          <span className="text-white text-lg font-bold">{user?.district}</span>
                        </div>
                        <div className="w-1 h-6 bg-white/30 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{t('location.mandal')}:</span>
                          <span className="text-white text-lg font-bold">{user?.mandal}</span>
                        </div>
                        <div className="w-1 h-6 bg-white/30 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{t('location.village')}:</span>
                          <span className="text-white text-lg font-bold">{user?.village}</span>
                        </div>
                        <div className="w-1 h-6 bg-white/30 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{t('location.voName')}:</span>
                          <span className="text-white text-lg font-bold">{user?.voName}</span>
                        </div>
                        <div className="w-1 h-6 bg-white/30 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">VO ID:</span>
                          <span className="text-white text-lg font-bold">{user?.voID}</span>
                        </div>
                        {/* <div className="w-1 h-6 bg-white/30 hidden sm:block"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{t('location.panchayat')}:</span>
                          <span className="text-white text-lg font-bold">{user?.panchayat}</span>
                        </div> */}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* SHG Upload Section - Full Width */}
              <SHGUploadSection
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
                user={user}
                onUploadComplete={(data) => {
                  console.log('SHG Upload complete:', data);
                }}
                t={t}
              />
            </>
          )}
        </div>
      </div>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <LogOut className="text-red-600 dark:text-red-400" size={24} />
            </div>

            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {t('header.logoutTitle') || 'Log Out'}
            </h3>

            <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
              {t('header.logoutConfirm') || 'Are you sure you want to log out?'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-all"
              >
                {t('header.cancel') || 'Cancel'}
              </button>

              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogOut();
                }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all"
              >
                {t('header.logout') || 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}