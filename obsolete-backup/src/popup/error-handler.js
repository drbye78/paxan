class ErrorHandler {
  static errors = [];
  static maxErrors = 50;

  static log(error, context = {}) {
    const errorEntry = {
      message: error.message || String(error),
      stack: error.stack || '',
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
    
    this.errors.unshift(errorEntry);
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }
    
    console.error('[ErrorHandler]', errorEntry);
    return errorEntry;
  }

  static async wrap(promise, fallback = null) {
    try {
      return await promise;
    } catch (error) {
      this.log(error, { action: 'wrap' });
      return fallback;
    }
  }

  static wrapSync(fn, fallback = null) {
    try {
      return fn();
    } catch (error) {
      this.log(error, { action: 'wrapSync' });
      return fallback;
    }
  }

  static showUserError(message, type = 'error') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  static getErrors() {
    return this.errors;
  }

  static clearErrors() {
    this.errors = [];
  }

  static async reportToStorage() {
    await chrome.storage.local.set({ errorLog: this.errors.slice(0, 20) });
  }
}

window.addEventListener('error', (event) => {
  ErrorHandler.log(event.error || new Error(event.message), {
    type: 'unhandled',
    filename: event.filename,
    lineno: event.lineno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.log(event.reason || new Error('Unhandled Promise Rejection'), {
    type: 'unhandledRejection'
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler };
}
