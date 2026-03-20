// Visualization Module - Connection Quality & Performance Charts

class VisualizationManager {
  constructor() {
    this.charts = new Map();
    this.dataBuffer = {
      latency: [],
      quality: [],
      throughput: [],
      errors: []
    };
    this.maxDataPoints = 100;
    
    this.init();
  }

  async init() {
    // Load historical data
    await this.loadHistoricalData();
    
    // Note: Periodic updates disabled in MV3
    // In popup context, use requestAnimationFrame or window.setInterval
    // In background context, use chrome.alarms API
  }

  async loadHistoricalData() {
    try {
      const result = await chrome.storage.local.get(['visualizationData']);
      if (result.visualizationData) {
        this.dataBuffer = { ...this.dataBuffer, ...result.visualizationData };
      }
    } catch (error) {
      console.error('Error loading visualization data:', error);
    }
  }

  async saveHistoricalData() {
    try {
      await chrome.storage.local.set({ visualizationData: this.dataBuffer });
    } catch (error) {
      console.error('Error saving visualization data:', error);
    }
  }

  // Collect metrics from health monitor and other sources
  async collectMetrics() {
    try {
      // Get current health status
      const healthStatus = await chrome.runtime.sendMessage({ action: 'getHealthStatus' });
      
      if (healthStatus && healthStatus.active) {
        const timestamp = Date.now();
        
        // Add latency data
        if (healthStatus.avgLatency) {
          this.addDataPoint('latency', {
            timestamp,
            value: healthStatus.avgLatency,
            quality: healthStatus.quality
          });
        }
        
        // Add quality data
        this.addDataPoint('quality', {
          timestamp,
          value: this.getQualityScore(healthStatus.quality),
          label: healthStatus.quality
        });
      }
      
      // Get proxy stats
      const proxyStats = await chrome.runtime.sendMessage({ action: 'getProxyStats' });
      if (proxyStats) {
        this.updateThroughputData(proxyStats);
      }
      
      // Save data periodically
      if (Math.random() < 0.1) { // 10% chance to save
        await this.saveHistoricalData();
      }
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  addDataPoint(type, data) {
    if (!this.dataBuffer[type]) {
      this.dataBuffer[type] = [];
    }
    
    this.dataBuffer[type].push(data);
    
    // Keep only last N data points
    if (this.dataBuffer[type].length > this.maxDataPoints) {
      this.dataBuffer[type].shift();
    }
  }

  getQualityScore(quality) {
    const scores = {
      'excellent': 100,
      'good': 75,
      'fair': 50,
      'poor': 25
    };
    return scores[quality] || 0;
  }

  updateThroughputData(proxyStats) {
    const timestamp = Date.now();
    let totalThroughput = 0;
    let activeProxies = 0;

    Object.values(proxyStats).forEach(stats => {
      if (stats.successRate && stats.avgLatency) {
        // Calculate throughput score based on success rate and latency
        const throughput = (stats.successRate / 100) * (1000 / Math.max(stats.avgLatency, 1));
        totalThroughput += throughput;
        activeProxies++;
      }
    });

    if (activeProxies > 0) {
      this.addDataPoint('throughput', {
        timestamp,
        value: totalThroughput / activeProxies
      });
    }
  }

  // Create SVG-based charts
  createLatencyChart(container, options = {}) {
    const { width = 400, height = 120, maxPoints = 50 } = options;
    const data = this.dataBuffer.latency.slice(-maxPoints);
    
    if (data.length < 2) {
      this.renderEmptyChart(container, 'No latency data available');
      return;
    }

    const svg = this.createSVG(width, height);
    const margin = { top: 10, right: 20, bottom: 20, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = this.createLinearScale(0, data.length - 1, margin.left, margin.left + chartWidth);
    const yMax = Math.max(...data.map(d => d.value)) * 1.1 || 100;
    const yScale = this.createLinearScale(0, yMax, margin.top + chartHeight, margin.top);

    // Grid lines
    this.drawGridLines(svg, chartWidth, chartHeight, margin, yMax);

    // Line path
    const linePath = this.createLinePath(data, xScale, yScale, (d, i) => i, d => d.value);
    svg.appendChild(linePath);

    // Area under curve
    const areaPath = this.createAreaPath(data, xScale, yScale, (d, i) => i, d => d.value);
    svg.appendChild(areaPath);

    // Axes
    this.drawAxes(svg, data, xScale, yScale, margin, chartWidth, chartHeight);

    // Quality indicators
    this.drawQualityIndicators(svg, data, xScale, yScale, margin);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  createQualityChart(container, options = {}) {
    const { width = 400, height = 120, maxPoints = 30 } = options;
    const data = this.dataBuffer.quality.slice(-maxPoints);
    
    if (data.length < 2) {
      this.renderEmptyChart(container, 'No quality data available');
      return;
    }

    const svg = this.createSVG(width, height);
    const margin = { top: 10, right: 20, bottom: 20, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = this.createLinearScale(0, data.length - 1, margin.left, margin.left + chartWidth);
    const yScale = this.createLinearScale(0, 100, margin.top + chartHeight, margin.top);

    // Grid lines
    this.drawGridLines(svg, chartWidth, chartHeight, margin, 100);

    // Quality bands
    this.drawQualityBands(svg, chartWidth, chartHeight, margin);

    // Line path with quality colors
    const linePath = this.createQualityLinePath(data, xScale, yScale, (d, i) => i, d => d.value);
    svg.appendChild(linePath);

    // Data points
    this.drawDataPoints(svg, data, xScale, yScale, margin);

    // Axes
    this.drawAxes(svg, data, xScale, yScale, margin, chartWidth, chartHeight);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  createThroughputChart(container, options = {}) {
    const { width = 400, height = 120, maxPoints = 40 } = options;
    const data = this.dataBuffer.throughput.slice(-maxPoints);
    
    if (data.length < 2) {
      this.renderEmptyChart(container, 'No throughput data available');
      return;
    }

    const svg = this.createSVG(width, height);
    const margin = { top: 10, right: 20, bottom: 20, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = this.createLinearScale(0, data.length - 1, margin.left, margin.left + chartWidth);
    const yMax = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const yScale = this.createLinearScale(0, yMax, margin.top + chartHeight, margin.top);

    // Grid lines
    this.drawGridLines(svg, chartWidth, chartHeight, margin, yMax);

    // Bar chart
    this.drawBars(svg, data, xScale, yScale, margin, chartWidth);

    // Axes
    this.drawAxes(svg, data, xScale, yScale, margin, chartWidth, chartHeight);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // SVG utility functions
  createSVG(width, height) {
    // Only create SVG in popup context
    if (typeof document === 'undefined') {
      return null;
    }
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    svg.style.fontSize = '11px';
    return svg;
  }

  createLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
    const domainRange = domainMax - domainMin;
    const rangeRange = rangeMax - rangeMin;
    return (value) => rangeMin + ((value - domainMin) / domainRange) * rangeRange;
  }

  createLinePath(data, xScale, yScale, xAccessor, yAccessor) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return null;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d = '';
    
    data.forEach((point, index) => {
      const x = xScale(xAccessor(point, index));
      const y = yScale(yAccessor(point, index));
      
      if (index === 0) {
        d = `M ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    });
    
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#667eea');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    return path;
  }

  createAreaPath(data, xScale, yScale, xAccessor, yAccessor) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return null;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d = '';
    
    // Start at first point
    const firstX = xScale(xAccessor(data[0], 0));
    const firstY = yScale(yAccessor(data[0], 0));
    d = `M ${firstX} ${firstY}`;
    
    // Draw line to each point
    data.forEach((point, index) => {
      const x = xScale(xAccessor(point, index));
      const y = yScale(yAccessor(point, index));
      d += ` L ${x} ${y}`;
    });
    
    // Close path
    const lastX = xScale(xAccessor(data[data.length - 1], data.length - 1));
    const bottomY = yScale(0);
    d += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    
    path.setAttribute('d', d);
    path.setAttribute('fill', 'url(#latencyGradient)');
    path.setAttribute('opacity', '0.3');
    
    return path;
  }

  createQualityLinePath(data, xScale, yScale, xAccessor, yAccessor) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return null;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d = '';
    
    data.forEach((point, index) => {
      const x = xScale(xAccessor(point, index));
      const y = yScale(yAccessor(point, index));
      
      if (index === 0) {
        d = `M ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    });
    
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'url(#qualityGradient)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    return path;
  }

  drawGridLines(svg, width, height, margin, yMax) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.setAttribute('class', 'grid-lines');
    
    // Horizontal grid lines
    const ySteps = [0.25, 0.5, 0.75, 1.0];
    ySteps.forEach(step => {
      const y = margin.top + (height * (1 - step));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', margin.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', margin.left + width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
      line.setAttribute('stroke-width', '1');
      gridGroup.appendChild(line);
    });
    
    svg.appendChild(gridGroup);
  }

  drawQualityBands(svg, width, height, margin) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    const bandsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    bandsGroup.setAttribute('class', 'quality-bands');
    
    const bands = [
      { y: 0, height: 25, color: '#ff4757', label: 'Poor' },
      { y: 25, height: 25, color: '#ffa502', label: 'Fair' },
      { y: 50, height: 25, color: '#64ffda', label: 'Good' },
      { y: 75, height: 25, color: '#2ed573', label: 'Excellent' }
    ];
    
    bands.forEach(band => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', margin.left);
      rect.setAttribute('y', margin.top + (height * (band.y / 100)));
      rect.setAttribute('width', width);
      rect.setAttribute('height', (height * (band.height / 100)));
      rect.setAttribute('fill', band.color);
      rect.setAttribute('opacity', '0.1');
      bandsGroup.appendChild(rect);
    });
    
    svg.appendChild(bandsGroup);
  }

  drawDataPoints(svg, data, xScale, yScale, margin) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pointsGroup.setAttribute('class', 'data-points');
    
    data.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(point.value);
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '2');
      circle.setAttribute('fill', this.getQualityColor(point.label));
      circle.setAttribute('opacity', '0.8');
      
      // Add hover effect
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('r', '4');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '1');
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '2');
        circle.removeAttribute('stroke');
      });
      
      pointsGroup.appendChild(circle);
    });
    
    svg.appendChild(pointsGroup);
  }

  drawBars(svg, data, xScale, yScale, margin, chartWidth) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    const barsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    barsGroup.setAttribute('class', 'bars');
    
    const barWidth = Math.max(2, chartWidth / data.length * 0.6);
    
    data.forEach((point, index) => {
      const x = xScale(index) - barWidth / 2;
      const y = yScale(point.value);
      const height = yScale(0) - y;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', 'url(#throughputGradient)');
      rect.setAttribute('rx', '2');
      rect.setAttribute('opacity', '0.8');
      
      barsGroup.appendChild(rect);
    });
    
    svg.appendChild(barsGroup);
  }

  drawAxes(svg, data, xScale, yScale, margin, chartWidth, chartHeight) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    // X-axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', margin.left);
    xAxis.setAttribute('y1', margin.top + chartHeight);
    xAxis.setAttribute('x2', margin.left + chartWidth);
    xAxis.setAttribute('y2', margin.top + chartHeight);
    xAxis.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    xAxis.setAttribute('stroke-width', '1');
    svg.appendChild(xAxis);
    
    // Y-axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', margin.left);
    yAxis.setAttribute('y1', margin.top);
    yAxis.setAttribute('x2', margin.left);
    yAxis.setAttribute('y2', margin.top + chartHeight);
    yAxis.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    yAxis.setAttribute('stroke-width', '1');
    svg.appendChild(yAxis);
  }

  drawQualityIndicators(svg, data, xScale, yScale, margin) {
    // Only create SVG elements in popup context
    if (typeof document === 'undefined') {
      return;
    }
    
    const indicatorsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    indicatorsGroup.setAttribute('class', 'quality-indicators');
    
    data.forEach((point, index) => {
      if (point.quality === 'poor') {
        const x = xScale(index);
        const y = yScale(point.value);
        
        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        indicator.setAttribute('cx', x);
        indicator.setAttribute('cy', y);
        indicator.setAttribute('r', '3');
        indicator.setAttribute('fill', '#ff4757');
        indicator.setAttribute('stroke', '#fff');
        indicator.setAttribute('stroke-width', '1');
        
        indicatorsGroup.appendChild(indicator);
      }
    });
    
    svg.appendChild(indicatorsGroup);
  }

  getQualityColor(quality) {
    const colors = {
      'excellent': '#2ed573',
      'good': '#64ffda',
      'fair': '#ffa502',
      'poor': '#ff4757'
    };
    return colors[quality] || '#8892b0';
  }

  renderEmptyChart(container, message) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 120px; color: var(--text-secondary); font-size: 12px;">
        ${message}
      </div>
    `;
  }

  // Update charts with latest data
  updateCharts() {
    this.charts.forEach((config, container) => {
      if (config.type === 'latency') {
        this.createLatencyChart(container, config.options);
      } else if (config.type === 'quality') {
        this.createQualityChart(container, config.options);
      } else if (config.type === 'throughput') {
        this.createThroughputChart(container, config.options);
      }
    });
  }

  // Register chart for automatic updates
  registerChart(container, type, options = {}) {
    this.charts.set(container, { type, options });
    // Initial render
    if (type === 'latency') {
      this.createLatencyChart(container, options);
    } else if (type === 'quality') {
      this.createQualityChart(container, options);
    } else if (type === 'throughput') {
      this.createThroughputChart(container, options);
    }
  }

  // Get summary statistics
  getSummaryStats() {
    const latencyData = this.dataBuffer.latency;
    const qualityData = this.dataBuffer.quality;
    
    const stats = {
      avgLatency: latencyData.length > 0 
        ? Math.round(latencyData.reduce((sum, d) => sum + d.value, 0) / latencyData.length)
        : 0,
      avgQuality: qualityData.length > 0
        ? qualityData.reduce((sum, d) => sum + d.value, 0) / qualityData.length
        : 0,
      dataPoints: {
        latency: latencyData.length,
        quality: qualityData.length,
        throughput: this.dataBuffer.throughput.length
      }
    };
    
    // Determine overall quality
    if (stats.avgQuality >= 85) stats.overallQuality = 'excellent';
    else if (stats.avgQuality >= 65) stats.overallQuality = 'good';
    else if (stats.avgQuality >= 45) stats.overallQuality = 'fair';
    else stats.overallQuality = 'poor';
    
    return stats;
  }

  // Export chart data
  exportChartData(type) {
    return {
      type,
      data: this.dataBuffer[type] || [],
      timestamp: Date.now(),
      summary: this.getSummaryStats()
    };
  }

  // Clear all chart data
  clearChartData() {
    this.dataBuffer = {
      latency: [],
      quality: [],
      throughput: [],
      errors: []
    };
    return this.saveHistoricalData();
  }
}

// Export for use in popup.js
export { VisualizationManager };

export function createVisualizationManager() {
  return new VisualizationManager();
}

// Note: This module requires explicit initialization after DOMContentLoaded
// Do not auto-initialize as it may run in service worker context