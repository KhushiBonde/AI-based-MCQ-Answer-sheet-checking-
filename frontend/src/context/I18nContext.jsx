import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    nav: {
      check: "Check sheet",
      keys: "Answer Keys",
      batch: "Batch Mode",
      generator: "Sheet Gen",
      history: "History",
      analytics: "Analytics",
      classes: "Classes",
      students: "Students",
      settings: "Settings"
    },
    common: {
      signout: "Sign out",
      workspace: "Workspace",
      usage: "Monthly Usage",
      used: "used",
      starter: "Starter"
    }
  },
  hi: {
    nav: {
      check: "शीट जाँचें",
      keys: "आंसर की",
      batch: "बैच मोड",
      generator: "शीट बनाएँ",
      history: "इतिहास",
      analytics: "एनालिटिक्स",
      classes: "कक्षाएँ",
      students: "छात्र",
      settings: "सेटिंग्स"
    },
    common: {
      signout: "साइन आउट",
      workspace: "कार्यक्षेत्र",
      usage: "मासिक उपयोग",
      used: "उपयोग किया गया",
      starter: "स्टार्टर"
    }
  }
};

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('markix_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('markix_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (path) => {
    const keys = path.split('.');
    let value = translations[lang];
    for (const key of keys) {
      if (!value) return path;
      value = value[key];
    }
    return value || path;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
