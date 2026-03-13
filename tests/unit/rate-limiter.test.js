// Unit tests for Rate Limiter (debounce, throttle)

const { RateLimiter, proxyFetchLimiter, proxyTestLimiter, debounce, throttle } = require('../test-shim');

describe('Rate Limiter Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounce', () => {
    test('should delay function execution', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    test('should only call function once for multiple rapid calls', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    test('should pass arguments to function', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should reset timer on each call', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      jest.advanceTimersByTime(50);
      debouncedFunc();
      jest.advanceTimersByTime(50);
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(func).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    test('should execute immediately on first call', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);
    });

    test('should not execute again within throttle period', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc();
      throttledFunc();
      throttledFunc();

      expect(func).toHaveBeenCalledTimes(1);
    });

    test('should execute again after throttle period', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc();
      jest.advanceTimersByTime(100);
      throttledFunc();

      expect(func).toHaveBeenCalledTimes(2);
    });

    test('should pass arguments to function', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc('arg1', 'arg2');
      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should execute at most once per period', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc();
      jest.advanceTimersByTime(50);
      throttledFunc();
      jest.advanceTimersByTime(50);
      throttledFunc();
      jest.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(2);
    });
  });

  describe('RateLimiter class', () => {
    test('should limit requests per second', () => {
      const limiter = new RateLimiter(2, 1000);

      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(false);

      jest.advanceTimersByTime(1000);
      expect(limiter.canProceed()).toBe(true);
    });

    test('should track time until next request', () => {
      const limiter = new RateLimiter(2, 1000);
      
      limiter.canProceed();
      limiter.canProceed();

      const waitTime = limiter.getTimeUntilNextRequest();
      expect(waitTime).toBeGreaterThan(0);
    });

    test('should reset after time period', () => {
      const limiter = new RateLimiter(2, 1000);

      limiter.canProceed();
      limiter.canProceed();
      expect(limiter.canProceed()).toBe(false);

      jest.advanceTimersByTime(1000);
      expect(limiter.canProceed()).toBe(true);
    });
  });

  describe('proxyFetchLimiter', () => {
    test('should exist and be a RateLimiter', () => {
      expect(proxyFetchLimiter).toBeDefined();
      expect(proxyFetchLimiter.canProceed).toBeDefined();
    });
  });

  describe('proxyTestLimiter', () => {
    test('should exist and be a RateLimiter', () => {
      expect(proxyTestLimiter).toBeDefined();
      expect(proxyTestLimiter.canProceed).toBeDefined();
    });
  });
});
