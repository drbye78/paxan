// ProxyMania VPN - URL Rules UI Module
// Implements whitelist/blacklist UI with add/remove URLs, import/export, and pattern testing

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// RULES LIST RENDERING
// ============================================================================

// Render URL rules list
function renderUrlRules(urlRules) {
  if (!urlRules || urlRules.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h4>No URL Rules</h4>
        <p>Add rules to control which websites use proxies</p>
      </div>
    `;
  }
  
  const groupedRules = groupRulesByAction(urlRules);
  
  return `
    <div class="url-rules-container">
      ${Object.entries(groupedRules).map(([action, rules]) => `
        <div class="rules-group">
          <div class="rules-group-header">
            <span class="action-badge ${action}">${getActionLabel(action)}</span>
            <span class="rules-count">${rules.length} rules</span>
          </div>
          <div class="rules-list">
            ${rules.map(rule => `
              <div class="url-rule-item ${rule.enabled ? 'enabled' : 'disabled'}" data-rule-id="${rule.id}">
                <div class="rule-info">
                  <div class="rule-pattern">
                    <span class="rule-type-icon">${getRuleTypeIcon(rule.type)}</span>
                    <span class="rule-pattern-text">${rule.pattern}</span>
                  </div>
                  <div class="rule-details">
                    ${rule.proxyIpPort ? `<span class="rule-proxy">🔗 ${truncate(rule.proxyIpPort, 20)}</span>` : ''}
                    <span class="rule-priority">Priority: ${rule.priority || 999}</span>
                  </div>
                </div>
                <div class="rule-actions">
                  <button class="btn btn-ghost btn-sm rule-toggle" data-rule-id="${rule.id}" title="${rule.enabled ? 'Disable' : 'Enable'} rule">
                    ${rule.enabled ? '✓' : '○'}
                  </button>
                  <button class="btn btn-ghost btn-sm rule-edit" data-rule-id="${rule.id}" title="Edit rule">
                    ✎
                  </button>
                  <button class="btn btn-ghost btn-sm rule-delete" data-rule-id="${rule.id}" title="Delete rule">
                    🗑
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render rule editor dialog
function renderRuleEditor(rule = null, availableProxies = []) {
  const isEdit = rule !== null;
  const title = isEdit ? 'Edit URL Rule' : 'Add URL Rule';
  
  return `
    <div class="dialog-overlay" id="ruleEditorDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>${title}</h3>
          <button class="dialog-close" id="closeRuleEditor">×</button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label for="rulePattern">URL Pattern:</label>
            <input type="text" id="rulePattern" class="input" 
              placeholder="e.g., *.netflix.com or /tracking\\.js$/"
              value="${isEdit ? rule.pattern : ''}">
            <div class="input-hint">Use * for wildcards, /regex/ for patterns</div>
          </div>
          <div class="form-group">
            <label for="ruleType">Pattern Type:</label>
            <select id="ruleType" class="dropdown">
              <option value="exact" ${isEdit && rule.type === 'exact' ? 'selected' : ''}>Exact Match</option>
              <option value="wildcard" ${isEdit && rule.type === 'wildcard' ? 'selected' : ''}>Wildcard (*)</option>
              <option value="domain" ${isEdit && rule.type === 'domain' ? 'selected' : ''}>Domain</option>
              <option value="regex" ${isEdit && rule.type === 'regex' ? 'selected' : ''}>Regex</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ruleAction">Action:</label>
            <select id="ruleAction" class="dropdown">
              <option value="whitelist" ${isEdit && rule.action === 'whitelist' ? 'selected' : ''}>Whitelist (Use Proxy)</option>
              <option value="blacklist" ${isEdit && rule.action === 'blacklist' ? 'selected' : ''}>Blacklist (No Proxy)</option>
              <option value="block" ${isEdit && rule.action === 'block' ? 'selected' : ''}>Block (Deny Access)</option>
              <option value="proxy" ${isEdit && rule.action === 'proxy' ? 'selected' : ''}>Force Proxy</option>
            </select>
          </div>
          <div class="form-group" id="proxySelectionGroup" style="${isEdit && (rule.action === 'whitelist' || rule.action === 'proxy') ? '' : 'display: none;'}">
            <label for="ruleProxy">Proxy (for Whitelist/Force Proxy):</label>
            <select id="ruleProxy" class="dropdown">
              <option value="">-- Use default proxy --</option>
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
            <button class="btn btn-secondary" id="cancelRuleEdit">Cancel</button>
            <button class="btn btn-ghost" id="testRulePattern">Test Pattern</button>
            <button class="btn btn-primary" id="saveRule" data-rule-id="${isEdit ? rule.id : ''}">
              ${isEdit ? 'Update' : 'Add'} Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// IMPORT/EXPORT UI
// ============================================================================

// Render import/export dialog
function renderImportExportDialog() {
  return `
    <div class="dialog-overlay" id="importExportDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>Import/Export Rules</h3>
          <button class="dialog-close" id="closeImportExport">×</button>
        </div>
        <div class="dialog-content">
          <div class="import-export-section">
            <h4>Export Rules</h4>
            <p>Download all your URL rules as a JSON file</p>
            <button class="btn btn-primary" id="exportRulesBtn">
              📥 Export Rules
            </button>
          </div>
          <hr class="divider">
          <div class="import-export-section">
            <h4>Import Rules</h4>
            <p>Load rules from a JSON file</p>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="importMerge" checked>
                <span>Merge with existing rules (uncheck to replace)</span>
              </label>
            </div>
            <input type="file" id="importFileInput" accept=".json" style="display: none;">
            <button class="btn btn-primary" id="importRulesBtn">
              📤 Import Rules
            </button>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" id="closeImportExportBtn">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// PATTERN TESTING UI
// ============================================================================

// Render pattern test dialog
function renderPatternTestDialog(pattern = '', type = 'wildcard') {
  return `
    <div class="dialog-overlay" id="patternTestDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>Test URL Pattern</h3>
          <button class="dialog-close" id="closePatternTest">×</button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label>Pattern:</label>
            <div class="pattern-display">${pattern}</div>
          </div>
          <div class="form-group">
            <label for="testUrl">Test URL:</label>
            <input type="text" id="testUrl" class="input" 
              placeholder="e.g., https://www.netflix.com/browse">
          </div>
          <div class="test-result" id="testResult" style="display: none;">
            <div class="result-icon"></div>
            <div class="result-message"></div>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" id="cancelTest">Cancel</button>
            <button class="btn btn-primary" id="runTest" data-pattern="${pattern}" data-type="${type}">
              Test
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render test result
function renderTestResult(matches, url, pattern) {
  if (matches) {
    return `
      <div class="test-result success">
        <div class="result-icon">✓</div>
        <div class="result-message">
          <strong>Match!</strong><br>
          <span class="result-url">${url}</span><br>
          matches pattern <span class="result-pattern">${pattern}</span>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="test-result failure">
        <div class="result-icon">✗</div>
        <div class="result-message">
          <strong>No Match</strong><br>
          <span class="result-url">${url}</span><br>
          does not match pattern <span class="result-pattern">${pattern}</span>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// RULES STATISTICS UI
// ============================================================================

// Render rules statistics
function renderRulesStats(stats) {
  return `
    <div class="rules-stats">
      <div class="stat-item">
        <span class="stat-value">${stats.total || 0}</span>
        <span class="stat-label">Total Rules</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.enabled || 0}</span>
        <span class="stat-label">Enabled</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.disabled || 0}</span>
        <span class="stat-label">Disabled</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.whitelist || 0}</span>
        <span class="stat-label">Whitelist</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.blacklist || 0}</span>
        <span class="stat-label">Blacklist</span>
      </div>
    </div>
  `;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Group rules by action
function groupRulesByAction(rules) {
  const groups = {
    whitelist: [],
    blacklist: [],
    block: [],
    proxy: []
  };
  
  rules.forEach(rule => {
    const action = rule.action || 'whitelist';
    if (groups[action]) {
      groups[action].push(rule);
    }
  });
  
  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });
  
  return groups;
}

// Get action label
function getActionLabel(action) {
  const labels = {
    whitelist: '✓ Whitelist',
    blacklist: '✗ Blacklist',
    block: '🚫 Block',
    proxy: '🔗 Force Proxy'
  };
  return labels[action] || action;
}

// Get rule type icon
function getRuleTypeIcon(type) {
  const icons = {
    exact: '🎯',
    wildcard: '*️⃣',
    domain: '🌐',
    regex: '⚙️'
  };
  return icons[type] || '🎯';
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

// Handle rule save
function handleSaveRule(ruleId, ruleData, isEdit, callback) {
  if (!ruleData.pattern) {
    callback({ success: false, error: 'Pattern is required' });
    return;
  }
  
  if (!ruleData.action) {
    callback({ success: false, error: 'Action is required' });
    return;
  }
  
  callback({ success: true, ruleId, rule: ruleData, isEdit });
}

// Handle rule delete
function handleDeleteRule(ruleId, callback) {
  callback({ success: true, ruleId });
}

// Handle rule toggle
function handleToggleRule(ruleId, enabled, callback) {
  callback({ success: true, ruleId, enabled });
}

// Handle pattern test
function handleTestPattern(pattern, type, testUrl, callback) {
  if (!pattern || !testUrl) {
    callback({ success: false, error: 'Pattern and URL are required' });
    return;
  }
  
  callback({ success: true, pattern, type, testUrl });
}

// Handle rules export
function handleExportRules(rules, callback) {
  callback({ success: true, rules });
}

// Handle rules import
function handleImportRules(rules, merge, callback) {
  if (!rules || !Array.isArray(rules)) {
    callback({ success: false, error: 'Invalid rules format' });
    return;
  }
  
  callback({ success: true, rules, merge });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Rendering
  renderUrlRules,
  renderRuleEditor,
  renderImportExportDialog,
  renderPatternTestDialog,
  renderTestResult,
  renderRulesStats,
  
  // Helpers
  groupRulesByAction,
  getActionLabel,
  getRuleTypeIcon,
  truncate,
  
  // Event handlers
  handleSaveRule,
  handleDeleteRule,
  handleToggleRule,
  handleTestPattern,
  handleExportRules,
  handleImportRules
};