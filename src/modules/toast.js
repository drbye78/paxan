// PeasyProxy VPN - Toast Notification Module
// Display toast notifications with undo support

import { toastContainer } from './dom.js';
import { getState } from './state.js';

// Current active toasts
const activeToasts = new Set();

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: info, success, warning, error
 * @param {Function} onUndo - Optional undo callback
 * @returns {HTMLElement|null} - Toast element
 */
export function showToast(message, type = 'info', onUndo = null) {
  if (!toastContainer) {
    console.warn('Toast container not found');
    return null;
  }

  // Limit to 3 toasts max
  while (activeToasts.size >= 3) {
    const oldest = activeToasts.values().next().value;
    if (oldest) {
      oldest.remove();
      activeToasts.delete(oldest);
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  const toastContent = document.createElement('div');
  toastContent.className = 'toast-content';
  toastContent.textContent = message;

  toast.appendChild(toastContent);

  // Add undo button if callback provided
  if (onUndo) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'toast-undo-btn';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', () => {
      onUndo();
      removeToast(toast);
    });
    toast.appendChild(undoBtn);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.addEventListener('click', () => removeToast(toast));
  toast.appendChild(closeBtn);

  toastContainer.appendChild(toast);
  activeToasts.add(toast);

  // Trigger reflow for animation
  toast.offsetHeight;
  toast.classList.add('toast-enter');

  // Auto-remove after 5 seconds
  const timeoutId = setTimeout(() => removeToast(toast), 5000);

  // Store timeout for manual clearing
  toast.dataset.timeoutId = timeoutId;

  // Announce to screen readers
  announceToScreenReader(message);

  return toast;
}

/**
 * Remove toast notification
 * @param {HTMLElement} toast - Toast element to remove
 */
export function removeToast(toast) {
  if (!toast || !toastContainer.contains(toast)) return;

  // Clear timeout
  if (toast.dataset.timeoutId) {
    clearTimeout(parseInt(toast.dataset.timeoutId));
  }

  toast.classList.remove('toast-enter');
  toast.classList.add('toast-exit');

  // Remove after animation
  setTimeout(() => {
    if (toastContainer.contains(toast)) {
      toast.remove();
      activeToasts.delete(toast);
    }
  }, 300);
}

/**
 * Clear all toast notifications
 */
export function clearAllToasts() {
  Array.from(activeToasts).forEach(toast => removeToast(toast));
}

/**
 * Show success toast
 * @param {string} message - Message to display
 * @param {Function} onUndo - Optional undo callback
 * @returns {HTMLElement|null} - Toast element
 */
export function showSuccess(message, onUndo = null) {
  return showToast(message, 'success', onUndo);
}

/**
 * Show error toast
 * @param {string} message - Message to display
 * @param {Function} onUndo - Optional undo callback
 * @returns {HTMLElement|null} - Toast element
 */
export function showError(message, onUndo = null) {
  return showToast(message, 'error', onUndo);
}

/**
 * Show warning toast
 * @param {string} message - Message to display
 * @param {Function} onUndo - Optional undo callback
 * @returns {HTMLElement|null} - Toast element
 */
export function showWarning(message, onUndo = null) {
  return showToast(message, 'warning', onUndo);
}

/**
 * Show info toast
 * @param {string} message - Message to display
 * @param {Function} onUndo - Optional undo callback
 * @returns {HTMLElement|null} - Toast element
 */
export function showInfo(message, onUndo = null) {
  return showToast(message, 'info', onUndo);
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

/**
 * Get count of active toasts
 * @returns {number} - Number of active toasts
 */
export function getActiveToastCount() {
  return activeToasts.size;
}
