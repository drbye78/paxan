// Integration: Health monitoring alarm flow through health-monitor.js
import * as healthMonitor from '../../src/background/health-monitor.js';

describe('Health Monitoring Integration', () => {
  let localStorage;
  const alarmState = {};

  beforeEach(() => {
    // Clear alarm tracking
    Object.keys(alarmState).forEach(k => delete alarmState[k]);

    // Set up all mocks BEFORE resetting module state via stopProxyMonitoring()
    localStorage = {
      proxies: [
        { ip: '10.0.0.1', port: 8080, ipPort: '10.0.0.1:8080', country: 'US', type: 'HTTPS', speedMs: 50 }
      ],
      healthData: {}
    };

    global.chrome.storage.local.get.mockImplementation((keys) => {
      let result = {};
      if (Array.isArray(keys)) keys.forEach(k => { result[k] = localStorage[k]; });
      return Promise.resolve(result);
    });
    global.chrome.storage.local.set.mockImplementation((items) => {
      Object.assign(localStorage, items);
      return Promise.resolve();
    });

    global.chrome.storage.session.set.mockResolvedValue(undefined);
    global.chrome.storage.session.remove.mockResolvedValue(undefined);

    global.chrome.alarms.create.mockImplementation((name, opts) => {
      alarmState[name] = opts || {};
      return Promise.resolve();
    });
    global.chrome.alarms.clear.mockImplementation((name) => {
      delete alarmState[name];
      return Promise.resolve(true);
    });
    global.chrome.alarms.get.mockImplementation((name, callback) => {
      const alarm = alarmState[name] ? { name, ...alarmState[name] } : null;
      if (callback) callback(alarm);
      return Promise.resolve(alarm);
    });

    // Reset module-level state (monitoringActive, currentMonitoringProxy)
    healthMonitor.stopProxyMonitoring();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ip: '10.0.0.99' })
    });
  });

  test('startProxyMonitoring creates alarm and persists state', async () => {
    const proxy = { ip: '10.0.0.1', port: 8080, ipPort: '10.0.0.1:8080', type: 'HTTPS' };
    await healthMonitor.startProxyMonitoring(proxy);
    expect(global.chrome.alarms.create).toHaveBeenCalled();
  });

  test('stopProxyMonitoring clears alarm', async () => {
    // First start monitoring to create the alarm
    const proxy = { ip: '10.0.0.1', port: 8080, ipPort: '10.0.0.1:8080', type: 'HTTPS' };
    await healthMonitor.startProxyMonitoring(proxy);

    healthMonitor.stopProxyMonitoring();
    expect(global.chrome.alarms.clear).toHaveBeenCalled();
  });

  test('isMonitoringActive returns false initially', () => {
    expect(healthMonitor.isMonitoringActive()).toBe(false);
  });

  test('handleAlarm does nothing for unknown alarm', () => {
    // Should not throw
    healthMonitor.handleAlarm({ name: 'unknownAlarm' });
  });

  test('calculateConnectionQuality returns correct tiers', () => {
    expect(healthMonitor.calculateConnectionQuality({ latency: 50, packetLoss: 0 })).toBe('excellent');
    expect(healthMonitor.calculateConnectionQuality({ latency: 200, packetLoss: 3 })).toBe('good');
    expect(healthMonitor.calculateConnectionQuality({ latency: 400, packetLoss: 10 })).toBe('fair');
    expect(healthMonitor.calculateConnectionQuality({ latency: 1000, packetLoss: 60 })).toBe('poor');
  });

  test('connection quality edge cases', () => {
    expect(healthMonitor.calculateConnectionQuality({ latency: null, packetLoss: 0 })).toBe('poor');
    expect(healthMonitor.calculateConnectionQuality({ latency: 100, packetLoss: 1 })).toBe('excellent');
    expect(healthMonitor.calculateConnectionQuality({ latency: 300, packetLoss: 5 })).toBe('good');
  });
});
