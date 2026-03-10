// ProxyMania VPN - Complete Implementation (Phases 1-5)

let proxies = [];
let currentProxy = null;
let connectionStartTime = null;
let timerInterval = null;
let proxyStats = {};
let favorites = [];
let currentTab = 'all';
let monitoringActive = false;
let settings = {
  theme: 'dark',
  autoFailover: true,
  testBeforeConnect: true,
  notifications: true,
  refreshInterval: 300000
};
let dailyStats = {
  proxiesUsed: 0,
  connectionTime: 0,
  attempts: 0,
  successes: 0
};

// Country flag mapping
const countryFlags = {
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
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

// DOM Elements
const $ = (id) => document.getElementById(id);
const statusIndicator = $('statusIndicator');
const statusText = statusIndicator.querySelector('.status-text');
const currentProxyEl = $('currentProxy');
const currentProxyValue = currentProxyEl.querySelector('.value');
const connectionTimer = $('connectionTimer');
const timerValue = connectionTimer.querySelector('.timer-value');
const testStatus = $('testStatus');
const testText = testStatus.querySelector('.test-text');
const monitoringStatus = $('monitoringStatus');
const refreshBtn = $('refreshBtn');
const disconnectBtn = $('disconnectBtn');
const themeBtn = $('themeBtn');
const statsBtn = $('statsBtn');
const favoritesBtn = $('favoritesBtn');
const settingsBtn = $('settingsBtn');
const countryFilter = $('countryFilter');
const typeFilter = $('typeFilter');
const proxyList = $('proxyList');
const proxyCount = $('proxyCount');
const listTitle = $('listTitle');
const loading = $('loading');
const quickConnectGrid = $('quickConnectGrid');
const quickConnectSection = $('quickConnect');
const recommendedSection = $('recommendedSection');
const recommendedList = $('recommendedList');
const toastContainer = $('toastContainer');
const mainTabs = $('mainTabs');
const filterChips = $('filterChips');
const settingsPanel = $('settingsPanel');
const statsPanel = $('statsPanel');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applyTheme();
  await loadFavorites();
  await loadProxyStats();
  await loadDailyStats();
  loadCurrentProxy();
  loadProxies();
  setupEventListeners();
  setupTabListeners();
  setupFilterChipListeners();
  setupSettingsListeners();
  setupMessageListener();
  startAutoRefresh();
});

function setupEventListeners() {
  refreshBtn.addEventListener('click', loadProxies);
  disconnectBtn.addEventListener('click', disconnectProxy);
  themeBtn.addEventListener('click', toggleTheme);
  statsBtn.addEventListener('click', () => showPanel('stats'));
  favoritesBtn.addEventListener('click', () => switchToTab('favorites'));
  settingsBtn.addEventListener('click', () => showPanel('settings'));
  $('settingsClose').addEventListener('click', () => hidePanel('settings'));
  $('statsClose').addEventListener('click', () => hidePanel('stats'));
  $('importBtn').addEventListener('click', importProxies);
  $('exportBtn').addEventListener('click', exportProxies);
  $('clearDataBtn').addEventListener('click', clearAllData);
  countryFilter.addEventListener('change', filterProxies);
  typeFilter.addEventListener('change', filterProxies);
}

function setupTabListeners() {
  mainTabs.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
}

function setupFilterChipListeners() {
  filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      filterProxies();
    });
  });
}

function setupSettingsListeners() {
  $('themeSelect').addEventListener('change', (e) => {
    settings.theme = e.target.value;
    applyTheme();
    saveSettings();
  });
  
  $('refreshInterval').addEventListener('change', (e) => {
    settings.refreshInterval = parseInt(e.target.value);
    saveSettings();
    startAutoRefresh();
  });
  
  $('autoFailoverToggle').addEventListener('click', function() {
    settings.autoFailover = !settings.autoFailover;
    this.classList.toggle('active', settings.autoFailover);
    saveSettings();
  });
  
  $('testBeforeConnectToggle').addEventListener('click', function() {
    settings.testBeforeConnect = !settings.testBeforeConnect;
    this.classList.toggle('active', settings.testBeforeConnect);
    saveSettings();
  });
  
  $('notificationsToggle').addEventListener('click', function() {
    settings.notifications = !settings.notifications;
    this.classList.toggle('active', settings.notifications);
    saveSettings();
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'proxyDegraded') handleProxyDegraded(message);
  });
}

// Settings Management
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) settings = { ...settings, ...result.settings };
    
    $('themeSelect').value = settings.theme;
    $('refreshInterval').value = settings.refreshInterval.toString();
    $('autoFailoverToggle').classList.toggle('active', settings.autoFailover);
    $('testBeforeConnectToggle').classList.toggle('active', settings.testBeforeConnect);
    $('notificationsToggle').classList.toggle('active', settings.notifications);
  } catch (error) { console.error('Error loading settings:', error); }
}

function saveSettings() {
  chrome.storage.local.set({ settings }).catch(console.error);
}

function applyTheme() {
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveSettings();
  showToast(`Switched to ${settings.theme} theme`, 'info');
}

// Panel Management
function showPanel(name) {
  if (name === 'settings') {
    settingsPanel.style.display = 'block';
  } else if (name === 'stats') {
    updateStatsDisplay();
    statsPanel.style.display = 'block';
  }
}

function hidePanel(name) {
  if (name === 'settings') settingsPanel.style.display = 'none';
  else if (name === 'stats') statsPanel.style.display = 'none';
}

// Stats Management
async function loadDailyStats() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['dailyStats', 'statsDate']);
    if (result.statsDate !== today) {
      dailyStats = { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 };
      await chrome.storage.local.set({ dailyStats, statsDate: today });
    } else if (result.dailyStats) {
      dailyStats = result.dailyStats;
    }
  } catch (error) { console.error('Error loading stats:', error); }
}

function updateDailyStats(updates) {
  dailyStats = { ...dailyStats, ...updates };
  chrome.storage.local.set({ dailyStats }).catch(console.error);
}

function updateStatsDisplay() {
  $('statProxiesUsed').textContent = dailyStats.proxiesUsed;
  
  const hours = Math.floor(dailyStats.connectionTime / 3600);
  const mins = Math.floor((dailyStats.connectionTime % 3600) / 60);
  $('statConnectionTime').textContent = `${hours}h ${mins}m`;
  
  const rate = dailyStats.attempts > 0 
    ? Math.round((dailyStats.successes / dailyStats.attempts) * 100) 
    : 0;
  $('statSuccessRate').textContent = rate + '%';
  
  // Top countries
  const countryCount = {};
  proxies.forEach(p => {
    const stats = proxyStats[p.ipPort];
    if (stats && stats.successes > 0) {
      countryCount[p.country] = (countryCount[p.country] || 0) + stats.successes;
    }
  });
  
  const topCountries = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  $('topCountriesList').innerHTML = topCountries.map(([country, count]) => `
    <div class="setting">
      <span>${getFlag(country)} ${country}</span>
      <span style="color: var(--accent-primary); font-weight: 600;">${count} connections</span>
    </div>
  `).join('') || '<p style="color: var(--text-secondary); text-align: center;">No data yet</p>';
  
  // Connection history (recent proxies)
  const recentProxies = Object.entries(proxyStats)
    .filter(([, s]) => s.lastSuccess)
    .sort((a, b) => b[1].lastSuccess - a[1].lastSuccess)
    .slice(0, 5);
  
  $('connectionHistoryList').innerHTML = recentProxies.map(([ipPort, stats]) => {
    const proxy = proxies.find(p => p.ipPort === ipPort);
    return `
      <div class="setting">
        <div>
          <div style="font-weight: 600;">${proxy ? getFlag(proxy.country) : '🌍'} ${ipPort}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">
            Success: ${stats.successRate}% | Avg: ${stats.avgLatency || 0}ms
          </div>
        </div>
      </div>
    `;
  }).join('') || '<p style="color: var(--text-secondary); text-align: center;">No connections yet</p>';
}

// Load favorites from storage
async function loadFavorites() {
  try {
    const result = await chrome.storage.local.get(['favorites']);
    favorites = result.favorites || [];
  } catch (error) { console.error('Error loading favorites:', error); }
}

// Load proxy stats
async function loadProxyStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getProxyStats' });
    proxyStats = response.stats || {};
  } catch (error) { proxyStats = {}; }
}

// Load current proxy
async function loadCurrentProxy() {
  try {
    const result = await chrome.storage.local.get(['activeProxy', 'connectionStartTime']);
    currentProxy = result.activeProxy || null;
    if (currentProxy && result.connectionStartTime) {
      connectionStartTime = result.connectionStartTime;
      startConnectionTimer();
      startMonitoring();
    }
    updateUI();
  } catch (error) { console.error('Error loading current proxy:', error); }
}

