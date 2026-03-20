// ProxyMania VPN - Onboarding Module
// Implements interactive tutorial and feature discovery

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// ONBOARDING STATE
// ============================================================================

let onboardingState = {
  completed: false,
  currentStep: 0,
  skipped: false,
  completedAt: null
};

// Onboarding steps
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ProxyMania!',
    description: 'Your smart proxy router for enhanced privacy and security.',
    content: `
      <div class="onboarding-welcome">
        <div class="welcome-icon">🛡️</div>
        <h2>Welcome to ProxyMania VPN</h2>
        <p>ProxyMania helps you route your browser traffic through rotating proxies for enhanced privacy and security.</p>
        <ul class="feature-list">
          <li>🔒 Enhanced privacy through proxy rotation</li>
          <li>🌍 Access content from different regions</li>
          <li>⚡ Fast and reliable connections</li>
          <li>🛡️ Security features and leak protection</li>
        </ul>
      </div>
    `,
    action: 'next'
  },
  {
    id: 'first-connection',
    title: 'Connect to Your First Proxy',
    description: 'Learn how to connect to a proxy server.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">🔗</div>
        <h3>Connecting to a Proxy</h3>
        <p>To connect to a proxy:</p>
        <ol class="step-list">
          <li>Browse the list of available proxies</li>
          <li>Click on a proxy to select it</li>
          <li>Click the <strong>Connect</strong> button</li>
          <li>Wait for the connection to establish</li>
        </ol>
        <div class="tip-box">
          <strong>💡 Tip:</strong> Look for proxies with low latency (ms) for best performance.
        </div>
      </div>
    `,
    action: 'try-connect',
    highlight: '.connect-btn'
  },
  {
    id: 'quick-connect',
    title: 'Quick Connect Feature',
    description: 'Connect to the fastest proxy instantly.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">⚡</div>
        <h3>Quick Connect</h3>
        <p>The <strong>Quick Connect</strong> feature automatically selects the fastest available proxy for you.</p>
        <ul class="feature-list">
          <li>Automatically finds the fastest proxy</li>
          <li>One-click connection</li>
          <li>Great for quick browsing sessions</li>
        </ul>
        <div class="tip-box">
          <strong>💡 Tip:</strong> Use Quick Connect when you need a fast, reliable connection without browsing the list.
        </div>
      </div>
    `,
    action: 'next',
    highlight: '#quickConnectBtn'
  },
  {
    id: 'favorites',
    title: 'Save Your Favorites',
    description: 'Bookmark proxies you use frequently.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">⭐</div>
        <h3>Favorites</h3>
        <p>Save your frequently used proxies for quick access:</p>
        <ol class="step-list">
          <li>Click the star icon (☆) on any proxy</li>
          <li>The proxy will be added to your favorites</li>
          <li>Access favorites from the <strong>⭐</strong> tab</li>
        </ol>
        <div class="tip-box">
          <strong>💡 Tip:</strong> Favorited proxies appear with a ⭐ indicator in the main list.
        </div>
      </div>
    `,
    action: 'next'
  },
  {
    id: 'settings-overview',
    title: 'Customize Your Experience',
    description: 'Configure ProxyMania to suit your needs.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">⚙️</div>
        <h3>Settings</h3>
        <p>Access settings to customize your experience:</p>
        <ul class="feature-list">
          <li><strong>Theme:</strong> Dark or light mode</li>
          <li><strong>Auto-Connect:</strong> Connect automatically on startup</li>
          <li><strong>Auto-Failover:</strong> Switch to backup proxy on failure</li>
          <li><strong>Notifications:</strong> Get alerts for connection issues</li>
        </ul>
        <div class="tip-box">
          <strong>💡 Tip:</strong> Enable Auto-Failover for uninterrupted browsing.
        </div>
      </div>
    `,
    action: 'next',
    highlight: '#settingsBtn'
  },
  {
    id: 'security-features',
    title: 'Security Features',
    description: 'Protect your privacy with built-in security.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">🛡️</div>
        <h3>Security Features</h3>
        <p>ProxyMania includes several security features:</p>
        <ul class="feature-list">
          <li><strong>DNS Leak Protection:</strong> Prevents DNS queries from leaking</li>
          <li><strong>WebRTC Protection:</strong> Blocks WebRTC IP leaks</li>
          <li><strong>Tamper Detection:</strong> Detects proxy interference</li>
          <li><strong>Trust Badges:</strong> Visual security indicators</li>
        </ul>
        <div class="warning-box">
          <strong>⚠️ Important:</strong> Free proxies can intercept traffic. Avoid sensitive activities.
        </div>
      </div>
    `,
    action: 'next'
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    description: 'Explore powerful proxy management tools.',
    content: `
      <div class="onboarding-step">
        <div class="step-icon">🔧</div>
        <h3>Advanced Features</h3>
        <p>ProxyMania offers advanced features for power users:</p>
        <ul class="feature-list">
          <li><strong>Per-Site Rules:</strong> Auto-switch proxies per website</li>
          <li><strong>Auto-Rotation:</strong> Automatically rotate proxies</li>
          <li><strong>Country Blacklist:</strong> Exclude certain countries</li>
          <li><strong>Import/Export:</strong> Backup and share your settings</li>
        </ul>
        <div class="tip-box">
          <strong>💡 Tip:</strong> Use Per-Site Rules to always use a specific proxy for certain websites.
        </div>
      </div>
    `,
    action: 'next'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start using ProxyMania to enhance your privacy.',
    content: `
      <div class="onboarding-complete">
        <div class="complete-icon">🎉</div>
        <h2>Congratulations!</h2>
        <p>You've completed the ProxyMania tutorial. You're ready to start using the extension!</p>
        <div class="next-steps">
          <h4>Next Steps:</h4>
          <ul>
            <li>Connect to a proxy and start browsing</li>
            <li>Explore different proxy locations</li>
            <li>Save your favorites for quick access</li>
            <li>Customize settings to your preference</li>
          </ul>
        </div>
        <div class="support-info">
          <p>Need help? Check the <strong>USER_GUIDE.md</strong> for detailed instructions.</p>
        </div>
      </div>
    `,
    action: 'finish'
  }
];

// ============================================================================
// ONBOARDING MANAGER
// ============================================================================

// Initialize onboarding
async function initOnboarding() {
  try {
    const { onboarding } = await chrome.storage.local.get(['onboarding']);
    
    if (onboarding) {
      onboardingState = {
        ...onboardingState,
        ...onboarding
      };
    }
    
    return {
      success: true,
      state: onboardingState
    };
  } catch (error) {
    console.error('Failed to initialize onboarding:', error);
    return { success: false, error: error.message };
  }
}

// Check if onboarding should be shown
async function shouldShowOnboarding() {
  try {
    const { onboarding } = await chrome.storage.local.get(['onboarding']);
    
    if (!onboarding) {
      return true; // First time user
    }
    
    return !onboarding.completed && !onboarding.skipped;
  } catch (error) {
    return false;
  }
}

// Start onboarding
async function startOnboarding() {
  try {
    onboardingState = {
      completed: false,
      currentStep: 0,
      skipped: false,
      completedAt: null
    };
    
    await saveOnboardingState();
    
    return {
      success: true,
      step: ONBOARDING_STEPS[0]
    };
  } catch (error) {
    console.error('Failed to start onboarding:', error);
    return { success: false, error: error.message };
  }
}

// Get current step
function getCurrentStep() {
  return ONBOARDING_STEPS[onboardingState.currentStep] || null;
}

// Go to next step
async function nextStep() {
  try {
    if (onboardingState.currentStep < ONBOARDING_STEPS.length - 1) {
      onboardingState.currentStep++;
      await saveOnboardingState();
      
      return {
        success: true,
        step: ONBOARDING_STEPS[onboardingState.currentStep],
        isLast: onboardingState.currentStep === ONBOARDING_STEPS.length - 1
      };
    }
    
    // Last step - complete onboarding
    return await completeOnboarding();
  } catch (error) {
    console.error('Failed to go to next step:', error);
    return { success: false, error: error.message };
  }
}

// Go to previous step
async function previousStep() {
  try {
    if (onboardingState.currentStep > 0) {
      onboardingState.currentStep--;
      await saveOnboardingState();
      
      return {
        success: true,
        step: ONBOARDING_STEPS[onboardingState.currentStep]
      };
    }
    
    return {
      success: false,
      error: 'Already at first step'
    };
  } catch (error) {
    console.error('Failed to go to previous step:', error);
    return { success: false, error: error.message };
  }
}

// Go to specific step
async function goToStep(stepIndex) {
  try {
    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      onboardingState.currentStep = stepIndex;
      await saveOnboardingState();
      
      return {
        success: true,
        step: ONBOARDING_STEPS[stepIndex]
      };
    }
    
    return {
      success: false,
      error: 'Invalid step index'
    };
  } catch (error) {
    console.error('Failed to go to step:', error);
    return { success: false, error: error.message };
  }
}

// Skip onboarding
async function skipOnboarding() {
  try {
    onboardingState = {
      completed: false,
      currentStep: 0,
      skipped: true,
      completedAt: Date.now()
    };
    
    await saveOnboardingState();
    
    return {
      success: true,
      message: 'Onboarding skipped'
    };
  } catch (error) {
    console.error('Failed to skip onboarding:', error);
    return { success: false, error: error.message };
  }
}

// Complete onboarding
async function completeOnboarding() {
  try {
    onboardingState = {
      completed: true,
      currentStep: ONBOARDING_STEPS.length - 1,
      skipped: false,
      completedAt: Date.now()
    };
    
    await saveOnboardingState();
    
    return {
      success: true,
      message: 'Onboarding completed'
    };
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    return { success: false, error: error.message };
  }
}

// Reset onboarding
async function resetOnboarding() {
  try {
    onboardingState = {
      completed: false,
      currentStep: 0,
      skipped: false,
      completedAt: null
    };
    
    await saveOnboardingState();
    
    return {
      success: true,
      message: 'Onboarding reset'
    };
  } catch (error) {
    console.error('Failed to reset onboarding:', error);
    return { success: false, error: error.message };
  }
}

// Save onboarding state
async function saveOnboardingState() {
  await chrome.storage.local.set({ onboarding: onboardingState });
}

// ============================================================================
// FEATURE DISCOVERY
// ============================================================================

// Show feature tooltip
function showFeatureTooltip(element, message, duration = 5000) {
  const tooltip = document.createElement('div');
  tooltip.className = 'feature-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-content">
      <span class="tooltip-message">${message}</span>
      <button class="tooltip-close">×</button>
    </div>
  `;
  
  // Position tooltip
  const rect = element.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.top = `${rect.bottom + 10}px`;
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.zIndex = '10000';
  
  document.body.appendChild(tooltip);
  
  // Auto-remove
  setTimeout(() => {
    tooltip.remove();
  }, duration);
  
  // Close button
  tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
    tooltip.remove();
  });
  
  return tooltip;
}

