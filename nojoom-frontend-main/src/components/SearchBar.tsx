import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { useThemeStore } from '../store/useThemeStore';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  placeholder?: string;
  compact?: boolean;
  darkMode?: boolean;
  className?: string;                // ✅ أضف
  size?: 'sm' | 'md' | 'lg';         // ✅ أضف
  autoFocus?: boolean;               // ✅ أضف
  suggestions?: { type: string; text: string; id?: number; avatar?: string; thumbnail?: string }[];
  onSuggestionClick?: (suggestion: string) => void;
  suggestionsLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  onSearch,
  placeholder,
  className = '',
  size = 'md',
  autoFocus = false,
  suggestions = [],
  onSuggestionClick,
  suggestionsLoading = false
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const { theme } = useThemeStore();
  const [isFocused, setIsFocused] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // الأحجام والأنماط بناءً على الحجم المحدد
  const sizeStyles: Record<'sm' | 'md' | 'lg', { container: string; input: string; button: string; icon: string }> = {
    sm: {
      container: 'h-10 rounded-lg',
      input: 'py-2 text-sm',
      button: 'p-2',
      icon: 'text-lg'
    },
    md: {
      container: 'h-12 rounded-xl',
      input: 'py-3 text-base',
      button: 'p-3',
      icon: 'text-xl'
    },
    lg: {
      container: 'h-14 rounded-xl',
      input: 'py-4 text-lg',
      button: 'p-3',
      icon: 'text-xl'
    }
  };

  const currentSize = sizeStyles[size];

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch();
      setHasSearched(true);
    }
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onQueryChange('');
    inputRef.current?.focus();
    if (hasSearched) {
      onSearch();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full ${className}`}
      role="search"
    >
      <div
        className={`
          relative flex items-center bg-gray-100 dark:bg-gray-800/80 backdrop-blur-sm border-2
          ${isFocused ? 'border-purple-500 bg-white dark:bg-gray-900/90' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}
          ${currentSize.container}
          transition-all duration-300 ease-in-out
          shadow-lg hover:shadow-xl
          group
        `}
      >
        {/* أيقونة البحث */}
        <button
          type="submit"
          className={`
            ${currentSize.button} 
            text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-white 
            transition-all duration-200
            hover:scale-110 active:scale-95
            ${isRTL ? 'order-2' : 'order-1'}
            flex items-center justify-center
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          disabled={!query.trim()}
          aria-label={t('search')}
        >
          <span className={`${currentSize.icon} transition-transform duration-200 group-hover:scale-110`}>
            {query.trim() ? '🔍' : '🔎'}
          </span>
        </button>

        {/* حقل الإدخال */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('searchPage.placeholder')}
          className={`
            flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 
            focus:outline-none focus:ring-0
            ${currentSize.input}
            ${isRTL ? 'text-right pr-3' : 'text-left pl-3'}
            transition-all duration-200
            autofill:bg-transparent
          `}
          aria-label={t('search')}
          enterKeyHint="search"
        />

        {/* مؤشر الكتابة */}
        {isFocused && (
          <div className={`
            absolute bottom-0 left-1/2 transform -translate-x-1/2
            w-8 h-0.5 bg-purple-500 rounded-full
            animate-pulse
            ${isRTL ? 'order-1' : 'order-2'}
          `} />
        )}

        {/* زر المسح */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className={`
              ${currentSize.button}
              text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-white 
              transition-all duration-200
              hover:scale-110 active:scale-95
              ${isRTL ? 'order-1' : 'order-2'}
              flex items-center justify-center
              animate-in fade-in zoom-in-75
            `}
            aria-label={t('searchPage.clear')}
          >
            <span className={`${currentSize.icon} font-bold`}>✕</span>
          </button>
        )}

        {/* تأثير التوهج عند التركيز */}
        <div
          className={`
            absolute inset-0 rounded-inherit bg-blue-500/10
            transition-opacity duration-300
            ${isFocused ? 'opacity-100' : 'opacity-0'}
            pointer-events-none
          `}
        />
      </div>

      {/* قائمة الاقتراحات */}
      <AnimatePresence>
        {isFocused && (suggestions.length > 0 || suggestionsLoading) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`
              absolute z-50 mt-1 w-full bg-white dark:bg-gray-900/95 backdrop-blur-md 
              border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden
              ${isRTL ? 'right-0' : 'left-0'}
            `}
          >
            {suggestionsLoading ? (
              <div className="p-4 text-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <ul className="py-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // لمنع سحب التركيز من الإدخال
                        if (onSuggestionClick) onSuggestionClick(suggestion.text);
                      }}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-white/10 
                        transition-colors text-gray-900 dark:text-white text-sm
                        ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}
                      `}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                        {suggestion.type === 'user' ? (
                          suggestion.avatar ? (
                            <img src={suggestion.avatar} alt={suggestion.text} className="w-full h-full object-cover" />
                          ) : '👤'
                        ) : suggestion.type === 'video' ? (
                          suggestion.thumbnail ? (
                            <img src={suggestion.thumbnail} alt={suggestion.text} className="w-full h-full object-cover" />
                          ) : '🎬'
                        ) : (
                          '#️⃣'
                        )}
                      </div>
                      <span className="flex-1 truncate font-medium">
                        {suggestion.text}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-60">
                        {t(`searchPage.${suggestion.type}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* عداد الأحرف */}
      {query.length > 0 && size !== 'sm' && (
        <div className="flex justify-between items-center mt-2 px-1">
          <span className={`
            text-gray-500 text-xs transition-all duration-200
            ${query.length > 50 ? 'text-yellow-500' : ''}
            ${query.length > 100 ? 'text-red-500' : ''}
          `}>
            {query.length} {t('searchPage.charactersSuffix')}
          </span>

          {query.length > 100 && (
            <span className="text-red-400 text-xs">
              {t('searchPage.charLimitExceeded')}
            </span>
          )}
        </div>
      )}

      {/* اقتراحات سريعة */}
      {size === 'lg' && (
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {[
            { label: t('searchPage.trendingLabel'), value: 'Trending' },
            { label: t('searchPage.musicLabel'), value: 'Music' },
            { label: t('searchPage.sportsLabel'), value: 'Sports' },
            { label: t('searchPage.techLabel'), value: 'Technology' },
            { label: t('searchPage.newsLabel'), value: 'News' }
          ].map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              onClick={() => {
                onQueryChange(suggestion.value);
                onSearch();
              }}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-white rounded-full text-xs transition-all duration-200 active:scale-95"
            >
              #{suggestion.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
};

export default SearchBar;

