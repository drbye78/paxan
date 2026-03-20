// Test compatibility shim - re-exports functions from actual extension code
// This shim provides access to the actual extension modules for testing

// ES module imports from actual extension code
import { ReputationEngine } from '../src/core/reputation-engine.js';

import { TamperDetector, TEST_ENDPOINTS, EXPECTED_HEADERS } from '../src/security/tamper-detection.js';

import { VirtualScroller } from '../src/popup/virtual-scroller.js';

// Import from modules that are kept for test support only
import { 
  validateProxyInput, 
  validateProxyPort, 
  validateProxyType, 
  validateProxyUrl,
  validateProxyAuth,
  validateProxySource,
  validateStorageData,
  sanitizeProxyData,
  sanitizeProxyForDisplay,
  filterMaliciousProxies,
  rateLimitProxyFetch,
  rateLimitConnection,
  encryptProxyData,
  decryptProxyData,
  handleProxyError,
  logProxyActivity
} from '../src/test-support/security.js';

import { 
  RateLimiter, 
  proxyFetchLimiter, 
  proxyTestLimiter, 
  debounce, 
  throttle 
} from '../src/test-support/rate-limiter.js';

// i18n.js uses CommonJS exports (module.exports)
// We need to import it using require() since it's a CommonJS module
// Babel will handle the transformation
const i18nModule = require('../src/popup/i18n.js');
const { translations, setLanguage, t, applyTranslations, updateDynamicText, updateLabels, currentLang } = i18nModule;

// Re-export for both ES modules and CommonJS
export {
  // Security functions (for test support only)
  validateProxyInput,
  validateProxyPort,
  validateProxyType,
  validateProxyUrl,
  validateProxyAuth,
  validateProxySource,
  validateStorageData,
  sanitizeProxyData,
  sanitizeProxyForDisplay,
  filterMaliciousProxies,
  rateLimitProxyFetch,
  rateLimitConnection,
  encryptProxyData,
  decryptProxyData,
  handleProxyError,
  logProxyActivity,
  
  // Rate limiter (for test support only)
  RateLimiter,
  proxyFetchLimiter,
  proxyTestLimiter,
  debounce,
  throttle,
  
  // i18n
  translations,
  setLanguage,
  t,
  applyTranslations,
  updateDynamicText,
  updateLabels,
  currentLang,
  
  // Reputation Engine
  ReputationEngine,
  
  // Tamper Detector
  TamperDetector,
  TEST_ENDPOINTS,
  EXPECTED_HEADERS,
  
  // Virtual Scroller
  VirtualScroller
};
