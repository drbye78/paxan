// PeasyProxy - Performance Optimization Module
// Handles lazy loading, caching, debouncing, and performance improvements

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// LAZY LOADING
// ============================================================================

// Virtual scroll configuration
const VIRTUAL_SCROLL_CONFIG = {
  itemHeight: 72,          // Height of each proxy item
  bufferSize: 5,           // Items to render above/below viewport
  overscan: 10,            // Extra items for smooth scrolling
  threshold: 50            // Minimum items before virtualizing
};

// Lazy load proxy images (flags)
function lazyLoadFlags(container) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px'
  });

  container.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });

  return observer;
}

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

// Memory cache with TTL
class MemoryCache {
  constructor(maxSize = 100, ttl = THRESHOLDS.CACHE_TTL) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  set(key, value) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// IndexedDB cache for large data
class IndexedDBCache {
  constructor(dbName = 'PeasyProxyCache', storeName = 'proxies') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async set(key, value) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({
        key,
        value,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
        } else {
          // Check TTL
          if (Date.now() - result.timestamp > THRESHOLDS.CACHE_TTL) {
            this.delete(key);
            resolve(null);
          } else {
            resolve(result.value);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Create singleton instances
const memoryCache = new MemoryCache();
const indexedDBCache = new IndexedDBCache();

// ============================================================================
// DEBOUNCING & THROTTLING
// ============================================================================

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// RequestAnimationFrame throttle for scroll events
function rafThrottle(func) {
  let ticking = false;
  return function(...args) {
    if (!ticking) {
      requestAnimationFrame(() => {
        func.apply(this, args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

// Batch DOM updates
class DOMBatcher {
  constructor() {
    this.queue = [];
    this.scheduled = false;
  }

  add(update) {
    this.queue.push(update);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    const updates = this.queue.splice(0);
    updates.forEach(update => update());
    this.scheduled = false;
  }
}

// Batch storage operations
class StorageBatcher {
  constructor() {
    this.queue = new Map();
    this.scheduled = false;
  }

  set(key, value) {
    this.queue.set(key, value);
    if (!this.scheduled) {
      this.scheduled = true;
      setTimeout(() => this.flush(), 100);
    }
  }

  async flush() {
    if (this.queue.size === 0) {
      this.scheduled = false;
      return;
    }

    const updates = Object.fromEntries(this.queue);
    this.queue.clear();
    this.scheduled = false;

    await chrome.storage.local.set(updates);
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
  }

  start(name) {
    this.marks.set(name, performance.now());
  }

  end(name) {
    const start = this.marks.get(name);
    if (start) {
      const duration = performance.now() - start;
      this.measures.push({ name, duration, timestamp: Date.now() });
      this.marks.delete(name);

      // Keep only last 100 measures
      if (this.measures.length > 100) {
        this.measures.shift();
      }

      return duration;
    }
    return null;
  }

  getStats(name) {
    const filtered = this.measures.filter(m => m.name === name);
    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.duration);
    return {
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      last: durations[durations.length - 1]
    };
  }

  getAllStats() {
    const names = [...new Set(this.measures.map(m => m.name))];
    return names.reduce((acc, name) => {
      acc[name] = this.getStats(name);
      return acc;
    }, {});
  }

  clear() {
    this.marks.clear();
    this.measures = [];
  }
}

// ============================================================================
// OPTIMIZED PROXY OPERATIONS
// ============================================================================

// Optimized proxy filtering with memoization
function createMemoizedFilter(filterFn) {
  const cache = new Map();
  
  return function(proxies, ...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      const cached = cache.get(key);
      // Check if proxies have changed
      if (cached.proxies === proxies) {
        return cached.result;
      }
    }
    
    const result = filterFn(proxies, ...args);
    cache.set(key, { proxies, result });
    
    // Clear old cache entries
    if (cache.size > 10) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
}

// Optimized sorting with caching
function createMemoizedSort(sortFn) {
  const cache = new WeakMap();
  
  return function(proxies) {
    if (cache.has(proxies)) {
      return cache.get(proxies);
    }
    
    const sorted = [...proxies].sort(sortFn);
    cache.set(proxies, sorted);
    
    return sorted;
  };
}

// Chunk large operations
function chunkOperation(items, operation, chunkSize = 100) {
  return new Promise((resolve) => {
    const results = [];
    let index = 0;

    function processChunk() {
      const chunk = items.slice(index, index + chunkSize);
      chunk.forEach(item => {
        results.push(operation(item));
      });
      
      index += chunkSize;
      
      if (index < items.length) {
        requestAnimationFrame(processChunk);
      } else {
        resolve(results);
      }
    }

    requestAnimationFrame(processChunk);
  });
}

// ============================================================================
// MEMORY OPTIMIZATION
// ============================================================================

// Weak reference cache for proxy objects
class WeakCache {
  constructor() {
    this.cache = new WeakMap();
  }

  set(key, value) {
    if (typeof key === 'object' && key !== null) {
      this.cache.set(key, value);
    }
  }

  get(key) {
    if (typeof key === 'object' && key !== null) {
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    if (typeof key === 'object' && key !== null) {
      return this.cache.has(key);
    }
    return false;
  }
}

// Garbage collection helper
function cleanupUnusedReferences() {
  // Clear expired cache entries
  memoryCache.clear();
  
  // Force garbage collection if available (Chrome only)
  if (window.gc) {
    window.gc();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Lazy loading
  lazyLoadFlags,
  VIRTUAL_SCROLL_CONFIG,
  
  // Caching
  MemoryCache,
  IndexedDBCache,
  memoryCache,
  indexedDBCache,
  
  // Debouncing & Throttling
  debounce,
  throttle,
  rafThrottle,
  
  // Batch operations
  DOMBatcher,
  StorageBatcher,
  
  // Performance monitoring
  PerformanceMonitor,
  
  // Optimized operations
  createMemoizedFilter,
  createMemoizedSort,
  chunkOperation,
  
  // Memory optimization
  WeakCache,
  cleanupUnusedReferences
};