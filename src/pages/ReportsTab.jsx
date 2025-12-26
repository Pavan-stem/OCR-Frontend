import { Download, FileBarChart, PieChart, Activity, Clock, CheckCircle, FileText } from 'lucide-react';

const ReportsTab = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Intelligence & Reports</h2>
          <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">
            Data-driven insights and <span className="text-indigo-600 font-black">official documentation</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Operational Report Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 p-8 group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Operational Report</h3>
          <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Detailed summary of daily upload metrics and validation performance across all districts.</p>
          <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl hover:shadow-xl hover:shadow-indigo-100 flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs border border-indigo-700 active:scale-95">
            <Download className="w-4 h-4" />
            Generate PDF
          </button>
        </div>

        {/* Financial Report Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 p-8 group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
          <div className="bg-emerald-500 w-16 h-16 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
            <PieChart className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Financial Summary</h3>
          <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Comprehensive review of monthly payment structures and outstanding dues for VO operations.</p>
          <button className="w-full bg-emerald-500 text-white py-4 rounded-2xl hover:shadow-xl hover:shadow-emerald-100 flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs border border-emerald-600 active:scale-95">
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>

        {/* Performance Report Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 p-8 group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
          <div className="bg-purple-600 w-16 h-16 rounded-2xl shadow-xl shadow-purple-100 flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
            <FileBarChart className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Performance Audit</h3>
          <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">In-depth behavioral analysis of user efficiency and regional processing speed benchmarks.</p>
          <button className="w-full bg-purple-600 text-white py-4 rounded-2xl hover:shadow-xl hover:shadow-purple-100 flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs border border-purple-700 active:scale-95">
            <Download className="w-4 h-4" />
            Generate Audit
          </button>
        </div>
      </div>

      {/* Report History Card */}
      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/30 overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Generation History</h3>
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Showing last 24 records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-indigo-700 text-white">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Document Type</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Context Period</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Generation Stamp</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">System Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-indigo-50/30 transition-all group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-black text-gray-900">Operational Summary</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-xs font-bold text-gray-500 uppercase">January 2025</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-800">2025-01-15</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">14:45 IST</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 w-fit">
                    <CheckCircle className="w-3 h-3" />
                    Submitted
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="text-indigo-600 hover:text-indigo-800 font-black text-xs uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all">
                    Retrieve
                  </button>
                </td>
              </tr>
              {/* Placeholder row to show style context */}
              <tr className="hover:bg-indigo-50/30 transition-all group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-black text-gray-900">Performance Audit</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Q4 2024</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-800">2024-12-31</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">23:59 IST</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 w-fit">
                    <CheckCircle className="w-3 h-3" />
                    Archived
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="text-indigo-600 hover:text-indigo-800 font-black text-xs uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all">
                    Retrieve
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
          <button className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors">
            Access Full Repository Securely
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;