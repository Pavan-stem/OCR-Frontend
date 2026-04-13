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
  Layout,
  ArrowDownCircle,
  ArrowUpCircle
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

const normalizeMBKId = (id) => {
  if (!id) return '';
  // Remove non-digits
  let s = String(id).trim().replace(/\D/g, '');
  if (!s) return '';
  
  // Rule: if one digit add a zero in front
  if (s.length === 1) return `0${s}`;
  
  // Rule: zero in front should be removed if 3 digits
  // Rule: if it detected a big number with more than 2 digit make it show last two digits
  // Both result in taking last two digits if length >= 2
  if (s.length >= 2) return s.slice(-2);
  
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

const SHGConversionEditView = ({ shgGroup, onBack, onSaveSuccess, t }) => {
  const [activePageTab, setActivePageTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page1Data, setPage1Data] = useState(null);
  const [page2Data, setPage2Data] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null); // { pageNum: number }

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

        if (data1.success) {
          // Normalize MBK IDs in initial data (OCR might detect > 2 digits)
          const processedP1 = JSON.parse(JSON.stringify(data1.data));
          if (processedP1.table_data?.data_rows) {
            processedP1.table_data.data_rows.forEach(row => {
              if (row.cells && row.cells[0]) {
                row.cells[0].text = normalizeMBKId(row.cells[0].text);
              }
            });
          }
          setPage1Data(processedP1);
        }
        if (data2.success) {
          // Inject related_page1_totals into page2Data for the column view
          setPage2Data({
            ...data2.data,
            relatedPage1Totals: data2.related_page1_totals
          });
        }

        if (!data1.success || !data2.success) {
          setError(t?.('upload.errorLoading') || 'Failed to fetch some page data');
        }
      } catch (err) {
        console.error('Error fetching conversion edit data:', err);
        setError(t?.('conversion.networkError') || 'Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [shgGroup, t]);

  const duplicateMBKIds = useMemo(() => {
    const ids = (page1Data?.table_data?.data_rows || [])
      .map(row => row.cells[0]?.text?.trim())
      .filter(id => id && id !== '');

    const counts = {};
    ids.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });

    return Object.keys(counts).filter(id => counts[id] > 1);
  }, [page1Data]);

  const handleSave = async () => {
    if (saving) return;

    if (duplicateMBKIds.length > 0) {
      const errorMsg = t?.('conversion.duplicateMBKIdError');
      alert(errorMsg === 'conversion.duplicateMBKIdError' || !errorMsg 
        ? 'Duplicate MBK IDs detected! Please ensure all Member MBK IDs are unique before saving.' 
        : errorMsg);
      return;
    }

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
        onSaveSuccess?.();
      } else {
        alert(t?.('conversion.saveFailed') || 'Failed to save some changes');
      }
    } catch (err) {
      console.error('Error saving data:', err);
      alert(t?.('conversion.networkError') || 'Save failed due to network error');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberCellBlur = (rIdx, cIdx, val) => {
    if (cIdx === 0) { // MBK ID column
      const normalized = normalizeMBKId(val);
      if (normalized !== val) {
        handleMemberCellChange(rIdx, cIdx, normalized);
      }
    }
  };

  const handleRejectExecute = async (pageNum) => {
    const item = shgGroup.pages[pageNum];
    setConfirmReject(null);

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
        onSaveSuccess?.(); // Refresh list and go back
      } else {
        alert(data.message || t?.('common.error') || 'Failed to reject');
      }
    } catch (err) {
      console.error('Error rejecting:', err);
      alert(t?.('conversion.rejectError') || 'Error rejecting item');
    }
  };

  // Page 1 Handlers
  const handleMemberCellChange = (rIdx, cIdx, val) => {
    const newData = { ...page1Data };
    let finalVal = val;
    if (cIdx === 0) {
      // For MBK ID, only allow digits and max 2
      finalVal = val.replace(/\D/g, '').slice(0, 2);
    }
    newData.table_data.data_rows[rIdx].cells[cIdx].text = finalVal;
    setPage1Data(newData);
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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-black uppercase tracking-widest text-xs opacity-80">{t?.('conversion.loading') || 'Loading SHG Details...'}</p>
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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 -m-4 sm:-m-8 p-2 sm:p-8 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full pb-24">
        {/* Header Area */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-2xl border border-white/20 sticky top-0 z-[100]">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <button onClick={onBack} className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-xl sm:rounded-2xl transition-all border border-white/10">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="text-center flex-1 min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-white leading-tight truncate px-2">{shgGroup.shgName}</h2>
              <span className="text-[8px] sm:text-[10px] font-black tracking-wider sm:tracking-widest text-indigo-200 uppercase block mt-0.5">{shgIdForPage1}</span>
              <div className="flex items-center justify-center gap-1.5 mt-2 bg-emerald-500/20 py-1 px-3 rounded-full border border-emerald-500/30 w-fit mx-auto backdrop-blur-sm">
                <CheckCircle size={10} className="text-emerald-400" />
                <span className="text-[8px] font-black text-emerald-200 uppercase tracking-tighter">
                  {t?.('conversion.bothPagesVerified') || 'Both Pages Verified & Ready'}
                </span>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-2 sm:p-3 bg-white text-indigo-600 rounded-xl sm:rounded-2xl shadow-xl hover:bg-indigo-50 transition-all font-black disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            </button>
          </div>

          {/* Compact Page Tabs */}
          <div className="flex bg-black/10 p-1.5 rounded-2xl gap-2 border border-white/10">
            <button
              onClick={() => setActivePageTab(1)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all ${activePageTab === 1
                ? 'bg-white text-indigo-600 shadow-md scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <Layout size={14} /> {t?.('conversion.page1Tab') || 'Page 1 (Members)'}
            </button>
            <button
              onClick={() => setActivePageTab(2)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all ${activePageTab === 2
                ? 'bg-white text-emerald-600 shadow-md scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <Smartphone size={14} /> {t?.('conversion.page2Tab') || 'Page 2 (Financials)'}
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
                  onClick={() => setConfirmReject({ pageNum: 1 })}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all border border-white/10 shadow-lg"
                >
                  <XCircle size={16} /> {t?.('conversion.rejectPage', { page: 1 }) || 'Reject Page 1'}
                </button>
              </div>

              {/* Member Cards */}
              {(page1Data?.table_data?.data_rows || [])
                .filter(row => row.cells?.some(c => c.text && c.text.trim() !== ''))
                .map((row, rIdx) => (
                  <MemberCard
                    key={rIdx}
                    row={row}
                    rIdx={rIdx}
                    shgId={shgIdForPage1}
                    onCellChange={handleMemberCellChange}
                    onCellBlur={handleMemberCellBlur}
                    isDuplicate={duplicateMBKIds.includes(row.cells[0]?.text?.trim())}
                    t={t}
                  />
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Page 2 Rejection */}
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmReject({ pageNum: 2 })}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all border border-white/10 shadow-lg"
                >
                  <XCircle size={16} /> {t?.('conversion.rejectPage', { page: 2 }) || 'Reject Page 2'}
                </button>
              </div>

              {/* Page 2 Grouped List View */}
              <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
                <Page2GroupedView
                  tableData={page2Data?.table_data}
                  onEdit={handlePage2CellEdit}
                  relatedPage1Totals={page2Data?.relatedPage1Totals}
                  t={t}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Reject Confirmation Modal */}
      {confirmReject && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setConfirmReject(null)} />
          <div className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <XCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">
              {t?.('common.areYouSure') || 'Are you sure?'}
            </h3>
            <p className="text-gray-500 text-center text-sm font-bold mb-8 leading-relaxed">
              {t?.('conversion.rejectConfirm', { page: confirmReject.pageNum }) || `Are you sure you want to reject Page ${confirmReject.pageNum}? It will be sent back to the VO for re-upload.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReject(null)}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
              >
                {t?.('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => handleRejectExecute(confirmReject.pageNum)}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
              >
                {t?.('common.confirm') || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MemberCard = ({ row, rIdx, shgId, onCellChange, onCellBlur, isDuplicate, t }) => {
  const [visibleIndices, setVisibleIndices] = useState([]);

  // Initialize visibleIndices based on existing text data
  useEffect(() => {
    if (row.cells) {
      const initialVisible = row.cells
        .map((c, i) => ({ text: c.text, index: i }))
        .filter(c => c.index > 1 && c.text && c.text.trim() !== '')
        .map(c => c.index);

      setVisibleIndices(prev => {
        const combined = new Set([...prev, ...initialVisible]);
        return Array.from(combined);
      });
    }
  }, [row.cells]);

  const mbkId = row.cells[0]?.text || '';
  const memberNameInput = row.cells[1]?.text || '';
  const hasName = memberNameInput.trim().length > 0;

  const visibleFields = row.cells.map((c, i) => ({ ...c, index: i }))
    .filter(c => c.index > 1 && visibleIndices.includes(c.index));

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-2xl border border-white/20 transition-all hover:scale-[1.01] hover:shadow-cyan-500/10 group">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl transition-colors ${isDuplicate ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
            <User size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {hasName ? (
                <h4 className="font-black text-gray-900 leading-tight">{memberNameInput}</h4>
              ) : (
                <h4 className="font-black text-gray-900 leading-tight uppercase tracking-tighter">
                  {t?.('upload.member') || 'Member'} {rIdx + 1}
                </h4>
              )}
              {isDuplicate && (
                <div className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-red-200">
                  <AlertCircle size={10} />
                  Duplicate ID
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
              {shgId}{padMBKId(mbkId)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black px-3 py-1 bg-gray-100 text-gray-500 rounded-full uppercase tracking-widest">
            {t?.('upload.row') || 'ROW'} {rIdx + 1}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {/* Specific field for MBK ID editing */}
        <div className={`flex flex-col gap-1 p-2 rounded-2xl border transition-all ${isDuplicate ? 'bg-red-50 border-red-200 shadow-lg shadow-red-100' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
          <label className={`text-[10px] font-black uppercase tracking-tight ${isDuplicate ? 'text-red-500' : 'text-indigo-400'}`}>
            {SHG_COLUMN_HEADERS[0]?.label}
          </label>
          <input
            type="text"
            value={mbkId}
            maxLength={2}
            onChange={(e) => onCellChange(rIdx, 0, e.target.value)}
            onBlur={(e) => onCellBlur(rIdx, 0, e.target.value)}
            className={`bg-white border rounded-xl px-2 py-1.5 text-xs font-bold transition-all outline-none w-full ${isDuplicate ? 'border-red-300 text-red-700' : 'border-gray-200 text-gray-700 focus:border-indigo-500'}`}
          />
        </div>

        {/* Visible Data Fields */}
        {visibleFields.map((field) => (
          <div key={field.index} className="flex flex-col gap-1 p-2 bg-gray-50/50 rounded-2xl border border-gray-100 relative min-h-[64px]">
            <div className="flex justify-between items-start gap-1">
              <label className="text-[10px] font-black text-gray-500 leading-tight pr-4">
                {SHG_COLUMN_HEADERS[field.index]?.label}
              </label>
              <button
                onClick={() => {
                  onCellChange(rIdx, field.index, '');
                  setVisibleIndices(prev => prev.filter(idx => idx !== field.index));
                }}
                className="p-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <input
              type="text"
              value={field.text}
              onChange={(e) => onCellChange(rIdx, field.index, e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-700 focus:border-indigo-500 outline-none mt-auto w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const Page2GroupedView = ({ tableData, onEdit, relatedPage1Totals, t }) => {
  const idMap = useMemo(() => {
    const map = {};
    (tableData?.data_rows || []).forEach(row => {
      (row.cells || []).forEach(cell => {
        if (cell.debug_id != null) map[cell.debug_id] = cell.text || '';
      });
    });
    return map;
  }, [tableData]);

  const readOnlyIds = relatedPage1Totals ? [89, 93, 97, 101, 105, 109] : [];

  const COLUMN_SECTIONS = [
    {
      title: "సంఘానికి వచ్చిన వివరములు",
      color: "from-indigo-600 to-indigo-700",
      icon: <ArrowDownCircle className="text-white/40" size={24} />,
      categories: [
        {
          title: "సంఘానికి వచ్చిన పొదుపు మొత్తం",
          fields: [{ id: 17, label: "పొదుపులు (SN+VO+Other Saving)" }]
        },
        {
          title: "సంఘానికి వచ్చిన ఫండ్స్",
          fields: [
            { id: 31, label: "రివాల్వింగ్ ఫండ్" },
            { id: 36, label: "ఆధార్ గ్రాంట్స్" }
          ]
        },
        {
          title: "సంఘానికి తిరిగి వచ్చినవి",
          fields: [
            { id: 61, label: "బ్యాంకు నుండి తిరిగి వచ్చిన డిపాజిట్" },
            { id: 56, label: "శ్రీనిధి నుండి తిరిగి వచ్చిన పొదుపు" },
            { id: 51, label: "VO నుండి తిరిగి వచ్చిన పొదుపు" }
          ]
        },
        {
          title: "సంఘానికి వచ్చిన ఆదాయాలు",
          fields: [
            { id: 91, label: "డిపాజిట్ లపై వచ్చిన వడ్డీలు" },
            { id: 87, label: "బ్యాంకు వడ్డీలు" }
          ]
        }
      ]
    },
    {
      title: "సంఘం చెల్లించిన వివరములు",
      color: "from-indigo-600 to-indigo-700",
      icon: <ArrowUpCircle className="text-white/40" size={24} />,
      categories: [
        {
          title: "సంఘం పెట్టుబడులు",
          fields: [
            { id: 19, label: "VO లో కట్టిన వాటాధనం" },
            { id: 26, label: "VO లో కట్టిన పొదుపు" },
            { id: 33, label: "శ్రీనిధి లో కట్టిన పొదుపు" }
          ]
        },
        {
          title: "సంఘం ఖర్చులు",
          fields: [
            { id: 38, label: "బ్యాంకు లో చేసిన డిపాజిట్" },
            { id: 48, label: "VO కు చెల్లించిన ప్రవేశ రుసుము/సభ్యత్వ రుసుము" },
            { id: 53, label: "VO కు చెల్లించిన జరిమానాలు" },
            { id: 58, label: "గౌరవవేతనం చెల్లింపు" },
            { id: 63, label: "ప్రయాణపు చార్జీల చెల్లింపు" },
            { id: 68, label: "ఇతర ఖర్చులు" },
            { id: 72, label: "స్టేషనరీ" },
            { id: 76, label: "ఆడిట్ ఫీజు" },
            { id: 80, label: "బ్యాంకు చార్జీలు" }
          ]
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Area */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex items-center justify-between shadow-lg">
        <div>
          <h4 className="text-white font-black text-xs uppercase tracking-widest leading-tight">
            {t?.('conversion.financialHeader') || 'ఆర్ధిక డేటా సవరణ'}
          </h4>
          <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-90 leading-tight">
            {t?.('conversion.financialSubheader') || 'క్రింద ఉన్న అన్ని ఆర్థిక వివరాలను సవరించండి'}
          </p>
        </div>
        <Layout className="text-white/40 hidden sm:block" size={24} />
      </div>

      <div className="flex-1 overflow-y-auto pb-10 sm:max-h-[75vh]">
        {COLUMN_SECTIONS.map((section, sIdx) => {
          const sectionDetectedFieldsCount = section.categories.reduce((acc, cat) => {
             return acc + cat.fields.filter(f => idMap[f.id] && idMap[f.id].toString().trim() !== '').length;
          }, 0);

          if (sectionDetectedFieldsCount === 0) return null;

          return (
            <div key={sIdx} className="mb-6">
              {/* Column Title */}
              <div className={`bg-gradient-to-r ${section.color} px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md`}>
                <h5 className="text-white font-black text-[11px] uppercase tracking-wider">
                  {section.title}
                </h5>
                {section.icon}
              </div>

              <div className="p-4 space-y-6">
                {section.categories.map((cat, cIdx) => {
                  const detectedFields = cat.fields.filter(f => idMap[f.id] && idMap[f.id].toString().trim() !== '');
                  if (detectedFields.length === 0) return null;

                  return (
                    <div key={cIdx} className="space-y-3">
                      {/* Section Title (Orange) */}
                      <h6 className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-3 py-1 bg-orange-50 w-fit rounded-lg border border-orange-200 shadow-sm ml-1">
                        {cat.title}
                      </h6>
                      
                      {/* Fields in List */}
                      <div className="space-y-2 px-1">
                        {detectedFields.map((field) => {
                          const isReadOnly = readOnlyIds.includes(field.id);
                          return (
                            <div key={field.id} className={`flex items-center gap-3 p-4 transition-all rounded-2xl bg-white border border-gray-100 shadow-sm ${isReadOnly ? 'opacity-80' : 'hover:border-indigo-200 hover:shadow-md'}`}>
                              <div className="flex-1 min-w-0">
                                <label className="text-xs font-bold text-gray-700 line-clamp-2 leading-tight">
                                  {field.label}
                                </label>
                              </div>
                              <div className="w-32">
                                <input
                                  type="text"
                                  value={idMap[field.id] || ''}
                                  onChange={(e) => onEdit(field.id, e.target.value)}
                                  disabled={isReadOnly}
                                  className={`w-full border rounded-xl px-4 py-2 text-sm font-black text-right outline-none transition-all ${isReadOnly
                                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-white border-gray-200 text-indigo-900 focus:border-indigo-500 shadow-sm focus:shadow-indigo-100'
                                    }`}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SHGConversionEditView;
