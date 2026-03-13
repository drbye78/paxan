function setupEventHandlers(state) {
  const { DOM, handlers, applyTheme, saveSettings } = state;
  
  if (DOM.warningDismiss && DOM.securityWarning) {
    DOM.warningDismiss.addEventListener('click', async () => {
      DOM.securityWarning.classList.add('hidden');
      try {
        await chrome.storage.local.set({ securityWarningDismissed: true });
      } catch (e) {}
    });
    chrome.storage.local.get(['securityWarningDismissed']).then((result) => {
      if (result.securityWarningDismissed) {
        DOM.securityWarning.classList.add('hidden');
      }
    }).catch(() => {});
  }

  if (DOM.fab) {
    DOM.fab.addEventListener('click', handlers.handleFabClick);
  }
  
  if (DOM.overflowBtn) {
    DOM.overflowBtn.addEventListener('click', handlers.toggleOverflowMenu);
  }
  if (DOM.overflowStatsBtn) {
    DOM.overflowStatsBtn.addEventListener('click', () => { handlers.toggleOverflowMenu(); handlers.showPanel('stats'); });
  }
  if (DOM.overflowFavoritesBtn) {
    DOM.overflowFavoritesBtn.addEventListener('click', () => { handlers.toggleOverflowMenu(); handlers.switchToTab('favorites'); });
  }
  if (DOM.overflowApplyRuleBtn) {
    DOM.overflowApplyRuleBtn.addEventListener('click', () => { handlers.toggleOverflowMenu(); handlers.applyRuleForCurrentTab(); });
  }
  if (DOM.overflowThemeBtn) {
    DOM.overflowThemeBtn.addEventListener('click', () => { handlers.toggleOverflowMenu(); handlers.toggleTheme(); });
  }
  
  document.addEventListener('click', (e) => {
    if (DOM.overflowMenu && !DOM.overflowBtn?.contains(e.target) && !DOM.overflowMenu.contains(e.target)) {
      DOM.overflowMenu.style.display = 'none';
    }
  });
  
  if (DOM.detailsToggle) {
    DOM.detailsToggle.addEventListener('click', handlers.toggleDetails);
  }
  
  if (DOM.quickConnectToggle) {
    DOM.quickConnectToggle.addEventListener('click', handlers.toggleQuickConnect);
  }
  
  if (DOM.ipDetectorSection) {
    DOM.ipDetectorSection.addEventListener('click', (e) => {
      if (e.target !== DOM.ipCheckBtn) {
        handlers.toggleIpDetector();
      }
    });
  }
  
  $('emptyRefreshBtn')?.addEventListener('click', handlers.loadProxies);
  DOM.settingsBtn?.addEventListener('click', () => handlers.showPanel('settings'));
  $('settingsClose')?.addEventListener('click', () => handlers.hidePanel('settings'));
  $('statsClose')?.addEventListener('click', () => handlers.hidePanel('stats'));
  $('importBtn')?.addEventListener('click', handlers.importProxies);
  $('exportBtn')?.addEventListener('click', handlers.exportProxies);
  $('clearDataBtn')?.addEventListener('click', handlers.clearAllData);
  DOM.countryFilter?.addEventListener('change', handlers.filterProxies);
  DOM.typeFilter?.addEventListener('change', handlers.filterProxies);
  
  if (DOM.bestProxyBtn) {
    DOM.bestProxyBtn.addEventListener('click', handlers.connectToBestProxy);
  }
  
  $('dnsLeakToggle')?.addEventListener('click', handlers.toggleDnsLeakProtection);
  $('webRtcToggle')?.addEventListener('click', handlers.toggleWebRtcProtection);
  
  if (DOM.ipCheckBtn) {
    DOM.ipCheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.checkIpAddresses();
    });
  }
  
  $('addSiteRuleBtn')?.addEventListener('click', handlers.showAddSiteRuleDialog);
  $('siteRulesList')?.addEventListener('click', handlers.handleSiteRuleAction);
  
  if (DOM.rotationToggle) {
    DOM.rotationToggle.addEventListener('click', handlers.toggleAutoRotation);
  }
  if (DOM.rotationIntervalSelect) {
    DOM.rotationIntervalSelect.addEventListener('change', handlers.updateRotationInterval);
  }
  
  if (DOM.manageBlacklistBtn) {
    DOM.manageBlacklistBtn.addEventListener('click', handlers.toggleBlacklistPanel);
  }
  
  if (DOM.themeSelect) {
    DOM.themeSelect.addEventListener('change', (e) => {
      state.settings.theme = e.target.value;
      applyTheme();
      saveSettings();
    });
  }

  setupKeyboardShortcuts(state);
  setupTabListeners(state);
  setupFilterChipListeners(state);
  setupSettingsListeners(state);
}

