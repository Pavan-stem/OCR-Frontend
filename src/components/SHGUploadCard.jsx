import React, { useRef, useState } from 'react';
import {
  Upload, CheckCircle, X, FileText, AlertCircle,
  Eye, ScanLine, AlertTriangle, ChevronLeft, ChevronRight,
  RefreshCw, Lock
} from 'lucide-react';

// ─── Helper: determine per-page server status from historyUploads & rejectionInfo ──
// Returns { page: 1|2, status: 'accepted'|'rejected'|'pending' } for each page
function computePageStatuses(historyUploads = [], rejectionInfo = null) {
  const statuses = { 1: 'pending', 2: 'pending' };

  // historyUploads are server-persisted docs for this SHG/month.
  // Each doc has: page (or metadata.page), status ('validated'|'accepted'|'rejected'|'pending' etc.)
  historyUploads.forEach(doc => {
    const pg = parseInt(doc.page || doc.metadata?.page || 0);
    if (!pg) return;
    const s = (doc.status || '').toLowerCase();
    if (s === 'rejected') {
      statuses[pg] = 'rejected';
    } else if (['validated', 'accepted', 'pending'].includes(s)) {
      // "pending" = uploaded but not yet reviewed → treat as accepted for display
      if (statuses[pg] !== 'rejected') statuses[pg] = 'accepted';
    }
  });

  // Legacy: if rejectionInfo exists and no page info, treat both as rejected
  if (rejectionInfo && historyUploads.length === 0) {
    statuses[1] = 'rejected';
    statuses[2] = 'rejected';
  }

  return statuses;
}

// Translation labels will be handled inside the component using the 't' function.

