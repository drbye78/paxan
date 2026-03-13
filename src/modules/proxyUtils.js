// Proxy Utilities - Pure functions for proxy management
// Extracted from popup.js for better testability

const COUNTRY_FLAGS = {
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Japan': '🇯🇵', 'China': '🇨🇳',
  'Brazil': '🇧🇷', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Russia': '🇷🇺',
  'India': '🇮🇳', 'South Korea': '🇰🇷', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Poland': '🇵🇱', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼', 'Indonesia': '🇮🇩', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭', 'Malaysia': '🇲🇾', 'Argentina': '🇦🇷', 'Mexico': '🇲🇽',
  'Ukraine': '🇺🇦', 'Turkey': '🇹🇷', 'South Africa': '🇿🇦', 'Sweden': '🇸🇪',
  'Norway': '🇳🇴', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
  'Portugal': '🇵🇹', 'Greece': '🇬🇷', 'Czech Republic': '🇨🇿', 'Romania': '🇷🇴',
  'Hungary': '🇭🇺', 'Bulgaria': '🇧🇬', 'Ireland': '🇮🇪', 'New Zealand': '🇳🇿',
  'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩', 'Iran': '🇮🇷', 'Israel': '🇮🇱',
  'UAE': '🇦🇪', 'Saudi Arabia': '🇸🇦', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Peru': '🇵🇪',
  'Venezuela': '🇻🇪', 'Ecuador': '🇪🇨', 'Uruguay': '🇺🇾', 'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦', 'Guatemala': '🇬🇹', 'Cuba': '🇨🇺', 'Jamaica': '🇯🇲',
  'Fiji': '🇫🇯', 'Iceland': '🇮🇸', 'Luxembourg': '🇱🇺', 'Malta': '🇲🇹',
  'Cyprus': '🇨🇾', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲', 'Kazakhstan': '🇰🇿',
  'Belarus': '🇧🇾', 'Lithuania': '🇱🇹', 'Latvia': '🇱🇻', 'Estonia': '🇪🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮',
  'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Morocco': '🇲🇦', 'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿', 'Ghana': '🇬🇭', 'Ethiopia': '🇪🇹', 'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬', 'Zimbabwe': '🇿🇼', 'Angola': '🇦🇴', 'Zambia': '🇿🇲',
  'Mozambique': '🇲🇿', 'Botswana': '🇧🇼', 'Namibia': '🇳🇦', 'Nepal': '🇳🇵',
  'Sri Lanka': '🇱🇰', 'Myanmar': '🇲🇲', 'Cambodia': '🇰🇭', 'Laos': '🇱🇦',
  'Mongolia': '🇲🇳', 'Iraq': '🇮🇶', 'Libya': '🇱🇾', 'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴', 'Honduras': '🇭🇳', 'El Salvador': '🇸🇻', 'Nicaragua': '🇳🇮',
  'Dominican Republic': '🇩🇴', 'Trinidad and Tobago': '🇹🇹', 'Bahamas': '🇧🇸',
  'Barbados': '🇧🇧', 'Papua New Guinea': '🇵🇬', 'Vanuatu': '🇻🇺'
};

function getFlag(country) {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country] || COUNTRY_FLAGS[country.split(' ')[0]] || '🌍';
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function matchesPattern(pattern, hostname, patternType = 'exact') {
  if (!pattern || !hostname) return false;
  
  switch (patternType) {
    case 'wildcard':
      if (pattern.startsWith("*.")) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return hostname.includes(pattern.slice(1, -1));
      }
      return hostname.endsWith(pattern);
      
    case 'regex':
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(hostname);
      } catch (e) {
        return false;
      }
      
    case 'exact':
    default:
      return hostname === pattern || hostname.endsWith('.' + pattern);
  }
}

function calculateConnectionQuality(latency, packetLoss = 0) {
  if (!latency || packetLoss > 50) return 'poor';
  if (latency <= 100 && packetLoss <= 1) return 'excellent';
  if (latency <= 300 && packetLoss <= 5) return 'good';
  if (latency <= 500 && packetLoss <= 10) return 'fair';
  return 'poor';
}

function getWorkingStatus(proxy) {
  if (!proxy || !proxy.lastCheck) return 'unknown';
  
  const lastCheck = proxy.lastCheck.toLowerCase();
  const russianRecent = ['только что', '1 мин', '2 мин', '3 мин'];
  const englishRecent = ['recently', 'just now', 'minutes ago', 'min ago'];
  
  if (russianRecent.some(s => lastCheck.includes(s)) || 
      englishRecent.some(s => lastCheck.includes(s))) {
    return 'good';
  }
  
  if (lastCheck.includes('hour') || lastCheck.includes('час')) {
    return 'warning';
  }
  
  return 'unknown';
}