// Show feature announcement
function showFeatureAnnouncement(feature, description) {
  const announcement = document.createElement('div');
  announcement.className = 'feature-announcement';
  announcement.innerHTML = `
    <div class="announcement-content">
      <div class="announcement-icon">✨</div>
      <div class="announcement-text">
        <strong>${feature}</strong>
        <p>${description}</p>
      </div>
      <button class="announcement-dismiss">×</button>
    </div>
  `;
  
  document.body.appendChild(announcement);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    announcement.classList.add('fade-out');
    setTimeout(() => announcement.remove(), 300);
  }, 8000);
  
  // Dismiss button
  announcement.querySelector('.announcement-dismiss').addEventListener('click', () => {
    announcement.remove();
  });
  
  return announcement;
}

// ============================================================================
// QUICK START GUIDE
// ============================================================================

// Generate quick start guide
function generateQuickStartGuide() {
  return {
    title: 'Quick Start Guide',
    steps: [
      {
        number: 1,
        title: 'Connect',
        description: 'Click on a proxy and click Connect',
        icon: '🔗'
      },
      {
        number: 2,
        title: 'Browse',
        description: 'Your traffic now routes through the proxy',
        icon: '🌐'
      },
      {
        number: 3,
        title: 'Disconnect',
        description: 'Click Disconnect when done',
        icon: '🔌'
      }
    ],
    tips: [
      'Use Quick Connect for fastest proxy',
      'Save favorites for quick access',
      'Enable Auto-Failover for reliability'
    ]
  };
}

