// PeasyProxy VPN - Settings Module
// Settings management, theme application, language handling

import { getState, setState, updateSetting, getSettings } from './state.js';
import { $ } from './dom.js';
import { saveSettings } from './storage.js';

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Load settings from storage and update UI
 * @returns {Promise<Object>} - Settings object
 */
export async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) {
      setState({ settings: result.settings });
    }
    
    // Update UI elements
    updateSettingsUI();
    
    return result.settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

/**
 * Update settings UI elements to match current state
 */
function updateSettingsUI() {
  const { settings } = getSettings();
  
  const themeSelect = $('themeSelect');
  const languageSelect = $('languageSelect');
  const refreshInterval = $('refreshInterval');
  const proxySource = $('proxySource');
  const autoFailoverToggle = $('autoFailoverToggle');
  const testBeforeConnectToggle = $('testBeforeConnectToggle');
  const autoConnectToggle = $('autoConnectToggle');
  const notificationsToggle = $('notificationsToggle');
  
  if (themeSelect) themeSelect.value = settings.theme || 'dark';
  if (languageSelect) languageSelect.value = settings.language || 'ru';
  if (refreshInterval) refreshInterval.value = settings.refreshInterval?.toString() || '300000';
  if (proxySource) proxySource.value = settings.proxySource || 'peasyproxy';
  if (autoFailoverToggle) autoFailoverToggle.classList.toggle('active', settings.autoFailover !== false);
  if (testBeforeConnectToggle) testBeforeConnectToggle.classList.toggle('active', settings.testBeforeConnect !== false);
  if (autoConnectToggle) autoConnectToggle.classList.toggle('active', settings.autoConnect !== false);
  if (notificationsToggle) notificationsToggle.classList.toggle('active', settings.notifications !== false);
}

/**
 * Save current settings to storage
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSettings() {
  try {
    const { settings } = getSettings();
    await chrome.storage.local.set({ settings });
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Apply current theme to the document
 */
export function applyTheme() {
  const { theme } = getSettings();
  const html = document.documentElement;
  
  if (!html) return;
  
  // Remove all theme classes
  html.classList.remove('theme-dark', 'theme-light', 'theme-auto');
  
  // Apply current theme
  if (theme === 'light') {
    html.classList.add('theme-light');
  } else if (theme === 'auto') {
    html.classList.add('theme-auto');
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('theme-dark');
    } else {
      html.classList.add('theme-light');
    }
  } else {
    // Default to dark
    html.classList.add('theme-dark');
  }
  
  // Update theme select if exists
  const themeSelect = $('themeSelect');
  if (themeSelect) {
    themeSelect.value = theme || 'dark';
  }
}

/**
 * Setup theme change listener
 */
export function setupThemeWatcher() {
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const { theme } = getSettings();
      if (theme === 'auto') {
        applyTheme();
      }
    });
  }
}

/**
 * Toggle between dark and light theme
 */
export function toggleTheme() {
  const { theme } = getSettings();
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  
  updateSetting('theme', newTheme);
  applyTheme();
  saveSettings();
  
  return newTheme;
}

// ============================================================================
// LANGUAGE MANAGEMENT
// ============================================================================

/**
 * Set application language
 * @param {string} lang - Language code (en/ru)
 */
export function setLanguage(lang) {
  if (!lang) lang = 'ru';
  
  updateSetting('language', lang);
  
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = getTranslation(key, lang);
    
    if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
      el.placeholder = translation;
    } else {
      el.textContent = translation;
    }
  });
  
  // Update language select if exists
  const languageSelect = $('languageSelect');
  if (languageSelect) {
    languageSelect.value = lang;
  }
}

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @param {string} lang - Language code
 * @returns {string} - Translated text
 */
function getTranslation(key, lang) {
  // Simple translation map - expand as needed
  const translations = {
    'en': {
      'extension_name': 'PeasyProxy VPN',
      'connect': 'Connect',
      'disconnect': 'Disconnect',
      'settings': 'Settings',
      'loading': 'Loading...',
      'no_proxies': 'No proxies available',
      'search': 'Search proxies...',
      'country': 'Country',
      'type': 'Type',
      'speed': 'Speed',
      'favorites': 'Favorites',
      'recent': 'Recent',
      'all': 'All Proxies'
    },
    'ru': {
      'extension_name': 'PeasyProxy VPN',
      'connect': 'Подключиться',
      'disconnect': 'Отключиться',
      'settings': 'Настройки',
      'loading': 'Загрузка...',
      'no_proxies': 'Нет доступных прокси',
      'search': 'Поиск прокси...',
      'country': 'Страна',
      'type': 'Тип',
      'speed': 'Скорость',
      'favorites': 'Избранное',
      'recent': 'Недавние',
      'all': 'Все прокси'
    }
  };
  
  return translations[lang]?.[key] || key;
}

/**
 * Get available languages
 * @returns {Array} - Array of language objects
 */
export function getAvailableLanguages() {
  return [
    { code: 'ru', name: 'Русский', label: 'Russian' },
    { code: 'en', name: 'English', label: 'English' }
  ];
}

// ============================================================================
// SETTINGS EVENT HANDLERS
// ============================================================================

/**
 * Setup settings panel event listeners
 */
export function setupSettingsListeners() {
  const themeSelect = $('themeSelect');
  const languageSelect = $('languageSelect');
  const refreshInterval = $('refreshInterval');
  const proxySource = $('proxySource');
  const autoFailoverToggle = $('autoFailoverToggle');
  const testBeforeConnectToggle = $('testBeforeConnectToggle');
  const autoConnectToggle = $('autoConnectToggle');
  const notificationsToggle = $('notificationsToggle');
  
  // Theme change
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      updateSetting('theme', e.target.value);
      applyTheme();
      saveSettings();
    });
  }
  
  // Language change
  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      const lang = e.target.value;
      updateSetting('language', lang);
      saveSettings();
      setLanguage(lang);
      
      const langName = e.target.options[e.target.selectedIndex].text;
      showToast(`Language changed to ${langName}`, 'info');
    });
  }
  
  // Refresh interval change
  if (refreshInterval) {
    refreshInterval.addEventListener('change', (e) => {
      updateSetting('refreshInterval', parseInt(e.target.value));
      saveSettings();
      // Restart auto-refresh with new interval
      const { startAutoRefresh } = require('./auto-refresh.js');
      startAutoRefresh();
    });
  }
  
  // Proxy source change
  if (proxySource) {
    proxySource.addEventListener('change', (e) => {
      updateSetting('proxySource', e.target.value);
      saveSettings();
      
      const sourceName = e.target.options[e.target.selectedIndex].text;
      showToast(`Proxy source changed to ${sourceName}`, 'info');
      
      // Reload proxies from new source
      const { loadProxies } = require('./proxy-list.js');
      loadProxies(true);
    });
  }
  
  // Auto-failover toggle
  if (autoFailoverToggle) {
    autoFailoverToggle.addEventListener('click', function() {
      const enabled = !this.classList.contains('active');
      updateSetting('autoFailover', enabled);
      this.classList.toggle('active', enabled);
      saveSettings();
    });
  }
  
  // Test before connect toggle
  if (testBeforeConnectToggle) {
    testBeforeConnectToggle.addEventListener('click', function() {
      const enabled = !this.classList.contains('active');
      updateSetting('testBeforeConnect', enabled);
      this.classList.toggle('active', enabled);
      saveSettings();
    });
  }
  
  // Auto-connect toggle
  if (autoConnectToggle) {
    autoConnectToggle.addEventListener('click', function() {
      const enabled = !this.classList.contains('active');
      updateSetting('autoConnect', enabled);
      this.classList.toggle('active', enabled);
      saveSettings();
      showToast(`Auto-connect ${enabled ? 'enabled' : 'disabled'}`, 'info');
    });
  }
  
  // Notifications toggle
  if (notificationsToggle) {
    notificationsToggle.addEventListener('click', function() {
      const enabled = !this.classList.contains('active');
      updateSetting('notifications', enabled);
      this.classList.toggle('active', enabled);
      saveSettings();
    });
  }
}

// ============================================================================
// IMPORT/EXPORT SETTINGS
// ============================================================================

/**
 * Export settings to JSON file
 */
export function exportSettings() {
  const { settings } = getSettings();
  const dataStr = JSON.stringify(settings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peasyproxy-settings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Settings exported', 'success');
}

/**
 * Import settings from JSON file
 * @param {File} file - Settings file
 * @returns {Promise<boolean>} - Success status
 */
export async function importSettings(file) {
  try {
    const text = await file.text();
    const settings = JSON.parse(text);
    
    // Validate settings structure
    if (typeof settings !== 'object') {
      throw new Error('Invalid settings format');
    }
    
    // Merge with current settings
    setState({ settings });
    await saveSettings();
    
    // Apply new settings
    applyTheme();
    updateSettingsUI();
    
    showToast('Settings imported successfully', 'success');
    return true;
  } catch (error) {
    console.error('Error importing settings:', error);
    showToast('Failed to import settings', 'error');
    return false;
  }
}

// Helper for toast - will be replaced with proper import
function showToast(message, type) {
  console.log(`[Toast] ${type}: ${message}`);
}

// Helper for require - will be replaced with proper import
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
