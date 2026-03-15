// ProxyMania VPN - UI Core Module
// Core UI update functions and display logic

import { getState, setState, getCurrentProxy, getSettings, getCountryBlacklist } from './state.js';
import { 
  statusIndicator, 
  statusText, 
  currentProxyDisplay, 
  proxyFlag, 
  proxyAddress, 
  proxyCountry,
  connectionTimer,
  timerValue,
  proxyCount,
  listTitle,
  loading,
  emptyState,
  fab,
  qualityBadgeInline,
  qualityStats,
  connectionQualityInline,
  detailsToggle,
  connectionDetails,
  healthIndicator,
  securityIndicator,
  failoverIndicator,
  dnsIndicator,
  webrtcIndicator
} from './dom.js';
import { getFlag } from './utils.js';
import { showToast } from './toast.js';

// ============================================================================
// CORE UI UPDATES
// ============================================================================

/**
 * Update entire UI based on current state
 */
export function updateUI() {
  updateConnectionStatus();
  updateProxyDisplay();
  updateTimerDisplay();
  updateFab();
  updateIndicators();
}

/**
 * Update connection status indicator
 */
export function updateConnectionStatus() {
  if (!statusIndicator || !statusText) return;
  
  const currentProxy = getCurrentProxy();
  
  if (currentProxy) {
    statusIndicator.classList.remove('disconnected');
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connected';
  } else {
    statusIndicator.classList.remove('connected');
    statusIndicator.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
  }
}

/**
 * Update proxy display in header
 */
export function updateProxyDisplay() {
  if (!currentProxyDisplay) return;
  
  const currentProxy = getCurrentProxy();
  
  if (!currentProxy) {
    if (proxyFlag) proxyFlag.textContent = '';
    if (proxyAddress) proxyAddress.textContent = 'No proxy selected';
    if (proxyCountry) proxyCountry.textContent = '';
    return;
  }
  
  if (proxyFlag) proxyFlag.textContent = getFlag(currentProxy.country);
  if (proxyAddress) proxyAddress.textContent = currentProxy.ipPort;
  if (proxyCountry) proxyCountry.textContent = currentProxy.country;
}

/**
 * Update connection timer display
 */
export function updateTimerDisplay() {
  if (!connectionTimer || !timerValue) return;
  
  const { connectionStartTime } = getState();
  
  if (!connectionStartTime) {
    connectionTimer.style.display = 'none';
    return;
  }
  
  connectionTimer.style.display = 'flex';
  
  const elapsed = Date.now() - connectionStartTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const h = hours.toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  
  timerValue.textContent = `${h}:${m}:${s}`;
}

/**
 * Start connection timer
 */
export function startConnectionTimer() {
  const { connectionStartTime } = getState();
  
  if (connectionStartTime) return; // Already running
  
  setState({ connectionStartTime: Date.now() });
  
  // Update every second
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

/**
 * Stop connection timer
 */
export function stopConnectionTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  setState({ connectionStartTime: null });
  
  if (timerValue) {
    timerValue.textContent = '00:00:00';
  }
}

/**
 * Update connection time (for external use)
 */
export function updateConnectionTime() {
  updateTimerDisplay();
}

// ============================================================================
// FAB (FLOATING ACTION BUTTON)
// ============================================================================

/**
 * Update FAB state based on connection status
 */
export function updateFab() {
  if (!fab) return;
  
  const currentProxy = getCurrentProxy();
  
  fab.classList.remove('loading', 'connected');
  
  if (currentProxy) {
    fab.classList.add('connected');
    fab.title = 'Disconnect';
  } else {
    fab.title = 'Connect';
  }
  
  // Update icon visibility
  const connectIcon = fab.querySelector('.fab-connect');
  const disconnectIcon = fab.querySelector('.fab-disconnect');
  const loadingIcon = fab.querySelector('.fab-loading');
  
  if (connectIcon) connectIcon.style.display = currentProxy ? 'none' : 'block';
  if (disconnectIcon) disconnectIcon.style.display = currentProxy ? 'block' : 'none';
  if (loadingIcon) loadingIcon.style.display = 'none';
}

/**
 * Set FAB loading state
 * @param {boolean} isLoading - Whether FAB is in loading state
 */
