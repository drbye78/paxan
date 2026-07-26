class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = Math.max(1, options.itemHeight || 72);
    this.buffer = options.buffer || 5;
    this.renderItem = options.renderItem || (() => '');
    this.onVisible = options.onVisible || (() => {});
    this.sanitize = options.sanitize !== false;
    
    this.items = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    this._viewportHeight = null;
    this.renderedElements = new Map();
    
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    
    this.init();
  }

  init() {
    this.container.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
    this.updateDimensions();
  }

  updateDimensions() {
    this.containerHeight = this.container.clientHeight;
    this.handleScroll();
  }

  setItems(items) {
    this.items = items;
    // Save viewport height before overriding
    this._viewportHeight = this._viewportHeight || this.container.clientHeight;
    this.container.style.height = `${Math.max(items.length * this.itemHeight, this._viewportHeight)}px`;
    this.renderAll();
  }

  handleResize() {
    this.updateDimensions();
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.renderVisible();
  }

  getVisibleRange() {
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(this.items.length, start + visibleCount + this.buffer * 2);
    return { start, end };
  }

  renderVisible() {
    const { start, end } = this.getVisibleRange();
    
    this.renderedElements.forEach((el, index) => {
      if (index < start || index >= end) {
        el.remove();
        this.renderedElements.delete(index);
      }
    });

    for (let i = start; i < end; i++) {
      if (!this.renderedElements.has(i)) {
        const el = document.createElement('div');
        el.style.height = `${this.itemHeight}px`;
        const raw = this.renderItem(this.items[i], i);
        if (this.sanitize) {
          const tmp = document.createElement('div');
          tmp.textContent = raw;
          el.innerHTML = tmp.innerHTML;
        } else {
          el.innerHTML = raw;
        }
        this.container.appendChild(el);
        this.renderedElements.set(i, el);
        
        this.onVisible(el, this.items[i], i);
      }
    }
  }

  renderAll() {
    this.renderedElements.forEach(el => el.remove());
    this.renderedElements.clear();
    this.renderVisible();
  }

  scrollToIndex(index) {
    this.container.scrollTop = index * this.itemHeight;
  }

  scrollToTop() {
    this.container.scrollTop = 0;
  }

  scrollToBottom() {
    const viewportHeight = this._viewportHeight || this.container.clientHeight;
    this.container.scrollTop = Math.max(0, this.items.length * this.itemHeight - viewportHeight);
  }

  getVisibleItems() {
    const { start, end } = this.getVisibleRange();
    return this.items.slice(start, end);
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    this.renderedElements.forEach(el => el.remove());
    this.renderedElements.clear();
  }
}

export { VirtualScroller };
