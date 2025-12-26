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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">OCR Validation Engine</h2>
          <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">
            Verifying digital records for <span className="text-indigo-600 font-black">{users.length}</span> active operators
          </p>
        </div>
      </div>

      {/* User Selection Carousel/Grid */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        <div className="bg-indigo-50/50 px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 leading-tight">Operator Selection</h3>
              <p className="text-sm text-gray-500 font-medium">Select a field operator to review their submissions</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => {
                  setSelectedUserId(user.id);
                  setSelectedFile(null);
                }}
                className={`group relative p-6 rounded-[28px] border-2 cursor-pointer transition-all duration-300 overflow-hidden bg-white ${selectedUserId === user.id ? 'border-indigo-500 shadow-2xl shadow-indigo-100 ring-4 ring-indigo-500/10 active:scale-95' : 'border-gray-100 hover:border-indigo-200 hover:shadow-xl'
                  }`}
              >
                {/* Selection indicator background line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${selectedUserId === user.id ? 'bg-indigo-600' : 'bg-gray-100 group-hover:bg-indigo-300'}`}></div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl ${selectedUserId === user.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 leading-tight">{user.name}</h4>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{user.village}, {user.mandal}</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-sm ${user.progress === 100 ? 'bg-green-100 text-green-600' :
                      user.progress >= 50 ? 'bg-blue-100 text-blue-600' :
                        'bg-orange-100 text-orange-600'
                    }`}>
                    {user.progress}% Sync
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Output:</span>
                    <span className="text-sm font-black text-gray-800">{user.totalFiles} Units</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-green-50 text-center p-2 rounded-xl border border-green-100">
                      <div className="text-sm font-black text-green-700">{user.validatedFiles}</div>
                      <div className="text-[8px] font-black uppercase text-green-500 tracking-tighter">Valid</div>
                    </div>
                    <div className="bg-orange-50 text-center p-2 rounded-xl border border-orange-100">
                      <div className="text-sm font-black text-orange-700">{user.inReviewFiles}</div>
                      <div className="text-[8px] font-black uppercase text-orange-500 tracking-tighter">Review</div>
                    </div>
                    <div className="bg-red-50 text-center p-2 rounded-xl border border-red-100">
                      <div className="text-sm font-black text-red-700">{user.pendingFiles}</div>
                      <div className="text-[8px] font-black uppercase text-red-500 tracking-tighter">Wait</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Validation Efficiency</span>
                    <span>{user.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 padding-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${user.progress === 100 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : user.progress >= 50 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'}`}
                      style={{ width: `${user.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedUserId && (
            <div className="mt-8 flex items-center justify-between bg-indigo-600 p-5 rounded-3xl shadow-xl shadow-indigo-100 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-black text-white text-lg leading-tight uppercase tracking-tight">Active Context: {selectedUser?.name}</span>
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider opacity-80">Syncing and examining submission pipeline</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95"
              >
                Reset Engine
              </button>
            </div>
          )}
        </div>
      </div>

      {/* File List and Validation Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* File Navigator */}
        <div className="lg:col-span-1 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Document Navigator
            </h3>
            <div className="relative group">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Find document by ID..."
                className="w-full pl-10 pr-4 py-3.5 bg-white border-2 border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {!selectedUserId ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="bg-indigo-50 p-6 rounded-full">
                  <Users className="w-12 h-12 text-indigo-300" />
                </div>
                <div>
                  <p className="text-gray-900 font-black text-lg">Context Unselected</p>
                  <p className="text-gray-500 text-xs font-medium max-w-[180px] mx-auto mt-1">Please select an operator from the panel above to view submissions</p>
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 font-bold italic">No submissions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`group relative p-4 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${selectedFile?.id === file.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-4 ring-indigo-500/5'
                        : 'border-gray-50 hover:border-gray-200 hover:bg-gray-50/80 shadow-sm'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 max-w-[70%]">
                        <div className={`p-1.5 rounded-lg ${selectedFile?.id === file.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'} transition-all`}>
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-black text-xs text-gray-800 truncate">{file.fileName}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${file.status === 'VALIDATED' ? 'bg-green-100 text-green-700' :
                          file.status === 'IN_REVIEW' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>
                        {file.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">{file.uploadDate}</span>
                      {selectedFile?.id === file.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Validation Canvas */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 flex flex-col min-h-[500px]">
          {selectedFile ? (
            <div className="space-y-6 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">{selectedFile.fileName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Digital Audit ID: {selectedFile.id}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{selectedFile.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="bg-gray-100 p-2.5 rounded-xl text-gray-500">
                    <Search className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Enhanced Image Area */}
              <div className="flex-1 border-2 border-dashed border-gray-200 rounded-[32px] p-10 bg-gray-50/50 flex flex-col items-center justify-center group hover:border-indigo-300 transition-all hover:bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-all pointer-events-none"></div>
                <div className="text-center relative z-10">
                  <div className="bg-white w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 transform group-hover:rotate-6 transition-transform group-hover:scale-110">
                    <FileText className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h4 className="text-lg font-black text-gray-900 mb-2">Document Preview System</h4>
                  <p className="text-gray-500 font-bold max-w-[280px] mx-auto text-sm">Visual engine ready. Click to zoom or pan original high-resolution scan.</p>
                </div>
              </div>

              {/* Action Array */}
              <div className="grid grid-cols-2 gap-6 pt-4 mt-auto">
                <button className="bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4.5 rounded-2xl hover:shadow-2xl hover:shadow-emerald-200 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest shadow-lg shadow-emerald-50">
                  <CheckCircle className="w-6 h-6" />
                  Authorize Record
                </button>
                <button className="bg-white border-2 border-orange-500 text-orange-600 py-4.5 rounded-2xl hover:bg-orange-50 hover:shadow-xl hover:shadow-orange-50 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest shadow-lg shadow-gray-50">
                  <AlertCircle className="w-6 h-6" />
                  Flag for Review
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-24">
              <div className="relative">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-300" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-xl shadow-lg border-4 border-white">
                  <Search className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="max-w-[320px]">
                <h4 className="text-xl font-black text-gray-900 leading-tight">Validation Engine Idling</h4>
                <p className="text-gray-500 font-medium text-sm mt-2">The validation interface is active. Select a specific submission from the document navigator to begin verification.</p>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-100 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRValidationTab;