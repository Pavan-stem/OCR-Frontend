import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

export default function ProfilePage({ onClose }) {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // fallback: if username missing but name exists
        if (!parsed.username && parsed.name) {
          parsed.username = parsed.name;
        }
        setUser(parsed);
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-auto min-h-screen">
      <div className="w-full max-w-6xl bg-white rounded-lg shadow-2xl my-8">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t('profile.title')}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {t('profile.subtitle')}
              </p>
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

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Account Information */}
            <div className="lg:col-span-1">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-600">
                  {t('profile.accountInformation')}
                </h3>

                <div className="space-y-3">

                  {/* Mobile Number */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('profile.mobileNumber')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.mobile || user?.phone || ''}
                    </p>
                  </div>

                  {/* VOA Name */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('profile.voaName')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.voaName || ''}
                    </p>
                  </div>

                  {/* Email */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('profile.email')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.email || ''}
                    </p>
                  </div>

                </div>
              </div>
            </div>

            {/* Location Details */}
            <div className="lg:col-span-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-600">
                  {t('profile.locationDetails')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* VO Name */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('profile.voName')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.voName || ''}
                    </p>
                  </div>

                  {/* VO ID */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      VO ID
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.voID || ''}
                    </p>
                  </div>

                  {/* District */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('location.district')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.district || ''}
                    </p>
                  </div>

                  {/* Mandal */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('location.mandal')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.mandal || ''}
                    </p>
                  </div>

                  {/* Village */}
                  <div className="bg-white p-3 rounded border border-slate-200 min-h-[56px]">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">
                      {t('location.village')}
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {user?.village || ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
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
