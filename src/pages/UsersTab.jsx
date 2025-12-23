import React, { useState, useEffect } from 'react';
import { Plus, Edit, Eye } from 'lucide-react';

const UsersTab = ({ filterProps }) => {
  const { selectedDistrict, setSelectedDistrict, selectedMandal, setSelectedMandal, selectedVillage, setSelectedVillage, serverStatus } = filterProps;
  const [users, setUsers] = useState([]);

  useEffect(() => {
    setUsers([
      { id: 1, name: 'Rajesh Kumar', role: 'USER', district: 'Khammam', mandal: 'Khammam Rural', village: 'Pedagadi', isActive: true, filesUploaded: 45, filesPending: 5 },
      { id: 2, name: 'Priya Sharma', role: 'USER', district: 'Khammam', mandal: 'Wyra', village: 'Bonakal', isActive: true, filesUploaded: 38, filesPending: 12 },
      { id: 3, name: 'Amit Patel', role: 'ADMIN', district: 'Warangal', mandal: 'Warangal Urban', village: 'Hanamkonda', isActive: true, filesUploaded: 52, filesPending: 8 }
    ]);
  }, []);

  const filteredUsers = users.filter(user => {
    if (selectedDistrict !== 'all' && user.district.toLowerCase() !== selectedDistrict) return false;
    if (selectedMandal !== 'all' && user.mandal.toLowerCase().replace(/\s+/g, '_') !== selectedMandal) return false;
    if (selectedVillage !== 'all' && user.village.toLowerCase() !== selectedVillage) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Files</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">{user.name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{user.village}, {user.mandal}</td>
                <td className="px-6 py-4 text-sm">{user.filesUploaded + user.filesPending}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-800">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersTab;