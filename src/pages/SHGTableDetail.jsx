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
    EyeOff
} from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

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
        // ... (existing code remains but use current 'data')
        try {
            if (!data || !data.table_data) return;

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/export-to-excel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_data: data.table_data,
                    shg_mbk_id: padSHGId(data.shgID) || 'Unknown',
                    month: new Date(data.convertedAt).getMonth() + 1,
                    year: new Date(data.convertedAt).getFullYear()
                })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SHG_Data_${shgName}_${padSHGId(data.shgID)}.xlsx`;
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
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/conversion/detail/${uploadId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_data: data.table_data,
                    shgID: data.shgID
                })
            });
            const result = await res.json();
            if (result.success) {
                setOriginalData(JSON.parse(JSON.stringify(data)));
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

    const handleSHGIDChange = (val) => {
        const newData = { ...data };
        newData.shgID = val;

        // Also update the label in header_rows if it exists to show live update
        if (newData.table_data && newData.table_data.header_rows) {
            newData.table_data.header_rows.forEach(row => {
                row.forEach(cell => {
                    if (cell.col_span === 15 && cell.row_span === 1) {
                        cell.label = val;
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

    const tableData = data.table_data;
    const headers = tableData.column_headers || [];
    const rows = tableData.data_rows || [];

    // Extract SHG ID from table data (backend now provides this as shg_id)
    const extractedSHGID = tableData.shg_id || tableData.shg_mbk_id || data.shgID;

    // Check if SHG ID matches
    const isSHGIDMismatch = extractedSHGID && data.shgID && extractedSHGID !== data.shgID;

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
                            <h3 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate">
                                {shgName}
                            </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                            <span className={`text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl uppercase tracking-widest ${isSHGIDMismatch
                                ? 'text-red-700 bg-red-50 border-2 border-red-500'
                                : 'text-indigo-600 bg-indigo-50/50 border border-indigo-100/50'
                                }`}>
                                {padSHGId(data.shgID)}
                            </span>

                            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-gray-400">
                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                                <span className="uppercase tracking-wide hidden sm:inline">Processed:</span>
                                <span className="text-gray-600 truncate">
                                    {new Date(data.convertedAt).toLocaleString()}
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
                <div className="bg-indigo-600 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <TableIcon className="text-white" size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">SHG Digital Table</h4>
                            <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-0.5">SHG Digitally Converted Table</p>
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
                            disabled={isSyncing || isEditing}
                            className={`hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full shadow-xl transition-all border-2 ${isSyncing
                                ? 'bg-indigo-400 border-indigo-300 text-white cursor-not-allowed'
                                : 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600 hover:scale-110 active:scale-95'
                                } ${isEditing ? 'opacity-50 cursor-not-allowed' : 'animate-pulse-subtle'}`}
                            title="Save data to member payments collection"
                        >
                            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span className="text-[11px] font-black uppercase tracking-widest text-white">
                                {isSyncing ? 'Processing...' : 'Save Data to DB'}
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

                <div className="overflow-x-auto custom-scrollbar">
                    <div className="inline-block min-w-full align-top">
                        <table className="w-full border-collapse">
                            <thead>
                                {/* Complex Headers from backend */}
                                {tableData.header_rows && tableData.header_rows.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        {row.map((cell, cIdx) => {
                                            const isLastLevel = (rIdx + (cell.row_span || 1)) === tableData.header_rows.length;
                                            const isSHGIDHeader = (cell.col_span === 15 && cell.row_span === 1);
                                            return (
                                                <th
                                                    key={cIdx}
                                                    colSpan={cell.col_span || 1}
                                                    rowSpan={cell.row_span || 1}
                                                    className={`bg-indigo-50/50 border-b border-r border-indigo-100/50 px-6 py-4 text-[11px] font-black text-indigo-900 transition-colors uppercase tracking-wider ${isLastLevel ? 'bg-indigo-100/30' : ''} ${isSHGIDHeader ? 'text-left' : 'text-center'} ${isSHGIDHeader && isSHGIDMismatch ? 'border-4 border-red-500' : ''}`}
                                                >
                                                    {isSHGIDHeader && isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={cell.label}
                                                            onChange={(e) => handleSHGIDChange(e.target.value)}
                                                            className="w-full bg-white border border-black/30 rounded px-2 py-1 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
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
                                {!tableData.header_rows && (
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
                                        {row.cells.map((cell, cIdx) => {
                                            return (
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
                                            );
                                        })}
                                    </tr>
                                ))}

                                {/* Totals Row */}
                                {rows.length > 0 && rows[0].cells && (
                                    <tr className="bg-indigo-50 border-t-2 border-indigo-600">
                                        {rows[0].cells.map((_, cellIdx) => {
                                            if (cellIdx === 0) {
                                                return (
                                                    <td
                                                        key={cellIdx}
                                                        colSpan={2}
                                                        className="px-6 py-4 text-sm font-black text-indigo-900 border-r border-gray-100/50 text-left"
                                                    >
                                                        మొత్తం :
                                                    </td>
                                                );
                                            } else if (cellIdx === 1) {
                                                return null;
                                            } else {
                                                const columnTotal = calculatedTotals[cellIdx] || 0;

                                                // Find extracted total for this column from OCR (debug cells 264-277)
                                                const extractedTotalCell = extractedTotals.find(
                                                    t => t.col_index === cellIdx
                                                );
                                                const extractedValue = extractedTotalCell
                                                    ? parseFloat(extractedTotalCell.text?.replace(/[^0-9.-]/g, ''))
                                                    : null;

                                                // Check if there's a mismatch (tolerance of 0.01 for floating point)
                                                const hasMismatch = extractedValue !== null &&
                                                    Math.abs(extractedValue - columnTotal) > 0.01;

                                                return (
                                                    <td
                                                        key={cellIdx}
                                                        className={`px-6 py-4 text-sm font-black border-r border-gray-100/50 text-center ${hasMismatch
                                                            ? 'text-yellow-900 bg-yellow-50 border-2 border-yellow-500'
                                                            : 'text-indigo-900'
                                                            }`}
                                                    >
                                                        {columnTotal > 0 ? columnTotal.toFixed(2) : '-'}
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
            </div>

            {/* Info Panel */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-10 rounded-[32px] shadow-lg border border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-indigo-100/30">
                    <AlertCircle size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-10">
                    <div className="p-5 bg-indigo-100 text-indigo-600 rounded-3xl border border-indigo-200 shadow-md">
                        <AlertCircle size={40} />
                    </div>
                    <div>
                        <h5 className="text-xl font-black text-indigo-900 mb-3 tracking-tight">Information about the SHG Digital Table</h5>
                        <p className="text-sm text-indigo-800/80 font-medium leading-relaxed max-w-2xl">
                            This SHG Digital Table was reconstructed using OCR Model. Values highlighted in <span className="text-amber-600 font-bold">Gold</span> failed the 60% confidence threshold and should be validated against the original physical records.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SHGTableDetail;
