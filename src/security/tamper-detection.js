const TEST_ENDPOINTS = [
  { url: 'https://httpbin.org/headers', hash: null },
  { url: 'https://httpbin.org/ip', hash: null },
  { url: 'https://api.ipify.org?format=json', hash: null }
];

const EXPECTED_HEADERS = {
  'accept': 'application/json',
  'user-agent': null
};

class TamperDetector {
  constructor() {
    this.baselines = {};
    this.suspiciousProxies = new Set();
  }

  async init() {
    const result = await chrome.storage.local.get(['tamperBaselines']);
    this.baselines = result.tamperBaselines || {};
  }

  async save() {
    await chrome.storage.local.set({ tamperBaselines: this.baselines });
  }

  async testProxy(proxy) {
    const results = [];
    
    for (const endpoint of TEST_ENDPOINTS) {
      try {
        const result = await this.verifyContent(proxy, endpoint.url);
        results.push(result);
      } catch (error) {
        results.push({
          url: endpoint.url,
          tampered: false,
          error: error.message
        });
      }
    }
    
    const tampered = results.some(r => r.tampered);
    const suspiciousCount = results.filter(r => r.suspicious).length;
    
    return {
      proxy: proxy.ipPort,
      tested: Date.now(),
      tampered,
      suspicious: suspiciousCount > 0,
      results
    };
  }

  async verifyContent(proxy, url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const proxyConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1', '::1']
        }
      };
      
      await chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' });
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      await chrome.proxy.settings.clear({ scope: 'regular' });
      
      const content = await response.text();
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      
      const tampered = this.detectTampering(headers, content, url);
      const suspicious = this.detectSuspiciousContent(headers, content);
      
      return {
        url,
        tampered,
        suspicious,
        status: response.status,
        headers,
        contentLength: content.length
      };
    } catch (error) {
      clearTimeout(timeoutId);
      try {
        await chrome.proxy.settings.clear({ scope: 'regular' });
      } catch (e) {}
      
      return {
        url,
        tampered: false,
        error: error.message
      };
    }
  }

  detectTampering(headers, content, url) {
    if (url.includes('httpbin.org/headers')) {
      const userAgent = headers['user-agent'] || '';
      
      if (userAgent.length > 200) return true;
      
      if (content.includes('<script') || content.includes('eval(')) {
        return true;
      }
    }
    
    if (url.includes('httpbin.org/ip')) {
      try {
        const data = JSON.parse(content);
        if (!data.origin) return true;
      } catch {
        return true;
      }
    }
    
    return false;
  }

  detectSuspiciousContent(headers, content) {
    const suspiciousPatterns = [
      '<script',
      'eval(',
      'document.cookie',
      'localStorage',
      'sessionStorage'
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (content.toLowerCase().includes(pattern)) {
        return true;
      }
    }
    
    if (headers['content-type'] && 
        !headers['content-type'].includes('html') &&
        !headers['content-type'].includes('json') &&
        !headers['content-type'].includes('text')) {
      return false;
    }
    
    return false;
  }

  async establishBaseline(proxy, url) {
    try {
      const content = await this.fetchDirect(url);
      const hash = await this.hashContent(content);
      
      this.baselines[url] = {
        hash,
        content: content.substring(0, 500),
        established: Date.now()
      };
      
      await this.save();
      return { success: true, hash };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fetchDirect(url) {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });
    return response.text();
  }

  async hashContent(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  addToSuspicious(ipPort) {
    this.suspiciousProxies.add(ipPort);
  }

  removeFromSuspicious(ipPort) {
    this.suspiciousProxies.delete(ipPort);
  }

  isSuspicious(ipPort) {
    return this.suspiciousProxies.has(ipPort);
  }

  getSuspiciousList() {
    return Array.from(this.suspiciousProxies);
  }

  async clearBaselines() {
    this.baselines = {};
    await this.save();
  }
}

export { TamperDetector, TEST_ENDPOINTS, EXPECTED_HEADERS };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TamperDetector, TEST_ENDPOINTS, EXPECTED_HEADERS };
}
