import { THRESHOLDS } from '../popup/constants.js';
import { buildProxyConfig } from '../shared/utils.js';
import { proxyConfig } from './proxy-config-manager.js';

const MAX_PAGES = 5;

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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) break;
      
      const html = await response.text();
      const proxies = parsePeasyProxy(html);
      
      if (!proxies || proxies.length === 0) break;
      
      allProxies.push(...proxies);
      console.log(`PeasyProxy: Fetched page ${page}, total proxies: ${allProxies.length}`);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`PeasyProxy: Failed to fetch page ${page}:`, error.message);
      break;
    }
  }
  
  return allProxies;
}

async function fetchProxyScrape() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(
      'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&format=csv&proxy_type=all&timeout=5000',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Failed to fetch from ProxyScrape: ' + response.statusText);
    const csvText = await response.text();
    return parseProxyScrapeCSV(csvText);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
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
  if (type.includes('SOCKS4')) return 'SOCKS4';
  if (type.includes('SOCKS5') || type.includes('SOCKS')) return 'SOCKS5';
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

async function testProxyConnectivity(proxy, keepProxy = false) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  if (keepProxy) {
    // When keepProxy is true, just test through the current proxy config
    // We assume the proxy is already set
    try {
      const response = await fetch('https://httpbin.org/ip', { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      return { success: response.ok, latency: Date.now() - startTime, status: response.status, working: response.ok };
    } catch {
      clearTimeout(timeoutId);
      return { success: false, latency: null, status: null, working: false, error: 'Connection failed' };
    }
  }

  const testConfig = buildProxyConfig(proxy);
  try {
    const result = await proxyConfig.withTestConfig(testConfig, async () => {
      // Try multiple endpoints
      const urls = [
        'https://httpbin.org/ip',
        'https://www.google.com/generate_204',
        'https://connectivitycheck.gstatic.com/generate_204'
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
          clearTimeout(timeoutId);
          controller.abort(); // stop other attempts
          return {
            success: response.ok || response.status === 204,
            latency: Date.now() - startTime,
            status: response.status,
            working: response.ok || response.status === 204,
            endpoint: url
          };
        } catch (e) {
          if (e.name === 'AbortError') break;
          // continue to next endpoint
        }
      }
      throw new Error('All test endpoints failed');
    }, { timeoutMs: 8000, settleMs: 50 });
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, latency: null, status: null, working: false, error: error.message };
  }
}

async function quickLatencyTest(proxy) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const testConfig = buildProxyConfig(proxy);
    return await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch('https://httpbin.org/ip', {
        method: 'GET', signal: controller.signal, cache: 'no-store'
      });
      clearTimeout(timeoutId);
      return { success: response.ok, latency: Date.now() - startTime };
    }, { timeoutMs: 5000, settleMs: 50 });
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, latency: null, error: error.message };
  }
}

async function testThroughProxy(proxy, url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const testConfig = buildProxyConfig(proxy);
    return await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      const data = await response.json();
      return { success: true, ip: data.ip || data.origin };
    }, { timeoutMs: 12000, settleMs: 50 });
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
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
  createProxyObject,
  testProxyConnectivity,
  quickLatencyTest,
  testThroughProxy
};