function renderSparkline(latencies, width = 80, height = 20) {
  if (!latencies || latencies.length === 0) return '';
  
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const range = max - min || 1;
  
  const points = latencies.map((val, i) => {
    const x = (i / (latencies.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline">
      <polyline points="${points}" fill="none" stroke="var(--accent-color, #4CAF50)" stroke-width="1.5"/>
    </svg>
  `;
}

function calculateProxyScore(proxy, proxyStats = {}, favorites = []) {
  if (!proxy) return 0;
  
  const stats = proxyStats[proxy.ipPort] || { successRate: 50, avgLatency: 100 };
  
  const latencyToUse = proxy.historicalAvgLatency && proxy.speedMs > 5000 
    ? proxy.historicalAvgLatency 
    : proxy.speedMs;
  
  const speedScore = Math.max(0, 100 - latencyToUse / 5);
  const reliabilityScore = stats.successRate || 50;
  
  let freshnessScore = 50;
  if (proxy.lastCheck) {
    const lastCheck = proxy.lastCheck.toLowerCase();
    if (lastCheck.includes('только что') || lastCheck.includes('1 мин')) freshnessScore = 100;
    else if (lastCheck.includes('2 мин')) freshnessScore = 90;
    else if (lastCheck.includes('3 мин')) freshnessScore = 80;
    else if (lastCheck.includes('4 мин') || lastCheck.includes('5 мин')) freshnessScore = 70;
    else if (lastCheck.includes('recently') || lastCheck.includes('just now')) freshnessScore = 100;
    else if (lastCheck.includes('min')) freshnessScore = 80;
    else if (lastCheck.includes('hour')) freshnessScore = 40;
    else if (lastCheck.includes('day')) freshnessScore = 20;
  }
  
  const isFavorite = favorites.some(f => f.ipPort === proxy.ipPort);
  const favoriteBonus = isFavorite ? 10 : 0;
  
  const historicalBonus = proxy.historicalSuccessRate > 80 ? 5 : 0;
  
  const score = (speedScore * 0.4) + (reliabilityScore * 0.3) + (freshnessScore * 0.2) + favoriteBonus + historicalBonus;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

function getRecommendedProxies(proxies, proxyStats = {}, favorites = [], excludeProxy = null, maxResults = 5) {
  if (!proxies || proxies.length === 0) return [];
  
  let filtered = proxies.filter(p => p.ipPort !== excludeProxy?.ipPort);
  
  const scored = filtered.map(proxy => ({
    ...proxy,
    score: calculateProxyScore(proxy, proxyStats, favorites)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, maxResults);
}

function getBestProxy(proxies, proxyStats = {}, favorites = []) {
  if (!proxies || proxies.length === 0) return null;
  
  const scored = proxies.map(proxy => ({
    ...proxy,
    score: calculateProxyScore(proxy, proxyStats, favorites)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  const best = scored[0];
  
  if (best.score < 30 || 
      (best.historicalSuccessRate && best.historicalSuccessRate < 30) ||
      (best.historicalAttempts && best.historicalAttempts < 3)) {
    return null;
  }
  
  return best;
}

function filterProxiesByCountry(proxies, country) {
  if (!country) return proxies;
  return proxies.filter(p => p.country === country);
}

function filterProxiesByType(proxies, type) {
  if (!type) return proxies;
  return proxies.filter(p => p.type === type);
}

function filterProxiesByBlacklist(proxies, blacklist = []) {
  if (!blacklist || blacklist.length === 0) return proxies;
  return proxies.filter(p => !blacklist.includes(p.country));
}

function filterProxiesBySpeed(proxies, speedFilter) {
  if (!speedFilter || speedFilter === 'all') return proxies;
  
  switch (speedFilter) {
    case 'fast':
      return proxies.filter(p => p.speedMs < 300);
    case 'medium':
      return proxies.filter(p => p.speedMs >= 300 && p.speedMs < 1000);
    case 'slow':
      return proxies.filter(p => p.speedMs >= 1000);
    case 'best':
      return proxies.filter(p => p.speedMs < 500);
    default:
      return proxies;
  }
}

function searchProxies(proxies, query) {
  if (!query) return proxies;
  const lowerQuery = query.toLowerCase();
  return proxies.filter(p => 
    p.ip?.toLowerCase().includes(lowerQuery) ||
    p.port?.toString().includes(lowerQuery) ||
    p.ipPort?.toLowerCase().includes(lowerQuery) ||
    p.country?.toLowerCase().includes(lowerQuery) ||
    p.type?.toLowerCase().includes(lowerQuery)
  );
}

function formatDuration(ms) {
  if (!ms) return '00:00';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function validateProxy(proxy) {
  if (!proxy) return { valid: false, error: 'Proxy is null or undefined' };
  if (!proxy.ip || typeof proxy.ip !== 'string') return { valid: false, error: 'Invalid IP address' };
  if (!proxy.port || typeof proxy.port !== 'number' || proxy.port < 1 || proxy.port > 65535) {
    return { valid: false, error: 'Invalid port number' };
  }
  const ipParts = proxy.ip.split('.');
  if (ipParts.length !== 4 || ipParts.some(p => {
    const num = parseInt(p);
    return isNaN(num) || num < 0 || num > 255;
  })) {
    return { valid: false, error: 'IP address format is invalid' };
  }
  return { valid: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFlag,
    escapeHtml,
    matchesPattern,
    calculateConnectionQuality,
    getWorkingStatus,
    renderSparkline,
    calculateProxyScore,
    getRecommendedProxies,
    getBestProxy,
    filterProxiesByCountry,
    filterProxiesByType,
    filterProxiesByBlacklist,
    filterProxiesBySpeed,
    searchProxies,
    formatDuration,
    validateProxy
  };
}
