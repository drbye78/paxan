// ProxyMania VPN - Analytics Dashboard Module
// Implements real-time graphs, historical charts, and statistics

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// CHART COMPONENTS
// ============================================================================

// Create a simple line chart
function createLineChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = options.padding || 40;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  if (!data || data.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }
  
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Find min/max values
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  
  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  // Draw grid lines
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  
  // Draw line
  ctx.strokeStyle = options.color || '#64ffda';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Draw points
  ctx.fillStyle = options.color || '#64ffda';
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw labels
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  
  // X-axis labels
  if (data.length > 0) {
    const step = Math.ceil(data.length / 6);
    for (let i = 0; i < data.length; i += step) {
      const x = padding + (i / (data.length - 1)) * chartWidth;
      ctx.fillText(data[i].label || '', x, height - padding + 15);
    }
  }
  
  // Y-axis labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const value = minValue + (valueRange / 5) * (5 - i);
    const y = padding + (chartHeight / 5) * i;
    ctx.fillText(Math.round(value), padding - 5, y + 4);
  }
}

// Create a bar chart
function createBarChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = options.padding || 40;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!data || data.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }
  
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / data.length * 0.7;
  const barGap = chartWidth / data.length * 0.3;
  
  const maxValue = Math.max(...data.map(d => d.value));
  
  // Draw bars
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding + index * (barWidth + barGap) + barGap / 2;
    const y = height - padding - barHeight;
    
    ctx.fillStyle = item.color || options.color || '#64ffda';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.label || '', x + barWidth / 2, height - padding + 15);
    
    // Draw value
    ctx.fillText(item.value, x + barWidth / 2, y - 5);
  });
}

// Create a sparkline chart
function createSparkline(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!data || data.length < 2) return;
  
  const max = Math.max(...data, 100);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  ctx.strokeStyle = options.color || '#64ffda';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Fill area under line
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = options.fillColor || 'rgba(100, 255, 218, 0.15)';
  ctx.fill();
}

// ============================================================================
// ANALYTICS DATA MANAGER
// ============================================================================

// Get connection statistics
async function getConnectionStats() {
  try {
    const { 
      dailyStats = {},
      proxyStats = {},
      connectionHistory = []
    } = await chrome.storage.local.get([
      'dailyStats',
      'proxyStats',
      'connectionHistory'
    ]);
    
    return {
      success: true,
      stats: {
        daily: dailyStats,
        proxy: proxyStats,
        history: connectionHistory
      }
    };
  } catch (error) {
    console.error('Failed to get connection stats:', error);
    return { success: false, error: error.message };
  }
}

// Get top countries
async function getTopCountries() {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    
    const countryStats = {};
    Object.values(proxyStats).forEach(stat => {
      if (stat.country) {
        countryStats[stat.country] = (countryStats[stat.country] || 0) + (stat.successes || 0);
      }
    });
    
    const sorted = Object.entries(countryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));
    
    return {
      success: true,
      countries: sorted
    };
  } catch (error) {
    console.error('Failed to get top countries:', error);
    return { success: false, error: error.message, countries: [] };
  }
}

