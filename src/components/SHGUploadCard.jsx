


import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, X, FileText, AlertCircle, Eye, ScanLine, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const SHGUploadCard = ({
    shg,
    filesData = {}, // { page1: fileObj, page2: fileObj }
    isPermanentlyUploaded,
    rejectionInfo,
    analyzingState = {}, // { page1: bool, page2: bool }
    isViewingPermanent,
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
    selectedYear
}) => {
    const fileInputRefs = useRef({ page1: null, page2: null });
    const nativeCameraInputRefs = useRef({ page1: null, page2: null });
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    // Check if any temporal file is uploaded
    const hasFiles = !!filesData.page1 || !!filesData.page2;
    const isReadyToSubmit = page1Validated === true && page2Validated === true;

    const renderDocumentSlot = (pageKey, pageTitle) => {
        const fileData = filesData[pageKey];
        const isAnalyzing = analyzingState[pageKey];

        return (
            <div className={`p-3 rounded-xl border-2 transition-all ${fileData
                    ? fileData.validated ? 'border-green-400 bg-green-50/50' : 'border-yellow-400 bg-yellow-50/50'
                    : 'border-dashed border-gray-300 bg-gray-50/50'
                }`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-700">{pageTitle}</span>
                    {fileData && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fileData.validated ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {fileData.validated ? 'Validated' : 'Pending Validation'}
                        </span>
                    )}
                </div>

                {!fileData ? (
                    /* EMPTY SLOT STATE */
                    <div>
                        <input
                            ref={(el) => (fileInputRefs.current[pageKey] = el)}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            onChange={(e) => onFileSelect(shg.shgId, shg.shgName, pageKey === 'page1' ? 1 : 2, e)}
                            className="hidden"
                        />
                        <input
                            ref={(el) => (nativeCameraInputRefs.current[pageKey] = el)}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => onFileSelect(shg.shgId, shg.shgName, pageKey === 'page1' ? 1 : 2, e)}
                            className="hidden"
                        />

                        {isAnalyzing ? (
                            <button disabled className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg font-semibold cursor-wait transition-all border shadow-sm text-xs bg-gray-100 text-gray-400 border-gray-200">
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500 border-t-transparent"></div>
                                <span>{t?.('upload.analyzing') || 'Analyzing...'}</span>
                            </button>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {!isMobileDevice && (
                                    <button
                                        onClick={() => fileInputRefs.current[pageKey]?.click()}
                                        className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg font-bold cursor-pointer transition-all border shadow-sm text-xs bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-300"
                                    >
                                        <Upload size={14} />
                                        <span>{t?.('upload.uploadFile') || 'Upload Document'}</span>
                                    </button>
                                )}

                                {isMobileDevice && (
                                    <button
                                        onClick={() => onOpenCamera(shg.shgId, shg.shgName, pageKey === 'page1' ? 1 : 2)}
                                        disabled={isUploading}
                                        className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg font-bold cursor-pointer transition-all text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    >
                                        <ScanLine size={14} />
                                        <span>{t?.('upload.cameraScan') || 'Camera Scan'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* FILE UPLOADED STATE */
                    <div className="space-y-3">
                        {/* File Info Box (Old Card Style) */}
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

                        {/* Validation Warning (Old Card Style) */}
                        {!fileData.validated && (
                            <div className="flex items-center gap-2 text-[12px] text-red-600 font-bold px-1">
                                <AlertTriangle size={14} />
                                <span>{t?.('upload.validateError') || 'Validate document before uploading'}</span>
                            </div>
                        )}

                        {/* Redesigned Actions (Removal of individual upload, fixed overlaps) */}
                        <div className="flex flex-col gap-2 mt-1">
                            {/* Validate Button (ధృవీకరించండి) - Only show if not validated */}
                            {fileData && !fileData.validated && !(pageKey === 'page1' ? page1Validated : page2Validated) && (
                                <button
                                    onClick={() => onValidateFile(shg.shgId, pageKey === 'page1' ? 1 : 2)}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[12px] transition-all shadow-sm active:scale-95 w-full"
                                >
                                    <CheckCircle size={16} />
                                    <span>{t?.('upload.validate') || 'ధృవీకరించండి'}</span>
                                </button>
                            )}

                            <div className="flex flex-col gap-2 mt-1">
                                {/* Remove Button (తొలగించండి) */}
                                <button
                                    onClick={() => onRemoveFile(shg.shgId, pageKey === 'page1' ? 1 : 2)}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-[#ff4d4d] hover:bg-[#e64040] text-white rounded-lg font-bold text-[12px] transition-all shadow-sm active:scale-95"
                                >
                                    <X size={16} />
                                    <span>{t?.('upload.remove') || 'Remove'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`relative bg-white rounded-xl shadow-md border transition-all ${rejectionInfo ? 'border-red-300' :
                isPermanentlyUploaded ? 'border-green-300 bg-green-50/30' :
                    isReadyToSubmit ? 'border-blue-400 hover:shadow-lg' :
                        'border-gray-200 hover:border-blue-300'
            }`}>

            {/* PERMANENT UPLOAD STATUS BADGE */}
            {isPermanentlyUploaded && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-md border border-white z-10">
                    <CheckCircle size={12} className="text-white font-bold" />
                </div>
            )}

            {/* REJECTION STATUS BADGE */}
            {rejectionInfo && !isPermanentlyUploaded && !hasFiles && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-md border border-white z-10">
                    <X size={12} className="text-white font-bold" />
                </div>
            )}

            <div className="p-3 sm:p-4 border-b border-gray-100">
                <h3 className="font-bold text-sm text-gray-800 line-clamp-1 truncate">{shg.shgName}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{shg.shgId}</p>
            </div>

            <div className="p-3 sm:p-4">
                {/* Rejection Alert */}
                {rejectionInfo && !hasFiles && (
                    <div className="mb-3 bg-red-50 rounded-lg p-2.5 border-l-4 border-red-500 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-0.5">Rejected Reason</p>
                            <p className="text-xs text-gray-700">{rejectionInfo.rejectionReason || 'Please follow guidelines and upload again.'}</p>
                        </div>
                    </div>
                )}

                {isPermanentlyUploaded ? (
                    <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                        {/* Carousel Header / Indicators */}
                        {historyUploads.length > 1 && (
                            <div className="flex items-center justify-between px-3 py-2 bg-green-50/50 border-b border-green-100">
                                <button
                                    onClick={() => setCurrentHistoryIndex(prev => (prev > 0 ? prev - 1 : historyUploads.length - 1))}
                                    className="p-1 hover:bg-green-100 rounded-full transition-colors"
                                >
                                    <ChevronLeft size={16} className="text-green-700" />
                                </button>
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
                                    Page {historyUploads[currentHistoryIndex]?.page || historyUploads[currentHistoryIndex]?.metadata?.page || (currentHistoryIndex + 1)} / {historyUploads.length}
                                </span>
                                <button
                                    onClick={() => setCurrentHistoryIndex(prev => (prev < historyUploads.length - 1 ? prev + 1 : 0))}
                                    className="p-1 hover:bg-green-100 rounded-full transition-colors"
                                >
                                    <ChevronRight size={16} className="text-green-700" />
                                </button>
                            </div>
                        )}

                        <div className="p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-green-700">
                                    <CheckCircle size={18} />
                                    <div>
                                        <p className="font-bold text-sm">
                                            {historyUploads.length > 1
                                                ? `Page ${historyUploads[currentHistoryIndex]?.page || historyUploads[currentHistoryIndex]?.metadata?.page || (currentHistoryIndex + 1)} Uploaded`
                                                : 'Document Uploaded'
                                            }
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
                                    disabled={isViewingPermanent}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-semibold text-xs transition-colors"
                                >
                                    {isViewingPermanent ? (
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                                    ) : (
                                        <Eye size={12} />
                                    )}
                                    {t?.('common.view') || 'View'}
                                </button>
                            </div>

                            {/* Dot Indicators */}
                            {historyUploads.length > 1 && (
                                <div className="flex justify-center gap-1.5 mt-2">
                                    {historyUploads.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1 rounded-full transition-all ${idx === currentHistoryIndex ? 'w-4 bg-green-500' : 'w-1 bg-green-200'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* THE DUAL PAGE UPLOAD SLOTS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {renderDocumentSlot('page1', 'Page 1 (Members Register)')}
                            {renderDocumentSlot('page2', 'Page 2 (Financial Ledger)')}
                        </div>

                        {/* FINAL SUBMISSION ACTION */}
                        {/* FINAL SUBMISSION ACTION */}
                        {(hasFiles || isReadyToSubmit) && (
                            <div className="pt-4 border-t border-gray-100 mt-4">
                                <button
                                    onClick={() => onUploadSingleShg(shg.shgId)}
                                    disabled={!page1Validated || !page2Validated || isUploading || isPermanentlyUploaded}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-md group ${(page1Validated && page2Validated && !isUploading && !isPermanentlyUploaded)
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white transform active:scale-95'
                                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Upload size={20} className={(page1Validated && page2Validated) ? 'animate-bounce group-hover:animate-none' : ''} />
                                    <span>{isUploading ? (t?.('upload.uploading') || 'Uploading...') : (t?.('upload.uploadFiles') || 'Upload Files')}</span>
                                </button>
                                {!isReadyToSubmit && hasFiles && (
                                    <div className="flex items-center justify-center gap-1.5 mt-3 text-red-500">
                                        <AlertTriangle size={14} />
                                        <p className="text-[11px] font-bold">{t?.('upload.dualValidationRequired') || 'Both documents must be validated before uploading.'}</p>
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
