// PeasyProxy VPN - Accessibility Module
// Screen reader support and keyboard navigation

import { $ } from './dom.js';

// ============================================================================
// SCREEN READER ANNOUNCEMENTS
// ============================================================================

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - Priority: polite or assertive
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

/**
 * Announce connection status
 * @param {boolean} connected - Whether connected
 */
export function announceConnectionStatus(connected) {
  const message = connected ? 'Connected to proxy' : 'Disconnected from proxy';
  announceToScreenReader(message, 'assertive');
}

/**
 * Announce proxy selection
 * @param {string} proxy - Proxy description
 */
export function announceProxySelection(proxy) {
  announceToScreenReader(`Selected proxy: ${proxy}`, 'polite');
}

/**
 * Announce filter change
 * @param {string} filter - Filter description
 */
export function announceFilterChange(filter) {
  announceToScreenReader(`Filter applied: ${filter}`, 'polite');
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

/**
 * Setup keyboard navigation for list
 * @param {HTMLElement} list - List element
 */
export function setupListKeyboardNavigation(list) {
  if (!list) return;
  
  list.addEventListener('keydown', (e) => {
    const items = Array.from(list.querySelectorAll('[tabindex="0"]'));
    const currentIndex = items.indexOf(document.activeElement);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  });
}

/**
 * Setup keyboard navigation for tabs
 * @param {HTMLElement} tabList - Tab list element
 */
export function setupTabKeyboardNavigation(tabList) {
  if (!tabList) return;
  
  tabList.addEventListener('keydown', (e) => {
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement);
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      tabs[nextIndex]?.focus();
      tabs[nextIndex]?.click();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      tabs[prevIndex]?.focus();
      tabs[prevIndex]?.click();
    }
  });
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Trap focus within an element (for modals)
 * @param {HTMLElement} element - Element to trap focus within
 */
export function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });
}

/**
 * Restore focus to previously focused element
 * @param {HTMLElement} element - Element that was previously focused
 */
export function restoreFocus(element) {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

// ============================================================================
// ARIA ATTRIBUTES
// ============================================================================

/**
 * Set aria-expanded attribute
 * @param {HTMLElement} element - Element to update
 * @param {boolean} expanded - Whether expanded
 */
export function setAriaExpanded(element, expanded) {
  if (!element) return;
  element.setAttribute('aria-expanded', expanded.toString());
}

/**
 * Set aria-pressed attribute
 * @param {HTMLElement} element - Element to update
 * @param {boolean} pressed - Whether pressed
 */
export function setAriaPressed(element, pressed) {
  if (!element) return;
  element.setAttribute('aria-pressed', pressed.toString());
}

/**
 * Set aria-label
 * @param {HTMLElement} element - Element to update
 * @param {string} label - Label text
 */
export function setAriaLabel(element, label) {
  if (!element) return;
  element.setAttribute('aria-label', label);
}

// ============================================================================
// VISIBILITY UTILITIES
// ============================================================================

/**
 * Make element visually hidden but accessible
 * @param {HTMLElement} element - Element to hide
 */
export function visuallyHide(element) {
  if (!element) return;
  
  element.style.position = 'absolute';
  element.style.width = '1px';
  element.style.height = '1px';
  element.style.padding = '0';
  element.style.margin = '-1px';
  element.style.overflow = 'hidden';
  element.style.clip = 'rect(0, 0, 0, 0)';
  element.style.whiteSpace = 'nowrap';
  element.style.border = '0';
}

/**
 * Show visually hidden element
 * @param {HTMLElement} element - Element to show
 */
export function visuallyShow(element) {
  if (!element) return;
  
  element.style.position = '';
  element.style.width = '';
  element.style.height = '';
  element.style.padding = '';
  element.style.margin = '';
  element.style.overflow = '';
  element.style.clip = '';
  element.style.whiteSpace = '';
  element.style.border = '';
}

// ============================================================================
// ACCESSIBILITY SETUP
// ============================================================================

/**
 * Setup accessibility features
 */
export function setupAccessibility() {
  // Add skip link
  addSkipLink();
  
  // Setup list navigation
  const proxyList = document.getElementById('proxyList');
  if (proxyList) {
    setupListKeyboardNavigation(proxyList);
  }
  
  // Setup tab navigation
  const tabChips = document.getElementById('tabChips');
  if (tabChips) {
    setupTabKeyboardNavigation(tabChips);
  }
}

/**
 * Add skip link for keyboard users
 */
function addSkipLink() {
  // Check if skip link already exists
  if (document.getElementById('skip-link')) return;
  
  const skipLink = document.createElement('a');
  skipLink.id = 'skip-link';
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}
