// Onboarding Module - Enhanced User Experience
// Phase 1: Security & Core UX

class OnboardingManager {
  constructor() {
    this.onboardingSteps = [
      {
        id: 'welcome',
        title: 'Welcome to ProxyMania VPN',
        content: 'Your free VPN service using ProxyMania proxy servers. Let\'s get you started!',
        image: '🛡️',
        buttonText: 'Get Started',
        nextStep: 'connectivity'
      },
      {
        id: 'connectivity',
        title: 'Understanding Connectivity',
        content: 'This extension routes your traffic through proxy servers to help protect your privacy and bypass restrictions.',
        image: '🌐',
        buttonText: 'Next',
        nextStep: 'security'
      },
      {
        id: 'security',
        title: 'Security Features',
        content: 'We include DNS leak protection and WebRTC leak prevention to keep your real IP address hidden.',
        image: '🔒',
        buttonText: 'Next',
        nextStep: 'connecting'
      },
      {
        id: 'connecting',
        title: 'How to Connect',
        content: '1. Browse available proxies<br>2. Look for the ✓ indicator (recently verified)<br>3. Click "Connect" on your chosen proxy',
        image: '⚡',
        buttonText: 'Next',
        nextStep: 'filters'
      },
      {
        id: 'filters',
        title: 'Using Filters',
        content: 'Use the country and type filters to find proxies from specific locations or protocols (HTTPS/SOCKS5).',
        image: '🔍',
        buttonText: 'Next',
        nextStep: 'features'
      },
      {
        id: 'features',
        title: 'Advanced Features',
        content: 'Try the Quick Connect for fastest proxies, Favorites to save preferred servers, and Statistics to track usage.',
        image: '⭐',
        buttonText: 'Next',
        nextStep: 'safety'
      },
      {
        id: 'safety',
        title: 'Important Safety Notes',
        content: '<strong>⚠️ Security Warning:</strong><br>Free proxies have limitations. Do NOT use for:<br>• Online banking<br>• Credit card transactions<br>• Sensitive account logins',
        image: '⚠️',
        buttonText: 'Got it!',
        nextStep: 'complete'
      }
    ];
    
    this.currentStepIndex = 0;
    this.isCompleted = false;
    this.version = '2.1.0';
    
    this.init();
  }

  async init() {
    await this.loadOnboardingState();
    this.setupEventListeners();
  }

  async loadOnboardingState() {
    try {
      const result = await chrome.storage.local.get(['onboarding']);
      if (result.onboarding) {
        this.isCompleted = result.onboarding.completed || false;
        this.currentStepIndex = result.onboarding.currentStepIndex || 0;
        this.version = result.onboarding.version || this.version;
      } else {
        // Initialize with defaults
        await this.saveOnboardingState();
      }
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    }
  }

  async saveOnboardingState() {
    try {
      await chrome.storage.local.set({
        onboarding: {
          completed: this.isCompleted,
          currentStepIndex: this.currentStepIndex,
          version: this.version,
          lastShown: Date.now()
        }
      });
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  }

  setupEventListeners() {
    // Listen for onboarding requests from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'startOnboarding') {
        this.startOnboarding();
        sendResponse({ success: true });
        return false;
      }
      
      if (request.action === 'completeOnboarding') {
        this.completeOnboarding();
        sendResponse({ success: true });
        return false;
      }
      
      if (request.action === 'getOnboardingState') {
        sendResponse({
          completed: this.isCompleted,
          currentStepIndex: this.currentStepIndex,
          version: this.version
        });
        return false;
      }
    });
  }

  async startOnboarding() {
    this.isCompleted = false;
    this.currentStepIndex = 0;
    await this.saveOnboardingState();
    
    // Notify popup to show onboarding
    chrome.runtime.sendMessage({
      action: 'showOnboarding',
      step: this.onboardingSteps[0]
    });
  }

  async completeOnboarding() {
    this.isCompleted = true;
    this.currentStepIndex = this.onboardingSteps.length;
    await this.saveOnboardingState();
    
    // Notify popup to hide onboarding
    chrome.runtime.sendMessage({
      action: 'hideOnboarding'
    });
  }

  async nextStep() {
    if (this.currentStepIndex < this.onboardingSteps.length - 1) {
      this.currentStepIndex++;
      await this.saveOnboardingState();
      
      const nextStep = this.onboardingSteps[this.currentStepIndex];
      chrome.runtime.sendMessage({
        action: 'showOnboardingStep',
        step: nextStep
      });
    } else {
      await this.completeOnboarding();
    }
  }

  async previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      await this.saveOnboardingState();
      
      const prevStep = this.onboardingSteps[this.currentStepIndex];
      chrome.runtime.sendMessage({
        action: 'showOnboardingStep',
        step: prevStep
      });
    }
  }

  shouldShowOnboarding() {
    // Show onboarding if:
    // 1. Never completed
    // 2. New version available
    // 3. User requested manually
    
    if (!this.isCompleted) return true;
    
    // Check if new version
    const currentVersion = this.version;
    const latestVersion = '2.1.0';
    
    return currentVersion !== latestVersion;
  }

  getProgress() {
    return {
      current: this.currentStepIndex + 1,
      total: this.onboardingSteps.length,
      percentage: Math.round(((this.currentStepIndex + 1) / this.onboardingSteps.length) * 100)
    };
  }

  getStepById(id) {
    return this.onboardingSteps.find(step => step.id === id);
  }

  // Static methods for popup integration
  static createOnboardingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-header">
          <div class="onboarding-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
            <span class="progress-text">Step 1 of 7</span>
          </div>
          <button class="onboarding-skip" title="Skip Tutorial">Skip</button>
        </div>
        
        <div class="onboarding-content">
          <div class="onboarding-image">🛡️</div>
          <h3 class="onboarding-title">Welcome to ProxyMania VPN</h3>
          <div class="onboarding-text">Your free VPN service using ProxyMania proxy servers. Let's get you started!</div>
        </div>
        
        <div class="onboarding-actions">
          <button class="onboarding-btn onboarding-btn-primary">Get Started</button>
          <button class="onboarding-btn onboarding-btn-secondary">Back</button>
        </div>
      </div>
    `;
    
    return overlay;
  }

  static showOnboardingInPopup() {
    // Create and inject onboarding UI
    const overlay = this.createOnboardingOverlay();
    document.body.appendChild(overlay);
    
    // Add event listeners
    overlay.querySelector('.onboarding-skip').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'completeOnboarding' });
      overlay.remove();
    });
    
    overlay.querySelector('.onboarding-btn-primary').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'nextOnboardingStep' });
    });
    
    overlay.querySelector('.onboarding-btn-secondary').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'previousOnboardingStep' });
    });
  }
}

// Export for use in popup.js
if (typeof module !== 'undefined') {
  module.exports = OnboardingManager;
}

// Initialize onboarding manager
const onboardingManager = new OnboardingManager();

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'nextOnboardingStep') {
    onboardingManager.nextStep();
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'previousOnboardingStep') {
    onboardingManager.previousStep();
    sendResponse({ success: true });
    return false;
  }
});