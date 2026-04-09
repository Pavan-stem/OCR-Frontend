import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft,
    Save,
    XCircle,
    Loader2,
    Plus,
    X,
    User,
    CheckCircle,
    Trash2,
    RotateCw,
    AlertCircle,
    Smartphone,
    Layout
} from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';
import SHGPage2View from './SHGPage2View';

const padSHGId = (id) => {
    if (!id) return id;
    const s = String(id).trim();
    if (/^\d+$/.test(s)) return s.padStart(18, '0');
    return s;
};

const padMBKId = (id) => {
    if (!id) return id;
    const s = String(id).trim();
    if (/^\d$/.test(s)) return s.padStart(2, '0');
    return s;
};

const SHG_COLUMN_HEADERS = [
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
    { index: 11, key: "loan_type", label: "కొత్త అప్పు రకం" },
    { index: 12, key: "loan_type_amount", label: "కొత్త అప్పు మొత్తం" },
    { index: 13, key: "penalty_amount", label: "జరిమానా రకం" },
    { index: 14, key: "returned_to_members", label: "సభ్యులకు తిరిగి ఇచ్చిన మొత్తం" },
    { index: 15, key: "other_savings_total", label: "సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు)" },
];

const SHGConversionEditView = ({ shgGroup, onBack, onSaveSuccess }) => {
    const [activePageTab, setActivePageTab] = useState(1);
    const [loading, setLoading] = useState(true);
    const [page1Data, setPage1Data] = useState(null);
    const [page2Data, setPage2Data] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const p1UploadId = shgGroup.pages[1]?.uploadId;
                const p2UploadId = shgGroup.pages[2]?.uploadId;

                const [res1, res2] = await Promise.all([
                    fetch(`${API_BASE}/api/conversion/detail/${p1UploadId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE}/api/conversion/detail/${p2UploadId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                const data1 = await res1.json();
                const data2 = await res2.json();

                if (data1.success) setPage1Data(data1.data);
                if (data2.success) {
                    // Inject related_page1_totals into page2Data for the column view
                    setPage2Data({
                        ...data2.data,
                        relatedPage1Totals: data2.related_page1_totals
                    });
                }

                if (!data1.success || !data2.success) {
                    setError('Failed to fetch some page data');
                }
            } catch (err) {
                console.error('Error fetching conversion edit data:', err);
                setError('Network error');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [shgGroup]);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            // Save Page 1
            const p1Res = await fetch(`${API_BASE}/api/conversion/detail/${shgGroup.pages[1].uploadId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_data: page1Data.table_data,
                    shgID: page1Data.shgID
                })
            });

            // Save Page 2
            const p2Res = await fetch(`${API_BASE}/api/conversion/detail/${shgGroup.pages[2].uploadId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_data: page2Data.table_data,
                    shgID: page2Data.shgID
                })
            });

            const r1 = await p1Res.json();
            const r2 = await p2Res.json();

            if (r1.success && r2.success) {
                alert('All changes saved successfully');
                onSaveSuccess?.();
            } else {
                alert('Failed to save some changes');
            }
        } catch (err) {
            console.error('Error saving data:', err);
            alert('Save failed due to network error');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async (pageNum) => {
        const item = shgGroup.pages[pageNum];
        if (!window.confirm(`Are you sure you want to reject Page ${pageNum}? it will need reach back to VO for re-upload.`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/admin/uploads/${item.uploadId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'rejected',
                    rejectionReason: 'Rejected by Admin/VO during conversion edit review'
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Page ${pageNum} rejected`);
                onSaveSuccess?.(); // Refresh list and go back
            } else {
                alert(data.message || 'Failed to reject');
            }
        } catch (err) {
            console.error('Error rejecting:', err);
            alert('Error rejecting item');
        }
    };

    // Page 1 Handlers
    const handleMemberCellChange = (rIdx, cIdx, val) => {
        const newData = { ...page1Data };
        newData.table_data.data_rows[rIdx].cells[cIdx].text = val;
        setPage1Data(newData);
    };

    const handleAddField = (rIdx, cIdx) => {
        // Just a placeholder for "Adding" a field — in our card view, we just show it if it has an empty string
        // but the user wants to pick from options.
    };

    // Page 2 Handlers
    const handlePage2CellEdit = (debugId, value) => {
        const newData = JSON.parse(JSON.stringify(page2Data));
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
            if (!newData.table_data.data_rows) newData.table_data.data_rows = [];
            if (newData.table_data.data_rows.length === 0) newData.table_data.data_rows.push({ cells: [] });
            newData.table_data.data_rows[0].cells.push({ debug_id: debugId, text: value, confidence: 1.0 });
        }
        setPage2Data(newData);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading SHG Details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 text-center text-red-500 font-bold">
                {error}
                <button onClick={onBack} className="block mx-auto mt-4 px-6 py-2 bg-gray-100 rounded-lg text-gray-700">Back</button>
            </div>
        );
    }

    const shgIdForPage1 = padSHGId(page1Data?.shgID);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 -m-4 sm:-m-8 p-4 sm:p-8 animate-in fade-in duration-500">
            <div className="space-y-6 max-w-4xl mx-auto w-full pb-20">
                {/* Header Area */}
                <div className="bg-white rounded-[32px] p-6 shadow-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="text-center flex-1">
                            <h2 className="text-lg font-black text-gray-900 leading-tight truncate px-4">{shgGroup.shgName}</h2>
                            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase">{shgIdForPage1}</span>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Compact Page Tabs */}
                    <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-2 border border-gray-100">
                        <button
                            onClick={() => setActivePageTab(1)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activePageTab === 1
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <Layout size={14} /> Page 1 (Members)
                        </button>
                        <button
                            onClick={() => setActivePageTab(2)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activePageTab === 2
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <Smartphone size={14} /> Page 2 (Financials)
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    {activePageTab === 1 ? (
                        <div className="space-y-4">
                            {/* Page 1 Rejection */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleReject(1)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
                                >
                                    <XCircle size={14} /> Reject Page 1
                                </button>
                            </div>

                            {/* Member Cards */}
                            {(page1Data?.table_data?.data_rows || []).map((row, rIdx) => (
                                <MemberCard
                                    key={rIdx}
                                    row={row}
                                    rIdx={rIdx}
                                    shgId={shgIdForPage1}
                                    onCellChange={handleMemberCellChange}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Page 2 Rejection */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleReject(2)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
                                >
                                    <XCircle size={14} /> Reject Page 2
                                </button>
                            </div>

                            {/* Page 2 Two Column View */}
                            <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
                                <Page2ColumnView
                                    tableData={page2Data?.table_data}
                                    onEdit={handlePage2CellEdit}
                                    relatedPage1Totals={page2Data?.relatedPage1Totals}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MemberCard = ({ row, rIdx, shgId, onCellChange }) => {
    const [showAddFieldMenu, setShowAddFieldMenu] = useState(false);

    // Get non-empty fields
    const mbkId = row.cells[0]?.text || '';
    const memberNameInput = row.cells[1]?.text || '';
    const hasName = memberNameInput.trim().length > 0;

    const visibleFields = row.cells.map((c, i) => ({ ...c, index: i }))
        .filter(c => c.index > 1 && c.text && c.text.trim() !== '');

    const allFieldOptions = SHG_COLUMN_HEADERS.filter(h => [9, 10, 11, 12, 13].includes(h.index));

    return (
        <div className="bg-white rounded-[32px] p-6 shadow-lg border border-gray-100 transition-all hover:shadow-2xl group">
            <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <User size={20} />
                    </div>
                    <div>
                        {hasName ? (
                            <h4 className="font-black text-gray-900 leading-tight">{memberNameInput}</h4>
                        ) : (
                            <h4 className="font-black text-gray-900 leading-tight uppercase tracking-tighter">Member {rIdx + 1}</h4>
                        )}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                            {shgId}{padMBKId(mbkId)}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-100 text-gray-500 rounded-full uppercase tracking-widest">
                        ROW {rIdx + 1}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {/* Specific field for MBK ID editing */}
                <div className="flex flex-col gap-1.5 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">సభ్యురాలి MBK ID</label>
                    <input
                        type="text"
                        value={mbkId}
                        onChange={(e) => onCellChange(rIdx, 0, e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none"
                    />
                </div>

                {/* Visible Data Fields */}
                {visibleFields.map((field) => (
                    <div key={field.index} className="flex flex-col gap-1.5 p-3 bg-gray-50/50 rounded-2xl border border-gray-100 relative">
                        <button
                            onClick={() => onCellChange(rIdx, field.index, '')}
                            className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pr-6">
                            {SHG_COLUMN_HEADERS[field.index]?.label}
                        </label>
                        <input
                            type="text"
                            value={field.text}
                            onChange={(e) => onCellChange(rIdx, field.index, e.target.value)}
                            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none"
                        />
                    </div>
                ))}

                {/* Add Field Button */}
                <div className="relative mt-2">
                    <button
                        onClick={() => setShowAddFieldMenu(!showAddFieldMenu)}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all font-bold text-xs"
                    >
                        <Plus size={16} /> Add Field
                    </button>

                    {showAddFieldMenu && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20 max-h-60 overflow-y-auto animate-in slide-in-from-bottom-2">
                            <div className="p-2 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white">
                                <span className="text-[10px] font-black uppercase text-gray-400 px-2">Select Field</span>
                                <button onClick={() => setShowAddFieldMenu(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={14} /></button>
                            </div>
                            {allFieldOptions.filter(h => !visibleFields.find(vf => vf.index === h.index)).map(option => (
                                <button
                                    key={option.index}
                                    onClick={() => {
                                        onCellChange(rIdx, option.index, ' ');
                                        setShowAddFieldMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-50 last:border-0"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Page2ColumnView = ({ tableData, onEdit, relatedPage1Totals }) => {
    const idMap = useMemo(() => {
        const map = {};
        (tableData?.data_rows || []).forEach(row => {
            (row.cells || []).forEach(cell => {
                if (cell.debug_id != null) map[cell.debug_id] = cell.text || '';
            });
        });
        return map;
    }, [tableData]);

    // User strictly requested only these 22 fields for Page 2 editing
    const EDITABLE_FIELDS = [
        { id: 17, label: "పొదుపులు (SN+VO+Other Saving)" },
        { id: 31, label: "రివాల్వింగ్ ఫండ్" },
        { id: 36, label: "ఆధార్ గ్రాంట్స్" },
        { id: 46, label: "VO నుండి తిరిగి వచ్చిన వాటాధనం" },
        { id: 51, label: "VO నుండి తిరిగి వచ్చిన పొదుపు" },
        { id: 56, label: "శ్రీనిధి నుండి తిరిగి వచ్చిన పొదుపు" },
        { id: 61, label: "బ్యాంకు నుండి తిరిగి వచ్చిన డిపాజిట్" },
        { id: 12, label: "సంఘం పెట్టుబడులు" },
        { id: 19, label: "VO లో కట్టిన వాటాధనం" },
        { id: 26, label: "VO లో కట్టిన పొదుపు" },
        { id: 33, label: "శ్రీనిధి లో కట్టిన పొదుపు" },
        { id: 38, label: "బ్యాంకు లో చేసిన డిపాజిట్" },
        { id: 48, label: "VO కు చెల్లించిన ప్రవేశ రుసుము/సభ్యత్వ రుసుము" },
        { id: 53, label: "VO కు చెల్లించిన జరిమానాలు" },
        { id: 58, label: "గౌరవవేతనం చెల్లింపు" },
        { id: 63, label: "ప్రయాణపు చార్జీల చెల్లింపు" },
        { id: 68, label: "ఇతర ఖర్చులు" },
        { id: 72, label: "స్టేషనరీ" },
        { id: 76, label: "ఆడిట్ ఫీజు" },
        { id: 80, label: "బ్యాంకు చార్జీలు" },
        { id: 87, label: "బ్యాంకు వడ్డీలు" },
        { id: 91, label: "డిపాజిట్ లపై వచ్చిన వడ్డీలు" },
    ];

    // Check which ones are READ ONLY due to Page 1 linking
    const readOnlyIds = relatedPage1Totals ? [89, 93, 97, 101, 105, 109] : [];

    return (
        <div className="divide-y divide-gray-50 flex flex-col h-full bg-white">
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
                <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest">Financial Data Correction</h4>
                    <p className="text-emerald-100 text-[9px] font-bold uppercase tracking-widest mt-0.5">Edit all financial entries below</p>
                </div>
                <Layout className="text-white/40" size={20} />
            </div>

            <div className="p-4 grid grid-cols-1 gap-1 flex-1 overflow-y-auto pb-10">
                {EDITABLE_FIELDS.map((field) => {
                    const isReadOnly = readOnlyIds.includes(field.id);
                    return (
                        <div key={field.id} className={`flex items-center gap-3 p-3 transition-colors rounded-xl ${isReadOnly ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                            <div className="flex-1 min-w-0">
                                <label className="text-[10px] sm:text-xs font-bold text-gray-700 line-clamp-2 leading-snug">
                                    {field.label}
                                </label>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] text-gray-400 font-black uppercase tracking-widest block">ID: {field.id}</span>
                                    {isReadOnly && (
                                        <span className="text-[7px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tight">Mirrored from Page 1</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-24 sm:w-32">
                                <input
                                    type="text"
                                    value={idMap[field.id] || ''}
                                    onChange={(e) => onEdit(field.id, e.target.value)}
                                    disabled={isReadOnly}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm font-black text-right outline-none shadow-sm transition-all ${isReadOnly
                                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-white border-gray-200 text-indigo-900 focus:border-indigo-500'
                                        }`}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Calculations Banner */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 mt-auto sticky bottom-0 z-10">
                <div className="flex items-center gap-3 text-amber-600 mb-4 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                    <AlertCircle size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest font-sans">Calculations are updated on save</span>
                </div>
            </div>
        </div>
    );
};

export default SHGConversionEditView;