export function setFabLoading(isLoading) {
  if (!fab) return;
  
  if (isLoading) {
    fab.classList.add('loading');
    fab.title = 'Connecting...';
  } else {
    fab.classList.remove('loading');
  }
}

// ============================================================================
// INDICATORS
// ============================================================================

/**
 * Update all status indicators
 */
export function updateIndicators() {
  updateHealthIndicator();
  updateSecurityIndicator();
  updateFailoverIndicator();
  updateDnsIndicator();
  updateWebRtcIndicator();
}

/**
 * Update health indicator
 */
export function updateHealthIndicator() {
  if (!healthIndicator) return;
  
  const { healthStatus } = getState();
  
  healthIndicator.classList.remove('excellent', 'good', 'fair', 'poor', 'active');
  
  if (healthStatus.active) {
    healthIndicator.classList.add('active');
    healthIndicator.classList.add(healthStatus.quality || 'excellent');
    
    const indicatorText = healthIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = `Health: ${healthStatus.quality || 'Excellent'}`;
    }
  } else {
    const indicatorText = healthIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = 'Health: Offline';
    }
  }
}

/**
 * Update security indicator
 */
export function updateSecurityIndicator() {
  if (!securityIndicator) return;
  
  const { securityStatus } = getState();
  
  securityIndicator.classList.toggle('active', securityStatus.status === 'secure');
  
  const indicatorText = securityIndicator.querySelector('.indicator-text');
  if (indicatorText) {
    indicatorText.textContent = securityStatus.status === 'secure' ? 'Secure' : 'Warning';
  }
}

/**
 * Update failover indicator
 */
export function updateFailoverIndicator() {
  if (!failoverIndicator) return;
  
  const currentProxy = getCurrentProxy();
  const { autoFailover } = getSettings();
  
  if (autoFailover) {
    failoverIndicator.style.display = 'flex';
    failoverIndicator.classList.toggle('active', currentProxy !== null);
  } else {
    failoverIndicator.style.display = 'none';
  }
}

/**
 * Update DNS leak protection indicator
 */
export function updateDnsIndicator() {
  if (!dnsIndicator) return;
  
  const { securityStatus } = getState();
  const dnsEnabled = securityStatus.dnsLeakProtection !== false;
  
  dnsIndicator.classList.toggle('active', dnsEnabled);
  dnsIndicator.classList.toggle('inactive', !dnsEnabled);
  
  const indicatorText = dnsIndicator.querySelector('.indicator-text');
  if (indicatorText) {
    indicatorText.textContent = dnsEnabled ? 'DNS: On' : 'DNS: Off';
  }
}

/**
 * Update WebRTC protection indicator
 */
export function updateWebRtcIndicator() {
  if (!webrtcIndicator) return;
  
  const { securityStatus } = getState();
  const webrtcEnabled = securityStatus.webRtcProtection !== false;
  
  webrtcIndicator.classList.toggle('active', webrtcEnabled);
  webrtcIndicator.classList.toggle('inactive', !webrtcEnabled);
  
  const indicatorText = webrtcIndicator.querySelector('.indicator-text');
  if (indicatorText) {
    indicatorText.textContent = webrtcEnabled ? 'WebRTC: On' : 'WebRTC: Off';
  }
}

// ============================================================================
// CONNECTION QUALITY
// ============================================================================

/**
 * Update connection quality display
 * @param {number} latency - Current latency in ms
 * @param {number} packetLoss - Packet loss percentage
 */
export function updateConnectionQuality(latency, packetLoss = 0) {
  const quality = calculateConnectionQuality(latency, packetLoss);
  
  setState({
    connectionQuality: {
      enabled: true,
      lastUpdate: Date.now(),
      latency: latency || 0,
      packetLoss,
      quality
    }
  });
  
  // Update inline quality badge
  if (qualityBadgeInline) {
    qualityBadgeInline.className = `quality-badge ${quality}`;
    qualityBadgeInline.textContent = quality.charAt(0).toUpperCase() + quality.slice(1);
  }
  
  if (qualityStats) {
    qualityStats.textContent = `${latency || 0}ms`;
  }
  
  // Show quality inline when connected
  if (connectionQualityInline && getCurrentProxy()) {
    connectionQualityInline.style.display = 'flex';
  }
}

/**
 * Calculate connection quality from metrics
 * @param {number} latency - Latency in ms
 * @param {number} packetLoss - Packet loss percentage
 * @returns {string} - Quality level
 */
