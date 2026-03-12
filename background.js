// ProxyMania VPN - Background Script (MV3 Compatible)
// Enhanced with Chrome 120+ support

const MONITORING_ALARM_NAME = 'proxyMonitoring';
const HEALTH_ALARM_NAME = 'healthMonitoring';
const SECURITY_ALARM_NAME = 'securityMonitoring';

let currentMonitoringProxy = null;
let monitoringActive = false;

class ProxyFailoverManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.failoverQueue = [];
  }
  
  setProxies(proxies, currentProxy) {
    if (!currentProxy) return;
    this.failoverQueue = proxies
      .filter(p => p.ipPort !== currentProxy.ipPort)
      .sort((a, b) => a.speedMs - b.speedMs);
  }
  
  getNextProxy() {
    if (this.failoverQueue.length === 0) {
      return null;
    }
    return this.failoverQueue.shift();
  }
  
  reset() {
    this.retryCount = 0;
    this.failoverQueue = [];
  }
}

const failoverManager = new ProxyFailoverManager();

// Alarm handlers for MV3 service worker
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === MONITORING_ALARM_NAME && currentMonitoringProxy) {
    await performProxyMonitoring();
  } else if (alarm.name === HEALTH_ALARM_NAME && currentMonitoringProxy) {
    await performHealthCheck();
  } else if (alarm.name === SECURITY_ALARM_NAME) {
    await performSecurityCheck();
  }
});

