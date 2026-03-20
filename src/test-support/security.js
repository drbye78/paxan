// Security Module - Simplified for MV3
// Note: webRequest blocking is not available in Manifest V3
// WebRTC protection is handled by webrtc-blocker.js content script

// ============================================================================
// INPUT VALIDATION FUNCTIONS
// ============================================================================

// Validate IP address format
function validateProxyInput(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Sanitize input first
  const sanitized = ip.replace(/<[^>]*>/g, '');
  
  // Check if it's a valid IPv4 format
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = sanitized.match(ipv4Regex);
  
  if (!match) return false;
  
  // Check each octet is valid (0-255)
  const octets = [match[1], match[2], match[3], match[4]];
  return octets.every(o => {
    const num = parseInt(o);
    return num >= 0 && num <= 255;
  });
}

// Validate proxy port
function validateProxyPort(port) {
  if (typeof port === 'string') {
    port = parseInt(port);
  }
  
  if (typeof port !== 'number' || isNaN(port)) return false;
  return port >= 1 && port <= 65535;
}

// Validate proxy type
function validateProxyType(type) {
  if (!type || typeof type !== 'string') return false;
  
  // Sanitize input
  const sanitized = type.replace(/<[^>]*>/g, '');
  
  const validTypes = ['HTTPS', 'HTTP', 'SOCKS5', 'SOCKS4'];
  return validTypes.includes(sanitized.toUpperCase());
}

// Validate proxy URL
function validateProxyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Sanitize input
  const sanitized = url.replace(/<[^>]*>/g, '');
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:'];
  for (const protocol of dangerousProtocols) {
    if (sanitized.toLowerCase().startsWith(protocol)) return false;
  }
  
  // Check if it's a valid URL
  try {
    const parsed = new URL(sanitized);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Validate proxy authentication
function validateProxyAuth(auth) {
  if (!auth) return true; // Auth is optional
  
  if (typeof auth !== 'object') return false;
  
  // Sanitize username and password
  const username = auth.username?.replace(/<[^>]*>/g, '');
  const password = auth.password?.replace(/<[^>]*>/g, '');
  
  if (!username || !password) return false;
  if (username.length > 100 || password.length > 100) return false;
  
  return true;
}

// Validate proxy source URL
function validateProxySource(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Only allow trusted proxy sources
  const allowedDomains = [
    'proxymania.su',
    'api.proxyscrape.com',
    'raw.githubusercontent.com'
  ];
  
  try {
    const parsed = new URL(url);
    return allowedDomains.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Validate storage data integrity
function validateStorageData(data) {
  if (!data || typeof data !== 'object') return false;
  
  // Check for suspicious data patterns
  const suspiciousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of suspiciousKeys) {
    if (key in data) return false;
  }
  
  return true;
}

// Sanitize proxy data from external sources
function sanitizeProxyData(proxy) {
  if (!proxy) return proxy;
  
  const sanitize = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  };
  
  const sanitized = { ...proxy };
  
  if (sanitized.ip) sanitized.ip = sanitize(sanitized.ip);
  if (sanitized.port) {
    const portNum = parseInt(sanitized.port);
    sanitized.port = isNaN(portNum) ? sanitized.port : portNum;
  }
  if (sanitized.country) sanitized.country = sanitize(sanitized.country);
  if (sanitized.type) sanitized.type = sanitize(sanitized.type);
  if (sanitized.speed) sanitized.speed = sanitize(sanitized.speed);
  if (sanitized.ipPort) sanitized.ipPort = sanitize(sanitized.ipPort);
  
  return sanitized;
}

// Filter malicious proxies from parsed data
function filterMaliciousProxies(proxies) {
  if (!Array.isArray(proxies)) return [];
  
  return proxies.filter(proxy => {
    // Skip proxies with suspicious content
    if (!proxy.ip || !validateProxyInput(proxy.ip)) return false;
    if (!validateProxyPort(proxy.port)) return false;
    
    // Block internal/private IPs (SSRF protection)
    const ip = proxy.ip;
    if (ip.startsWith('127.') || 
        ip.startsWith('10.') || 
        ip.startsWith('192.168.') || 
        ip.startsWith('169.254.')) {
      return false;
    }
    
    // Check for XSS patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /onmouseover=/i,
      /alert\(/i
    ];
    
    const proxyStr = JSON.stringify(proxy).toLowerCase();
    if (suspiciousPatterns.some(pattern => pattern.test(proxyStr))) {
      return false;
    }
    
    return true;
  });
}

// Rate limiting for proxy fetch
let fetchTimestamps = [];
function rateLimitProxyFetch() {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10;
  
  fetchTimestamps = fetchTimestamps.filter(t => now - t < windowMs);
  
  if (fetchTimestamps.length >= maxRequests) {
    return false;
  }
  
  fetchTimestamps.push(now);
  return true;
}

// Rate limiting for connections
let connectionTimestamps = [];
function rateLimitConnection() {
  const now = Date.now();
  const windowMs = 10000; // 10 seconds
  const maxConnections = 5;
  
  connectionTimestamps = connectionTimestamps.filter(t => now - t < windowMs);
  
  if (connectionTimestamps.length >= maxConnections) {
    return false;
  }
  
  connectionTimestamps.push(now);
  return true;
}

// Encrypt/decrypt sensitive proxy data using Web Crypto API
// Uses AES-GCM with PBKDF2 key derivation

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptProxyData(data, password = 'ProxyManiaSecureKey') {
  if (!data) return null;
  
  try {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const key = await deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv },
      key,
      encoder.encode(JSON.stringify(data))
    );
    
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

export async function decryptProxyData(encryptedData, password = 'ProxyManiaSecureKey') {
  if (!encryptedData) return null;
  
  try {
    const combined = new Uint8Array(base64ToArrayBuffer(encryptedData));
    
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const data = combined.slice(SALT_LENGTH + IV_LENGTH);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv },
      key,
      data
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Handle proxy errors securely
function handleProxyError(error) {
  if (!error) return { message: 'Unknown error occurred' };
  
  // Sanitize error message to prevent XSS
  const sanitized = error.toString().replace(/<[^>]*>/g, '');
  
  // Log error but don't expose sensitive info
  const safeMessage = sanitized.replace(/ip:\s*\d+\.\d+\.\d+\.\d+/gi, 'ip: [REDACTED]');
  
  return { message: safeMessage };
}

// Log proxy activity (without sensitive data)
function logProxyActivity(action, proxy) {
  const logEntry = {
    timestamp: Date.now(),
    action,
    proxyType: proxy?.type,
    country: proxy?.country,
    // Don't log IP/port for privacy
  };
  
  console.log('[Security] Proxy activity:', logEntry);
  
  // Store in chrome.storage for audit trail
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['activityLog'], (result) => {
      const log = result.activityLog || [];
      log.push(logEntry);
      // Keep only last 100 entries
      if (log.length > 100) log.shift();
      chrome.storage.local.set({ activityLog: log });
    });
  }
}

