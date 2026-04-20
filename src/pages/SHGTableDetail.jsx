import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Download,
    FileText,
    Table as TableIcon,
    Loader2,
    CheckCircle,
    Clock,
    ExternalLink,
    XCircle,
    AlertCircle,
    ChevronRight,
    ShieldCheck,
    Edit3,
    Save,
    X,
    Image as ImageIcon,
    Eye,
    EyeOff,
    BookCheck,
    BookOpen,
    Book,
    Lock,
    Database
} from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import { formatDateTime } from '../utils/dateUtils';
import SHGPage2View from './SHGPage2View';

const padSHGId = (id) => {
    if (!id) return id;
    const s = String(id).trim();
    if (/^\d+$/.test(s)) {
        return s.padStart(18, '0');
    }
    return s;
};

const padMBKId = (id) => {
    if (!id) return id;
    const s = String(id).trim();
    if (/^\d$/.test(s)) {
        return s.padStart(2, '0');
    }
    return s;
};

const SHGTableDetail = ({ uploadId, shgName, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showImage, setShowImage] = useState(false);
    const [s3Url, setS3Url] = useState(null);
    const [opacity, setOpacity] = useState(0.5);
    const [page1Totals, setPage1Totals] = useState(null);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/api/conversion/detail/${uploadId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await res.json();

                if (result.success) {
                    setData(result.data);
                    setOriginalData(JSON.parse(JSON.stringify(result.data)));
                    setS3Url(result.s3Url);
                    setPage1Totals(result.related_page1_totals);
                } else {
                    setError(result.message || 'Failed to load table data');
                }
            } catch (err) {
                console.error('Error fetching conversion detail:', err);
                setError('Network error. Failed to fetch data.');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [uploadId]);

    const handleDownloadExcel = async () => {
        try {
            if (!data || !data.table_data) return;

            const isPage2 = data.table_data.page === 2;
            const endpoint = isPage2 ? `${API_BASE}/api/export-finance-to-excel` : `${API_BASE}/api/export-to-excel`;
            
            const payload = isPage2 ? {
                table_data: data.table_data,
                shg_mbk_id: padSHGId(data.shgID) || 'Unknown',
                filename: `SHG_Finance_${shgName}_${padSHGId(data.shgID)}`
            } : {
                table_data: {
                    ...data.table_data,
                    header_rows: headerRows,
                    column_headers: headers
                },
                shg_mbk_id: padSHGId(data.shgID) || 'Unknown',
                month: new Date(data.convertedAt).getMonth() + 1,
                year: new Date(data.convertedAt).getFullYear(),
                filename: `SHG_Data_${shgName}_${padSHGId(data.shgID)}`
            };

            const token = localStorage.getItem('token');
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = isPage2 
                    ? `SHG_Finance_${shgName}_${padSHGId(data.shgID)}.xlsx`
                    : `SHG_Data_${shgName}_${padSHGId(data.shgID)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert('Failed to generate Excel file');
            }
        } catch (err) {
            console.error('Error exporting to excel:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const currentTotals = calculateColumnTotals();
            const updatedTableData = (() => {
                const updated = JSON.parse(JSON.stringify(data.table_data));

                // Skip totals logic for Page 2 (Financial Ledger)
                if (updated.page === 2) return updated;

                // Always re-calculate and save the current totals for Page 1
                // This ensures "what is displaying" is what is saved
                const totalsCells = [];
                for (let i = 0; i < 14; i++) {
                    const frontendIdx = i + 2;
                    const val = currentTotals[frontendIdx] || 0;
                    totalsCells.push({
                        col_index: i,
                        text: val > 0 ? val.toFixed(2) : '',
                        confidence: 1.0
                    });
                }
                updated.totals_row = { cells: totalsCells };
                
                return updated;
            })();

            // SHG ID is usually found in table_data.shg_mbk_id if it was edited
            // fallback to data.shgID if not changed or present in table_data
            const shgIDToSave = updatedTableData.shg_mbk_id || data.shgID;

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/conversion/detail/${uploadId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_data: updatedTableData,
                    shgID: shgIDToSave
                })
            });
            const result = await res.json();
            if (result.success) {
                // Update local state with the same data we sent to server
                const newData = { 
                    ...data, 
                    table_data: updatedTableData, 
                    shgID: shgIDToSave, // Update primary record ID if changed
                    isSynced: true 
                };
                setData(newData);
                setOriginalData(JSON.parse(JSON.stringify(newData)));
                setIsEditing(false);
            } else {
                alert(result.message || 'Failed to save changes');
            }
        } catch (err) {
            console.error('Error saving changes:', err);
            alert('Network error. Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleSyncToPayments = async () => {
        setIsSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/conversion/sync-payments/${uploadId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = await res.json();
            if (result.success) {
                setData(prev => ({ ...prev, isSynced: true }));
                alert(result.message);
            } else {
                alert(result.message || 'Failed to save data');
            }
        } catch (err) {
            console.error('Error syncing to payments:', err);
            alert('Network error. Failed to save data.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCancel = () => {
        setData(JSON.parse(JSON.stringify(originalData)));
        setIsEditing(false);
    };

    const handleCellChange = (rIdx, cIdx, val) => {
        const newData = { ...data };
        newData.table_data.data_rows[rIdx].cells[cIdx].text = val;
        setData(newData);
    };

    // Page 2 cell edit: update cell by debug_id across all rows
    const handlePage2CellEdit = (debugId, value) => {
        const newData = JSON.parse(JSON.stringify(data));
        let found = false;
        for (const row of newData.table_data.data_rows || []) {
            for (const cell of row.cells || []) {
                if (cell.debug_id === debugId) {
                    cell.text = value;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found) {
            // Cell doesn't exist yet — insert it in first row as a new cell
            if (!newData.table_data.data_rows) newData.table_data.data_rows = [];
            if (newData.table_data.data_rows.length === 0) {
                newData.table_data.data_rows.push({ cells: [] });
            }
            newData.table_data.data_rows[0].cells.push({
                debug_id: debugId,
                text: value,
                confidence: 1.0,
            });
        }
        setData(newData);
    };

    const handleTotalChange = (cellIdx, val) => {
        const newData = { ...data };
        const expectedColIndex = cellIdx - 2;

        if (!newData.table_data.totals_row) {
            newData.table_data.totals_row = { cells: [] };
        }

        // Ensure the cells array is populated up to the required index
        while (newData.table_data.totals_row.cells.length < 14) {
            newData.table_data.totals_row.cells.push({ col_index: newData.table_data.totals_row.cells.length, text: '', confidence: 1.0 });
        }

        newData.table_data.totals_row.cells[expectedColIndex].text = val;
        setData(newData);
    };

    const handleSHGIDChange = (val) => {
        const newData = { ...data };

        // Ensure table_data exists
        if (!newData.table_data) newData.table_data = {};

        // Update the SHG ID used for sync and display in the table
        newData.table_data.shg_mbk_id = val;

        // Also update the label in header_rows if it exists to show live update in the table
        if (newData.table_data.header_rows) {
            newData.table_data.header_rows.forEach(row => {
                row.forEach(cell => {
                    if (cell.col_span === 15 && cell.row_span === 1) {
                        cell.label = val;
                        cell.text = val;
                    }
                });
            });
        }

        setData(newData);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] bg-white/40 backdrop-blur-xl rounded-[40px] p-12 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
                    <Loader2 className="w-20 h-20 animate-spin text-indigo-600 mb-8 relative z-10" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Compiling Data</h3>
                <div className="text-gray-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                    Reconstructing table archives...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-16 text-center shadow-2xl border border-red-100 animate-in slide-in-from-top-4 duration-500">
                <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <XCircle size={48} />
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Access Denied</h3>
                <p className="text-gray-600 mb-10 max-w-sm mx-auto font-medium leading-relaxed">{error}</p>
                <button
                    onClick={onBack}
                    className="px-10 py-4 bg-gray-900 text-white rounded-[24px] font-black shadow-xl hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }


    // ===================================================================
    // V2.0 STATIC HEADERS - Never stored in database
    // ===================================================================
    // These Telugu labels are identical for ALL SHG tables, so v2.0 schema
    // doesn't store them in MongoDB (saves ~10-12KB per document).
    // Instead, frontend loads them from these static constants.

    const SHG_COLUMN_HEADERS_V2 = [
        { index: 0, key: "member_mbk_id", label: "సభ్యురాలి MBK ID" },
        { index: 1, key: "member_name", label: "సభ్యురాలు పేరు" },
        { index: 2, key: "savings_this_month", label: "ఈ నెల పొదుపు" },
        { index: 3, key: "shg_internal_loan_total", label: "SHG అంతర్గత అప్పు కట్టిన మొత్తం" },
        { index: 4, key: "bank_loan_total", label: "బ్యాంక్ అప్పు కట్టిన మొత్తం" },
        { index: 5, key: "streenidhi_micro_loan_total", label: "స్త్రీనిధి మైక్రో అప్పు కట్టిన మొత్తం" },
        { index: 6, key: "streenidhi_tenni_loan_total", label: "స్త్రీనిధి టెన్నీ అప్పు కట్టిన మొత్తం" },
        { index: 7, key: "unnathi_scsp_loan_total", label: "ఉన్నతి (SCSP) అప్పు కట్టిన మొత్తం" },
        { index: 8, key: "unnathi_tsp_loan_total", label: "ఉన్నతి (TSP) అప్పు కట్టిన మొత్తం" },
        { index: 9, key: "cif_loan_total", label: "CIF అప్పు కట్టిన మొత్తం" },
        { index: 10, key: "vo_internal_loan_total", label: "VO అంతర్గత అప్పు కట్టిన మొత్తం" },
        { index: 11, key: "loan_type", label: "అప్పు రకం" },
        { index: 12, key: "loan_type_amount", label: "మొత్తం" },
        { index: 13, key: "penalty_amount", label: "జరిమానా రకం" },
        { index: 14, key: "returned_to_members", label: "సభ్యులకు తిరిగి ఇచ్చిన మొత్తం" },
        { index: 15, key: "other_savings_total", label: "సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు)" },
    ];

    // Base multi-level header rows template (same for all documents)
    const BASE_SHG_HEADER_ROWS_V2 = [
        // Row 1: Title row spanning all columns
        [
            { label: "………......................... స్వయం సహయక సంఘ  ................. తేదిన జరిగిన సమావేశ ఆర్థిక లావాదేవీలు వివరములు (అనుభందం - II)", col_span: 16, row_span: 1 }
        ],
        // Row 2: SHG MBK ID row (ID is injected dynamically)
        [
            { label: "SHG MBK ID", col_span: 1, row_span: 1, align: "left" },
            { label: "", col_span: 15, row_span: 1, align: "left" } // Dynamic SHG ID goes here
        ],
        // Row 3: Financial transactions header
        [
            { label: "సభ్యుల స్థాయిలో జరిగిన ఆర్థిక లావాదేవీలు", col_span: 16, row_span: 1 }
        ],
        // Row 4: Main category headers
        [
            { label: "సభ్యురాలి MBK ID", col_span: 1, row_span: 2 },
            { label: "సభ్యురాలు పేరు", col_span: 1, row_span: 2 },
            { label: "ఈ నెల పొదుపు", col_span: 1, row_span: 2 },
            { label: "అప్పు రికార్డు వివరములు", col_span: 8, row_span: 1 },
            { label: "కొత్త అప్పు వివరాలు", col_span: 2, row_span: 1 },
            { label: "జరిమానా రకం", col_span: 1, row_span: 2 },
            { label: "సభ్యులకు తిరిగి ఇచ్చిన మొత్తం", col_span: 1, row_span: 2 },
            { label: "సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు)", col_span: 1, row_span: 2 },
        ],
        // Row 5: Sub-headers (only appears under row 4's middle columns)
        [
            { label: "SHG అంతర్గత అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "బ్యాంక్ అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "స్త్రీనిధి మైక్రో అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "స్త్రీనిధి టెన్నీ అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "ఉన్నతి (SCSP) అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "ఉన్నతి (TSP) అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "CIF అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "VO అంతర్గత అప్పు కట్టిన మొత్తం", col_span: 1, row_span: 1 },
            { label: "అప్పు రకం", col_span: 1, row_span: 1 },
            { label: "మొత్తం", col_span: 1, row_span: 1 },
        ],
    ];

    const tableData = data.table_data;
    const schemaVersion = tableData.schema_version || "1.0"; // Default to v1.0 for old data
    const formPage = tableData.page || 1;  // 1 = member table, 2 = financial ledger
    const isPage2 = formPage === 2;

    // V2.0: Use static headers, V1.0: Use headers from database
    const headers = schemaVersion === "2.0" ? SHG_COLUMN_HEADERS_V2 : (tableData.column_headers || []);

    // Extract SHG ID for display and comparison
    // We prioritize shg_mbk_id then shg_id from results, then fallback to record ID
    const convertedSHGID = tableData.shg_mbk_id || tableData.shg_id || "";
    const actualSHGID = data.shgID || "";

    // V2.0: Build header rows with dynamic SHG ID injection
    let headerRows;
    if (schemaVersion === "2.0") {
        headerRows = JSON.parse(JSON.stringify(BASE_SHG_HEADER_ROWS_V2)); // Deep copy
        // Inject dynamic SHG ID into row 2, cell 2 - match the top-level ID for consistency
        headerRows[1][1].label = actualSHGID;
        headerRows[1][1].text = actualSHGID;
    } else {
        headerRows = tableData.header_rows || [];
    }

    const rows = tableData.data_rows || [];

    // Helper: Get cell text (works for both v1.0 and v2.0)
    const getCellText = (cell) => {
        return cell?.text || '';
    };

    // Helper: Get cell confidence (works for both v1.0 and v2.0)
    const getCellConfidence = (cell) => {
        return cell?.confidence || 0.0;
    };


    // Calculate totals for each column
    const calculateColumnTotals = () => {
        const totals = {};
        if (!rows || rows.length === 0) return totals;

        for (let colIdx = 2; colIdx < (rows[0]?.cells?.length || 0); colIdx++) {
            const calculatedTotal = rows.reduce((sum, row) => {
                const cellText = row.cells[colIdx]?.text || '';
                const numValue = parseFloat(cellText.replace(/[^0-9.-]/g, ''));
                return !isNaN(numValue) ? sum + numValue : sum;
            }, 0);
            totals[colIdx] = calculatedTotal;
        }
        return totals;
    };

    const calculatedTotals = calculateColumnTotals();

    // Get OCR-extracted totals from backend (debug cells 264-277)
    const extractedTotals = tableData.totals_row?.cells || [];

    return (
        <div className="min-h-screen bg-white rounded-3xl shadow-xl p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Top Glass Navigation */}
            <div className="bg-gray-50 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-lg border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 transition-all">

                {/* LEFT SECTION */}
                <div className="flex items-start sm:items-center gap-4 sm:gap-6">

                    {/* BACK BUTTON */}
                    <button
                        onClick={onBack}
                        className="p-3 sm:p-4 bg-white hover:bg-indigo-600 hover:text-white text-gray-700 rounded-xl sm:rounded-2xl transition-all group shadow-md border border-gray-200"
                    >
                        <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>

                    {/* DIVIDER (DESKTOP ONLY) */}
                    <div className="h-12 w-[1px] bg-gray-200/50 hidden md:block"></div>

                    {/* INFO */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate flex items-center gap-2">
                                {shgName}
                                {data?.isSynced && (
                                    <BookCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 shrink-0" title="Sent to DB" />
                                )}
                            </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                            <span className="text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl uppercase tracking-widest text-indigo-600 bg-indigo-50/50 border border-indigo-100/50">
                                {padSHGId(data.shgID)}
                            </span>

                            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-gray-400">
                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                                <span className="uppercase tracking-wide hidden sm:inline">Processed:</span>
                                <span className="text-gray-600 truncate">
                                    {formatDateTime(data.convertedAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex flex-wrap items-center gap-3">
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-5 sm:px-6 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-[24px] font-black shadow-lg transition-all flex items-center gap-2"
                            >
                                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-sm sm:text-base">Edit</span>
                            </button>
                            <button
                                onClick={handleDownloadExcel}
                                className="group relative px-5 sm:px-8 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-[24px] font-black shadow-lg transition-all"
                            >
                                <div className="flex items-center justify-center gap-2 sm:gap-3">
                                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-sm sm:text-base">Download Excel</span>
                                </div>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleCancel}
                                className="px-5 sm:px-6 py-3 sm:py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl sm:rounded-[24px] font-black transition-all flex items-center gap-2"
                            >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-sm sm:text-base font-bold">Cancel</span>
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 sm:px-8 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-[24px] font-black shadow-lg transition-all flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                                <span className="text-sm sm:text-base">Save Changes</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Table Vessel with Image Overlay */}
            <div className="bg-white rounded-[32px] shadow-lg border border-gray-200 overflow-hidden relative z-0">
                <div className={`${isPage2 ? 'bg-violet-700' : 'bg-indigo-600'} px-8 py-5 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            {isPage2 ? <Book className="text-white" size={24} /> : <TableIcon className="text-white" size={24} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                                    {isPage2 ? 'SHG Financial Ledger' : 'SHG Digital Table'}
                                </h4>
                                <span className="px-2.5 py-0.5 bg-white/25 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                                    Page {formPage}
                                </span>
                            </div>
                            <p className={`text-[10px] ${isPage2 ? 'text-violet-200' : 'text-indigo-200'} font-bold uppercase tracking-widest mt-0.5`}>
                                {isPage2 ? 'Monthly Financial Summary — ఆర్థిక సారాంశం' : 'SHG Digitally Converted Table'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Image Visibility Control */}
                        {showImage && s3Url && (
                            <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full border border-white/10">
                                <span className="text-[10px] text-white font-black uppercase tracking-widest">Visibility:</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={opacity * 100}
                                    onChange={(e) => setOpacity(e.target.value / 100)}
                                    className="w-24 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                                />
                                <span className="text-[10px] text-white font-bold">{Math.round(opacity * 100)}%</span>
                            </div>
                        )}

                        {/* View Image Button */}
                        {s3Url && (
                            <button
                                onClick={() => setShowImage(!showImage)}
                                className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-md border font-semibold text-sm flex items-center gap-2 ${showImage ? 'bg-white text-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
                                title={showImage ? "Hide Original Image" : "View Original Image"}
                            >
                                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                <span className="hidden sm:inline">{showImage ? "Show digital data" : "View Image"}</span>
                            </button>
                        )}

                        <button
                            onClick={handleSyncToPayments}
                            disabled={isSyncing || isEditing || data?.isSynced}
                            className={`px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all font-black shadow-lg flex items-center gap-2 sm:gap-3 ${data?.isSynced
                                ? 'bg-emerald-500 text-white cursor-default border-emerald-400'
                                : isPage2
                                    ? 'bg-violet-500 text-white hover:bg-violet-600 border-violet-400'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-400'
                                }`}
                        >
                            {isSyncing ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            ) : data?.isSynced ? (
                                <BookCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                            <span className="text-sm sm:text-base">
                                {data?.isSynced ? 'Sent to DB' : isPage2 ? 'Save Finance Ledger' : 'Send to DB'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Image Overlay Container */}
                {showImage && s3Url && (
                    <div className="absolute inset-0 top-20 left-0 right-0 bottom-0 z-40 flex items-center justify-center overflow-hidden">
                        {/* Image */}
                        <div className="relative w-full h-full">
                            <img
                                src={s3Url}
                                alt="Original Record"
                                className="w-full h-full transition-opacity duration-300"
                                style={{ opacity: opacity }}
                            />
                        </div>
                    </div>
                )}

                {/* Mobile Opacity Control */}
                {showImage && s3Url && (
                    <div className="lg:hidden bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Eye size={18} className="text-indigo-600" />
                            <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Visibility:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={opacity * 100}
                                onChange={(e) => setOpacity(e.target.value / 100)}
                                className="w-24 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="text-xs font-bold text-gray-500 w-8 text-right">{Math.round(opacity * 100)}%</span>
                        </div>
                    </div>
                )}

                {/* ── PAGE 2: Financial Ledger renderer ───────────────── */}
                {isPage2 ? (
                    <SHGPage2View
                        tableData={tableData}
                        isEditing={isEditing}
                        onCellEdit={handlePage2CellEdit}
                        relatedPage1Totals={page1Totals}
                    />
                ) : (
                    /* ── PAGE 1: Member spreadsheet renderer (unchanged) ── */
                    <>
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="inline-block min-w-full align-top">
                                <table className="w-full border-collapse">
                                    <thead>
                                        {/* Complex Headers - v2.0 uses static template, v1.0 uses database */}
                                        {headerRows && headerRows.map((row, rIdx) => (
                                            <tr key={rIdx}>
                                                {row.map((cell, cIdx) => {
                                                    const isLastLevel = (rIdx + (cell.row_span || 1)) === headerRows.length;
                                                    const isSHGIDHeader = (cell.col_span === 15 && cell.row_span === 1);
                                                    return (
                                                        <th
                                                            key={cIdx}
                                                            colSpan={cell.col_span || 1}
                                                            rowSpan={cell.row_span || 1}
                                                            className={`bg-indigo-50/50 border-b border-r border-indigo-100/50 px-6 py-4 text-[11px] font-black transition-colors uppercase tracking-wider ${isLastLevel ? 'bg-indigo-100/30' : ''} ${isSHGIDHeader ? 'text-left' : 'text-center'}`}
                                                        >
                                                            {isSHGIDHeader && isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={tableData.shg_mbk_id || cell.label}
                                                                    onChange={(e) => handleSHGIDChange(e.target.value)}
                                                                    className={`w-full bg-white border border-black/30 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold`}
                                                                />
                                                            ) : (
                                                                cell.label
                                                            )}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {/* Fallback Simple Header */}
                                        {(!headerRows || headerRows.length === 0) && (
                                            <tr className="bg-indigo-50/50">
                                                {headers.map((header, idx) => (
                                                    <th key={idx} className="border-b border-r border-indigo-100/50 px-6 py-4 text-xs font-black text-indigo-900 text-left whitespace-nowrap uppercase tracking-widest">
                                                        {header.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white/50">
                                        {rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-indigo-50/30 transition-all duration-200 group">
                                                {row.cells.map((cell, cIdx) => (
                                                    <td key={cIdx} className="px-6 py-4 text-sm font-semibold text-gray-700 border-r border-gray-100/50 group-last:border-r-0 min-w-[150px]">
                                                        <div className="flex flex-col">
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={cell.text}
                                                                    onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                                                    className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
                                                                />
                                                            ) : (
                                                                <span>{cIdx === 0 ? padMBKId(cell.text) : cell.text}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}

                                        {/* Totals Row */}
                                        {rows.length > 0 && rows[0].cells && (
                                            <tr className="bg-indigo-50 border-t-2 border-indigo-600">
                                                {rows[0].cells.map((_, cellIdx) => {
                                                    if (cellIdx === 0) {
                                                        return (
                                                            <td key={cellIdx} colSpan={2} className="px-6 py-4 text-sm font-black text-indigo-900 border-r border-gray-100/50 text-left">
                                                                మొత్తం :
                                                            </td>
                                                        );
                                                    } else if (cellIdx === 1) {
                                                        return null;
                                                    } else {
                                                        const columnTotal = calculatedTotals[cellIdx] || 0;
                                                        const displayText = columnTotal > 0 ? columnTotal.toFixed(2) : '-';
                                                        return (
                                                            <td
                                                                key={cellIdx}
                                                                className="px-6 py-4 text-sm font-black border-r border-gray-100/50 text-center text-indigo-900"
                                                            >
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={displayText === '-' ? '' : displayText}
                                                                        onChange={(e) => handleTotalChange(cellIdx, e.target.value)}
                                                                        className="w-full bg-white border border-indigo-200 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 font-black text-indigo-900"
                                                                    />
                                                                ) : displayText}
                                                            </td>
                                                        );
                                                    }
                                                })}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {rows.length === 0 && (
                            <div className="p-32 text-center bg-gray-50/30">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <FileText className="w-10 h-10 text-gray-300" />
                                </div>
                                <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">No records extracted</p>
                                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-2">Check source document quality</p>
                            </div>
                        )}
                    </>
                )}
            </div>



        </div>
    );
};

export default SHGTableDetail;