const SHGUploadCard = ({
  shg,
  filesData = {},
  isPermanentlyUploaded,
  rejectionInfo,
  analyzingState = {}, // { page1: bool, page2: bool }
  currentlyViewingId,
  isMobileDevice,
  isUploading,
  t,
  formatBytes,
  page1Validated,
  page2Validated,
  onOpenCamera,
  onFileSelect,
  onValidateFile,
  onViewFile,
  onRemoveFile,
  onUploadSingleShg,
  onViewPermanentlyUploadedFile,
  historyUploads = [],
  selectedMonth,
  selectedYear,
  isAfterFeb2026,
  pageSyncStatus = { 1: false, 2: false },
}) => {
  const fileInputRefs = useRef({ page1: null, page2: null });
  const nativeCameraInputRefs = useRef({ page1: null, page2: null });
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // ── Per-page server status ────────────────────────────────────────────
  const pageStatuses = computePageStatuses(historyUploads, rejectionInfo);
  const p1Status = pageStatuses[1]; // 'accepted' | 'rejected' | 'pending'
  const p2Status = pageStatuses[2];

  // A page is "accepted" (locked) on the server — cannot be replaced
  const p1AcceptedOnServer = p1Status === 'accepted';
  const p2AcceptedOnServer = p2Status === 'accepted';

  // A page is "rejected" — must be re-uploaded
  const p1Rejected = p1Status === 'rejected';
  const p2Rejected = p2Status === 'rejected';

  // ── Completion Logic ───────────────────────────────────────────────
  const isPartialUpload = (p1AcceptedOnServer || p2AcceptedOnServer) && (p1Rejected || p2Rejected);
  const isFullyAccepted = isPermanentlyUploaded && !p1Rejected && !p2Rejected;

  const canSubmitFull = !isPartialUpload && (
    // Allow if BOTH are validated, OR if at least one is validated and we're not strictly blocking
    (page1Validated || p1AcceptedOnServer) && (page2Validated || p2AcceptedOnServer)
  );

  // If not strictly blocking, we can allow submission if at least one local page is validated
  const canSubmitAny = (filesData.page1 && page1Validated) || (filesData.page2 && page2Validated);

  const canSubmitPartial = isPartialUpload && (
    (p1Rejected && page1Validated && filesData.page1) ||
    (p2Rejected && page2Validated && filesData.page2)
  );

  // We'll use canSubmitAny for the button state if the user doesn't want hard blocking
  const canSubmit = isPartialUpload ? canSubmitPartial : canSubmitAny;

  // ── Completion States ───────────────────────────────────────────────
  const hasFiles = !!filesData.page1 || !!filesData.page2;
  const hasAnyAccepted = p1AcceptedOnServer || p2AcceptedOnServer;
  const isReadyToSubmit = (canSubmitFull || canSubmitPartial);

  const isPending = !hasFiles && !hasAnyAccepted && !p1Rejected && !p2Rejected;
  const isFullyRejected = (p1Rejected && p2Rejected) && !hasFiles;
  const isHalfPending = !isReadyToSubmit && !isFullyAccepted && !isPartialUpload && !isFullyRejected && (hasFiles || hasAnyAccepted);

  // ── Detailed Alert Logic ───────────────────────────────────────────
  const getStatusMessage = () => {
    if (isPartialUpload) {
      const p1Needs = p1Rejected && (!filesData.page1 || !page1Validated);
      const p2Needs = p2Rejected && (!filesData.page2 || !page2Validated);
      if (p1Needs && p2Needs) return t?.('upload.page1And2NeedReupload') || "Page 1 & 2 need to be re-uploaded and validated.";
      if (p1Needs) return t?.('upload.page1NeedsReupload') || "Page 1 needs to be re-uploaded and validated.";
      if (p2Needs) return t?.('upload.page2NeedsReupload') || "Page 2 needs to be re-uploaded and validated.";
      return t?.('upload.reuploadValidationNote') || "Validate the re-uploaded page before submitting.";
    }

    if (isAfterFeb2026) {
      const hasP1 = p1AcceptedOnServer || (filesData.page1 && page1Validated);
      const hasP2 = p2AcceptedOnServer || (filesData.page2 && page2Validated);

      const p1Missing = !p1AcceptedOnServer && !filesData.page1;
      const p2Missing = !p2AcceptedOnServer && !filesData.page2;
      const p1NotValidated = filesData.page1 && !page1Validated;
      const p2NotValidated = filesData.page2 && !page2Validated;

      if (p1Missing && p2Missing) return t?.('upload.page1And2Missing') || "Page 1 & Page 2 are missing.";
      if (p1Missing && p2NotValidated) return t?.('upload.page1MissingPage2NeedsValidation') || "Page 1 missing, Page 2 needs validation.";
      if (p2Missing && p1NotValidated) return t?.('upload.page2MissingPage1NeedsValidation') || "Page 2 missing, Page 1 needs validation.";
      if (p1Missing) return t?.('upload.page1Missing') || "Page 1 is missing.";
      if (p2Missing) return t?.('upload.page2Missing') || "Page 2 is missing.";
      if (p1NotValidated && p2NotValidated) return t?.('upload.bothPagesNeedValidation') || "Both pages need validation.";
      if (p1NotValidated) return t?.('upload.page1NeedsValidation') || "Page 1 needs validation.";
      if (p2NotValidated) return t?.('upload.page2NeedsValidation') || "Page 2 needs validation.";
    }

    return t?.('upload.dualValidationRequired') || 'Both documents must be validated before uploading.';
  };

  // ── Visual Theme Configuration ──────────────────────────────────────
  const headerAccent = isFullyAccepted
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
    : isReadyToSubmit
      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
      : isPartialUpload
        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
        : isFullyRejected
          ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white'
          : isHalfPending
            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white'
            : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-b border-slate-300';

  const cardBorderClass = isFullyAccepted
    ? 'border-blue-400 bg-white backdrop-blur-md shadow-xl shadow-blue-500/10'
    : isReadyToSubmit
      ? 'border-emerald-400 bg-white backdrop-blur-md shadow-xl shadow-emerald-500/10'
      : isPartialUpload
        ? 'border-amber-400 bg-white backdrop-blur-md shadow-lg shadow-amber-500/10'
        : isFullyRejected
          ? 'border-rose-400 bg-white backdrop-blur-md shadow-lg shadow-rose-500/10'
          : isHalfPending
            ? 'border-indigo-400 bg-white backdrop-blur-md shadow-lg shadow-indigo-500/10'
            : 'border-slate-200 hover:border-indigo-400 bg-white shadow-md hover:shadow-xl';

  const idBadgeClass = isPending
    ? 'text-slate-600 font-bold bg-slate-100 border border-slate-200'
    : isHalfPending || isReadyToSubmit || isFullyAccepted || isPartialUpload || isFullyRejected
      ? 'text-white/80 font-black px-2 py-0.5 rounded-md bg-black/10'
      : 'text-gray-500 font-mono';

  // ── Per-page upload slot ─────────────────────────────────────────────
  const renderDocumentSlot = (pageKey, pageTitle) => {
    const pageNum = pageKey === 'page1' ? 1 : 2;
    const isAcceptedOnServer = pageKey === 'page1' ? p1AcceptedOnServer : p2AcceptedOnServer;
    const isRejectedOnServer = pageKey === 'page1' ? p1Rejected : p2Rejected;
    const isPageValidated = pageKey === 'page1' ? page1Validated : page2Validated;
    const fileData = filesData[pageKey];
    const isAnalyzing = analyzingState[pageKey];
    const isViewingPermanent = currentlyViewingId === `${shg.shgId}-${pageNum}`;

    // ── ACCEPTED (locked) server page ─────────────────────────────────
    if (isAcceptedOnServer && !isRejectedOnServer) {
      // Find the matching server doc for this page
      const serverDoc = historyUploads.find(doc => {
        const pg = parseInt(doc.page || doc.metadata?.page || 0);
        return pg === pageNum;
      });

      return (
        <div className="p-3 rounded-xl border-2 border-blue-300 bg-blue-50/40 flex flex-col h-full shadow-sm">
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex flex-wrap gap-2">
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 flex items-center gap-1 border border-blue-200">
                <CheckCircle size={10} /> {t?.('upload.validated') || 'Accepted'}
              </span>
            </div>
            <span className="font-bold text-sm text-blue-800 leading-tight">{pageTitle}</span>
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-blue-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700/70 bg-blue-100/30 px-2 py-1 rounded-md">
                <Lock size={12} strokeWidth={2.5} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Secure</span>
              </div>
              <span className="text-[10px] text-blue-600 font-bold">{t?.('upload.documentUploaded') || 'Success'}</span>
            </div>
            <button
              onClick={() => {
                const pg = serverDoc?.page || serverDoc?.metadata?.page || pageNum;
                onViewPermanentlyUploadedFile(shg.shgId, pg);
              }}
              disabled={isViewingPermanent}
              className="flex items-center justify-center gap-1.5 w-full px-2 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-xs transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              {isViewingPermanent
                ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                : <Eye size={14} />}
              {t?.('upload.viewDocument') || 'View Document'}
            </button>
          </div>
        </div>
      );
    }

    // ── REJECTED server page → show re-upload slot ────────────────────
    const rejectionLabel = isRejectedOnServer && !fileData ? (
      <div className="mb-3 bg-white rounded-lg p-2 border border-rose-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-rose-50 p-1 rounded-md">
            <AlertCircle size={10} className="text-rose-600" />
          </div>
          <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest leading-none">
            {t?.('upload.pageRejected', { page: pageNum }) || `Page ${pageNum} Rejected`}
          </p>
        </div>
        <p className="text-[10px] text-gray-500 leading-tight pl-1 italic">
          "{rejectionInfo?.rejectionReason || 'Document criteria not met.'}"
        </p>
      </div>
    ) : null;

    // ── Normal (pending) or re-upload slot ────────────────────────────
    return (
      <div className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col h-full ${fileData
        ? fileData.validated ? 'border-green-400 bg-green-50/40 shadow-sm shadow-green-100' : 'border-amber-400 bg-amber-50/40 shadow-sm shadow-amber-100'
        : isRejectedOnServer ? 'border-rose-200 bg-rose-50/40' : 'border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100/50'
        }`}>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex flex-wrap gap-2">
            {isRejectedOnServer && !fileData && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 uppercase tracking-tighter flex items-center gap-1 border border-rose-200">
                <X size={10} strokeWidth={3} /> {t?.('upload.reupload') || 'RE-UPLOAD'}
              </span>
            )}
            {fileData && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${fileData.validated ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                {fileData.validated ? t?.('upload.validated') || 'Validated' : 'Pending'}
              </span>
            )}
          </div>
          <span className={`font-bold text-sm leading-tight ${isRejectedOnServer ? 'text-rose-800' : 'text-gray-700'}`}>{pageTitle}</span>
        </div>

        {rejectionLabel}

        {!fileData ? (
          /* EMPTY / RE-UPLOAD SLOT */
          <div>
            <input
              ref={(el) => (fileInputRefs.current[pageKey] = el)}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => onFileSelect(shg.shgId, shg.shgName, pageNum, e)}
              className="hidden"
            />
            <input
              ref={(el) => (nativeCameraInputRefs.current[pageKey] = el)}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onFileSelect(shg.shgId, shg.shgName, pageNum, e)}
              className="hidden"
            />

            {isAnalyzing ? (
              <button disabled className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg font-semibold cursor-wait transition-all border shadow-sm text-xs bg-gray-100 text-gray-400 border-gray-200">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500 border-t-transparent" />
                <span>{t?.('upload.analyzing') || 'Analyzing...'}</span>
              </button>
            ) : (
              <div className="mt-auto pt-2 space-y-2">
                {isRejectedOnServer && (
                  <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mb-1">
                    <RefreshCw size={10} /> {t?.('upload.reuploadReplacement') || 'Upload a replacement'}
                  </p>
                )}
                {!isMobileDevice && (
                  <button
                    onClick={() => fileInputRefs.current[pageKey]?.click()}
                    className={`flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all border shadow-sm text-xs ${isRejectedOnServer
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                      : 'bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                  >
                    <Upload size={14} />
                    <span>{isRejectedOnServer
                      ? (t?.('upload.reuploadPage') || `Re-upload Page ${pageNum}`)
                      : (t?.('upload.uploadFile') || t?.(`upload.page${pageNum}`) || `Upload Page ${pageNum}`)}</span>
                  </button>
                )}
                {isMobileDevice && (
                  <button
                    onClick={() => onOpenCamera(shg.shgId, shg.shgName, pageNum)}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all text-xs ${isRejectedOnServer
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                  >
                    <ScanLine size={14} />
                    <span>{isRejectedOnServer
                      ? (t?.('upload.rescanPage') || `Re-scan Page ${pageNum}`)
                      : (t?.('upload.cameraScan') || t?.(`upload.page${pageNum}`) || `Camera Scan Page ${pageNum}`)}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* FILE SELECTED (staged for upload) */
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm flex items-start gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <FileText size={24} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 leading-tight mb-1 truncate">
                  {fileData.fileName}
                </p>
                <div className="flex flex-col gap-0.5 text-[11px] text-gray-500 font-medium">
                  <span>{formatBytes(fileData.fileSize)}</span>
                  {fileData.width && fileData.height && (
                    <span>{fileData.width} × {fileData.height}</span>
                  )}
                </div>
              </div>
            </div>

            {!fileData.validated && (
              <div className="flex items-start gap-2 text-[11px] text-red-600 font-bold px-1 leading-tight">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{fileData.validationMessage || t?.('upload.validateError') || 'Validate document before uploading'}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onViewFile(shg.shgId, pageNum)}
                  className="flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-[11px] transition-all shadow-sm active:scale-95"
                >
                  <Eye size={14} />
                  <span>{t?.('upload.view') || 'View'}</span>
                </button>
                <button
                  onClick={() => onRemoveFile(shg.shgId, pageNum)}
                  className="flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg font-bold text-[11px] transition-all shadow-sm active:scale-95"
                >
                  <X size={14} />
                  <span>{t?.('upload.remove') || 'Remove'}</span>
                </button>
              </div>

              {fileData && !fileData.validated && !isPageValidated && (
                <button
                  onClick={() => onValidateFile(shg.shgId, pageNum)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[12px] transition-all shadow-md active:scale-95 w-full mt-1"
                >
                  <CheckCircle size={16} />
                  <span>{t?.('upload.validate') || 'Validate'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative bg-white rounded-2xl shadow-xl border border-white/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl overflow-hidden ${cardBorderClass}`}>



      {/* CARD HEADER */}
      <div className={`p-4 sm:p-5 ${headerAccent} transition-all duration-500 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-sm sm:text-base leading-tight mb-1 truncate drop-shadow-sm">
              {shg.shgName}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-[10px] sm:text-xs ${idBadgeClass} font-mono tracking-wider rounded-lg px-2 py-0.5 border border-white/10 backdrop-blur-sm`}>
                {shg.shgId}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">

        {/* ── FULLY ACCEPTED: show carousel of accepted pages ───────── */}
        {isFullyAccepted ? (
          <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
            {historyUploads.length > 1 && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50/70 border-b border-blue-100">
                <button
                  onClick={() => setCurrentHistoryIndex(prev => (prev > 0 ? prev - 1 : historyUploads.length - 1))}
                  className="p-1 hover:bg-blue-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={16} className="text-blue-700" />
                </button>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  Page {historyUploads[currentHistoryIndex]?.page || historyUploads[currentHistoryIndex]?.metadata?.page || (currentHistoryIndex + 1)} of {historyUploads.length}
                </span>
                <button
                  onClick={() => setCurrentHistoryIndex(prev => (prev < historyUploads.length - 1 ? prev + 1 : 0))}
                  className="p-1 hover:bg-blue-100 rounded-full transition-colors"
                >
                  <ChevronRight size={16} className="text-blue-700" />
                </button>
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle size={18} />
                  <div>
                    <p className="font-bold text-sm">
                      {historyUploads.length > 1
                        ? `Page ${historyUploads[currentHistoryIndex]?.page || historyUploads[currentHistoryIndex]?.metadata?.page || (currentHistoryIndex + 1)} · Accepted`
                        : 'Both Pages Accepted'}
                    </p>
                    <p className="text-[10px] text-gray-500">{selectedMonth} / {selectedYear}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const doc = historyUploads[currentHistoryIndex];
                    const pageToView = doc?.page || doc?.metadata?.page || 1;
                    onViewPermanentlyUploadedFile(shg.shgId, pageToView);
                  }}
                  disabled={!!currentlyViewingId}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-semibold text-xs transition-colors"
                >
                  {currentlyViewingId === `${shg.shgId}-${historyUploads[currentHistoryIndex]?.page || historyUploads[currentHistoryIndex]?.metadata?.page || 1}` ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                  ) : (
                    <Eye size={12} />
                  )}
                  {t?.('common.view') || 'View'}
                </button>
              </div>
              {historyUploads.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {historyUploads.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 rounded-full transition-all ${idx === currentHistoryIndex ? 'w-4 bg-blue-500' : 'w-1 bg-blue-200'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── PENDING / PARTIAL / REUPLOAD FLOW ──────────────────── */
          <div className="space-y-4">
            {/* Partial upload info banner */}
            {isPartialUpload && (
              <div className="bg-amber-50 rounded-lg p-2.5 border-l-4 border-amber-500 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">
                    Partial Re-upload Required
                  </p>
                  <p className="text-xs text-gray-700">
                    {p1Rejected && p2AcceptedOnServer && 'Page 1 was rejected. Re-upload Page 1 to complete the submission.'}
                    {p2Rejected && p1AcceptedOnServer && 'Page 2 was rejected. Re-upload Page 2 to complete the submission.'}
                  </p>
                </div>
              </div>
            )}

            {/* Full rejection banner (both pages rejected, no partial) */}
            {rejectionInfo && !isPartialUpload && !hasFiles && (
              <div className="mb-3 bg-red-50 rounded-lg p-2.5 border-l-4 border-red-500 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-0.5">Rejected</p>
                  <p className="text-xs text-gray-700">{rejectionInfo.rejectionReason || 'Please follow guidelines and upload again.'}</p>
                </div>
              </div>
            )}

            {/* DUAL PAGE SLOTS */}
            <div className="flex flex-col lg:flex-row gap-4">

              <div className="flex-1">
                {renderDocumentSlot('page1', t?.('upload.page1Full') || 'Page 1 · Members Register')}
              </div>
              <div className="flex-1">
                {renderDocumentSlot('page2', t?.('upload.page2Full') || 'Page 2 · Financial Ledger')}
              </div>
            </div>

            {/* SUBMISSION BUTTON - Hidden if already permanently uploaded */}
            {(hasFiles || isReadyToSubmit || canSubmitPartial) && !isPermanentlyUploaded && (
              <div className="pt-4 border-t border-gray-100 mt-4">
                <button
                  onClick={() => onUploadSingleShg(shg.shgId)}
                  disabled={!canSubmit || isUploading}
                  className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-md group ${canSubmit && !isUploading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white transform active:scale-95'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <Upload size={20} className={canSubmit ? 'animate-bounce group-hover:animate-none' : ''} />
                  <span>
                    {isUploading
                      ? (t?.('upload.uploading') || 'Uploading...')
                      : canSubmitPartial
                        ? (t?.('upload.reuploadPage') || 'Re-upload Rejected Page')
                        : (t?.('upload.uploadFiles') || 'Upload Files')
                    }
                  </span>
                </button>

                {!canSubmit && hasFiles && (
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-red-500">
                    <AlertTriangle size={14} />
                    <p className="text-[11px] font-bold">
                      {getStatusMessage()}
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default SHGUploadCard;
