import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, FileText, Users, Search } from 'lucide-react';

const OCRValidationTab = () => {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [ocrFiles, setOcrFiles] = useState([]);
    
    const [users] = useState([
      { id: 1, name: 'Rajesh Kumar', village: 'Pedagadi', mandal: 'Khammam Rural', totalFiles: 25, validatedFiles: 18, inReviewFiles: 4, pendingFiles: 3, progress: 72 },
      { id: 2, name: 'Priya Sharma', village: 'Bonakal', mandal: 'Wyra', totalFiles: 22, validatedFiles: 10, inReviewFiles: 6, pendingFiles: 6, progress: 45 },
    ]);
  
    useEffect(() => {
      // Sample files
      const sampleFiles = [];
      for (let i = 1; i <= 25; i++) {
        sampleFiles.push({
          id: i,
          userId: 1,
          fileName: `SHG_Jan_2025_${String(i).padStart(3, '0')}.jpg`,
          uploadDate: '2025-01-15',
          status: i <= 18 ? 'VALIDATED' : i <= 22 ? 'IN_REVIEW' : 'PENDING'
        });
      }
      setOcrFiles(sampleFiles);
    }, []);
  
    const selectedUser = users.find(u => u.id === selectedUserId);
    const filteredFiles = ocrFiles.filter(file => !selectedUserId || file.userId === selectedUserId);
  
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">OCR Validation</h2>
  
        {/* User Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Select User to Validate</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => {
                  setSelectedUserId(user.id);
                  setSelectedFile(null);
                }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedUserId === user.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{user.name}</h4>
                    <p className="text-xs text-gray-500">{user.village}, {user.mandal}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user.progress === 100 ? 'bg-green-100 text-green-800' :
                    user.progress >= 50 ? 'bg-blue-100 text-blue-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {user.progress}%
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">{user.totalFiles}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>✓ Validated:</span>
                    <span className="font-semibold">{user.validatedFiles}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>⚡ In Review:</span>
                    <span className="font-semibold">{user.inReviewFiles}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>⏳ Pending:</span>
                    <span className="font-semibold">{user.pendingFiles}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${user.progress === 100 ? 'bg-green-500' : user.progress >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                      style={{ width: `${user.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
  
          {selectedUserId && (
            <div className="mt-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Validating files for: {selectedUser?.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
  
        {/* File List and Validation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-3">
                {selectedUserId ? `${selectedUser?.name}'s Files` : 'All Files'}
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
  
            <div className="max-h-96 overflow-y-auto p-4">
              {!selectedUserId ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Please select a user first</p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`p-3 mb-2 rounded-lg cursor-pointer border-2 transition-all ${
                      selectedFile?.id === file.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate">{file.fileName}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        file.status === 'VALIDATED' ? 'bg-green-100 text-green-800' :
                        file.status === 'IN_REVIEW' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {file.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{file.uploadDate}</p>
                  </div>
                ))
              )}
            </div>
          </div>
  
          {/* Validation Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            {selectedFile ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{selectedFile.fileName}</h3>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 h-80 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <FileText className="w-16 h-16 mx-auto mb-2" />
                    <p>Image Preview</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Validate
                  </button>
                  <button className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-2" />
                  <p className="font-medium">Select a file to validate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

export default OCRValidationTab;