// Unit tests for Virtual Scroller

const { VirtualScroller } = require('../test-shim');

describe('VirtualScroller', () => {
  let container;
  let scroller;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="scrollContainer" style="height: 500px; overflow-y: auto;">
      </div>
    `;
    container = document.getElementById('scrollContainer');
  });

  afterEach(() => {
    if (scroller) {
      scroller.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      scroller = new VirtualScroller(container);
      
      expect(scroller.container).toBe(container);
      expect(scroller.itemHeight).toBe(72);
      expect(scroller.buffer).toBe(5);
      expect(scroller.items).toEqual([]);
    });

    test('should initialize with custom options', () => {
      scroller = new VirtualScroller(container, {
        itemHeight: 50,
        buffer: 3
      });
      
      expect(scroller.itemHeight).toBe(50);
      expect(scroller.buffer).toBe(3);
    });
  });

  describe('setItems', () => {
    test('should set items and render', () => {
      const items = [
        { ip: '192.168.1.1', port: 8080 },
        { ip: '192.168.1.2', port: 8080 },
        { ip: '192.168.1.3', port: 8080 }
      ];

      scroller = new VirtualScroller(container, {
        renderItem: (item) => `<div>${item.ip}</div>`
      });
      
      scroller.setItems(items);
      
      expect(scroller.items).toHaveLength(3);
      expect(container.children.length).toBeGreaterThan(0);
    });

    test('should set container height based on items', () => {
      const items = new Array(100).fill({ ip: '192.168.1.1', port: 8080 });
      
      scroller = new VirtualScroller(container);
      scroller.setItems(items);
      
      expect(container.style.height).toBeTruthy();
    });
  });

  describe('renderVisible', () => {
    test('should render visible items only', () => {
      const items = new Array(50).fill(null).map((_, i) => ({ ip: `192.168.1.${i}`, port: 8080 }));
      
      scroller = new VirtualScroller(container, {
        itemHeight: 72,
        renderItem: (item) => `<div>${item.ip}</div>`
      });
      
      scroller.setItems(items);
      const initialCount = container.children.length;
      
      expect(initialCount).toBeGreaterThan(0);
      expect(initialCount).toBeLessThan(items.length);
    });

    test('should remove items outside visible range', () => {
      const items = new Array(50).fill(null).map((_, i) => ({ ip: `192.168.1.${i}`, port: 8080 }));
      
      scroller = new VirtualScroller(container, {
        itemHeight: 72,
        renderItem: (item) => `<div>${item.ip}</div>`
      });
      
      scroller.setItems(items);
      container.scrollTop = 1000;
      scroller.handleScroll();
      
      expect(container.children.length).toBeLessThan(50);
    });
  });

  describe('getVisibleRange', () => {
    test('should calculate correct visible range', () => {
      const items = new Array(100).fill({ ip: '192.168.1.1', port: 8080 });
      
      scroller = new VirtualScroller(container, { itemHeight: 72 });
      scroller.setItems(items);
      
      const range = scroller.getVisibleRange();
      
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeGreaterThan(range.start);
    });

    test('should handle empty items', () => {
      scroller = new VirtualScroller(container);
      scroller.setItems([]);
      
      const range = scroller.getVisibleRange();
      
      expect(range.start).toBe(0);
      expect(range.end).toBe(0);
    });
  });

  describe('scrollToIndex', () => {
    test('should scroll to specific index', () => {
      const items = new Array(100).fill({ ip: '192.168.1.1', port: 8080 });
      
      scroller = new VirtualScroller(container, { itemHeight: 72 });
      scroller.setItems(items);
      
      scroller.scrollToIndex(10);
      
      expect(container.scrollTop).toBe(720);
    });
  });

  describe('scrollToTop / scrollToBottom', () => {
    test('should scroll to top', () => {
      const items = new Array(100).fill({ ip: '192.168.1.1', port: 8080 });
      
      scroller = new VirtualScroller(container, { itemHeight: 72 });
      scroller.setItems(items);
      
      container.scrollTop = 5000;
      scroller.scrollToTop();
      
      expect(container.scrollTop).toBe(0);
    });

    test('should scroll to bottom', () => {
      const items = new Array(100).fill({ ip: '192.168.1.1', port: 8080 });
      
      scroller = new VirtualScroller(container, { itemHeight: 72 });
      scroller.setItems(items);
      
      scroller.scrollToBottom();
      
      expect(container.scrollTop).toBe(7200);
    });
  });

  describe('getVisibleItems', () => {
    test('should return visible items', () => {
      const items = new Array(100).fill(null).map((_, i) => ({ ip: `192.168.1.${i}`, port: 8080 }));
      
      scroller = new VirtualScroller(container, { itemHeight: 72 });
      scroller.setItems(items);
      
      const visible = scroller.getVisibleItems();
      
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThan(items.length);
    });
  });

  describe('destroy', () => {
    test('should clean up listeners and elements', () => {
      const items = new Array(10).fill(null).map((_, i) => ({ ip: `192.168.1.${i}`, port: 8080 }));
      
      scroller = new VirtualScroller(container, {
        itemHeight: 72,
        renderItem: (item) => `<div>${item.ip}</div>`
      });
      scroller.setItems(items);
      
      const removeEventListenerSpy = jest.spyOn(container, 'removeEventListener');
      
      scroller.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', scroller.handleScroll);
    });
  });
});
