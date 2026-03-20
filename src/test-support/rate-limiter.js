class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  async execute(fn) {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldest);
      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime));
        return this.execute(fn);
      }
    }
    
    this.requests.push(now);
    return fn();
  }

  canProceed() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindow);
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }

  getTimeUntilNextRequest() {
    if (this.canProceed()) return 0;
    const oldest = this.requests[0];
    return this.timeWindow - (Date.now() - oldest);
  }
}

const proxyFetchLimiter = new RateLimiter(1, 300000);
const proxyTestLimiter = new RateLimiter(5, 60000);

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export { RateLimiter, proxyFetchLimiter, proxyTestLimiter, debounce, throttle };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RateLimiter, proxyFetchLimiter, proxyTestLimiter, debounce, throttle };
}
