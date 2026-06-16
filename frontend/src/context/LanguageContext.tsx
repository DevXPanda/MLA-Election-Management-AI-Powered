'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, TRANSLATIONS } from '../lib/translations';

// Global state to allow non-hook modules (like ui-labels.ts) to access the current language synchronously.
export const globalLanguageState = {
  current: 'en' as Language,
};

// Safe helper for static imports/non-React-hooks
export function getTranslation(key: string, defaultText: string = ''): string {
  const lang = globalLanguageState.current;
  return TRANSLATIONS[lang]?.[key] ?? defaultText;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check local storage for persistent preference
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang === 'en' || savedLang === 'hi') {
      setLanguageState(savedLang);
      globalLanguageState.current = savedLang;
    } else {
      // Default to english, or check navigator languages
      const browserLang = navigator.language.substring(0, 2);
      if (browserLang === 'hi') {
        setLanguageState('hi');
        globalLanguageState.current = 'hi';
      }
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    globalLanguageState.current = lang;
    localStorage.setItem('lang', lang);
  };

  const t = (key: string, defaultText?: string): string => {
    return TRANSLATIONS[language]?.[key] ?? defaultText ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
export { TRANSLATIONS };