// Load proxies
async function loadProxies() {
  showLoading(true);
  
  try {
    const cached = await chrome.storage.local.get(['proxies', 'proxiesTimestamp']);
    if (cached.proxies?.length > 0) {
      proxies = cached.proxies;
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      showLoading(false);
    }
  } catch (error) { console.error('Error loading cached:', error); }
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'fetchProxies' });
    if (response?.proxies) {
      proxies = response.proxies;
      await chrome.storage.local.set({ proxies, proxiesTimestamp: Date.now() });
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      if (proxies.length > 0) showToast(`Loaded ${proxies.length} proxies`, 'info');
    }
  } catch (error) {
    if (!proxies.length) showEmptyState('noProxies');
    else showToast('Using cached proxies', 'warning');
  } finally {
    showLoading(false);
  }
}

// Populate country filter
function populateCountryFilter() {
  const countries = [...new Set(proxies.map(p => p.country))].sort();
  countryFilter.innerHTML = '<option value="">🌍 All Countries</option>';
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = `${getFlag(country)} ${country}`;
    countryFilter.appendChild(opt);
  });
}

// Filter proxies
function filterProxies() {
  const selectedCountry = countryFilter.value;
  const selectedType = typeFilter.value;
  const activeChip = filterChips.querySelector('.chip-active');
  const speedFilter = activeChip?.dataset.filter === 'speed' ? activeChip.dataset.value : 'all';
  
  let filtered = proxies;
  
  if (currentTab === 'favorites') {
    filtered = filtered.filter(p => favorites.some(f => f.ipPort === p.ipPort));
  } else if (currentTab === 'recent') {
    chrome.storage.local.get(['recentlyUsed'], (result) => {
      const recent = result.recentlyUsed || [];
      filtered = filtered.filter(p => recent.some(r => r.proxy.ipPort === p.ipPort));
      applyFilters(filtered, selectedCountry, selectedType, speedFilter);
    });
    return;
  }
  
  applyFilters(filtered, selectedCountry, selectedType, speedFilter);
}

function applyFilters(filtered, country, type, speed) {
  if (country) filtered = filtered.filter(p => p.country === country);
  if (type) filtered = filtered.filter(p => p.type === type);
  if (speed === 'fast') filtered = filtered.filter(p => p.speedMs < 100);
  if (speed === 'medium') filtered = filtered.filter(p => p.speedMs < 300);
  
  filtered = filtered.map(p => ({ ...p, score: calculateProxyScore(p) }))
    .sort((a, b) => b.score - a.score);
  
  renderProxyList(filtered);
}

// Calculate proxy score
function calculateProxyScore(proxy) {
  const stats = proxyStats[proxy.ipPort] || { successRate: 50, avgLatency: 100 };
  const speedScore = Math.max(0, 100 - proxy.speedMs / 5);
  const reliabilityScore = stats.successRate || 50;
  let freshnessScore = 50;
  if (proxy.lastCheck) {
    if (proxy.lastCheck.includes('только что')) freshnessScore = 100;
    else if (proxy.lastCheck.includes('1 мин')) freshnessScore = 90;
    else if (proxy.lastCheck.includes('2 мин')) freshnessScore = 80;
    else if (proxy.lastCheck.includes('3 мин')) freshnessScore = 70;
  }
  const favoriteBonus = favorites.some(f => f.ipPort === proxy.ipPort) ? 10 : 0;
  return (speedScore * 0.4) + (reliabilityScore * 0.4) + (freshnessScore * 0.2) + favoriteBonus;
}

