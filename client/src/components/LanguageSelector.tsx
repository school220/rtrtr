import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '' }) => {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 text-white font-medium text-xs transition-colors select-none"
        title="Tilni o'zgartirish / Сменить язык"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-200" />
        <span>{lang === 'uz' ? "O'zbekcha" : 'Русский'}</span>
        <ChevronDown className="w-3 h-3 text-white/70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 bg-white text-gray-800 rounded shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs font-sans">
          <button
            type="button"
            onClick={() => {
              setLang('uz');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-cyan-50 transition-colors ${
              lang === 'uz' ? 'font-bold text-[#25718f]' : 'text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🇺🇿</span>
              <span>O'zbekcha</span>
            </div>
            {lang === 'uz' && <Check className="w-3.5 h-3.5 text-[#25718f]" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setLang('ru');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-cyan-50 transition-colors ${
              lang === 'ru' ? 'font-bold text-[#25718f]' : 'text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🇷🇺</span>
              <span>Русский</span>
            </div>
            {lang === 'ru' && <Check className="w-3.5 h-3.5 text-[#25718f]" />}
          </button>
        </div>
      )}
    </div>
  );
};
