// ProxyMania VPN - Search & Filter Module
// Implements advanced search, saved presets, and filter shortcuts

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// SEARCH ENGINE
// ============================================================================

// Parse search query
function parseSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return { terms: [], operators: [], filters: {} };
  }
  
  const terms = [];
  const operators = [];
  const filters = {};
  
  // Split by spaces, respecting quotes
  const parts = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  
  parts.forEach(part => {
    // Check for operators
    if (part === 'AND' || part === 'OR' || part === 'NOT') {
      operators.push(part);
      return;
    }
    
    // Check for filter syntax (field:value)
    if (part.includes(':')) {
      const [field, value] = part.split(':');
      filters[field.toLowerCase()] = value.replace(/"/g, '');
      return;
    }
    
    // Check for NOT operator prefix
    if (part.startsWith('!')) {
      operators.push('NOT');
      terms.push(part.slice(1).replace(/"/g, ''));
      return;
    }
    
    // Regular term
    terms.push(part.replace(/"/g, ''));
  });
  
  return { terms, operators, filters };
}

// Search proxies
function searchProxies(proxies, query) {
  if (!query || !proxies) return proxies;
  
  const { terms, operators, filters } = parseSearchQuery(query);
  
  return proxies.filter(proxy => {
    let matches = true;
    
    // Apply term matching
    if (terms.length > 0) {
      const proxyText = [
        proxy.ipPort,
        proxy.country,
        proxy.type,
        proxy.ip
      ].join(' ').toLowerCase();
      
      const hasTermMatch = terms.some(term => 
        proxyText.includes(term.toLowerCase())
      );
      
      // Apply operators
      if (operators.includes('NOT')) {
        matches = !hasTermMatch;
      } else if (operators.includes('OR')) {
        matches = hasTermMatch || matches;
      } else {
        // Default AND
        matches = matches && hasTermMatch;
      }
    }
    
    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      switch (field) {
        case 'country':
          matches = matches && proxy.country.toLowerCase().includes(value.toLowerCase());
          break;
        case 'type':
          matches = matches && proxy.type.toLowerCase() === value.toLowerCase();
          break;
        case 'speed':
        case 'latency':
          const speed = parseInt(value.replace(/[<>]/g, ''));
          if (value.startsWith('<')) {
            matches = matches && proxy.speedMs < speed;
          } else if (value.startsWith('>')) {
            matches = matches && proxy.speedMs > speed;
          } else {
            matches = matches && proxy.speedMs <= speed;
          }
          break;
        case 'status':
          if (value === 'good') {
            matches = matches && proxy.lastCheck && 
              ['recently', 'just now', 'minute'].some(t => 
                proxy.lastCheck.toLowerCase().includes(t)
              );
          }
          break;
      }
    });
    
    return matches;
  });
}

// ============================================================================
// SEARCH HISTORY
// ============================================================================

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_SIZE = 20;

// Save search to history
async function saveSearchHistory(query) {
  try {
    if (!query || query.trim().length < 2) return;
    
    const { searchHistory = [] } = await chrome.storage.local.get([SEARCH_HISTORY_KEY]);
    
    // Remove duplicate if exists
    const filtered = searchHistory.filter(item => item.query !== query);
    
    // Add new search to beginning
    filtered.unshift({
      query,
      timestamp: Date.now()
    });
    
    // Keep only recent searches
    const trimmed = filtered.slice(0, MAX_HISTORY_SIZE);
    
    await chrome.storage.local.set({ searchHistory: trimmed });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save search history:', error);
    return { success: false, error: error.message };
  }
}

// Get search history
async function getSearchHistory() {
  try {
    const { searchHistory = [] } = await chrome.storage.local.get([SEARCH_HISTORY_KEY]);
    return { success: true, history: searchHistory };
  } catch (error) {
    console.error('Failed to get search history:', error);
    return { success: false, error: error.message, history: [] };
  }
}

// Clear search history
async function clearSearchHistory() {
  try {
    await chrome.storage.local.remove([SEARCH_HISTORY_KEY]);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear search history:', error);
    return { success: false, error: error.message };
  }
}

// Get popular searches
async function getPopularSearches() {
  try {
    const { searchHistory = [] } = await chrome.storage.local.get([SEARCH_HISTORY_KEY]);
    
    // Count occurrences
    const counts = {};
    searchHistory.forEach(item => {
      counts[item.query] = (counts[item.query] || 0) + 1;
    });
    
    // Sort by frequency
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return { success: true, popular: sorted };
  } catch (error) {
    console.error('Failed to get popular searches:', error);
    return { success: false, error: error.message, popular: [] };
  }
}

// ============================================================================
// FILTER PRESETS
// ============================================================================

const FILTER_PRESETS_KEY = 'filterPresets';

// Save filter preset
async function saveFilterPreset(name, filters) {
  try {
    const { filterPresets = {} } = await chrome.storage.local.get([FILTER_PRESETS_KEY]);
    
    filterPresets[name] = {
      filters,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await chrome.storage.local.set({ filterPresets });
    
    return { success: true, message: `Preset "${name}" saved` };
  } catch (error) {
    console.error('Failed to save filter preset:', error);
    return { success: false, error: error.message };
  }
}

// Get filter preset
async function getFilterPreset(name) {
  try {
    const { filterPresets = {} } = await chrome.storage.local.get([FILTER_PRESETS_KEY]);
    
    const preset = filterPresets[name];
    if (!preset) {
      return { success: false, error: 'Preset not found' };
    }
    
    return { success: true, preset };
  } catch (error) {
    console.error('Failed to get filter preset:', error);
    return { success: false, error: error.message };
  }
}

// List filter presets
async function listFilterPresets() {
  try {
    const { filterPresets = {} } = await chrome.storage.local.get([FILTER_PRESETS_KEY]);
    
    const presets = Object.entries(filterPresets).map(([name, preset]) => ({
      name,
      filters: preset.filters,
      createdAt: preset.createdAt
    }));
    
    return { success: true, presets };
  } catch (error) {
    console.error('Failed to list filter presets:', error);
    return { success: false, error: error.message, presets: [] };
  }
}

// Delete filter preset
async function deleteFilterPreset(name) {
  try {
    const { filterPresets = {} } = await chrome.storage.local.get([FILTER_PRESETS_KEY]);
    
    if (!filterPresets[name]) {
      return { success: false, error: 'Preset not found' };
    }
    
    delete filterPresets[name];
    await chrome.storage.local.set({ filterPresets });
    
    return { success: true, message: `Preset "${name}" deleted` };
  } catch (error) {
    console.error('Failed to delete filter preset:', error);
    return { success: false, error: error.message };
  }
}

// Share filter preset
function shareFilterPreset(preset) {
  try {
    const data = JSON.stringify({
      name: preset.name,
      filters: preset.filters,
      sharedAt: Date.now()
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(data);
    
    return {
      success: true,
      message: 'Preset copied to clipboard',
      data
    };
  } catch (error) {
    console.error('Failed to share preset:', error);
    return { success: false, error: error.message };
  }
}

// Import filter preset
async function importFilterPreset(data) {
  try {
    const preset = JSON.parse(data);
    
    if (!preset.name || !preset.filters) {
      return { success: false, error: 'Invalid preset format' };
    }
    
    return await saveFilterPreset(preset.name, preset.filters);
  } catch (error) {
    console.error('Failed to import preset:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// FILTER SHORTCUTS
// ============================================================================

// Built-in filter shortcuts
const BUILT_IN_SHORTCUTS = {
  'fast': { speedMs: { '<': 100 } },
  'ultra-fast': { speedMs: { '<': 50 } },
  'https': { type: 'HTTPS' },
  'socks5': { type: 'SOCKS5' },
  'trusted': { trustScore: { '>=': 70 } },
  'recent': { lastCheck: 'recent' },
  'us': { country: 'United States' },
  'de': { country: 'Germany' },
  'fr': { country: 'France' },
  'uk': { country: 'United Kingdom' }
};

// Get filter shortcut
function getFilterShortcut(name) {
  return BUILT_IN_SHORTCUTS[name.toLowerCase()] || null;
}

// Apply filter shortcut
function applyFilterShortcut(proxies, shortcutName) {
  const shortcut = getFilterShortcut(shortcutName);
  if (!shortcut) return proxies;
  
  return proxies.filter(proxy => {
    return Object.entries(shortcut).every(([field, condition]) => {
      if (typeof condition === 'object') {
        // Range condition
        const [operator, value] = Object.entries(condition)[0];
        switch (operator) {
          case '<':
            return proxy[field] < value;
          case '<=':
            return proxy[field] <= value;
          case '>':
            return proxy[field] > value;
          case '>=':
            return proxy[field] >= value;
          default:
            return true;
        }
      } else {
        // Exact match
        return proxy[field] === condition ||
          (typeof proxy[field] === 'string' && 
           proxy[field].toLowerCase().includes(condition.toLowerCase()));
      }
    });
  });
}

// ============================================================================
// SMART FILTERS
// ============================================================================

// Get smart filter suggestions
function getSmartFilterSuggestions(proxies, currentFilters) {
  const suggestions = [];
  
  // Suggest based on available data
  const countries = [...new Set(proxies.map(p => p.country))];
  if (countries.length > 5) {
    suggestions.push({
      type: 'country',
      message: `${countries.length} countries available`,
      action: 'Filter by country'
    });
  }
  
  // Suggest fast proxies
  const fastProxies = proxies.filter(p => p.speedMs < 100);
  if (fastProxies.length > 0) {
    suggestions.push({
      type: 'speed',
      message: `${fastProxies.length} fast proxies (<100ms)`,
      action: 'Show fast proxies'
    });
  }
  
  // Suggest HTTPS proxies
  const httpsProxies = proxies.filter(p => p.type === 'HTTPS');
  if (httpsProxies.length > 0) {
    suggestions.push({
      type: 'type',
      message: `${httpsProxies.length} HTTPS proxies`,
      action: 'Show HTTPS only'
    });
  }
  
  return suggestions;
}

// Get filter autocomplete
function getFilterAutocomplete(query, proxies) {
  if (!query || query.length < 2) return [];
  
  const suggestions = [];
  const lowerQuery = query.toLowerCase();
  
  // Country suggestions
  const countries = [...new Set(proxies.map(p => p.country))];
  countries.forEach(country => {
    if (country.toLowerCase().includes(lowerQuery)) {
      suggestions.push({
        type: 'country',
        value: country,
        display: `country:${country}`
      });
    }
  });
  
  // Type suggestions
  const types = [...new Set(proxies.map(p => p.type))];
  types.forEach(type => {
    if (type.toLowerCase().includes(lowerQuery)) {
      suggestions.push({
        type: 'type',
        value: type,
        display: `type:${type}`
      });
    }
  });
  
  // Speed suggestions
  if (lowerQuery.includes('fast') || lowerQuery.includes('speed')) {
    suggestions.push({
      type: 'speed',
      value: '<100',
      display: 'speed:<100'
    });
    suggestions.push({
      type: 'speed',
      value: '<300',
      display: 'speed:<300'
    });
  }
  
  return suggestions.slice(0, 10);
}

// ============================================================================
// SEARCH UI HELPERS
// ============================================================================

// Render search suggestions
function renderSearchSuggestions(suggestions, history, popular) {
  let html = '';
  
  if (suggestions.length > 0) {
    html += `
      <div class="search-section">
        <div class="search-section-title">Suggestions</div>
        ${suggestions.map(s => `
          <div class="search-suggestion" data-value="${s.display}">
            <span class="suggestion-type">${s.type}</span>
            <span class="suggestion-value">${s.value}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  if (history.length > 0) {
    html += `
      <div class="search-section">
        <div class="search-section-title">Recent Searches</div>
        ${history.slice(0, 5).map(h => `
          <div class="search-history-item" data-value="${h.query}">
            <span class="history-query">${h.query}</span>
            <span class="history-time">${new Date(h.timestamp).toLocaleDateString()}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  if (popular.length > 0) {
    html += `
      <div class="search-section">
        <div class="search-section-title">Popular Searches</div>
        ${popular.slice(0, 5).map(p => `
          <div class="search-popular-item" data-value="${p.query}">
            <span class="popular-query">${p.query}</span>
            <span class="popular-count">${p.count}x</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  return html || '<div class="search-empty">Start typing to search...</div>';
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Search engine
  parseSearchQuery,
  searchProxies,
  
  // Search history
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  getPopularSearches,
  
  // Filter presets
  saveFilterPreset,
  getFilterPreset,
  listFilterPresets,
  deleteFilterPreset,
  shareFilterPreset,
  importFilterPreset,
  
  // Filter shortcuts
  BUILT_IN_SHORTCUTS,
  getFilterShortcut,
  applyFilterShortcut,
  
  // Smart filters
  getSmartFilterSuggestions,
  getFilterAutocomplete,
  
  // UI helpers
  renderSearchSuggestions
};