function calculateConnectionQuality(latency, packetLoss) {
  if (!latency || packetLoss > 50) return 'poor';
  if (latency <= 100 && packetLoss <= 1) return 'excellent';
  if (latency <= 300 && packetLoss <= 5) return 'good';
  if (latency <= 500 && packetLoss <= 10) return 'fair';
  return 'poor';
}

// ============================================================================
// LOADING STATES
// ============================================================================

/**
 * Show/hide loading indicator
 * @param {boolean} show - Whether to show loading
 */
export function showLoading(show) {
  if (!loading) return;
  
  if (show) {
    loading.style.display = 'flex';
    loading.classList.add('loading-visible');
  } else {
    loading.style.display = 'none';
    loading.classList.remove('loading-visible');
  }
}

/**
 * Show loading spinner with message
 * @param {string} message - Loading message
 */
export function showLoadingMessage(message) {
  if (!loading) return;
  
  const messageEl = loading.querySelector('.loading-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
  
  showLoading(true);
}

// ============================================================================
// EMPTY STATE
// ============================================================================

/**
 * Hide empty state
 */
export function hideEmptyState() {
  if (!emptyState) return;
  emptyState.style.display = 'none';
}

/**
 * Show empty state
 * @param {string} type - Empty state type: no_proxies, no_favorites, no_recent, search_empty, filtered_empty
 */
export function showEmptyState(type = 'no_proxies') {
  if (!emptyState) return;
  
  const titleEl = emptyState.querySelector('.empty-title');
  const messageEl = emptyState.querySelector('.empty-message');
  const iconEl = emptyState.querySelector('.empty-icon');
  
  const messages = {
    no_proxies: {
      title: 'No Proxies Available',
      message: 'Click refresh to load proxies from the server',
      icon: '📡'
    },
    no_favorites: {
      title: 'No Favorites',
      message: 'Star your favorite proxies to quickly access them',
      icon: '⭐'
    },
    no_recent: {
      title: 'No Recent Proxies',
      message: 'Recently used proxies will appear here',
      icon: '🕐'
    },
    search_empty: {
      title: 'No Search Results',
      message: 'Try a different search term',
      icon: '🔍'
    },
    filtered_empty: {
      title: 'No Matching Proxies',
      message: 'Try adjusting your filters',
      icon: '🎯'
    }
  };
  
  const config = messages[type] || messages.no_proxies;
  
  if (titleEl) titleEl.textContent = config.title;
  if (messageEl) messageEl.textContent = config.message;
  if (iconEl) iconEl.textContent = config.icon;
  
  emptyState.style.display = 'flex';
}

/**
 * Update proxy count display
 * @param {number} count - Number of proxies
 * @param {number} total - Total number of proxies (before filtering)
 */
export function updateProxyCount(count, total) {
  if (!proxyCount) return;
  
  if (count === total) {
    proxyCount.textContent = `${count} proxies`;
  } else {
    proxyCount.textContent = `${count} of ${total} proxies`;
  }
}

/**
 * Update list title
 * @param {string} title - List title
 */
export function updateListTitle(title) {
  if (!listTitle) return;
  listTitle.textContent = title;
}

// ============================================================================
// PROGRESSIVE DISCLOSURE
// ============================================================================

/**
 * Toggle connection details visibility
 */
export function toggleDetails() {
  const { detailsExpanded } = getState();
  const newExpanded = !detailsExpanded;
  
  setState({ detailsExpanded: newExpanded });
  
  if (detailsToggle) {
    detailsToggle.setAttribute('aria-expanded', newExpanded);
  }
  
  if (connectionDetails) {
    connectionDetails.style.display = newExpanded ? 'block' : 'none';
  }
}

/**
 * Set details expanded state
 * @param {boolean} expanded - Whether details should be expanded
 */
export function setDetailsExpanded(expanded) {
  setState({ detailsExpanded: expanded });
  
  if (detailsToggle) {
    detailsToggle.setAttribute('aria-expanded', expanded);
  }
  
  if (connectionDetails) {
    connectionDetails.style.display = expanded ? 'block' : 'none';
  }
}

// ============================================================================
// SCREEN READER ANNOUNCEMENTS
// ============================================================================

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 */
export function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}
