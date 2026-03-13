// Unit tests for i18n (Internationalization)

const {
  translations,
  setLanguage,
  t,
  applyTranslations,
  updateDynamicText
} = require('../test-shim');

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
      const ruKeys = Object.keys(translations.ru);
      const enKeys = Object.keys(translations.en);
      
      ruKeys.forEach(key => {
        expect(enKeys).toContain(key);
      });
    });
  });

  describe('setLanguage', () => {
    test('should set language to Russian', () => {
      setLanguage('ru');
      expect(t('disconnected')).toBe('Отключено');
    });

    test('should set language to English', () => {
      setLanguage('en');
      expect(t('disconnected')).toBe('Disconnected');
    });

    test('should default to English for unknown language', () => {
      setLanguage('unknown');
      // Should fall back to English per implementation
      expect(t('disconnected')).toBe('Disconnected');
    });
  });

  describe('t() - translation function', () => {
    test('should translate Russian text', () => {
      setLanguage('ru');
      const result = t('disconnected');
      expect(result).toBe('Отключено');
    });

    test('should translate English text', () => {
      setLanguage('en');
      const result = t('disconnected');
      expect(result).toBe('Disconnected');
    });

    test('should return key for missing translation', () => {
      setLanguage('ru');
      const result = t('nonexistent_key');
      expect(result).toBe('nonexistent_key');
    });

    test('should handle empty key', () => {
      setLanguage('ru');
      const result = t('');
      expect(result).toBe('');
    });
  });

  describe('applyTranslations', () => {
    test('should translate data-i18n elements', () => {
      document.body.innerHTML = `
        <span data-i18n="disconnected">Original</span>
        <span data-i18n="connected">Original</span>
      `;
      
      setLanguage('ru');
      applyTranslations();
      
      expect(document.body.querySelector('[data-i18n="disconnected"]').textContent).toBe('Отключено');
      expect(document.body.querySelector('[data-i18n="connected"]').textContent).toBe('Подключено');
    });

    test('should handle missing translations gracefully', () => {
      document.body.innerHTML = `<span data-i18n="missing_key">Original</span>`;
      
      setLanguage('ru');
      applyTranslations();
      
      expect(document.body.querySelector('[data-i18n="missing_key"]').textContent).toBe('Original');
    });
  });

  describe('updateDynamicText', () => {
    test('should update text content', () => {
      document.body.innerHTML = `
        <div class="status-text">Original</div>
      `;
      
      setLanguage('ru');
      updateDynamicText();
      
      expect(document.querySelector('.status-text').textContent).toBe('Отключено');
    });

    test('should handle non-existent element', () => {
      expect(() => {
        updateDynamicText();
      }).not.toThrow();
    });
  });
});
