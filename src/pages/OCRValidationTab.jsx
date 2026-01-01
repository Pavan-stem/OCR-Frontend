import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const OCRValidationTab = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('original'); // 'original' or 'digitized'
  const [dragActive, setDragActive] = useState(false);

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
    const shgMbkId = tableData.shg_mbk_id || 'N/A';

    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-black text-gray-900">Extracted SHG Table</h3>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-xl">
            <span className="text-sm font-bold text-gray-600">SHG MBK ID:</span>
            <span className="text-lg font-black text-indigo-600">{shgMbkId}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-purple-600">
                <th className="px-3 py-3 text-left text-xs font-black text-white uppercase tracking-wider border border-indigo-500">
                  Row
                </th>
                {headers.map((header, idx) => (
                  <th key={idx} className="px-3 py-3 text-left text-xs font-black text-white uppercase tracking-wider border border-indigo-500 min-w-[150px]">
                    <div className="truncate" title={header.label}>
                      {header.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-sm font-bold text-gray-900 border border-gray-200">
                    {row.row_number}
                  </td>
                  {row.cells?.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-sm border border-gray-200">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900 break-words">
                          {cell.text || '-'}
                        </div>
                        {cell.confidence !== undefined && (
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getConfidenceColor(cell.confidence)}`}>
                            {(cell.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            Low (\u003c70%)
          </span>
        </div>
      </div>
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