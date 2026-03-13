// Test compatibility shim - re-exports functions from ES modules
// This allows existing tests to work with the new ES module structure

const { 
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
} = require('../src/modules/security.js');

const { 
  RateLimiter, 
  proxyFetchLimiter, 
  proxyTestLimiter, 
  debounce, 
  throttle 
} = require('../src/utils/rate-limiter.js');

const { translations, setLanguage, t, applyTranslations, updateDynamicText } = require('../src/popup/i18n.js');

const { ReputationEngine } = require('../src/core/reputation-engine.js');

const { TamperDetector } = require('../src/security/tamper-detection.js');

const { VirtualScroller } = require('../src/popup/virtual-scroller.js');

module.exports = {
  // Security functions
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
  
  // Rate limiter
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
  
  // Reputation Engine
  ReputationEngine,
  
  // Tamper Detector
  TamperDetector,
  
  // Virtual Scroller
  VirtualScroller
};
