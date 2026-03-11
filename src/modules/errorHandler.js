// Error Handler Module - Enhanced Error Management
// Phase 1: Security & Core UX

class ErrorHandler {
  constructor() {
    this.errorCategories = {
      NETWORK: 'network',
      PROXY: 'proxy',
      PERMISSION: 'permission',
      STORAGE: 'storage',
      SECURITY: 'security',
      UNKNOWN: 'unknown'
    };
    
    this.errorMessages = {
      // Network errors
      'NETWORK_ERROR': {
        title: 'Network Error',
        message: 'Unable to connect to the internet. Please check your connection.',
        recovery: 'Check your internet connection and try again.',
        category: 'network'
      },
      'TIMEOUT_ERROR': {
        title: 'Connection Timeout',
        message: 'The request timed out. The proxy server may be slow or unavailable.',
        recovery: 'Try a different proxy or wait a moment before retrying.',
        category: 'network'
      },
      
      // Proxy errors
      'PROXY_CONNECTION_FAILED': {
        title: 'Proxy Connection Failed',
        message: 'Unable to connect to the selected proxy server.',
        recovery: 'Try a different proxy or check the proxy status.',
        category: 'proxy'
      },
      'PROXY_TEST_FAILED': {
        title: 'Proxy Test Failed',
        message: 'The proxy server failed the connectivity test.',
        recovery: 'Select a different proxy with a ✓ indicator.',
        category: 'proxy'
      },
      'PROXY_UNAVAILABLE': {
        title: 'Proxy Unavailable',
        message: 'This proxy is currently offline or not responding.',
        recovery: 'Choose another proxy from the list.',
        category: 'proxy'
      },
      
      // Permission errors
      'PERMISSION_DENIED': {
        title: 'Permission Error',
        message: 'Extension permissions are required to configure proxy settings.',
        recovery: 'Check extension permissions in Chrome settings.',
        category: 'permission'
      },
      'PROXY_PERMISSION_ERROR': {
        title: 'Proxy Permission Error',
        message: 'Unable to modify proxy settings. Another extension may be controlling them.',
        recovery: 'Disable other proxy/VPN extensions and try again.',
        category: 'permission'
      },
      
      // Storage errors
      'STORAGE_ERROR': {
        title: 'Storage Error',
        message: 'Unable to save data. Storage may be full or corrupted.',
        recovery: 'Clear extension data and restart Chrome.',
        category: 'storage'
      },
      'CACHE_EXPIRED': {
        title: 'Cache Expired',
        message: 'Proxy list is outdated. Fetching fresh data.',
        recovery: 'Click "Refresh" to get the latest proxy list.',
        category: 'network'
      },
      
      // Security errors
      'DNS_LEAK_DETECTED': {
        title: 'DNS Leak Detected',
        message: 'Your DNS requests may be bypassing the proxy.',
        recovery: 'DNS leak protection is active. Monitor connection status.',
        category: 'security'
      },
      'WEBRTC_LEAK_DETECTED': {
        title: 'WebRTC Leak Detected',
        message: 'Your real IP address may be exposed through WebRTC.',
        recovery: 'WebRTC protection is active. Consider disconnecting if concerned.',
        category: 'security'
      },
      
      // General errors
      'UNKNOWN_ERROR': {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred.',
        recovery: 'Please try again or restart the extension.',
        category: 'unknown'
      }
    };
    
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error || event.message);
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason);
    });
  }

  categorizeError(error) {
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
      return this.errorCategories.NETWORK;
    } else if (errorStr.includes('proxy') || errorStr.includes('connection')) {
      return this.errorCategories.PROXY;
    } else if (errorStr.includes('permission') || errorStr.includes('access')) {
      return this.errorCategories.PERMISSION;
    } else if (errorStr.includes('storage') || errorStr.includes('cache')) {
      return this.errorCategories.STORAGE;
    } else if (errorStr.includes('dns') || errorStr.includes('webrtc')) {
      return this.errorCategories.SECURITY;
    }
    
    return this.errorCategories.UNKNOWN;
  }

  getErrorMessage(error) {
    const errorStr = error.toString().toLowerCase();
    
    // Map specific error patterns to messages
    if (errorStr.includes('fetch')) {
      return this.errorMessages.NETWORK_ERROR;
    } else if (errorStr.includes('timeout')) {
      return this.errorMessages.TIMEOUT_ERROR;
    } else if (errorStr.includes('connection failed')) {
      return this.errorMessages.PROXY_CONNECTION_FAILED;
    } else if (errorStr.includes('test failed')) {
      return this.errorMessages.PROXY_TEST_FAILED;
    } else if (errorStr.includes('unavailable')) {
      return this.errorMessages.PROXY_UNAVAILABLE;
    } else if (errorStr.includes('permission')) {
      return this.errorMessages.PERMISSION_DENIED;
    } else if (errorStr.includes('storage')) {
      return this.errorMessages.STORAGE_ERROR;
    } else if (errorStr.includes('dns leak')) {
      return this.errorMessages.DNS_LEAK_DETECTED;
    } else if (errorStr.includes('webrtc leak')) {
      return this.errorMessages.WEBRTC_LEAK_DETECTED;
    }
    
    return this.errorMessages.UNKNOWN_ERROR;
  }

  handleGlobalError(error) {
    console.error('Global error caught:', error);
    
    // Log error for debugging
    this.logError(error, 'global');
    
    // Show user-friendly error
    this.showError({
      title: 'System Error',
      message: 'An unexpected error occurred in the extension.',
      recovery: 'The error has been logged. Please try again.',
      category: 'unknown',
      error: error
    });
  }

  async handleProxyError(error, proxy = null) {
    const categorizedError = this.categorizeError(error);
    const errorMessage = this.getErrorMessage(error);
    
    // Log the error
    await this.logError(error, 'proxy', proxy);
    
    // Show appropriate error message
    this.showError({
      ...errorMessage,
      proxy: proxy,
      timestamp: Date.now()
    });
    
    // Suggest recovery actions
    this.suggestRecovery(errorMessage, proxy);
  }

  async handleNetworkError(error) {
    const errorMessage = this.getErrorMessage(error);
    
    await this.logError(error, 'network');
    
    this.showError({
      ...errorMessage,
      timestamp: Date.now()
    });
  }

  async handleStorageError(error) {
    const errorMessage = this.getErrorMessage(error);
    
    await this.logError(error, 'storage');
    
    this.showError({
      ...errorMessage,
      timestamp: Date.now()
    });
  }

  showError(errorInfo) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = `toast toast-error error-toast`;
    toast.innerHTML = `
      <span class="toast-icon">⚠️</span>
      <div class="toast-content">
        <div class="toast-title">${errorInfo.title}</div>
        <div class="toast-message">${errorInfo.message}</div>
        <div class="toast-recovery">💡 ${errorInfo.recovery}</div>
      </div>
      <button class="toast-close" title="Dismiss">×</button>
    `;
    
    // Add to toast container
    const container = document.getElementById('toastContainer') || document.body;
    container.appendChild(toast);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 8000);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    });
    
    // Shake animation for critical errors
    if (errorInfo.category === 'security' || errorInfo.category === 'permission') {
      toast.style.animation = 'shake 0.5s ease-in-out';
    }
  }

  suggestRecovery(errorInfo, proxy = null) {
    // Show recovery suggestions in console for developers
    console.log('Recovery suggestions:', errorInfo.recovery);
    
    // For proxy errors, suggest alternatives
    if (proxy && errorInfo.category === 'proxy') {
      console.log('Suggested actions:');
      console.log('1. Try a different proxy');
      console.log('2. Check proxy status indicator');
      console.log('3. Refresh proxy list');
    }
  }

  async logError(error, context, additionalData = null) {
    const errorLog = {
      timestamp: Date.now(),
      error: error.toString(),
      stack: error.stack,
      context: context,
      additionalData: additionalData,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    try {
      // Store error in local storage
      const existingErrors = await this.getStoredErrors();
      existingErrors.push(errorLog);
      
      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }
      
      await chrome.storage.local.set({ errorLogs: existingErrors });
    } catch (storageError) {
      console.error('Failed to log error:', storageError);
    }
  }

  async getStoredErrors() {
    try {
      const result = await chrome.storage.local.get(['errorLogs']);
      return result.errorLogs || [];
    } catch (error) {
      return [];
    }
  }

  async clearErrorLogs() {
    try {
      await chrome.storage.local.remove(['errorLogs']);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Recovery functions
  async retryProxyConnection(proxy) {
    try {
      // Implement retry logic
      const result = await chrome.runtime.sendMessage({
        action: 'testProxy',
        proxy: proxy
      });
      
      if (result.success) {
        // Auto-connect if test passes
        await chrome.runtime.sendMessage({
          action: 'setProxy',
          proxy: proxy
        });
        
        this.showSuccess('Proxy connection restored');
        return true;
      }
      
      return false;
    } catch (error) {
      await this.handleProxyError(error, proxy);
      return false;
    }
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-success`;
    toast.innerHTML = `
      <span class="toast-icon">✓</span>
      <span class="toast-message">${message}</span>
    `;
    
    const container = document.getElementById('toastContainer') || document.body;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Permission recovery
  async checkPermissions() {
    try {
      // Check if proxy permission is granted
      const permissions = await chrome.permissions.getAll();
      
      if (!permissions.permissions.includes('proxy')) {
        throw new Error('Proxy permission not granted');
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Storage recovery
  async clearAndResetStorage() {
    try {
      // Clear all extension data
      await chrome.storage.local.clear();
      
      // Reset to defaults
      await chrome.storage.local.set({
        settings: {
          theme: 'dark',
          autoFailover: true,
          testBeforeConnect: true,
          notifications: true,
          refreshInterval: 300000
        },
        security: {
          dnsLeakProtection: true,
          webRtcProtection: true,
          securityStatus: 'secure'
        }
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export for use in popup.js and background.js
if (typeof module !== 'undefined') {
  module.exports = ErrorHandler;
}

// Initialize error handler
const errorHandler = new ErrorHandler();

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'handleProxyError') {
    errorHandler.handleProxyError(request.error, request.proxy)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'clearErrorLogs') {
    errorHandler.clearErrorLogs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getStoredErrors') {
    errorHandler.getStoredErrors()
      .then(errors => sendResponse({ errors }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});