// Sanitize proxy data for display (removes any remaining HTML)
function sanitizeProxyForDisplay(proxy) {
  if (!proxy) return null;
  
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    // Remove HTML tags and dangerous characters
    return str.replace(/<[^>]*>/g, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+=/gi, '')
              .trim();
  };
  
  return {
    ...proxy,
    ip: sanitizeString(proxy.ip),
    country: sanitizeString(proxy.country),
    type: sanitizeString(proxy.type),
    speed: sanitizeString(proxy.speed),
    ipPort: sanitizeString(proxy.ipPort)
  };
}

class SecurityManager {
  constructor() {
    this.dnsLeakProtection = true;
    this.webRtcProtection = true;
    this.securityStatus = 'secure';
    this.lastSecurityCheck = null;
    
    this.init();
  }

  async init() {
    await this.loadSecuritySettings();
    this.startSecurityMonitoring();
  }

  async loadSecuritySettings() {
    try {
      const result = await chrome.storage.local.get(['security']);
      if (result.security) {
        this.dnsLeakProtection = result.security.dnsLeakProtection !== false;
        this.webRtcProtection = result.security.webRtcProtection !== false;
        this.securityStatus = result.security.securityStatus || 'secure';
        this.lastSecurityCheck = result.security.lastSecurityCheck;
      } else {
        await this.saveSecuritySettings();
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  }

  async saveSecuritySettings() {
    try {
      await chrome.storage.local.set({
        security: {
          dnsLeakProtection: this.dnsLeakProtection,
          webRtcProtection: this.webRtcProtection,
          securityStatus: this.securityStatus,
          lastSecurityCheck: this.lastSecurityCheck
        }
      });
    } catch (error) {
      console.error('Error saving security settings:', error);
    }
  }

  startSecurityMonitoring() {
    // Note: In MV3, we cannot use webRequest for blocking
    // Security status is informational only
    this.lastSecurityCheck = Date.now();
  }

  async toggleDnsLeakProtection(enabled) {
    this.dnsLeakProtection = enabled;
    await this.saveSecuritySettings();
    return { success: true, enabled };
  }

  async toggleWebRtcProtection(enabled) {
    this.webRtcProtection = enabled;
    await this.saveSecuritySettings();
    
    // Inject or remove WebRTC blocker based on setting
    if (enabled) {
      await this.injectWebRtcBlocker();
    }
    
    return { success: true, enabled };
  }

  async injectWebRtcBlocker() {
    try {
      if (typeof chrome !== 'undefined' && chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { allFrames: true },
          files: ['src/modules/webrtc-blocker.js']
        });
      }
    } catch (error) {
      console.warn('Failed to inject WebRTC blocker:', error);
    }
  }

  getSecurityStatus() {
    return {
      status: this.securityStatus,
      dnsLeakProtection: this.dnsLeakProtection,
      webRtcProtection: this.webRtcProtection,
      lastCheck: this.lastSecurityCheck,
      note: 'WebRTC protection active via content script'
    };
  }

  resetSecurityAlerts() {
    this.securityStatus = 'secure';
  }
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Validation functions
    validateProxyInput,
    validateProxyPort,
    validateProxyType,
    validateProxyUrl,
    validateProxyAuth,
    validateProxySource,
    validateStorageData,
    
    // Sanitization functions
    sanitizeProxyData,
    sanitizeProxyForDisplay,
    filterMaliciousProxies,
    
    // Security functions
    rateLimitProxyFetch,
    rateLimitConnection,
    encryptProxyData,
    decryptProxyData,
    handleProxyError,
    logProxyActivity
  };
}
