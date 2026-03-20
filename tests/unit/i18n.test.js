// Unit tests for i18n (Internationalization)

import {
  translations,
  setLanguage,
  t,
  applyTranslations,
  updateDynamicText
} from '../test-shim.js';

describe('i18n - Internationalization', () => {
  describe('translations', () => {
    test('should have Russian translations', () => {
      expect(translations.ru).toBeDefined();
      expect(translations.ru.disconnected).toBeDefined();
    });

    test('should have English translations', () => {
      expect(translations.en).toBeDefined();
      expect(translations.en.disconnected).toBeDefined();
    });

    test('should have same keys in both languages', () => {
      const ruKeys = Object.keys(translations.ru).sort();
      const enKeys = Object.keys(translations.en).sort();
      expect(ruKeys).toEqual(enKeys);
    });
  });

  describe('setLanguage', () => {
    test('should set language to Russian', () => {
      setLanguage('ru');
      expect(document.documentElement.lang).toBe('ru');
    });

    test('should set language to English', () => {
      setLanguage('en');
      expect(document.documentElement.lang).toBe('en');
    });

    test('should default to English for unknown language', () => {
      setLanguage('unknown');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  describe('t() - translation function', () => {
    test('should translate Russian text', () => {
      setLanguage('ru');
      expect(t('disconnected')).toBe('Отключено');
    });

    test('should translate English text', () => {
      setLanguage('en');
      expect(t('disconnected')).toBe('Disconnected');
    });

    test('should return key for missing translation', () => {
      setLanguage('en');
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    test('should handle empty key', () => {
      expect(t('')).toBe('');
    });
  });

  describe('applyTranslations', () => {
    test('should translate data-i18n elements', () => {
      document.body.innerHTML = '<div data-i18n="disconnected"></div>';
      setLanguage('ru');
      applyTranslations();
      expect(document.querySelector('[data-i18n="disconnected"]').textContent).toBe('Отключено');
    });

    test('should handle missing translations gracefully', () => {
      document.body.innerHTML = '<div data-i18n="nonexistent"></div>';
      applyTranslations();
      expect(document.querySelector('[data-i18n="nonexistent"]').textContent).toBe('nonexistent');
    });
  });

  describe('updateDynamicText', () => {
    test('should update text content', () => {
      document.body.innerHTML = '<div id="statusText" data-i18n="disconnected"></div>';
      setLanguage('ru');
      updateDynamicText();
      expect(document.getElementById('statusText').textContent).toBe('Отключено');
    });

    test('should handle non-existent element', () => {
      expect(() => {
        updateDynamicText();
      }).not.toThrow();
    });
  });
});
