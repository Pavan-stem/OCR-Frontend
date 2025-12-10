import { API_BASE } from './utils/apiConfig';
import React, { useEffect, useState } from 'react';
import { X, FileText, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';

export default function DocumentHistory({ onClose }) {
  const [uploads, setUploads] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadUploads();
  }, []);

  async function loadUploads() {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/uploads`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        setUploads(Array.isArray(data.files) ? data.files : Array.isArray(data) ? data : []);
        return;
      }
    } catch (e) {
      console.error('API fetch failed, trying localStorage:', e);
    }

    try {
      const raw = localStorage.getItem('ocr_results_v1');
      const failed = localStorage.getItem('ocr_failed_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      const parsedFailed = failed ? JSON.parse(failed) : [];
      const merged = [];
      parsed.forEach((r) => merged.push({ 
        filename: r.filename || r.file || 'unknown', 
        date: r.date || r.uploaded_at || r.created_at || new Date().toISOString(),
        status: 'success'
      }));
      parsedFailed.forEach((r) => merged.push({ 
        filename: r.filename || r.file || 'unknown', 
        date: r.date || r.uploaded_at || r.created_at || new Date().toISOString(), 
        status: 'failed' 
      }));
      setUploads(merged);
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }

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

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-700" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-700" />;
    return <Clock className="w-4 h-4 text-amber-700" />;
  };

  const getStatusBadge = (status) => {
    if (status === 'success') return 'bg-green-100 text-green-800 border-green-300';
    if (status === 'failed') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-auto min-h-screen">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Document Upload History</h2>
              <p className="text-blue-100 text-sm mt-1">View and manage your uploaded documents</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                      Document
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {uploads.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                        <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>No documents uploaded yet</p>
                      </td>
                    </tr>
                  )}
                  {uploads.map((u, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-slate-900">{u.filename || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.date ? new Date(u.date).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusBadge(u.status || 'pending')}`}>
                          {getStatusIcon(u.status || 'pending')}
                          {u.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => viewDocument(u)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Viewer Modal */}
          {selectedDocument && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
              <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-bold">{selectedDocument.filename || 'Document'}</h3>
                    <p className="text-blue-100 text-sm">
                      {selectedDocument.date ? new Date(selectedDocument.date).toLocaleDateString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedDocument(null)} 
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-slate-50 p-4">
                  {selectedDocument.url ? (
                    <>
                      {imageError ? (
                        <div className="text-center text-slate-500 py-8">
                          <p>Unable to load image</p>
                        </div>
                      ) : (
                        <div className="flex items-start justify-center min-h-full">
                          <img 
                            src={selectedDocument.url} 
                            alt={selectedDocument.filename}
                            onError={() => setImageError(true)}
                            className="max-w-full h-auto border border-slate-300 rounded shadow-lg"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-8">
                      <p>No image URL available</p>
                    </div>
                  )}
                </div>
                <div className="bg-slate-100 px-6 py-3 flex justify-end flex-shrink-0">
                  <button 
                    onClick={() => setSelectedDocument(null)}
                    className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
            <button 
              onClick={onClose} 
              className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
