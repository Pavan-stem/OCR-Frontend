import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        // Load language preference from localStorage, default to English
        const savedLanguage = localStorage.getItem('language');
        return savedLanguage || 'en';
    });

    useEffect(() => {
        // Save language preference to localStorage whenever it changes
        localStorage.setItem('language', language);
    }, [language]);

    const changeLanguage = (lang) => {
        if (lang === 'en' || lang === 'te') {
            setLanguage(lang);
        }
    };

    const t = (key) => {
        // Navigate through nested translation keys (e.g., 'common.upload')
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        return value || key;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
