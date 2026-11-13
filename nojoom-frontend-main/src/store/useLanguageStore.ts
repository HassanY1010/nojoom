import { create } from 'zustand';
import i18n from '../i18n';

interface LanguageState {
  currentLanguage: string;
  isRTL: boolean;
  direction: 'rtl' | 'ltr';
  changeLanguage: (lng: string) => void;
  init: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  currentLanguage: i18n.language || 'en',
  isRTL: i18n.language === 'ar',
  direction: i18n.language === 'ar' ? 'rtl' : 'ltr',

  changeLanguage: (lng) => {
    i18n.changeLanguage(lng);
    const isRTL = lng === 'ar';
    const direction = isRTL ? 'rtl' : 'ltr';

    set({ 
      currentLanguage: lng, 
      isRTL, 
      direction 
    });

    document.documentElement.dir = direction;
    document.documentElement.lang = lng;

    if (lng === 'ar') {
      document.body.style.fontFamily = "'Tajawal', 'Poppins', sans-serif";
    } else {
      document.body.style.fontFamily = "'Poppins', 'Tajawal', sans-serif";
    }
  },

  init: () => {
    const lng = i18n.language || 'en';
    const isRTL = lng === 'ar';
    const direction = isRTL ? 'rtl' : 'ltr';
    
    document.documentElement.dir = direction;
    document.documentElement.lang = lng;
    
    if (lng === 'ar') {
      document.body.style.fontFamily = "'Tajawal', 'Poppins', sans-serif";
    } else {
      document.body.style.fontFamily = "'Poppins', 'Tajawal', sans-serif";
    }

    set({ currentLanguage: lng, isRTL, direction });

    const handleLanguageChange = (newLng: string) => {
      const isRTL = newLng === 'ar';
      set({ currentLanguage: newLng, isRTL, direction: isRTL ? 'rtl' : 'ltr' });
    };

    i18n.on('languageChanged', handleLanguageChange);
  }
}));
