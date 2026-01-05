import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Image as ImageIcon, X, Loader2, Eye, EyeOff, Download } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const OCRValidationTab = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('original'); // 'original' or 'digitized'
  const [dragActive, setDragActive] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [showCellDetails, setShowCellDetails] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, BMP, or TIFF)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResults(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResults(null);
    setError(null);
    setViewMode('original');
    setElapsedTime(null);
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_BASE}/api/extract-tables`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OCR processing failed');
      }

      if (data.success && data.files && data.files.length > 0) {
        const fileResult = data.files[0];
        if (fileResult.pages && fileResult.pages.length > 0) {
          setResults(fileResult.pages[0]);
          // Capture elapsed time from response
          if (data.elapsed_time !== undefined) {
            setElapsedTime(data.elapsed_time);
          }
        } else {
          throw new Error('No pages found in response');
        }
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err.message || 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  const downloadExcel = async () => {
    if (!results?.table_data) return;

    setDownloading(true);
    try {
      const response = await fetch(`${API_BASE}/api/export-to-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_data: results.table_data,
          filename: selectedFile?.name || 'shg_table'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Excel export failed');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Get filename from uploaded file (remove extension and add .xlsx)
      let downloadName = 'shg_table.xlsx';
      if (selectedFile?.name) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        downloadName = `${nameWithoutExt}.xlsx`;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Excel download error:', err);
      setError(err.message || 'Failed to download Excel file');
    } finally {
      setDownloading(false);
    }
  };

  const formatElapsedTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const renderValidationChecks = () => {
    if (!results?.validation?.checks) return null;

    const checks = results.validation.checks;
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-indigo-600" />
          Image Validation Checks
        </h3>
        <div className="space-y-3">
          {Object.entries(checks).map(([key, check]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                {check.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <span className="font-bold text-gray-900 capitalize">{key}</span>
                  <p className="text-xs text-gray-500">{check.message}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${check.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {check.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!results?.table_data) return null;

    const tableData = results.table_data;
    const headers = tableData.column_headers || [];
    const dataRows = tableData.data_rows || [];
    const headerRows = tableData.header_rows || [];

    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-black text-gray-900">Extracted SHG Table</h3>
            </div>
            <button
              onClick={downloadExcel}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              title="Download as Excel"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Excel
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end mb-4">
          <p className="text-xs font-bold text-gray-900 mr-2">Debug Cell details:</p>
          <button
            onClick={() => setShowCellDetails(!showCellDetails)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            title={showCellDetails ? "Hide panel" : "Show panel"}
          >
            {showCellDetails ? (
              <>
                <EyeOff className="w-3 h-3" />
                Hide
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Show
              </>
            )}
          </button>
        </div>

        <div className="lg:grid-cols-4 gap-6 relative">
          <div className="width-full overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                {headerRows && headerRows.length > 0 ? (
                  headerRows.map((row, rowIdx) => (
                    <tr key={`header-row-${rowIdx}`} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                      {row.map((cell, cellIdx) => {
                        // Left-align cells with colspan 15 and rowspan 1
                        const isLeftAligned = (cell.col_span === 15 || cell.col_span === '15') &&
                          (cell.row_span === 1 || cell.row_span === '1');

                        // Check if this cell has data and if it's active
                        const hasData = cell.text || cell.image_base64;
                        const headerRowId = `header-${rowIdx}`;
                        const isActive = activeCell?.rowIdx === headerRowId && activeCell?.cellIdx === cellIdx;

                        return (
                          <th
                            key={`header-cell-${rowIdx}-${cellIdx}`}
                            colSpan={cell.col_span || 1}
                            rowSpan={cell.row_span || 1}
                            onClick={() => hasData ? setActiveCell({ ...cell, rowIdx: headerRowId, cellIdx }) : null}
                            className={`px-3 py-2 text-xs font-black text-white border border-indigo-500 ${hasData ? 'cursor-pointer hover:bg-indigo-700 transition-colors' : ''
                              } ${isActive ? 'ring-2 ring-yellow-400 ring-inset' : ''} ${isLeftAligned ? 'text-left' : 'text-center'
                              }`}
                          >
                            {cell.label || ''}
                          </th>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    {headers.map((header, idx) => {
                      const isLeftAligned = header.label && (header.label.includes('SHG MBK ID') || header.label.includes('ID'));
                      return (
                        <th key={idx} className={`px-3 py-3 text-xs font-black text-white uppercase border border-indigo-500 min-w-[120px] ${isLeftAligned ? 'text-left' : 'text-center'}`}>
                          <div className="truncate" title={header.label}>
                            {header.label}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>
              <tbody>
                {dataRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {row.cells?.map((cell, cellIdx) => {
                      const isActive = activeCell?.rowIdx === rowIdx && activeCell?.cellIdx === cellIdx;
                      // Check if this column should be left-aligned (first column is typically ID)
                      const isLeftAligned = cellIdx === 0;
                      return (
                        <td
                          key={cellIdx}
                          onClick={() => cell.text || cell.image_base64 ? setActiveCell({ ...cell, rowIdx, cellIdx }) : null}
                          className={`px-3 py-3 text-sm border border-gray-200 cursor-pointer transition-all ${isActive ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset z-10' :
                            (cell.text || cell.image_base64) ? 'hover:bg-indigo-50' : 'opacity-40 cursor-not-allowed'
                            }`}
                        >
                          <div className="space-y-1">
                            <div className={`font-medium break-words ${isActive ? 'text-indigo-900' : 'text-gray-900'} ${isLeftAligned ? 'text-left' : 'text-center'}`}>
                              {cell.text || '-'}
                            </div>
                            {cell.confidence !== undefined && cell.confidence > 0 && (
                              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getConfidenceColor(cell.confidence)} `}>
                                {(cell.confidence * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Totals Row */}
                {dataRows.length > 0 && dataRows[0].cells && (
                  <tr className="bg-indigo-50 border-t-2 border-indigo-600">
                    {dataRows[0].cells.map((_, cellIdx) => {
                      if (cellIdx === 0) {
                        // First cell with "మొత్తం :" label spanning 2 columns
                        return (
                          <td
                            key={cellIdx}
                            colSpan={2}
                            className="px-3 py-3 text-sm font-black text-indigo-900 border border-gray-200 text-left"
                          >
                            మొత్తం :
                          </td>
                        );
                      } else if (cellIdx === 1) {
                        // Skip the second cell since first cell spans 2 columns
                        return null;
                      } else {
                        // Calculate total for this column
                        const columnTotal = dataRows.reduce((sum, row) => {
                          const cellText = row.cells[cellIdx]?.text || '';
                          const numValue = parseFloat(cellText.replace(/[^0-9.-]/g, ''));
                          return !isNaN(numValue) ? sum + numValue : sum;
                        }, 0);

                        return (
                          <td
                            key={cellIdx}
                            className="px-3 py-3 text-sm font-black text-indigo-900 border border-gray-200 text-center"
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

          {/* Cell Details Panel */}
          {showCellDetails && (
            <div className="absolute top-0 right-0 p-6 rounded-xl shadow-lg bg-white border-l border-gray-100 pl-6 space-y-6">
              <div className="sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Cell Details</h4>
                </div>
                {activeCell ? (
                  <div className="space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Original Segment</p>
                      {activeCell.image_base64 ? (
                        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                          <img
                            src={`data:image/png;base64,${activeCell.image_base64}`}
                            alt="Cell Segment"
                            className="w-full h-auto object-contain max-h-32 p-2 mx-auto"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video flex items-center justify-center bg-gray-100 rounded-xl text-gray-400 text-xs font-bold">
                          No Image Available
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="bg-indigo-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-indigo-400 uppercase mb-1">OCR Text</p>
                        <p className="text-xl font-black text-indigo-900 break-words">{activeCell.text || 'Empty'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Confidence</p>
                          <p className={`text-lg font-black ${activeCell.confidence >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                            {(activeCell.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Debug ID</p>
                          <p className="text-lg font-black text-gray-900">#{activeCell.debug_id ?? 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 rounded-3xl">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-400">Select a cell from the table to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            High Confidence (≥90%)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            Medium (70-90%)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            Low (&lt;70%)
          </span>
        </div>
      </div >
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">OCR Validation Engine</h2>
        <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">
          Upload SHG form images for OCR processing and validation
        </p>
      </div>

      {/* Upload Area */}
      {!selectedFile && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
          <div className="p-8">
            <div
              className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${dragActive
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/bmp,image/tiff"
                onChange={handleFileInput}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <Upload className="w-16 h-16 text-indigo-600 mb-4" />
                <p className="text-xl font-black text-gray-900 mb-2">Drop your SHG form image here</p>
                <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                <p className="text-xs text-gray-400">Supports JPG, PNG, BMP, TIFF (max 10MB)</p>
              </label>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview & Process */}
      {selectedFile && !results && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-600" />
                <div>
                  <h3 className="text-lg font-black text-gray-900">{selectedFile.name}</h3>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                title="Remove file"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {previewUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden border-2 border-gray-200">
                <img src={previewUrl} alt="Preview" className="w-full max-h-96 object-contain bg-gray-50" />
              </div>
            )}

            <button
              onClick={processImage}
              disabled={processing}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-wider shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {processing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Process Image
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900">Processing Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Processing Time Display */}
          {elapsedTime !== null && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 shadow-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Processing Complete</h3>
                    <p className="text-sm text-gray-600">OCR analysis finished successfully</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Time</p>
                  <p className="text-3xl font-black text-green-600">
                    {formatElapsedTime(elapsedTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Image View Toggle */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                  Image View
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('original')}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === 'original'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setViewMode('digitized')}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === 'digitized'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Digitized View
                  </button>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-50">
                {viewMode === 'original' && previewUrl && (
                  <img src={previewUrl} alt="Original" className="w-full max-h-[600px] object-contain" />
                )}
                {viewMode === 'digitized' && (
                  <div className="relative">
                    {previewUrl && <img src={previewUrl} alt="Base" className="w-full max-h-[600px] object-contain" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/10">
                      <p className="text-sm font-bold text-gray-600 bg-white/90 px-4 py-2 rounded-xl shadow-lg">
                        Cell overlay visualization coming soon
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Validation Checks */}
          {renderValidationChecks()}

          {/* Table Results */}
          {renderTable()}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={clearFile}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-4 rounded-2xl font-black text-lg uppercase tracking-wider shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all"
            >
              Process Another Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRValidationTab;