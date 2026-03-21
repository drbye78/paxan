// Chrome API Mock for PeasyProxy tests

const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null,
  },
  
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
  },
  
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      remove: jest.fn(),
    }
  },
  
  proxy: {
    settings: {
      set: jest.fn(),
      get: jest.fn(),
      clear: jest.fn(),
    }
  },
  
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }
  },
  
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    getAll: jest.fn(),
    onClosed: {
      addListener: jest.fn(),
    }
  },
  
  extension: {
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
  }
};

// Setup global chrome object
global.chrome = mockChrome;

// Helper to reset all mocks
const resetChromeMocks = () => {
  Object.values(mockChrome).forEach(api => {
    if (typeof api === 'object' && api !== null) {
      Object.values(api).forEach(method => {
        if (typeof method === 'object' && method !== null) {
          Object.values(method).forEach(subMethod => {
            if (typeof subMethod === 'function') {
              subMethod.mockClear();
            }
          });
        } else if (typeof method === 'function') {
          method.mockClear();
        }
      });
    }
  });
};

// Helper to setup successful proxy settings
const setupSuccessfulProxySettings = (proxy) => {
  mockChrome.proxy.settings.set.mockImplementation((config, callback) => {
    if (callback) callback();
  });
  
  mockChrome.proxy.settings.get.mockImplementation((options, callback) => {
    const config = {
      levelOfControl: 'controlled_by_this_extension',
      value: {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1']
        }
      }
    };
    if (callback) callback(config);
  });
};

// Helper to setup storage with test data
const setupStorageWith = (data) => {
  mockChrome.storage.local.get.mockImplementation((keys, callback) => {
    let result = {};
    
    if (typeof keys === 'string') {
      result[keys] = data[keys];
    } else if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = data[key];
      });
    } else if (typeof keys === 'object' && keys !== null) {
      Object.keys(keys).forEach(key => {
        result[key] = data[key] !== undefined ? data[key] : keys[key];
      });
    } else {
      // Return all data
      result = { ...data };
    }
    
    if (callback) callback(result);
  });
  
  mockChrome.storage.local.set.mockImplementation((items, callback) => {
    Object.assign(data, items);
    if (callback) callback();
  });
};

// Helper to setup fetch mock
const setupFetchMock = (responses) => {
  const mockFn = jest.fn();
  
  responses.forEach(({ url, response, error }, index) => {
    if (error) {
      mockFn.mockImplementationOnce((fetchUrl) => {
        if (fetchUrl.includes(url) || url.includes(fetchUrl)) {
          return Promise.reject(error);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
    } else {
      mockFn.mockImplementationOnce((fetchUrl) => {
        if (fetchUrl.includes(url) || url.includes(fetchUrl) || !url) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(response),
            json: () => Promise.resolve(JSON.parse(response)),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
    }
  });
  
  global.fetch = mockFn;
};

// Default mock implementations
beforeEach(() => {
  // Default successful responses
  mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
  mockChrome.storage.local.get.mockResolvedValue({});
  mockChrome.storage.local.set.mockResolvedValue(undefined);
  mockChrome.proxy.settings.set.mockResolvedValue(undefined);
  mockChrome.proxy.settings.get.mockResolvedValue({ value: {} });
  mockChrome.proxy.settings.clear.mockResolvedValue(undefined);
  
  // Default fetch mock
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
  });
  
  // Reset lastError
  mockChrome.runtime.lastError = null;
});

module.exports = {
  mockChrome,
  resetChromeMocks,
  setupSuccessfulProxySettings,
  setupStorageWith,
  setupFetchMock
};
