import { API_BASE } from './utils/apiConfig';
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

export default function ProfilePage({ onClose, onUserUpdate }) {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);

  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [panchayat, setPanchayat] = useState('');

  // const [oldPassword, setOldPassword] = useState('');
  // const [newPassword, setNewPassword] = useState('');
  // const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setDistrict(parsed.district || '');
        setMandal(parsed.mandal || '');
        setVillage(parsed.village || '');
        setPanchayat(parsed.panchayat || '');
        // If username is not present but name exists, set username for display
        if (!parsed.username && parsed.name) {
          parsed.username = parsed.name;
        }
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
    // Load available locations and then restore user's saved selection
    loadLocations().then(() => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.district) {
            // populate mandals for this district, then restore mandal and villages
            loadMandals(parsed.district).then(() => {
              if (parsed.mandal) {
                setMandal(parsed.mandal);
                loadVillages(parsed.district, parsed.mandal).then(() => {
                  if (parsed.village) setVillage(parsed.village);
                }).catch(() => { });
              }
            }).catch(() => { });
          }
        }
      } catch (e) {
        // ignore
      }
    }).catch(() => { });
  }, []);

  async function loadLocations() {
    try {
      const resp = await fetch(`${API_BASE}/api/districts`);
      if (!resp.ok) return;
      const data = await resp.json();
      // Normalize response to [{id, name}]
      let districtList = [];
      if (Array.isArray(data)) {
        districtList = data.map((d, i) => ({ id: String(d.id ?? i + 1), name: String(d.name ?? d).trim() }));
      } else if (Array.isArray(data.districts)) {
        districtList = data.districts.map((d, i) => ({ id: String(d.id ?? i + 1), name: String(d.name ?? d).trim() }));
      } else if (data && typeof data === 'object' && data.districts) {
        districtList = (data.districts || []).map((d, i) => ({ id: String(d.id ?? i + 1), name: String(d.name ?? d).trim() }));
      }
      setDistricts(districtList);
      return districtList;
    } catch (e) {
      console.error('Error loading districts:', e);
    }
  }

  async function loadMandals(selectedDistrict) {
    if (!selectedDistrict) {
      setMandals([]);
      setMandal('');
      setVillages([]);
      setVillage('');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/mandals?district=${encodeURIComponent(selectedDistrict)}`);
      if (!resp.ok) {
        setMandals([]);
        setMandal('');
        setVillages([]);
        setVillage('');
        return;
      }
      const data = await resp.json();
      // Normalize to [{id, name}]
      let mandalList = [];
      if (Array.isArray(data)) {
        mandalList = data.map((m, i) => ({ id: String(m.id ?? i + 1), name: String(m.name ?? m).trim() }));
      } else if (Array.isArray(data.mandals)) {
        mandalList = data.mandals.map((m, i) => ({ id: String(m.id ?? i + 1), name: String(m.name ?? m).trim() }));
      }
      setMandals(mandalList);
      setMandal('');
      setVillages([]);
      setVillage('');
      return mandalList;
    } catch (e) {
      console.error('Error loading mandals:', e);
      setMandals([]);
      setMandal('');
      setVillages([]);
      setVillage('');
    }
  }

  async function loadVillages(selectedDistrict, selectedMandal) {
    if (!selectedDistrict || !selectedMandal) {
      setVillages([]);
      setVillage('');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/villages?district=${encodeURIComponent(selectedDistrict)}&mandal=${encodeURIComponent(selectedMandal)}`);
      if (!resp.ok) {
        setVillages([]);
        setVillage('');
        return;
      }
      const data = await resp.json();
      // Normalize to [{id, name}]
      let villageList = [];
      if (Array.isArray(data)) {
        villageList = data.map((v, i) => ({ id: String(v.id ?? i + 1), name: String(v.name ?? v).trim() }));
      } else if (Array.isArray(data.villages)) {
        villageList = data.villages.map((v, i) => ({ id: String(v.id ?? i + 1), name: String(v.name ?? v).trim() }));
      }
      setVillages(villageList);
      setVillage('');
      return villageList;
    } catch (e) {
      console.error('Error loading villages:', e);
      setVillages([]);
      setVillage('');
    }
  }

  const optionLabel = (item) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      return String(item.name ?? item.label ?? item.id ?? JSON.stringify(item));
    }
    return String(item);
  };

  async function updateLocation() {
    setMessage('');
    setError('');

    if (!district) {
      setError('Please select a district');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/user/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ district, mandal, village, panchayat })
      });
      if (!resp.ok) throw new Error('Failed to update location');
      const updated = await resp.json();
      const newUser = { ...(user || {}), district, mandal, village, panchayat, ...updated };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      // Inform parent to refresh its user / location state
      if (typeof onUserUpdate === 'function') {
        try { onUserUpdate(); } catch (e) { /* ignore */ }
      }
      setMessage('Location updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || 'Update failed');
    }
  }

  // async function changePassword() {
  //   setMessage('');
  //   setError('');
  //   if (!oldPassword || !newPassword) {
  //     setError('Please fill all password fields');
  //     return;
  //   }
  //   if (newPassword !== confirmPassword) {
  //     setError('New passwords do not match');
  //     return;
  //   }
  //   if (newPassword.length < 6) {
  //     setError('Password must be at least 6 characters');
  //     return;
  //   }

  //   try {
  //     const token = localStorage.getItem('token');
  //     const resp = await fetch(`${API_BASE}/api/user/change-password`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         ...(token ? { Authorization: `Bearer ${token}` } : {})
  //       },
  //       body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
  //     });
  //     if (!resp.ok) {
  //       const txt = await resp.text();
  //       throw new Error(txt || 'Password change failed');
  //     }
  //     setOldPassword('');
  //     setNewPassword('');
  //     setConfirmPassword('');
  //     setMessage('Password changed successfully');
  //     setTimeout(() => setMessage(''), 3000);
  //   } catch (e) {
  //     setError(e.message || 'Change failed');
  //   }
  // }

  // async function deleteUser() {
  //   const ok = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
  //   if (!ok) return;
  //   try {
  //     const token = localStorage.getItem('token');
  //     const resp = await fetch(`${API_BASE}/api/user/delete`, {
  //       method: 'DELETE',
  //       headers: {
  //         ...(token ? { Authorization: `Bearer ${token}` } : {})
  //       }
  //     });
  //     if (!resp.ok) throw new Error('Delete failed');
  //     localStorage.removeItem('token');
  //     localStorage.removeItem('user');
  //     window.location.href = '/login';
  //   } catch (e) {
  //     setError(e.message || 'Delete failed');
  //   }
  // }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-auto min-h-screen">
      <div className="w-full max-w-6xl bg-white rounded-lg shadow-2xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t('profile.title')}</h2>
              <p className="text-blue-100 text-sm mt-1">{t('profile.subtitle')}</p>
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
          {/* Alert Messages */}
          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <p className="text-green-800 font-medium">{message}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account Section */}
            <div className="lg:col-span-1">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-600">
                  {t('profile.accountInformation')}
                </h3>
                <div className="space-y-3 mb-6">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">{t('profile.username')}</p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.username || user?.name || 'Not set'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">{t('profile.mobileNumber')}</p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.mobile || user?.phone || 'Not set'}
                    </p>
                  </div>
                </div>

                {/* <h4 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-300">
                  Change Password
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Current Password
                    </label>
                    <input 
                      type="password" 
                      value={oldPassword} 
                      onChange={e=>setOldPassword(e.target.value)} 
                      placeholder="Enter current password" 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={e=>setNewPassword(e.target.value)} 
                      placeholder="Enter new password" 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={e=>setConfirmPassword(e.target.value)} 
                      placeholder="Confirm new password" 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={changePassword}
                      className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded transition-colors"
                    >
                      Change Password
                    </button>
                    <button 
                      onClick={()=>{setOldPassword('');setNewPassword('');setConfirmPassword('');}} 
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div> */}
              </div>
            </div>

            {/* Location & Documents Section */}
            <div className="lg:col-span-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-600">
                  {t('profile.locationDetails')}
                </h3>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">{t('location.currentLocation')}: </span>
                    {user?.district || 'Not set'}
                    {user?.mandal && ` - ${user.mandal}`}
                    {user?.village && ` - ${user.village}`}
                    {user?.panchayat && ` - ${user.panchayat}`}
                  </p>
                </div>
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('location.district')} <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={district}
                        onChange={(e) => {
                          const selectedDistrict = e.target.value;
                          setDistrict(selectedDistrict);
                          loadMandals(selectedDistrict);
                        }}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
                      >
                        <option value="">{t('location.selectDistrict')}</option>
                        {districts.map((d, i) => (
                          <option key={i} value={optionLabel(d)}>
                            {optionLabel(d)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('location.mandal')} <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={mandal}
                        onChange={(e) => {
                          const selectedMandal = e.target.value;
                          setMandal(selectedMandal);
                          loadVillages(district, selectedMandal);
                        }}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
                        disabled={!district}
                      >
                        <option value="">{t('location.selectMandal')}</option>
                        {mandals.map((m, i) => (
                          <option key={i} value={optionLabel(m)}>
                            {optionLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('location.village')} <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
                        disabled={!mandal}
                      >
                        <option value="">{t('location.selectVillage')}</option>
                        {villages.map((v, i) => (
                          <option key={i} value={optionLabel(v)}>
                            {optionLabel(v)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('location.panchayat')}
                      </label>
                      <input type="text" value={panchayat} onChange={(e) => setPanchayat(e.target.value)} className='w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white' />
                    </div>
                  </div>
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={updateLocation}
                      className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded transition-colors"
                    >
                      {t('profile.updateLocation')}
                    </button>
                    <button
                      onClick={() => { setDistrict(user?.district || ''); setMandal(user?.mandal || ''); setVillage(user?.village || ''); }}
                      className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded transition-colors"
                    >
                      {t('profile.reset')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
            {/* <button 
              onClick={deleteUser} 
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded transition-colors"
            >
              Delete Account
            </button> */}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}