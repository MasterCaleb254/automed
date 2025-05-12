import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: 'en', // Default language
  fallbackLng: 'en', // Fallback language if translation is missing
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

// In your i18n.js (or wherever you handle translations)
const resources = {
  en: {
    translation: {
      "startVoiceInput": "Start Voice Input",
      "submit": "Submit",
      "error": "Something went wrong, please try again.",
      // Add any other missing keys
    }
  },
  // Add other languages (e.g., "es", "fr")
};