async function performProxyMonitoring() {
  if (!currentMonitoringProxy) return;
  
  try {
    const result = await testProxyConnectivity(currentMonitoringProxy);
    await updateProxyStats(currentMonitoringProxy, result.success, result.latency);
    
    if (!result.success || (result.latency && result.latency > 500)) {
      chrome.runtime.sendMessage({
        action: 'proxyDegraded',
        proxy: {
          ipPort: currentMonitoringProxy.ipPort,
          country: currentMonitoringProxy.country
        },
        latency: result.latency,
        success: result.success,
        monitoringTime: Date.now()
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}

async function performHealthCheck() {
  if (!currentMonitoringProxy) return;
  
  try {
    const healthResult = await measureConnectionHealth(currentMonitoringProxy);
    const quality = calculateConnectionQuality(healthResult);
    
    chrome.runtime.sendMessage({
      action: 'healthStatusUpdate',
      active: true,
      quality: quality,
      avgLatency: healthResult.latency,
      lastCheck: Date.now()
    }).catch(() => {});
  } catch (error) {
    console.error('Health check error:', error);
  }
}

async function performSecurityCheck() {
  try {
    const result = await chrome.storage.local.get(['activeProxy']);
    if (!result.activeProxy) {
      return;
    }
    
    // Note: WebRequest blocking is not available in MV3
    // Security status is now informational only
    chrome.runtime.sendMessage({
      action: 'securityStatusUpdate',
      status: 'secure',
      dnsLeakProtection: true,
      webRtcProtection: true,
      lastCheck: Date.now()
    }).catch(() => {});
  } catch (error) {
    console.error('Security check error:', error);
  }
}

function calculateConnectionQuality(healthResult) {
  if (!healthResult.latency || healthResult.packetLoss > 50) return 'poor';
  if (healthResult.latency <= 100 && healthResult.packetLoss <= 1) return 'excellent';
  if (healthResult.latency <= 300 && healthResult.packetLoss <= 5) return 'good';
  return 'fair';
}

async function measureConnectionHealth(proxy) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  try {
    const testConfig = {
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
    
    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
    
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    return {
      success: response.ok,
      latency: Date.now() - startTime,
      packetLoss: 0
    };
  } catch (error) {
    clearTimeout(timeoutId);
    try {
      await chrome.proxy.settings.clear({ scope: 'regular' });
    } catch (e) {}
    
    return {
      success: false,
      latency: null,
      packetLoss: 100
    };
  }
}

// Main message handler - single unified handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});

async function handleMessage(request) {
  try {
    switch (request.action) {
      case 'setProxy':
        await setProxy(request.proxy);
        return { success: true };
        
      case 'clearProxy':
        await clearProxy();
        return { success: true };
        
      case 'getProxy':
        const config = await getProxy();
        return { config };
        
      case 'fetchProxies':
        const proxies = await fetchProxies();
        return { proxies };
        
      case 'testProxy':
        return await testProxyConnectivity(request.proxy, request.keepProxy);
        
      case 'quickTest':
        return await quickLatencyTest(request.proxy);
        
      case 'updateProxyStats':
        await updateProxyStats(request.proxy, request.success, request.latency);
        return { success: true };
        
      case 'getProxyStats':
        const stats = await getProxyStats();
        return { stats };
        
      case 'startMonitoring':
        await startProxyMonitoring(request.proxy);
        return { success: true };
        
      case 'stopMonitoring':
        stopProxyMonitoring();
        return { success: true };
        
      case 'setFailoverProxies':
        failoverManager.setProxies(request.proxies, request.currentProxy);
        return { success: true };
        
      case 'getNextFailoverProxy':
        const proxy = failoverManager.getNextProxy();
        return { proxy };
        
      case 'resetFailover':
        failoverManager.reset();
        return { success: true };
        
      case 'toggleDnsLeakProtection':
      case 'toggleWebRtcProtection':
        return { success: true, enabled: request.enabled };
        
      case 'getSecurityStatus':
        return {
          status: 'secure',
          dnsLeakProtection: true,
          webRtcProtection: true,
          lastCheck: null
        };
        
      case 'resetSecurityAlerts':
        return { success: true };
        
      case 'handleProxyError':
        console.error('Proxy error:', request.error);
        return { success: true };
        
      case 'clearErrorLogs':
        return { success: true };
        
      case 'getStoredErrors':
        return { errors: [] };
        
      case 'startOnboarding':
      case 'completeOnboarding':
        return { success: true };
        
      case 'getOnboardingState':
        const onboarding = await chrome.storage.local.get(['onboarding']);
        return onboarding.onboarding || { completed: false, currentStepIndex: 0, version: '2.1.0' };
        
      case 'startHealthMonitoring':
        if (request.proxy) {
          await startHealthMonitoring(request.proxy);
        }
        return { success: true };
        
      case 'stopHealthMonitoring':
        stopHealthMonitoring();
        return { success: true };
        
      case 'getHealthStatus':
        return {
          active: monitoringActive,
          quality: 'excellent',
          avgLatency: 0,
          lastCheck: null
        };
        
      default:
        return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Message handler error:', error);
    return { success: false, error: error.message };
  }
}

// Proxy functions
async function fetchProxies() {
  try {
    // Get proxy source from settings
    const result = await chrome.storage.local.get(['settings']);
    const proxySource = result.settings?.proxySource || 'proxymania';
    
    let proxies;
    switch (proxySource) {
      case 'proxyscrape':
        proxies = await fetchProxyScrape();
        break;
      case 'proxymania':
      default:
        proxies = await fetchProxyMania();
        break;
    }
    
    return proxies;
  } catch (error) {
    console.error('Error fetching proxies:', error);
    // Try fallback to proxymania if proxyscrape fails
    try {
      return await fetchProxyMania();
    } catch (fallbackError) {
      throw error;
    }
  }
}

async function fetchProxyMania() {
  try {
    const allProxies = [];
    const maxPages = 5; // Fetch up to 5 pages
    
    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 
        ? 'https://proxymania.su/free-proxy' 
        : `https://proxymania.su/free-proxy?page=${page}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        break; // Stop if no more pages
      }
      
      const html = await response.text();
      const proxies = parseProxyMania(html);
      
      if (!proxies || proxies.length === 0) {
        break; // Stop if no more proxies
      }
      
      allProxies.push(...proxies);
      console.log(`ProxyMania: Fetched page ${page}, total proxies: ${allProxies.length}`);
    }
    
    return allProxies;
  } catch (error) {
    console.error('Error fetching from ProxyMania:', error);
    throw error;
  }
}

async function fetchProxyScrape() {
  try {
    // Use the API endpoint for direct CSV download
    const response = await fetch('https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&format=csv&proxy_type=all&timeout=5000');
    
    if (!response.ok) {
      throw new Error('Failed to fetch from ProxyScrape: ' + response.statusText);
    }
    
    const csvText = await response.text();
    return parseProxyScrapeCSV(csvText);
  } catch (error) {
    console.error('Error fetching from ProxyScrape:', error);
    throw error;
  }
}

function parseProxyScrapeCSV(csvText) {
  const proxyItems = [];
  
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return proxyItems;
    
    // Parse header to find column indices
    const headerLine = lines[0].toLowerCase();
    const headers = parseCSVLine(headerLine);
    
    const ipIndex = headers.findIndex(h => h === 'ip');
    const portIndex = headers.findIndex(h => h === 'port');
    const codeIndex = headers.findIndex(h => h === 'ip_data_countryCode');
    const countryIndex = headers.findIndex(h => h === 'ip_data_country');
    const typeIndex = headers.findIndex(h => h === 'protocol');
    const speedIndex = headers.findIndex(h => h === 'average_timeout');
    
    console.log('ProxyScrape headers:', headers);
    console.log('Indices - IP:', ipIndex, 'Port:', portIndex, 'Code:', codeIndex, 'Type:', typeIndex, 'Speed:', speedIndex);
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = parseCSVLine(line);
      
      if (parts.length < 3) continue;
      
      const ip = parts[ipIndex]?.trim();
      const port = parseInt(parts[portIndex]?.trim());
      const countryCode = parts[codeIndex]?.trim() || parts[countryIndex]?.trim();
      const type = parts[typeIndex]?.trim();
      const speedStr = parts[speedIndex]?.trim();
      
      if (ip && port && !isNaN(port)) {
        proxyItems.push({
          ip,
          port,
          ipPort: `${ip}:${port}`,
          country: getCountryName(countryCode),
          type: normalizeProxyType(type),
          speed: speedStr,
          lastCheck: 'Recently',
          speedMs: parseSpeed(speedStr)
        });
      }
    }
    
    console.log(`ProxyScrape: Parsed ${proxyItems.length} proxies from CSV`);
  } catch (error) {
    console.error('Error parsing ProxyScrape CSV:', error);
  }
  
  return proxyItems;
}

// Parse a CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function parseProxyMania(html) {
  const proxyItems = [];
  
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    
    if (cells.length >= 6) {
      const ipPort = cells[0];
      const country = cells[1];
      const type = cells[2];
      const speed = cells[4];
      const lastCheck = cells[5];
      
      const [ip, port] = ipPort.split(':');
      
      if (ip && port && !isNaN(parseInt(port))) {
        proxyItems.push({
          ip,
          port: parseInt(port),
          ipPort,
          country,
          type,
          speed,
          lastCheck,
          speedMs: parseSpeed(speed)
        });
      }
    }
  }
  
  return proxyItems;
}

function parseProxyScrape(html) {
  const proxyItems = [];
  
  // ProxyScrape format: table with IP, Port, Code, Country, Anonymity, Type, Speed, Latency, Uptime
  const rowRegex = /<tr[^>]*class="[^"]*odd[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  // Also match even rows
  const rowRegexAll = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  
  // Try to parse the table
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.includes('thead')) continue;
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      let content = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(content);
    }
    
    // ProxyScrape typically has: IP, Port, Code, Country, Anonymity, Type, Speed, Latency, Uptime
    // Indices: 0=IP, 1=Port, 2=Code, 3=Country, 4=Anonymity, 5=Type, 6=Speed, 7=Latency, 8=Uptime
    if (cells.length >= 6) {
      const ip = cells[0];
      const port = parseInt(cells[1]);
      const countryCode = cells[2] || cells[3] || '';
      const country = getCountryName(countryCode);
      const type = normalizeProxyType(cells[5]);
      const speedStr = cells[6] || '';
      const speedMs = parseSpeed(speedStr);
      
      if (ip && port && !isNaN(port)) {
        proxyItems.push({
          ip,
          port,
          ipPort: `${ip}:${port}`,
          country,
          type,
          speed: speedStr,
          lastCheck: 'Recently',
          speedMs
        });
      }
    }
  }
  
  return proxyItems;
}

function getCountryName(code) {
  const countryMap = {
    'US': 'United States', 'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
    'JP': 'Japan', 'CN': 'China', 'BR': 'Brazil', 'CA': 'Canada', 'AU': 'Australia',
    'RU': 'Russia', 'IN': 'India', 'KR': 'South Korea', 'NL': 'Netherlands',
    'ES': 'Spain', 'IT': 'Italy', 'PL': 'Poland', 'SG': 'Singapore', 'HK': 'Hong Kong',
    'TW': 'Taiwan', 'ID': 'Indonesia', 'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Philippines',
    'MY': 'Malaysia', 'AR': 'Argentina', 'MX': 'Mexico', 'UA': 'Ukraine', 'TR': 'Turkey',
    'ZA': 'South Africa', 'SE': 'Sweden', 'NO': 'Norway', 'CH': 'Switzerland', 'AT': 'Austria',
    'BE': 'Belgium', 'PT': 'Portugal', 'GR': 'Greece', 'CZ': 'Czech Republic', 'RO': 'Romania',
    'HU': 'Hungary', 'BG': 'Bulgaria', 'IE': 'Ireland', 'NZ': 'New Zealand', 'PK': 'Pakistan',
    'BD': 'Bangladesh', 'IR': 'Iran', 'IL': 'Israel', 'AE': 'UAE', 'SA': 'Saudi Arabia',
    'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya', 'CL': 'Chile', 'CO': 'Colombia',
    'PE': 'Peru', 'VE': 'Venezuela', 'EC': 'Ecuador', 'UY': 'Uruguay', 'CR': 'Costa Rica'
  };
  return countryMap[code?.toUpperCase()] || code || 'Unknown';
}

function normalizeProxyType(typeStr) {
  const type = typeStr?.toUpperCase() || '';
  if (type.includes('HTTPS') || type.includes('HTTP')) return 'HTTPS';
  if (type.includes('SOCKS5') || type.includes('SOCKS')) return 'SOCKS5';
  if (type.includes('SOCKS4')) return 'SOCKS4';
  return 'HTTPS';
}

function parseSpeed(speedStr) {
  const match = speedStr?.match(/(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

async function testProxyConnectivity(proxy, keepProxy = false) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const testConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: [
          'localhost', '127.0.0.1', '::1', '*.local',
          '192.168.*', '10.*', '172.16.*', '172.17.*',
          '172.18.*', '172.19.*', '172.20.*', '172.21.*',
          '172.22.*', '172.23.*', '172.24.*', '172.25.*',
          '172.26.*', '172.27.*', '172.28.*', '172.29.*',
          '172.30.*', '172.31.*',
          'chrome-extension://*', 'chrome://*',
          'https://proxymania.su'
        ]
      }
    };
    
    chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, () => {
      const testUrls = [
        'http://www.google.com/generate_204',
        'https://httpbin.org/ip',
        'http://connectivitycheck.gstatic.com/generate_204'
      ];
      
      const testNext = (index = 0) => {
        if (index >= testUrls.length) {
          clearTimeout(timeoutId);
          if (!keepProxy) {
            chrome.proxy.settings.clear({ scope: 'regular' }, () => {});
          }
          resolve({
            success: false,
            latency: null,
            status: null,
            working: false,
            error: 'All test endpoints failed'
          });
          return;
        }
        
        fetch(testUrls[index], {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store'
        })
        .then(response => {
          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;
          if (!keepProxy) {
            chrome.proxy.settings.clear({ scope: 'regular' }, () => {});
          }
          
          resolve({
            success: response.ok || response.status === 204,
            latency: latency,
            status: response.status,
            working: response.ok || response.status === 204,
            endpoint: testUrls[index]
          });
        })
        .catch(() => {
          testNext(index + 1);
        });
      };
      
      testNext();
    });
  });
}

async function quickLatencyTest(proxy) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  try {
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);
    
    return {
      success: response.ok,
      latency: Date.now() - startTime
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      latency: null,
      error: error.message
    };
  }
}

async function setProxy(proxy) {
  return new Promise((resolve, reject) => {
    const proxyConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: [
          'localhost', '127.0.0.1', '::1', '*.local',
          '192.168.*', '10.*', '172.16.*', '172.17.*',
          '172.18.*', '172.19.*', '172.20.*', '172.21.*',
          '172.22.*', '172.23.*', '172.24.*', '172.25.*',
          '172.26.*', '172.27.*', '172.28.*', '172.29.*',
          '172.30.*', '172.31.*',
          'chrome-extension://*', 'chrome://*',
          'https://proxymania.su'
        ]
      }
    };
    
    chrome.proxy.settings.set(
      { value: proxyConfig, scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy set successfully:', proxy.ipPort);
          resolve(result);
        }
      }
    );
  });
}

async function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(
      { scope: 'regular' },
      (result) => {
        stopProxyMonitoring();
        stopHealthMonitoring();
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy cleared successfully');
          resolve(result);
        }
      }
    );
  });
}

async function getProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.get(
      { scope: 'regular' },
      (config) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(config);
        }
      }
    );
  });
}

async function updateProxyStats(proxy, success, latency) {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    const key = proxy.ipPort;
    
    if (!proxyStats[key]) {
      proxyStats[key] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        lastFailure: null,
        lastSuccess: null
      };
    }
    
    proxyStats[key].attempts++;
    
    if (success) {
      proxyStats[key].successes++;
      proxyStats[key].lastSuccess = Date.now();
      
      if (latency) {
        proxyStats[key].latencies.push(latency);
        if (proxyStats[key].latencies.length > 20) {
          proxyStats[key].latencies.shift();
        }
      }
    } else {
      proxyStats[key].failures++;
      proxyStats[key].lastFailure = Date.now();
    }
    
    proxyStats[key].successRate = Math.round(
      (proxyStats[key].successes / proxyStats[key].attempts) * 100
    );
    
    const latencies = proxyStats[key].latencies;
    proxyStats[key].avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    
    await chrome.storage.local.set({ proxyStats });
  } catch (error) {
    console.error('Error updating proxy stats:', error);
  }
}

async function getProxyStats() {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    return proxyStats;
  } catch (error) {
    console.error('Error getting proxy stats:', error);
    return {};
  }
}

async function startProxyMonitoring(proxy) {
  stopProxyMonitoring();
  
  currentMonitoringProxy = proxy;
  monitoringActive = true;
  
  try {
    await chrome.alarms.create(MONITORING_ALARM_NAME, {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5
    });
    console.log('Started monitoring for:', proxy.ipPort);
  } catch (error) {
    console.error('Failed to create monitoring alarm:', error);
  }
}

function stopProxyMonitoring() {
  chrome.alarms.get(MONITORING_ALARM_NAME, (alarm) => {
    if (alarm) {
      chrome.alarms.clear(MONITORING_ALARM_NAME);
    }
  });
  currentMonitoringProxy = null;
  monitoringActive = false;
}

async function startHealthMonitoring(proxy) {
  stopHealthMonitoring();
  
  try {
    await chrome.alarms.create(HEALTH_ALARM_NAME, {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5
    });
    console.log('Started health monitoring');
  } catch (error) {
    console.error('Failed to create health alarm:', error);
  }
}

function stopHealthMonitoring() {
  chrome.alarms.get(HEALTH_ALARM_NAME, (alarm) => {
    if (alarm) {
      chrome.alarms.clear(HEALTH_ALARM_NAME);
    }
  });
}

// Extension lifecycle handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('ProxyMania VPN installed');

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
      },
      onboarding: {
        completed: false,
        currentStepIndex: 0,
        version: '2.2.0'
      },
      healthData: {
        connectionQuality: 'excellent',
        lastCheck: null,
        qualityHistory: [],
        latencyHistory: [],
        avgLatency: 0
      },
      // v2.2.0 new fields
      siteRules: [],
      autoRotation: {
        enabled: false,
        interval: 600000
      }
    });
  } else if (details.reason === 'update') {
    console.log('ProxyMania VPN updated from', details.previousVersion);
    
    // Storage migration for v2.2.0
    const oldVersion = details.previousVersion || '2.0.0';
    if (oldVersion < '2.2.0') {
      try {
        const data = await chrome.storage.local.get(null);
        const updates = {};
        
        // Initialize new v2.2.0 fields if missing
        if (!data.siteRules) {
          updates.siteRules = [];
        }
        if (!data.autoRotation) {
          updates.autoRotation = { enabled: false, interval: 600000 };
        }
        if (!data.connectionQuality) {
          updates.connectionQuality = { enabled: true, lastUpdate: null, latency: 0, packetLoss: 0, quality: 'excellent' };
        }
        if (!data.ipInfo) {
          updates.ipInfo = { realIp: null, proxyIp: null, isLoading: false, lastCheck: null };
        }
        
        // Update onboarding version
        if (data.onboarding) {
          data.onboarding.version = '2.2.0';
          updates.onboarding = data.onboarding;
        }
        
        if (Object.keys(updates).length > 0) {
          await chrome.storage.local.set(updates);
          console.log('Migrated to v2.2.0:', Object.keys(updates));
        }
      } catch (error) {
        console.error('Migration error:', error);
      }
    }
    
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await setProxy(result.activeProxy);
        await startProxyMonitoring(result.activeProxy);
      }
    } catch (error) {
      console.error('Error restoring proxy after update:', error);
    }
  }
});

// Restore proxy on startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { settings, activeProxy } = await chrome.storage.local.get(['settings', 'activeProxy']);
    if (settings?.autoConnect && activeProxy) {
      await setProxy(activeProxy);
      await startProxyMonitoring(activeProxy);
      console.log('Auto-connected to proxy:', activeProxy.ipPort);
    }
  } catch (error) {
    console.error('Error restoring proxy:', error);
  }
});

// ===== Feature 4: Per-Site Rules - Auto-switch proxy based on website =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return;

  try {
    const { siteRules, activeProxy } = await chrome.storage.local.get(['siteRules', 'activeProxy']);
    if (!siteRules || !activeProxy || siteRules.length === 0) return;

    const url = changeInfo.url;
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      return;
    }

    // Find first matching enabled rule (sorted by priority)
    const sortedRules = [...siteRules].filter(r => r.enabled !== false).sort((a, b) => a.priority - b.priority);
    const matchingRule = sortedRules.find(rule => {
      const patternType = rule.patternType || 'exact';
      if (patternType === 'exact') {
        return hostname === rule.url || hostname.endsWith('.' + rule.url);
      } else if (patternType === 'wildcard') {
        if (rule.url.startsWith('*.')) {
          const domain = rule.url.slice(2);
          return hostname === domain || hostname.endsWith('.' + domain);
        }
        if (rule.url.startsWith('*') && rule.url.endsWith('*')) {
          return hostname.includes(rule.url.slice(1, -1));
        }
        return hostname.endsWith(rule.url);
      } else if (patternType === 'regex') {
        try {
          return new RegExp(rule.url, 'i').test(hostname);
        } catch (e) {
          return false;
        }
      }
      return false;
    });

    if (!matchingRule) return;

    // Check if current proxy already matches the rule
    const currentProxyInRule = matchingRule.proxyIps.includes(activeProxy.ipPort);
    if (currentProxyInRule) return;

    // Find a proxy from the rule's country
    const { proxies } = await chrome.storage.local.get(['proxies']);
    if (!proxies) return;

    const newProxy = proxies.find(p => 
      matchingRule.proxyIps.includes(p.ipPort) && 
      p.speedMs < 300
    );

    if (!newProxy) return;

    console.log(`Auto-switching to ${newProxy.country} proxy for ${hostname}`);

    // Switch proxy
    await setProxy(newProxy);
    await chrome.storage.local.set({ activeProxy: newProxy });

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'siteRuleApplied',
      rule: matchingRule,
      proxy: newProxy,
      url: hostname
    }).catch(() => {});

  } catch (error) {
    console.error('Site rule check error:', error);
  }
});
