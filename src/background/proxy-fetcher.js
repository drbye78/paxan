import { THRESHOLDS } from '../popup/constants.js';

const MAX_PAGES = 5;
const BYPASS_LIST = [
  'localhost', '127.0.0.1', '::1', '*.local',
  '192.168.*', '10.*', '172.16.*', '172.17.*',
  '172.18.*', '172.19.*', '172.20.*', '172.21.*',
  '172.22.*', '172.23.*', '172.24.*', '172.25.*',
  '172.26.*', '172.27.*', '172.28.*', '172.29.*',
  '172.30.*', '172.31.*',
  'chrome-extension://*', 'chrome://*',
  'https://proxymania.su'
];

async function fetchProxies() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    const proxySource = result.settings?.proxySource || 'peasyproxy';
    
    let proxies;
    switch (proxySource) {
      case 'proxyscrape':
        proxies = await fetchProxyScrape();
        break;
      case 'peasyproxy':
      default:
        proxies = await fetchPeasyProxy();
        break;
    }
    
    return proxies;
  } catch (error) {
    console.error('Error fetching proxies:', error);
    try {
      return await fetchPeasyProxy();
    } catch (fallbackError) {
      throw error;
    }
  }
}

async function fetchPeasyProxy() {
  const allProxies = [];
  
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 
      ? 'https://proxymania.su/free-proxy' 
      : `https://proxymania.su/free-proxy?page=${page}`;
    
    const response = await fetch(url);
    if (!response.ok) break;
    
    const html = await response.text();
    const proxies = parsePeasyProxy(html);
    
    if (!proxies || proxies.length === 0) break;
    
    allProxies.push(...proxies);
    console.log(`PeasyProxy: Fetched page ${page}, total proxies: ${allProxies.length}`);
  }
  
  return allProxies;
}

async function fetchProxyScrape() {
  const response = await fetch(
    'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&format=csv&proxy_type=all&timeout=5000'
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch from ProxyScrape: ' + response.statusText);
  }
  
  const csvText = await response.text();
  return parseProxyScrapeCSV(csvText);
}

function parseProxyScrapeCSV(csvText) {
  const proxyItems = [];
  
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return proxyItems;
    
    const headerLine = lines[0].toLowerCase();
    const headers = parseCSVLine(headerLine);
    
    const ipIndex = headers.findIndex(h => h === 'ip');
    const portIndex = headers.findIndex(h => h === 'port');
    const codeIndex = headers.findIndex(h => h === 'ip_data_countryCode');
    const countryIndex = headers.findIndex(h => h === 'ip_data_country');
    const typeIndex = headers.findIndex(h => h === 'protocol');
    const speedIndex = headers.findIndex(h => h === 'average_timeout');
    
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
        const proxy = createProxyObject(ip, port, getCountryName(countryCode), normalizeProxyType(type), speedStr, 'Recently');
        proxyItems.push(proxy);
      }
    }
    
    console.log(`ProxyScrape: Parsed ${proxyItems.length} proxies from CSV`);
  } catch (error) {
    console.error('Error parsing ProxyScrape CSV:', error);
  }
  
  return proxyItems;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function parsePeasyProxy(html) {
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
        const proxy = createProxyObject(ip, parseInt(port), country, type, speed, lastCheck);
        proxyItems.push(proxy);
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
  if (!speedStr) return 9999;
  
  const match = speedStr.match(/(\d+\.?\d*)/);
  if (!match) return 9999;
  
  const value = parseFloat(match[1]);
  
  if (speedStr.toLowerCase().includes('sec')) {
    return Math.round(value * 1000);
  } else if (speedStr.toLowerCase().includes('s') && !speedStr.toLowerCase().includes('ms')) {
    return Math.round(value * 1000);
  } else if (speedStr.toLowerCase().includes('ms') || speedStr.match(/\d+\s*ms/)) {
    return Math.round(value);
  }
  
  return Math.round(value);
}

function createProxyObject(ip, port, country, type, speed, lastCheck) {
  return {
    ip,
    port,
    ipPort: `${ip}:${port}`,
    country,
    type: normalizeProxyType(type),
    speed,
    lastCheck,
    speedMs: parseSpeed(speed)
  };
}

function createProxyConfig(proxy) {
  return {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
        host: proxy.ip,
        port: proxy.port
      },
      bypassList: BYPASS_LIST
    }
  };
}

const TestUrls = [
  'http://www.google.com/generate_204',
  'https://httpbin.org/ip',
  'http://connectivitycheck.gstatic.com/generate_204'
];

async function testProxyConnectivity(proxy, keepProxy = false) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const testConfig = createProxyConfig(proxy);
    
    chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, () => {
      const testNext = (index = 0) => {
        if (index >= TestUrls.length) {
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
        
        fetch(TestUrls[index], {
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
            endpoint: TestUrls[index]
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

export {
  fetchProxies,
  fetchPeasyProxy,
  fetchProxyScrape,
  parsePeasyProxy,
  parseProxyScrapeCSV,
  parseCSVLine,
  getCountryName,
  normalizeProxyType,
  parseSpeed,
  createProxyConfig,
  testProxyConnectivity,
  quickLatencyTest,
  BYPASS_LIST
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchProxies,
    fetchPeasyProxy,
    fetchProxyScrape,
    parsePeasyProxy,
    parseProxyScrapeCSV,
    parseCSVLine,
    getCountryName,
    normalizeProxyType,
    parseSpeed,
    createProxyConfig,
    testProxyConnectivity,
    quickLatencyTest,
    BYPASS_LIST
  };
}
