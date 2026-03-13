const $ = (id) => document.getElementById(id);

const DOM = {
  statusIndicator: null,
  statusText: null,
  currentProxyDisplay: null,
  proxyFlag: null,
  proxyAddress: null,
  proxyCountry: null,
  connectionTimer: null,
  timerValue: null,
  testStatus: null,
  testText: null,
  healthIndicator: null,
  securityIndicator: null,
  qualityBadgeInline: null,
  qualityStats: null,
  connectionQualityInline: null,
  detailsToggle: null,
  connectionDetails: null,
  ipDetectorContent: null,
  fab: null,
  overflowBtn: null,
  overflowMenu: null,
  overflowStatsBtn: null,
  overflowFavoritesBtn: null,
  overflowApplyRuleBtn: null,
  overflowThemeBtn: null,
  settingsBtn: null,
  settingsPanel: null,
  statsPanel: null,
  proxySearch: null,
  filterChips: null,
  countryFilter: null,
  typeFilter: null,
  proxyList: null,
  proxyCount: null,
  listTitle: null,
  loading: null,
  emptyState: null,
  quickConnectGrid: null,
  quickConnectSection: null,
  quickConnectToggle: null,
  bestProxyBtn: null,
  tabChips: null,
  mainTabs: null,
  toastContainer: null,
  themeSelect: null,
  proxySourceSelect: null,
  rotationToggle: null,
  rotationIntervalSelect: null,
  manageBlacklistBtn: null,
  blacklistContainer: null,
  blacklistChips: null,
  ipCheckBtn: null,
  ipRealValue: null,
  ipProxyValue: null,
  ipDetectorSection: null,
  speedGraphCanvas: null,
  speedGraphSection: null,
  currentLatencyEl: null,
  securityWarning: null,
  warningDismiss: null,
  
  init() {
    this.statusIndicator = $('statusBadge');
    this.statusText = this.statusIndicator?.querySelector('.status-text');
    this.currentProxyDisplay = $('currentProxyDisplay');
    this.proxyFlag = $('proxyFlag');
    this.proxyAddress = $('proxyAddress');
    this.proxyCountry = $('proxyCountry');
    this.connectionTimer = $('connectionTimer');
    this.timerValue = this.connectionTimer?.querySelector('.timer-value');
    this.testStatus = $('testStatus');
    this.testText = this.testStatus?.querySelector('.test-text');
    this.healthIndicator = $('healthIndicator');
    this.securityIndicator = $('securityIndicator');
    this.qualityBadgeInline = $('qualityBadge');
    this.qualityStats = $('qualityStats');
    this.connectionQualityInline = $('connectionQualityInline');
    this.detailsToggle = $('detailsToggle');
    this.connectionDetails = $('connectionDetails');
    this.ipDetectorContent = $('ipDetectorContent');
    this.fab = $('fab');
    this.overflowBtn = $('overflowBtn');
    this.overflowMenu = $('overflowMenu');
    this.overflowStatsBtn = $('overflowStatsBtn');
    this.overflowFavoritesBtn = $('overflowFavoritesBtn');
    this.overflowApplyRuleBtn = $('overflowApplyRuleBtn');
    this.overflowThemeBtn = $('overflowThemeBtn');
    this.settingsBtn = $('settingsBtn');
    this.settingsPanel = $('settingsPanel');
    this.statsPanel = $('statsPanel');
    this.proxySearch = $('proxySearch');
    this.filterChips = $('filterChips');
    this.countryFilter = $('countryFilter');
    this.typeFilter = $('typeFilter');
    this.proxyList = $('proxyList');
    this.proxyCount = $('proxyCount');
    this.listTitle = $('listTitle');
    this.loading = $('loading');
    this.emptyState = $('emptyState');
    this.quickConnectGrid = $('quickConnectGrid');
    this.quickConnectSection = $('quickConnectSection');
    this.quickConnectToggle = $('quickConnectToggle');
    this.bestProxyBtn = $('bestProxyBtn');
    this.tabChips = $('tabChips');
    this.mainTabs = $('mainTabs');
    this.toastContainer = $('toastContainer');
    this.themeSelect = $('themeSelect');
    this.proxySourceSelect = $('proxySource');
    this.rotationToggle = $('rotationToggle');
    this.rotationIntervalSelect = $('rotationInterval');
    this.manageBlacklistBtn = $('manageBlacklistBtn');
    this.blacklistContainer = $('blacklistContainer');
    this.blacklistChips = $('blacklistChips');
    this.ipCheckBtn = $('ipCheckBtn');
    this.ipRealValue = $('ipRealValue');
    this.ipProxyValue = $('ipProxyValue');
    this.ipDetectorSection = $('ipDetectorSection');
    this.speedGraphCanvas = $('speedGraph');
    this.speedGraphSection = $('speedGraphSection');
    this.currentLatencyEl = $('currentLatency');
    this.securityWarning = $('securityWarning');
    this.warningDismiss = $('warningDismiss');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOM, $ };
}
