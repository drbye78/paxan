// ProxyMania VPN - Tab Proxy UI Module
// Implements tab list with proxy indicators, quick proxy switch, and domain rules UI

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// TAB LIST RENDERING
// ============================================================================

// Render tab list with proxy indicators
function renderTabList(tabs, tabProxyMappings, domainRules) {
  if (!tabs || tabs.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📑</div>
        <h4>No Active Tabs</h4>
        <p>Open some tabs to manage per-tab proxy settings</p>
      </div>
    `;
  }
  
  return `
    <div class="tab-list">
      ${tabs.map(tab => {
        const proxyMapping = tabProxyMappings[tab.id.toString()];
        const domainRule = findDomainRule(tab.hostname, domainRules);
        const hasProxy = proxyMapping || domainRule;
        
        return `
          <div class="tab-item ${hasProxy ? 'has-proxy' : ''}" data-tab-id="${tab.id}">
            <div class="tab-info">
              <div class="tab-title" title="${tab.title || tab.url}">${truncate(tab.title || tab.url, 40)}</div>
              <div class="tab-url">${tab.hostname || 'Unknown'}</div>
            </div>
            <div class="tab-proxy-status">
              ${hasProxy ? `
                <span class="proxy-indicator active" title="Proxy assigned">
                  🔗 ${proxyMapping ? truncate(proxyMapping.proxyIpPort, 20) : domainRule.proxyIpPort}
                </span>
              ` : `
                <span class="proxy-indicator inactive" title="No proxy">Direct</span>
              `}
            </div>
            <div class="tab-actions">
              ${hasProxy ? `
                <button class="btn btn-ghost btn-sm tab-remove-proxy" data-tab-id="${tab.id}" title="Remove proxy">
                  ✕
                </button>
              ` : `
                <button class="btn btn-ghost btn-sm tab-assign-proxy" data-tab-id="${tab.id}" title="Assign proxy">
                  🔗
                </button>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Render tab proxy assignment dialog
function renderAssignProxyDialog(tabId, tabHostname, availableProxies) {
  return `
    <div class="dialog-overlay" id="assignProxyDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>Assign Proxy to Tab</h3>
          <button class="dialog-close" id="closeAssignDialog">×</button>
        </div>
        <div class="dialog-content">
          <div class="dialog-info">
            <p><strong>Tab:</strong> ${tabHostname}</p>
          </div>
          <div class="proxy-selection">
            <label>Select Proxy:</label>
            <select id="proxySelect" class="dropdown">
              <option value="">-- Select a proxy --</option>
              ${availableProxies.map(proxy => `
                <option value="${proxy.ipPort}">
                  ${proxy.country} - ${proxy.ipPort} (${proxy.speedMs}ms)
                </option>
              `).join('')}
            </select>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" id="cancelAssign">Cancel</button>
            <button class="btn btn-primary" id="confirmAssign" data-tab-id="${tabId}">Assign</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// DOMAIN RULES UI
// ============================================================================

// Render domain rules list
function renderDomainRules(domainRules) {
  if (!domainRules || Object.keys(domainRules).length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🌐</div>
        <h4>No Domain Rules</h4>
        <p>Add rules to automatically assign proxies to specific websites</p>
      </div>
    `;
  }
  
  const rules = Object.entries(domainRules).map(([domain, rule]) => ({
    domain,
    ...rule
  })).sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  return `
    <div class="domain-rules-list">
      ${rules.map(rule => `
        <div class="domain-rule-item ${rule.enabled ? 'enabled' : 'disabled'}" data-domain="${rule.domain}">
          <div class="rule-info">
            <div class="rule-domain">
              <span class="rule-pattern-type">${getPatternTypeIcon(rule.patternType)}</span>
              <span class="rule-domain-text">${rule.domain}</span>
            </div>
            <div class="rule-details">
              <span class="rule-proxy">🔗 ${truncate(rule.proxyIpPort, 25)}</span>
              <span class="rule-priority">Priority: ${rule.priority || 999}</span>
            </div>
          </div>
          <div class="rule-actions">
            <button class="btn btn-ghost btn-sm rule-toggle" data-domain="${rule.domain}" title="${rule.enabled ? 'Disable' : 'Enable'} rule">
              ${rule.enabled ? '✓' : '○'}
            </button>
            <button class="btn btn-ghost btn-sm rule-edit" data-domain="${rule.domain}" title="Edit rule">
              ✎
            </button>
            <button class="btn btn-ghost btn-sm rule-delete" data-domain="${rule.domain}" title="Delete rule">
              🗑
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render domain rule editor
function renderDomainRuleEditor(rule = null, availableProxies = []) {
  const isEdit = rule !== null;
  const title = isEdit ? 'Edit Domain Rule' : 'Add Domain Rule';
  
  return `
    <div class="dialog-overlay" id="domainRuleDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>${title}</h3>
          <button class="dialog-close" id="closeRuleDialog">×</button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label for="ruleDomain">Domain Pattern:</label>
            <input type="text" id="ruleDomain" class="input" 
              placeholder="e.g., netflix.com or *.netflix.com"
              value="${isEdit ? rule.domain : ''}">
          </div>
          <div class="form-group">
            <label for="rulePatternType">Pattern Type:</label>
            <select id="rulePatternType" class="dropdown">
              <option value="exact" ${isEdit && rule.patternType === 'exact' ? 'selected' : ''}>Exact Match</option>
              <option value="wildcard" ${isEdit && rule.patternType === 'wildcard' ? 'selected' : ''}>Wildcard (*)</option>
              <option value="contains" ${isEdit && rule.patternType === 'contains' ? 'selected' : ''}>Contains</option>
              <option value="regex" ${isEdit && rule.patternType === 'regex' ? 'selected' : ''}>Regex</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ruleProxy">Proxy:</label>
            <select id="ruleProxy" class="dropdown">
              ${availableProxies.map(proxy => `
                <option value="${proxy.ipPort}" ${isEdit && rule.proxyIpPort === proxy.ipPort ? 'selected' : ''}>
                  ${proxy.country} - ${proxy.ipPort} (${proxy.speedMs}ms)
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="rulePriority">Priority (1 = highest):</label>
            <input type="number" id="rulePriority" class="input" 
              min="1" max="999" value="${isEdit ? (rule.priority || 999) : 100}">
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="ruleEnabled" ${isEdit && rule.enabled !== false ? 'checked' : ''}>
              <span>Enabled</span>
            </label>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" id="cancelRule">Cancel</button>
            <button class="btn btn-primary" id="saveRule" data-domain="${isEdit ? rule.domain : ''}">
              ${isEdit ? 'Update' : 'Add'} Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Find domain rule for hostname
function findDomainRule(hostname, domainRules) {
  if (!hostname || !domainRules) return null;
  
  const sortedRules = Object.entries(domainRules)
    .filter(([_, rule]) => rule.enabled !== false)
    .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));
  
  for (const [domain, rule] of sortedRules) {
    if (matchDomainPattern(hostname, domain, rule.patternType || 'exact')) {
      return { domain, ...rule };
    }
  }
  
  return null;
}

// Match domain pattern
function matchDomainPattern(hostname, pattern, patternType) {
  switch (patternType) {
    case 'exact':
      return hostname === pattern;
    case 'wildcard':
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      return hostname.includes(pattern);
    case 'contains':
      return hostname.includes(pattern);
    case 'regex':
      try {
        return new RegExp(pattern).test(hostname);
      } catch {
        return false;
      }
    default:
      return hostname === pattern;
  }
}

// Get pattern type icon
function getPatternTypeIcon(patternType) {
  const icons = {
    exact: '🎯',
    wildcard: '*️⃣',
    contains: '🔍',
    regex: '⚙️'
  };
  return icons[patternType] || '🎯';
}

// Truncate string
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// Handle tab proxy assignment
function handleAssignProxy(tabId, proxyIpPort, callback) {
  if (!proxyIpPort) {
    callback({ success: false, error: 'Please select a proxy' });
    return;
  }
  
  callback({ success: true, tabId, proxyIpPort });
}

// Handle tab proxy removal
function handleRemoveProxy(tabId, callback) {
  callback({ success: true, tabId });
}

// Handle domain rule save
function handleSaveRule(domain, ruleData, isEdit, callback) {
  if (!domain) {
    callback({ success: false, error: 'Domain is required' });
    return;
  }
  
  if (!ruleData.proxyIpPort) {
    callback({ success: false, error: 'Please select a proxy' });
    return;
  }
  
  callback({ success: true, domain, rule: ruleData, isEdit });
}

// Handle domain rule delete
function handleDeleteRule(domain, callback) {
  callback({ success: true, domain });
}

// Handle domain rule toggle
function handleToggleRule(domain, enabled, callback) {
  callback({ success: true, domain, enabled });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Rendering
  renderTabList,
  renderAssignProxyDialog,
  renderDomainRules,
  renderDomainRuleEditor,
  
  // Helpers
  findDomainRule,
  matchDomainPattern,
  getPatternTypeIcon,
  truncate,
  
  // Event handlers
  handleAssignProxy,
  handleRemoveProxy,
  handleSaveRule,
  handleDeleteRule,
  handleToggleRule
};