function setupKeyboardShortcuts(state) {
  const { DOM, handlers } = state;
  
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        DOM.proxySearch?.focus();
      }
      return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      DOM.proxySearch?.focus();
    }
    
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      DOM.proxySearch?.focus();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (state.currentProxy) handlers.disconnectProxy();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      handlers.loadProxies();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      handlers.checkIpAddresses();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handlers.showPanel('settings');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
      e.preventDefault();
      handlers.connectToBestProxy();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      DOM.countryFilter?.focus();
    }
    
    if (e.key === 'Escape') {
      handlers.hidePanel('settings');
      handlers.hidePanel('stats');
    }
  });
}

function setupTabListeners(state) {
  const { DOM, handlers } = state;
  const tabContainer = DOM.tabChips || DOM.mainTabs;
  if (!tabContainer) return;
  
  const tabs = tabContainer.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => handlers.switchToTab(tab.dataset.tab));
  });
}

function setupFilterChipListeners(state) {
  const { DOM, handlers } = state;
  if (!DOM.filterChips) return;
  DOM.filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      handlers.filterProxies();
    });
  });
}

function setupSettingsListeners(state) {
  const { DOM, handlers, saveSettings, applyTheme, startAutoRefresh, loadProxies, showToast } = state;
  
  $('themeSelect')?.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    applyTheme();
    saveSettings();
  });
  
  $('refreshInterval')?.addEventListener('change', (e) => {
    state.settings.refreshInterval = parseInt(e.target.value);
    saveSettings();
    startAutoRefresh();
  });
  
  $('proxySource')?.addEventListener('change', (e) => {
    state.settings.proxySource = e.target.value;
    saveSettings();
    showToast(`Proxy source changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
    loadProxies(true);
  });
  
  $('autoFailoverToggle')?.addEventListener('click', function() {
    state.settings.autoFailover = !state.settings.autoFailover;
    this.classList.toggle('active', state.settings.autoFailover);
    saveSettings();
  });
  
  $('testBeforeConnectToggle')?.addEventListener('click', function() {
    state.settings.testBeforeConnect = !state.settings.testBeforeConnect;
    this.classList.toggle('active', state.settings.testBeforeConnect);
    saveSettings();
  });
  
  $('autoConnectToggle')?.addEventListener('click', function() {
    state.settings.autoConnect = !state.settings.autoConnect;
    this.classList.toggle('active', state.settings.autoConnect);
    saveSettings();
    showToast(`Auto-connect ${state.settings.autoConnect ? 'enabled' : 'disabled'}`, 'info');
  });
  
  $('notificationsToggle')?.addEventListener('click', function() {
    state.settings.notifications = !state.settings.notifications;
    this.classList.toggle('active', state.settings.notifications);
    saveSettings();
  });
}

function setupMessageListener(state) {
  const { handlers } = state;
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'proxyDegraded') handlers.handleProxyDegraded(message);
    if (message.action === 'securityAlert') handlers.handleSecurityAlert(message);
    if (message.action === 'securityStatusUpdate') handlers.updateSecurityStatus(message);
    if (message.action === 'healthStatusUpdate') handlers.updateHealthStatus(message);
    if (message.action === 'connectionDegraded') handlers.handleConnectionDegraded(message);
    if (message.action === 'showOnboarding') handlers.showOnboardingStep(message.step);
    if (message.action === 'hideOnboarding') handlers.hideOnboarding();
    if (message.action === 'showOnboardingStep') handlers.showOnboardingStep(message.step);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupEventHandlers, setupKeyboardShortcuts, setupTabListeners, setupFilterChipListeners, setupSettingsListeners, setupMessageListener };
}
