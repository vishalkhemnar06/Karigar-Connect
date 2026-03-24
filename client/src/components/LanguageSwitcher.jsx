// src/components/LanguageSwitcher.jsx
// Supports three display modes:
//   <LanguageSwitcher />           → default (desktop navbar)
//   <LanguageSwitcher compact />   → icon-only small version (mobile header)
//   <LanguageSwitcher fullWidth /> → full width row (mobile menu)

import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'en', label: 'EN', fullLabel: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हि', fullLabel: 'हिंदी',   flag: '🇮🇳' },
    { code: 'mr', label: 'म',  fullLabel: 'मराठी',   flag: '🇮🇳' },
];

const LanguageSwitcher = ({ compact = false, fullWidth = false }) => {
    const { i18n } = useTranslation();
    // normalize: 'en-US' → 'en'
    const currentLang = (i18n.language || 'en').split('-')[0];

    const handleChange = (code) => {
        i18n.changeLanguage(code);
    };

    // ── Compact mode: small pill with flag only (mobile top-bar) ──
    if (compact) {
        return (
            <div className="flex items-center gap-0.5 bg-orange-50 rounded-lg p-0.5 border border-orange-200">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleChange(lang.code)}
                        title={lang.fullLabel}
                        className={`
                            w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center
                            transition-all duration-200
                            ${currentLang === lang.code
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'text-gray-500 hover:bg-orange-100'
                            }
                        `}
                    >
                        {lang.label}
                    </button>
                ))}
            </div>
        );
    }

    // ── Full-width mode: horizontal button row (inside mobile menu) ──
    if (fullWidth) {
        return (
            <div className="flex gap-2 px-2">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleChange(lang.code)}
                        className={`
                            flex-1 flex items-center justify-center gap-2
                            py-2.5 rounded-xl text-sm font-bold
                            transition-all duration-200 border-2
                            ${currentLang === lang.code
                                ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                                : 'text-gray-600 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                            }
                        `}
                    >
                        <span className="text-base">{lang.flag}</span>
                        <span>{lang.fullLabel}</span>
                    </button>
                ))}
            </div>
        );
    }

    // ── Default mode: pill buttons (desktop navbar) ──
    return (
        <div
            className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200"
            title="Change Language / भाषा बदलें / भाषा बदला"
        >
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => handleChange(lang.code)}
                    title={lang.fullLabel}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                        transition-all duration-200
                        ${currentLang === lang.code
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                        }
                    `}
                >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitcher;