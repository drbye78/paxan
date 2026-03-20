// Error Handler Module - Simplified for MV3

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
    
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        console.error('Global error:', event.error || event.message);
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled rejection:', event.reason);
      });
    }
  }

  categorizeError(error) {
    const errorStr = (error?.toString() || '').toLowerCase();
    
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
      return this.errorCategories.NETWORK;
    } else if (errorStr.includes('proxy') || errorStr.includes('connection')) {
      return this.errorCategories.PROXY;
    } else if (errorStr.includes('permission') || errorStr.includes('access')) {
      return this.errorCategories.PERMISSION;
    } else if (errorStr.includes('storage') || errorStr.includes('cache')) {
      return this.errorCategories.STORAGE;
    }
    
    return this.errorCategories.UNKNOWN;
  }

  async handleProxyError(error, proxy = null) {
    const category = this.categorizeError(error);
    console.error('Proxy error:', { error, proxy, category });
    
    // Log to storage
    await this.logError(error, category, proxy);
  }

  async handleNetworkError(error) {
    console.error('Network error:', error);
    await this.logError(error, 'network');
  }

  async handleStorageError(error) {
    console.error('Storage error:', error);
    await this.logError(error, 'storage');
  }

  async logError(error, context, additionalData = null) {
    const errorLog = {
      timestamp: Date.now(),
      error: error?.toString() || String(error),
      stack: error?.stack,
      context: context,
      additionalData: additionalData
    };
    
    try {
      const result = await chrome.storage.local.get(['errorLogs']);
      const existingErrors = result.errorLogs || [];
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
}

const errorHandler = new ErrorHandler();
