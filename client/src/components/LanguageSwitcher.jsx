import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',   native: 'हिन्दी',  flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी',   flag: '🇮🇳' },
];

const LanguageSwitcher = () => {
  const [open, setOpen]               = useState(false);
  const [selected, setSelected]       = useState(LANGUAGES[0]);
  const dropdownRef                   = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeLanguage = (lang) => {
    setSelected(lang);
    setOpen(false);

    if (lang.code === 'en') {
      // Reset to English - reload with no cookie
      const iframe = document.querySelector('.goog-te-banner-frame');
      if (iframe) {
        const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
        const restore = innerDoc.querySelector('.goog-te-button button');
        if (restore) restore.click();
      }
      // Fallback: delete cookie and reload
      document.cookie =
        'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie =
        'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' +
        window.location.hostname;
      window.location.reload();
      return;
    }

    // Set Google Translate cookie
    const cookieValue = `/en/${lang.code}`;
    document.cookie = `googtrans=${cookieValue}; path=/`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname}`;

    // Trigger translate via hidden select
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = lang.code;
      select.dispatchEvent(new Event('change'));
    } else {
      // If widget not ready, reload with cookie set
      window.location.reload();
    }
  };

  // On mount, read cookie to sync selected state
  useEffect(() => {
    const match = document.cookie.match(/googtrans=\/en\/(\w+)/);
    if (match) {
      const found = LANGUAGES.find((l) => l.code === match[1]);
      if (found) setSelected(found);
    }
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 bg-white"
        title="Change Language"
      >
        <Globe size={14} className="text-orange-500" />
        <span className="text-xs font-semibold text-gray-700 hidden sm:inline">
          {selected.native}
        </span>
        <span className="text-sm sm:hidden">{selected.flag}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} className="text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 overflow-hidden"
          >
            <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Select Language
            </p>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-orange-50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{lang.flag}</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-800 text-xs">{lang.native}</p>
                    <p className="text-[10px] text-gray-400">{lang.label}</p>
                  </div>
                </div>
                {selected.code === lang.code && (
                  <Check size={13} className="text-orange-500" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;