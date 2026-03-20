// Onboarding Module - Simplified for MV3

class OnboardingManager {
  constructor() {
    this.onboardingSteps = [
      { id: 'welcome', title: 'Welcome to ProxyMania VPN', content: 'Your free VPN service using ProxyMania proxy servers.', image: '🛡️' },
      { id: 'connectivity', title: 'Understanding Connectivity', content: 'This extension routes your traffic through proxy servers.', image: '🌐' },
      { id: 'security', title: 'Security Features', content: 'DNS leak protection and WebRTC leak prevention are included.', image: '🔒' },
      { id: 'connecting', title: 'How to Connect', content: '1. Browse available proxies 2. Look for the ✓ indicator 3. Click "Connect"', image: '⚡' },
      { id: 'filters', title: 'Using Filters', content: 'Use country and type filters to find specific proxies.', image: '🔍' },
      { id: 'features', title: 'Advanced Features', content: 'Try Quick Connect, Favorites, and Statistics.', image: '⭐' },
      { id: 'safety', title: 'Important Safety Notes', content: '⚠️ Free proxies have limitations. Do NOT use for banking or sensitive data.', image: '⚠️' }
    ];
    
    this.currentStepIndex = 0;
    this.isCompleted = false;
    this.version = '2.1.0';
  }

  async loadOnboardingState() {
    try {
      const result = await chrome.storage.local.get(['onboarding']);
      if (result.onboarding) {
        this.isCompleted = result.onboarding.completed || false;
        this.currentStepIndex = result.onboarding.currentStepIndex || 0;
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
          version: this.version
        }
      });
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  }

  async startOnboarding() {
    this.isCompleted = false;
    this.currentStepIndex = 0;
    await this.saveOnboardingState();
  }

  async completeOnboarding() {
    this.isCompleted = true;
    this.currentStepIndex = this.onboardingSteps.length;
    await this.saveOnboardingState();
  }

  getOnboardingState() {
    return {
      completed: this.isCompleted,
      currentStepIndex: this.currentStepIndex,
      version: this.version
    };
  }
}

const onboardingManager = new OnboardingManager();