// Get latency history
async function getLatencyHistory() {
  try {
    const { connectionHistory = [] } = await chrome.storage.local.get(['connectionHistory']);
    
    const latencyData = connectionHistory
      .filter(entry => entry.latency)
      .slice(-50)
      .map(entry => ({
        value: entry.latency,
        label: new Date(entry.timestamp).toLocaleTimeString(),
        timestamp: entry.timestamp
      }));
    
    return {
      success: true,
      data: latencyData
    };
  } catch (error) {
    console.error('Failed to get latency history:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Get connection status timeline
async function getConnectionTimeline() {
  try {
    const { connectionHistory = [] } = await chrome.storage.local.get(['connectionHistory']);
    
    const timelineData = connectionHistory
      .slice(-20)
      .map(entry => ({
        status: entry.success ? 'connected' : 'failed',
        timestamp: entry.timestamp,
        proxy: entry.proxyIpPort
      }));
    
    return {
      success: true,
      timeline: timelineData
    };
  } catch (error) {
    console.error('Failed to get connection timeline:', error);
    return { success: false, error: error.message, timeline: [] };
  }
}

// ============================================================================
// DASHBOARD RENDERING
// ============================================================================

// Render analytics dashboard
function renderAnalyticsDashboard() {
  return `
    <div class="analytics-dashboard">
      <div class="analytics-header">
        <h3>📊 Connection Analytics</h3>
        <button class="btn btn-ghost btn-sm" id="refreshAnalytics">Refresh</button>
      </div>
      
      <div class="analytics-grid">
        <!-- Stats Cards -->
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-value" id="totalConnections">0</div>
            <div class="stat-label">Total Connections</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="successRate">0%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="avgLatency">0ms</div>
            <div class="stat-label">Avg Latency</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="totalTime">0h</div>
            <div class="stat-label">Connected Time</div>
          </div>
        </div>
        
        <!-- Latency Chart -->
        <div class="chart-container">
          <h4>Latency Over Time</h4>
          <canvas id="latencyChart" width="400" height="200"></canvas>
        </div>
        
        <!-- Top Countries -->
        <div class="chart-container">
          <h4>Top Countries</h4>
          <div id="topCountriesList" class="stats-list"></div>
        </div>
        
        <!-- Connection Timeline -->
        <div class="chart-container">
          <h4>Recent Connections</h4>
          <div id="connectionTimeline" class="timeline-list"></div>
        </div>
      </div>
    </div>
  `;
}

// Update dashboard with data
async function updateDashboard() {
  try {
    // Get stats
    const statsResult = await getConnectionStats();
    const countriesResult = await getTopCountries();
    const latencyResult = await getLatencyHistory();
    const timelineResult = await getConnectionTimeline();
    
    if (!statsResult.success) return;
    
    const stats = statsResult.stats;
    
    // Update stat cards
    const totalConnections = document.getElementById('totalConnections');
    const successRate = document.getElementById('successRate');
    const avgLatency = document.getElementById('avgLatency');
    const totalTime = document.getElementById('totalTime');
    
    if (totalConnections) {
      totalConnections.textContent = stats.daily.attempts || 0;
    }
    
    if (successRate) {
      const rate = stats.daily.attempts > 0
        ? Math.round((stats.daily.successes / stats.daily.attempts) * 100)
        : 0;
      successRate.textContent = `${rate}%`;
    }
    
    if (avgLatency) {
      avgLatency.textContent = `${stats.daily.avgLatency || 0}ms`;
    }
    
    if (totalTime) {
      const hours = Math.floor((stats.daily.connectionTime || 0) / 3600);
      totalTime.textContent = `${hours}h`;
    }
    
    // Update latency chart
    if (latencyResult.success && latencyResult.data.length > 0) {
      const canvas = document.getElementById('latencyChart');
      if (canvas) {
        createLineChart(canvas, latencyResult.data);
      }
    }
    
    // Update top countries
    if (countriesResult.success) {
      const countriesList = document.getElementById('topCountriesList');
      if (countriesList) {
        countriesList.innerHTML = countriesResult.countries.map(({ country, count }) => `
          <div class="setting">
            <span>${country}</span>
            <span style="color: var(--accent-primary); font-weight: 600;">${count} connections</span>
          </div>
        `).join('') || '<p style="color: var(--text-secondary);">No data yet</p>';
      }
    }
    
    // Update timeline
    if (timelineResult.success) {
      const timeline = document.getElementById('connectionTimeline');
      if (timeline) {
        timeline.innerHTML = timelineResult.timeline.map(entry => `
          <div class="timeline-item ${entry.status}">
            <span class="timeline-time">${new Date(entry.timestamp).toLocaleString()}</span>
            <span class="timeline-proxy">${entry.proxy || 'Unknown'}</span>
            <span class="timeline-status">${entry.status === 'connected' ? '✓' : '✗'}</span>
          </div>
        `).join('') || '<p style="color: var(--text-secondary);">No connections yet</p>';
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update dashboard:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATA EXPORT
// ============================================================================

// Export analytics data
async function exportAnalyticsData() {
  try {
    const statsResult = await getConnectionStats();
    const countriesResult = await getTopCountries();
    
    const data = {
      exportedAt: Date.now(),
      stats: statsResult.stats,
      topCountries: countriesResult.countries
    };
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Failed to export analytics:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Chart components
  createLineChart,
  createBarChart,
  createSparkline,
  
  // Data manager
  getConnectionStats,
  getTopCountries,
  getLatencyHistory,
  getConnectionTimeline,
  
  // Dashboard rendering
  renderAnalyticsDashboard,
  updateDashboard,
  
  // Data export
  exportAnalyticsData
};