// ============================================================================
// ONBOARDING UI HELPERS
// ============================================================================

// Render onboarding modal
function renderOnboardingModal(step, stepIndex, totalSteps) {
  return `
    <div class="onboarding-modal" id="onboardingModal">
      <div class="onboarding-overlay"></div>
      <div class="onboarding-content">
        <div class="onboarding-header">
          <div class="step-indicator">
            ${Array.from({ length: totalSteps }, (_, i) => 
              `<span class="step-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'completed' : ''}"></span>`
            ).join('')}
          </div>
          <span class="step-counter">${stepIndex + 1} / ${totalSteps}</span>
        </div>
        
        <div class="onboarding-body">
          ${step.content}
        </div>
        
        <div class="onboarding-footer">
          <button class="btn btn-ghost" id="onboardingSkip">Skip Tutorial</button>
          <div class="onboarding-nav">
            ${stepIndex > 0 ? '<button class="btn btn-secondary" id="onboardingPrev">Back</button>' : ''}
            <button class="btn btn-primary" id="onboardingNext">
              ${step.action === 'finish' ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Highlight element
function highlightElement(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;
  
  // Remove existing highlights
  document.querySelectorAll('.onboarding-highlight').forEach(el => {
    el.classList.remove('onboarding-highlight');
  });
  
  element.classList.add('onboarding-highlight');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  return element;
}

// Remove highlight
function removeHighlight() {
  document.querySelectorAll('.onboarding-highlight').forEach(el => {
    el.classList.remove('onboarding-highlight');
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  ONBOARDING_STEPS,
  
  // State
  onboardingState,
  
  // Manager
  initOnboarding,
  shouldShowOnboarding,
  startOnboarding,
  getCurrentStep,
  nextStep,
  previousStep,
  goToStep,
  skipOnboarding,
  completeOnboarding,
  resetOnboarding,
  
  // Feature discovery
  showFeatureTooltip,
  showFeatureAnnouncement,
  
  // Quick start
  generateQuickStartGuide,
  
  // UI helpers
  renderOnboardingModal,
  highlightElement,
  removeHighlight
};