import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageToggle() {
    const { language, changeLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-xl px-1 py-2 border border-white/20">
            <Globe size={18} className="text-white" />
            <div className="flex gap-1">
                <button
                    onClick={() => changeLanguage('en')}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${language === 'en'
                            ? 'bg-white text-indigo-600 shadow-md'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                >
                    EN
                </button>
                <button
                    onClick={() => changeLanguage('te')}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${language === 'te'
                            ? 'bg-white text-indigo-600 shadow-md'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                >
                    తె
                </button>
            </div>
        </div>
    );
}
