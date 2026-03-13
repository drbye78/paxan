class AppState {
  constructor() {
    this.state = {
      proxies: [],
      filteredProxies: [],
      currentProxy: null,
      settings: {
        theme: 'dark',
        autoFailover: true,
        testBeforeConnect: true,
        notifications: true,
        refreshInterval: 300000,
        proxySource: 'proxymania'
      },
      activeProxy: null,
      connectionStartTime: null,
      isConnected: false,
      isLoading: false,
      error: null,
      favorites: [],
      recentlyUsed: [],
      stats: {},
      dailyStats: {
        proxiesUsed: 0,
        connectionTime: 0,
        attempts: 0,
        successes: 0
      },
      filters: {
        country: null,
        type: null,
        speed: null,
        search: ''
      },
      activeTab: 'all',
      reputation: {},
      tamperResults: {}
    };
    
    this.listeners = [];
    this.initialized = false;
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  get(key) {
    return key ? this.state[key] : this.state;
  }

  async update(key, value) {
    if (typeof key === 'object') {
      this.state = { ...this.state, ...key };
    } else {
      this.state[key] = value;
    }
    this.notify();
    await this.persist();
  }

  async init() {
    if (this.initialized) return;
    
    try {
      const data = await chrome.storage.local.get([
        'proxies',
        'activeProxy',
        'settings',
        'favorites',
        'recentlyUsed',
        'proxyStats',
        'dailyStats',
        'connectionStartTime'
      ]);
      
      this.state.proxies = data.proxies || [];
      this.state.filteredProxies = this.state.proxies;
      this.state.activeProxy = data.activeProxy || null;
      this.state.settings = { ...this.state.settings, ...data.settings };
      this.state.favorites = data.favorites || [];
      this.state.recentlyUsed = data.recentlyUsed || [];
      this.state.stats = data.proxyStats || {};
      this.state.dailyStats = data.dailyStats || this.state.dailyStats;
      this.state.connectionStartTime = data.connectionStartTime;
      this.state.isConnected = !!data.activeProxy;
      
      this.applyFilters();
      this.initialized = true;
      this.notify();
    } catch (error) {
      console.error('State init error:', error);
    }
  }

  async persist() {
    try {
      await chrome.storage.local.set({
        proxies: this.state.proxies,
        activeProxy: this.state.activeProxy,
        settings: this.state.settings,
        favorites: this.state.favorites,
        recentlyUsed: this.state.recentlyUsed,
        proxyStats: this.state.stats,
        dailyStats: this.state.dailyStats,
        connectionStartTime: this.state.connectionStartTime
      });
    } catch (error) {
      console.error('State persist error:', error);
    }
  }

  setProxies(proxies) {
    this.state.proxies = proxies;
    this.applyFilters();
    this.notify();
  }

  setFilter(key, value) {
    this.state.filters[key] = value;
    this.applyFilters();
    this.notify();
  }

  clearFilters() {
    this.state.filters = {
      country: null,
      type: null,
      speed: null,
      search: ''
    };
    this.applyFilters();
    this.notify();
  }

  applyFilters() {
    let filtered = [...this.state.proxies];
    
    if (this.state.filters.country) {
      filtered = filtered.filter(p => 
        p.country === this.state.filters.country
      );
    }
    
    if (this.state.filters.type) {
      filtered = filtered.filter(p => 
        p.type === this.state.filters.type
      );
    }
    
    if (this.state.filters.speed) {
      const speedMap = {
        'ultra': 100,
        'fast': 300,
        'medium': 1000
      };
      const maxSpeed = speedMap[this.state.filters.speed];
      if (maxSpeed) {
        filtered = filtered.filter(p => 
          p.speedMs < maxSpeed
        );
      }
    }
    
    if (this.state.filters.search) {
      const search = this.state.filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.ipPort.toLowerCase().includes(search) ||
        p.country.toLowerCase().includes(search)
      );
    }
    
    if (this.state.activeTab === 'favorites') {
      filtered = filtered.filter(p => 
        this.state.favorites.includes(p.ipPort)
      );
    } else if (this.state.activeTab === 'recent') {
      filtered = filtered.slice(0, 10);
    }
    
    this.state.filteredProxies = filtered;
  }

  async connect(proxy) {
    this.state.isLoading = true;
    this.state.error = null;
    this.notify();
    
    try {
      await chrome.runtime.sendMessage({
        action: 'setProxy',
        proxy
      });
      
      this.state.activeProxy = proxy;
      this.state.isConnected = true;
      this.state.connectionStartTime = Date.now();
      
      if (!this.state.recentlyUsed.includes(proxy.ipPort)) {
        this.state.recentlyUsed.unshift(proxy.ipPort);
        if (this.state.recentlyUsed.length > 10) {
          this.state.recentlyUsed.pop();
        }
      }
      
      this.state.dailyStats.proxiesUsed++;
      this.state.dailyStats.connectionTime = 0;
      
      await this.persist();
      this.notify();
    } catch (error) {
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
  }

  async disconnect() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearProxy' });
      
      if (this.state.connectionStartTime) {
        const duration = Math.floor((Date.now() - this.state.connectionStartTime) / 1000);
        this.state.dailyStats.connectionTime += duration;
      }
      
      this.state.activeProxy = null;
      this.state.isConnected = false;
      this.state.connectionStartTime = null;
      
      await this.persist();
      this.notify();
    } catch (error) {
      this.state.error = error.message;
      throw error;
    }
  }

  toggleFavorite(proxy) {
    const index = this.state.favorites.indexOf(proxy.ipPort);
    if (index === -1) {
      this.state.favorites.push(proxy.ipPort);
    } else {
      this.state.favorites.splice(index, 1);
    }
    this.notify();
    this.persist();
  }

  isFavorite(proxy) {
    return this.state.favorites.includes(proxy.ipPort);
  }

  setActiveTab(tab) {
    this.state.activeTab = tab;
    this.applyFilters();
    this.notify();
  }

  async updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.notify();
    await this.persist();
  }

  getProxyByIpPort(ipPort) {
    return this.state.proxies.find(p => p.ipPort === ipPort);
  }

  getFilteredProxies() {
    return this.state.filteredProxies;
  }

  getUniqueCountries() {
    const countries = new Set();
    this.state.proxies.forEach(p => {
      if (p.country) countries.add(p.country);
    });
    return Array.from(countries).sort();
  }
}

const store = new AppState();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppState, store };
}
