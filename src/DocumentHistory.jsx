import { API_BASE } from './utils/apiConfig';
import React, { useEffect, useState } from 'react';
import { X, FileText, Eye, Filter } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

export default function DocumentHistory({ onClose }) {
  const { t } = useLanguage();
  const [uploads, setUploads] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadUploads();
  }, []);

  async function loadUploads() {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE}/api/uploads`;

      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        setUploads(Array.isArray(data.files) ? data.files : Array.isArray(data) ? data : []);
        return;
      }
    } catch (e) {
      console.error('API fetch failed:', e);
    }

    setUploads([]);
  }

  // Client-side filtering based on selected month and year
  const filteredUploads = uploads.filter(upload => {
    const uploadDate = new Date(upload.date || upload.uploadTimestamp);

    // If date is invalid, exclude it
    if (isNaN(uploadDate.getTime())) return false;

    const uploadMonth = String(uploadDate.getMonth() + 1).padStart(2, '0');
    const uploadYear = String(uploadDate.getFullYear());

    // Apply month filter if selected
    if (selectedMonth && uploadMonth !== selectedMonth) return false;

    // Apply year filter if selected
    if (selectedYear && uploadYear !== selectedYear) return false;

    return true;
  });

  async function viewDocument(upload) {
    setImageError(false);
    // Normalize URL into a single field for convenience
    const url = upload.url || upload.s3Url || upload.metadata?.s3Url || upload.metadata?.url || upload.url;

    // If no direct URL (private S3 object), attempt to fetch a presigned URL from backend
    if (!url && upload._id) {
      try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`${API_BASE}/api/uploads/${upload._id}/presign`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.url) {
            setSelectedDocument({ ...upload, url: data.url });
            return;
          }
        }
      } catch (e) {
        console.error('Presign fetch failed', e);
      }
    }

    setSelectedDocument({ ...upload, url });
  }

  return (
    <>
      {/* DESKTOP VIEW - Original Design */}
      <div className="hidden sm:flex fixed inset-0 z-40 items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0 z-20">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold truncate">
                {t('documentHistory.title')}
              </h2>
              <p className="text-blue-100 text-sm mt-1 truncate">
                {t('documentHistory.subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* FILTERS */}
          <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white z-10">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-slate-200 rounded-lg p-4">
              <div className="flex flex-wrap gap-4">

                {/* Month */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('upload.month')}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">{t('documentHistory.allTimeMonths')}</option>
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                      <option key={m} value={m}>
                        {t(`months.${[
                          'january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'
                        ][i]}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('upload.year')}
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">{t('documentHistory.allTimeYears')}</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>

                {/* Count */}
                <div className="flex-1 min-w-[180px] flex items-end">
                  <div className="w-full px-4 py-2 bg-blue-100 border-2 border-blue-300 rounded-lg text-center font-semibold text-blue-900">
                    {t('documentHistory.showing')} {filteredUploads.length}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* TABLE SCROLL AREA */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm border-collapse">

              {/* STICKY HEADER */}
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase border-b">
                    {t('documentHistory.document')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase border-b">
                    {t('documentHistory.date')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase border-b">
                    {t('documentHistory.action')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredUploads.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      {t('documentHistory.noDocuments')}
                    </td>
                  </tr>
                )}

                {filteredUploads.map((u, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">

                    {/* DOCUMENT */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex gap-2">
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                        <div className="min-w-0">
                          <div
                            className="font-medium text-slate-900 truncate"
                            title={u.shgName || u.metadata?.shgName}
                          >
                            {u.shgName || u.metadata?.shgName || 'Unknown SHG'}
                            {(u.shgID || u.metadata?.shgID) && (
                              <span className="ml-1 text-slate-600">
                                ({u.shgID || u.metadata?.shgID})
                              </span>
                            )}
                          </div>

                          <div
                            className="text-xs text-gray-500 truncate mt-0.5"
                            title={u.filename || u.originalFilename || u.metadata?.originalFilename}
                          >
                            {u.filename ||
                              u.originalFilename ||
                              u.metadata?.originalFilename ||
                              'unknown'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* DATE */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {u.date || u.uploadTimestamp
                        ? new Date(u.date || u.uploadTimestamp).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                        : 'N/A'}
                    </td>

                    {/* ACTION */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => viewDocument(u)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
                      >
                        <Eye className="w-3 h-3" />
                        {t('documentHistory.action')}
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="border-t border-slate-200 px-4 py-4 flex justify-end flex-shrink-0 bg-white z-20">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded"
            >
              {t('common.close')}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE VIEW - Popup Style */}
      <div className="sm:hidden fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 flex justify-between items-center flex-shrink-0 z-20">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold truncate">
                {t('documentHistory.title')}
              </h2>
              <p className="text-blue-100 text-sm mt-1 truncate">
                {t('documentHistory.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Toggle filters"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* FILTERS - Toggleable on Mobile */}
          {showFilters && (
            <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white z-10">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-slate-200 rounded-lg p-4">
                <div className="space-y-4">

                  {/* Month */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {t('upload.month')}
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">{t('documentHistory.allTimeMonths')}</option>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                        <option key={m} value={m}>
                          {t(`months.${[
                            'january', 'february', 'march', 'april', 'may', 'june',
                            'july', 'august', 'september', 'october', 'november', 'december'
                          ][i]}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {t('upload.year')}
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">{t('documentHistory.allTimeYears')}</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>

                  {/* Count */}
                  <div className="px-4 py-2 bg-blue-100 border-2 border-blue-300 rounded-lg text-center font-semibold text-blue-900">
                    {t('documentHistory.showing')} {filteredUploads.length}
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* CARD LIST SCROLL AREA - Mobile */}
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-200">
              {filteredUploads.length === 0 && (
                <div className="px-4 py-10 text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">{t('documentHistory.noDocuments')}</p>
                </div>
              )}

              {filteredUploads.map((u, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm mb-0.5 break-words">
                        {u.shgName || u.metadata?.shgName || 'Unknown SHG'}
                        {(u.shgID || u.metadata?.shgID) && (
                          <span className="ml-1 text-slate-600 font-normal">
                            ({u.shgID || u.metadata?.shgID})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 break-words">
                        {u.filename ||
                          u.originalFilename ||
                          u.metadata?.originalFilename ||
                          'unknown'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pl-8">
                    <div className="text-xs text-slate-600">
                      {u.date || u.uploadTimestamp
                        ? new Date(u.date || u.uploadTimestamp).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })
                        : 'N/A'}
                    </div>
                    <button
                      onClick={() => viewDocument(u)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t('documentHistory.action')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-slate-200 px-4 py-4 flex justify-end flex-shrink-0 bg-white z-20">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded"
            >
              {t('common.close')}
            </button>
          </div>

        </div>
      </div>

      {/* DOCUMENT PREVIEW MODAL - Works for both Desktop & Mobile */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold truncate">
                  {selectedDocument.shgName || selectedDocument.metadata?.shgName} <span className="ml-1 text-white">({selectedDocument.shgID || selectedDocument.metadata?.shgID})</span>
                </h3>
                <p className="text-xs text-blue-100 truncate">
                  {selectedDocument.filename ||
                    selectedDocument.originalFilename ||
                    selectedDocument.metadata?.originalFilename}
                </p>
              </div>
              <button
                onClick={() => setSelectedDocument(null)}
                className="p-2 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 p-4">
              <img
                src={selectedDocument.url}
                alt="Document"
                className="max-w-full mx-auto border rounded shadow"
              />
            </div>

            <div className="border-t px-4 py-3 flex justify-end">
              <button
                onClick={() => setSelectedDocument(null)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}