import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const ReportsTab = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Operational Report</h3>
            <p className="text-sm text-gray-600 mb-4">Daily upload and validation summary</p>
            <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Financial Report</h3>
            <p className="text-sm text-gray-600 mb-4">Monthly payment and dues summary</p>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Generate Excel
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Performance Report</h3>
            <p className="text-sm text-gray-600 mb-4">User and region-wise analysis</p>
            <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        </div>
  
        {/* Report History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Report History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-3 text-sm">Operational Report</td>
                  <td className="px-4 py-3 text-sm">Jan 2025</td>
                  <td className="px-4 py-3 text-sm">2025-01-15</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Submitted</span></td>
                  <td className="px-4 py-3"><button className="text-blue-600 hover:text-blue-800 text-sm">Download</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

export default ReportsTab;