// Get recommended proxies
function getRecommendedProxies(excludeProxy = null) {
  return proxies
    .filter(p => !excludeProxy || p.ipPort !== excludeProxy.ipPort)
    .map(p => ({ ...p, score: calculateProxyScore(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Render recommended
function renderRecommended() {
  const recommended = getRecommendedProxies();
  if (!recommended.length || recommended[0].score < 60) {
    recommendedSection.style.display = 'none';
    return;
  }
  recommendedSection.style.display = 'block';
  recommendedList.innerHTML = recommended.slice(0, 3).map(proxy => {
    const stats = proxyStats[proxy.ipPort] || {};
    return `
      <div class="recommended-item" data-proxy="${proxy.ipPort}">
        <div class="rec-info">
          <span class="rec-flag">${getFlag(proxy.country)}</span>
          <span class="rec-country">${proxy.country}</span>
          <span class="rec-type">${proxy.type}</span>
        </div>
        <div class="rec-stats">
          <span class="rec-speed">⚡ ${proxy.speedMs}ms</span>
          ${stats.successRate ? `<span class="rec-rate">✓ ${stats.successRate}%</span>` : ''}
        </div>
        <button class="rec-connect-btn">Connect</button>
      </div>
    `;
  }).join('');
  
  recommendedList.querySelectorAll('.recommended-item').forEach(item => {
    const proxy = proxies.find(p => p.ipPort === item.dataset.proxy);
    item.querySelector('.rec-connect-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (proxy) connectToProxy(proxy, { target: item });
    });
    item.addEventListener('click', () => {
      if (proxy) connectToProxy(proxy, { target: item });
    });
  });
}

// Render proxy list
function renderProxyList(proxyItems) {
  proxyList.innerHTML = '';
  if (!proxyItems.length) {
    showEmptyState(currentTab === 'favorites' ? 'noFavorites' : 'noResults');
    return;
  }
  proxyItems.forEach(proxy => proxyList.appendChild(createProxyItem(proxy)));
}

// Create proxy item
function createProxyItem(proxy) {
  const item = document.createElement('div');
  item.className = 'proxy-item' + (currentProxy?.ipPort === proxy.ipPort ? ' active' : '');
  const stats = proxyStats[proxy.ipPort] || {};
  const flag = getFlag(proxy.country);
  const isFav = favorites.some(f => f.ipPort === proxy.ipPort);
  const workingStatus = getWorkingStatus(proxy);
  
  item.innerHTML = `
    <div class="proxy-info">
      <div class="proxy-ip">
        <span class="proxy-flag">${flag}</span>
        <span>${proxy.ipPort}</span>
        ${isFav ? '<span class="fav-indicator">⭐</span>' : ''}
      </div>
      <div class="proxy-details">
        <span>${proxy.country}</span>
        <span class="proxy-type">${proxy.type}</span>
        <span class="proxy-speed">⚡ ${proxy.speedMs}ms</span>
        ${stats.successRate ? `<span class="proxy-rate">✓ ${stats.successRate}%</span>` : ''}
        ${workingStatus !== 'unknown' ? `<span class="proxy-status ${workingStatus}">${workingStatus === 'good' ? '✓' : '⚠'}</span>` : ''}
      </div>
      ${stats.avgLatency && stats.latencies?.length ? renderSparkline(stats.latencies) : ''}
    </div>
    <div class="proxy-actions">
      <button class="icon-btn fav-btn ${isFav ? 'active' : ''}">${isFav ? '⭐' : '☆'}</button>
      <button class="connect-btn ${currentProxy?.ipPort === proxy.ipPort ? 'active' : ''}">
        ${currentProxy?.ipPort === proxy.ipPort ? 'Connected' : 'Connect'}
      </button>
    </div>
  `;
  
  item.querySelector('.fav-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFavorite(proxy);
    renderProxyList(proxyItems);
    renderRecommended();
  });
  
  item.querySelector('.connect-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    connectToProxy(proxy, { target: item });
  });
  
  return item;
}

// Render sparkline
function renderSparkline(latencies) {
  if (latencies.length < 2) return '';
  const w = 60, h = 20;
  const max = Math.max(...latencies, 100), min = Math.min(...latencies);
  const range = max - min || 1;
  const points = latencies.slice(-10).map((lat, i) => {
    const x = (i / 9) * w;
    const y = h - ((lat - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = latencies[latencies.length - 1] < 100 ? '#2ed573' : latencies[latencies.length - 1] < 300 ? '#64ffda' : '#ffa502';
  return `<div class="sparkline-container"><svg width="${w}" height="${h}" class="sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

// Get working status
function getWorkingStatus(proxy) {
  if (!proxy.lastCheck) return 'unknown';
  const recent = ['только что', '1 мин', '2 мин', '3 мин'].some(t => proxy.lastCheck.includes(t));
  return recent ? 'good' : 'warning';
}

// Render quick connect
function renderQuickConnect() {
  const fastest = proxies.filter(p => p.speedMs < 150 && getWorkingStatus(p) === 'good')
    .sort((a, b) => a.speedMs - b.speedMs).slice(0, 4);
  
  if (!fastest.length) { quickConnectSection.style.display = 'none'; return; }
  quickConnectSection.style.display = 'block';
  
  quickConnectGrid.innerHTML = fastest.map(p => `
    <button class="quick-connect-btn" data-proxy="${p.ipPort}">
      <span class="qc-flag">${getFlag(p.country)}</span>
      <span class="qc-country">${p.country}</span>
      <span class="qc-speed">${p.speedMs}ms</span>
    </button>
  `).join('');
  
  quickConnectGrid.querySelectorAll('.quick-connect-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proxy = proxies.find(p => p.ipPort === btn.dataset.proxy);
      if (proxy) await connectToProxy(proxy, { target: btn });
    });
  });
}

// Switch tab
function switchToTab(tabName) {
  currentTab = tabName;
  mainTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab-active', t.dataset.tab === tabName));
  listTitle.textContent = { all: 'Available Proxies', favorites: '⭐ Favorites', recent: '🕐 Recently Used' }[tabName];
  filterProxies();
}

// Connect to proxy
async function connectToProxy(proxy, event) {
  const proxyItem = event.target.closest('.proxy-item') || event.target;
  proxyItem.classList.add('connecting');
  const connectBtn = event.target.querySelector('.connect-btn') || event.target;
  const originalText = connectBtn.textContent;
  connectBtn.textContent = '🧪 Testing...';
  testStatus.style.display = 'block';
  testText.textContent = 'Testing proxy connectivity...';
  
  try {
    if (settings.testBeforeConnect) {
      const testResult = await chrome.runtime.sendMessage({ action: 'testProxy', proxy });
      await chrome.runtime.sendMessage({ action: 'updateProxyStats', proxy, success: testResult.success, latency: testResult.latency });
      await loadProxyStats();
      if (!testResult.success) throw new Error('Proxy test failed');
      testText.textContent = `✓ Test passed (${testResult.latency}ms)`;
      await new Promise(r => setTimeout(r, 500));
    }
    
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    await chrome.runtime.sendMessage({ action: 'setFailoverProxies', proxies, currentProxy: proxy });
    
    currentProxy = proxy;
    connectionStartTime = Date.now();
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime });
    await addToRecentlyUsed(proxy);
    updateDailyStats({ proxiesUsed: dailyStats.proxiesUsed + 1 });
    
    startConnectionTimer();
    startMonitoring();
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast(`Connected to ${proxy.country} (${proxy.speedMs}ms)`, 'success');
  } catch (error) {
    showToast(`Connection failed: ${error.message}`, 'error');
    updateDailyStats({ attempts: dailyStats.attempts + 1 });
    if (settings.autoFailover) {
      const result = await chrome.runtime.sendMessage({ action: 'getNextFailoverProxy' });
      if (result.proxy) {
        showToast('Auto-failover: Trying ' + result.proxy.country, 'info');
        await connectToProxy(result.proxy, event);
        return;
      }
    }
  } finally {
    proxyItem.classList.remove('connecting');
    testStatus.style.display = 'none';
  }
}

// Disconnect
async function disconnectProxy() {
  try {
    await chrome.runtime.sendMessage({ action: 'clearProxy' });
    await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    await chrome.storage.local.remove(['activeProxy', 'connectionStartTime']);
    stopConnectionTimer();
    stopMonitoring();
    currentProxy = null;
    connectionStartTime = null;
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast('Disconnected', 'info');
  } catch (error) { showToast('Disconnect failed', 'error'); }
}

// Toggle favorite
async function toggleFavorite(proxy) {
  const idx = favorites.findIndex(f => f.ipPort === proxy.ipPort);
  if (idx === -1) {
    favorites.push({ ...proxy, favoritedAt: Date.now() });
    showToast(`Added ${proxy.country} to favorites`, 'success');
  } else {
    favorites.splice(idx, 1);
    showToast('Removed from favorites', 'info');
  }
  await chrome.storage.local.set({ favorites });
}

// Add to recently used
async function addToRecentlyUsed(proxy) {
  try {
    const { recentlyUsed = [] } = await chrome.storage.local.get(['recentlyUsed']);
    const filtered = recentlyUsed.filter(r => r.proxy.ipPort !== proxy.ipPort);
    filtered.unshift({ proxy: { ...proxy }, lastUsed: Date.now() });
    await chrome.storage.local.set({ recentlyUsed: filtered.slice(0, 10) });
  } catch (error) { console.error(error); }
}

// Monitoring
function startMonitoring() {
  if (currentProxy && !monitoringActive) {
    chrome.runtime.sendMessage({ action: 'startMonitoring', proxy: currentProxy });
    monitoringActive = true;
    monitoringStatus.style.display = 'flex';
  }
}

function stopMonitoring() {
  if (monitoringActive) {
    chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    monitoringActive = false;
    monitoringStatus.style.display = 'none';
  }
}

// Timer
function startConnectionTimer() {
  connectionTimer.style.display = 'flex';
  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!connectionStartTime) return;
  const elapsed = Date.now() - connectionStartTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  timerValue.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function stopConnectionTimer() {
  connectionTimer.style.display = 'none';
  if (timerInterval) clearInterval(timerInterval);
  timerValue.textContent = '00:00';
}

// Update timer on disconnect
function updateConnectionTime() {
  if (connectionStartTime) {
    const elapsed = Math.floor((Date.now() - connectionStartTime) / 1000);
    updateDailyStats({ connectionTime: dailyStats.connectionTime + elapsed });
  }
}

// Update UI
function updateUI() {
  if (currentProxy) {
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connected';
    currentProxyValue.textContent = `${getFlag(currentProxy.country)} ${currentProxy.ipPort}`;
    disconnectBtn.disabled = false;
  } else {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';
    currentProxyValue.textContent = 'None';
    disconnectBtn.disabled = true;
    connectionTimer.style.display = 'none';
    monitoringStatus.style.display = 'none';
    monitoringActive = false;
  }
}

function updateProxyCount() { proxyCount.textContent = proxies.length; }
function showLoading(show) { loading.classList.toggle('show', show); if (show) proxyList.innerHTML = ''; }

// Empty state
function showEmptyState(type) {
  const msgs = {
    noProxies: { icon: '📭', title: 'No Proxies', msg: 'Failed to load. Check connection.', action: 'Retry', fn: loadProxies },
    noResults: { icon: '🔍', title: 'No Matches', msg: 'Try adjusting filters.', action: 'Clear', fn: () => { countryFilter.value = ''; typeFilter.value = ''; filterProxies(); } },
    noFavorites: { icon: '⭐', title: 'No Favorites', msg: 'Star proxies to save them.', action: 'Browse', fn: () => switchToTab('all') }
  };
  const { icon, title, msg, action, fn } = msgs[type];
  proxyList.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><h4>${title}</h4><p>${msg}</p><button class="btn btn-primary">${action}</button></div>`;
  proxyList.querySelector('.btn').addEventListener('click', fn);
}

// Toast
function showToast(message, type = 'info') {
  if (!settings.notifications && type !== 'error') return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// Handle degradation
function handleProxyDegraded({ proxy, latency, success }) {
  if (!success) {
    showToast(`⚠️ Proxy ${proxy.ipPort} stopped working`, 'warning');
    const next = getRecommendedProxies(proxy)[0];
    if (next) showToast('Try: ' + next.country + ' (' + next.speedMs + 'ms)', 'info');
  } else if (latency > 500) {
    showToast(`⚠️ High latency (${latency}ms)`, 'warning');
  }
}

// Auto refresh
let refreshTimer;
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (settings.refreshInterval > 0) {
    refreshTimer = setInterval(loadProxies, settings.refreshInterval);
  }
}

// Import/Export
async function importProxies() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (Array.isArray(imported)) {
        proxies = [...proxies, ...imported];
        await chrome.storage.local.set({ proxies });
        showToast(`Imported ${imported.length} proxies`, 'success');
        loadProxies();
      }
    } catch {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const imported = lines.map(line => {
        const [ip, port] = line.split(':');
        return { ip, port: parseInt(port), ipPort: line, country: 'Unknown', type: 'HTTPS', speedMs: 9999 };
      }).filter(p => p.ip && p.port);
      proxies = [...proxies, ...imported];
      await chrome.storage.local.set({ proxies });
      showToast(`Imported ${imported.length} proxies`, 'success');
      loadProxies();
    }
  };
  input.click();
}

function exportProxies() {
  const working = proxies.filter(p => {
    const stats = proxyStats[p.ipPort];
    return stats && stats.successRate > 50;
  });
  const data = JSON.stringify(working, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proxies-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${working.length} proxies`, 'success');
}

async function clearAllData() {
  if (confirm('Clear all extension data? This cannot be undone.')) {
    await chrome.storage.local.clear();
    location.reload();
  }
}

// Handle proxy degradation
function handleProxyDegraded(message) {
  const { proxy, latency, success } = message;
  if (!success) {
    showToast(`⚠️ Proxy ${proxy.ipPort} stopped working`, 'warning');
    const next = getRecommendedProxies(proxy)[0];
    if (next) showToast('Try: ' + next.country + ' (' + next.speedMs + 'ms)', 'info');
  } else if (latency > 500) {
    showToast(`⚠️ High latency (${latency}ms)`, 'warning');
  }
}
