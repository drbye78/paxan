const countryFlags = {
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Japan': '🇯🇵', 'China': '🇨🇳',
  'Brazil': '🇧🇷', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Russia': '🇷🇺',
  'India': '🇮🇳', 'South Korea': '🇰🇷', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Poland': '🇵🇱', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼', 'Indonesia': '🇮🇩', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭', 'Malaysia': '🇲🇾', 'Argentina': '🇦🇷', 'Mexico': '🇲🇽',
  'Ukraine': '🇺🇦', 'Turkey': '🇹🇷', 'South Africa': '🇿🇦', 'Sweden': '🇸🇪',
  'Norway': '🇳🇴', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
  'Portugal': '🇵🇹', 'Greece': '🇬🇷', 'Czech Republic': '🇨🇿', 'Romania': '🇷🇴',
  'Hungary': '🇭🇺', 'Bulgaria': '🇧🇬', 'Ireland': '🇮🇪', 'New Zealand': '🇳🇿',
  'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩', 'Iran': '🇮🇷', 'Israel': '🇮🇱',
  'UAE': '🇦🇪', 'Saudi Arabia': '🇸🇦', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Peru': '🇵🇪',
  'Venezuela': '🇻🇪', 'Ecuador': '🇪🇨', 'Uruguay': '🇺🇾', 'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦', 'Guatemala': '🇬🇹', 'Cuba': '🇨🇺', 'Jamaica': '🇯🇲',
  'Fiji': '🇫🇯', 'Iceland': '🇮🇸', 'Luxembourg': '🇱🇺', 'Malta': '🇲🇹',
  'Cyprus': '🇨🇾', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲', 'Kazakhstan': '🇰🇿',
  'Belarus': '🇧🇾', 'Lithuania': '🇱🇹', 'Latvia': '🇱🇻', 'Estonia': '🇪🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮',
  'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Morocco': '🇲🇦', 'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿', 'Ghana': '🇬🇭', 'Ethiopia': '🇪🇹', 'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬', 'Zimbabwe': '🇿🇼', 'Angola': '🇦🇴', 'Zambia': '🇿🇲',
  'Mozambique': '🇲🇿', 'Botswana': '🇧🇼', 'Namibia': '🇳🇦', 'Nepal': '🇳🇵',
  'Sri Lanka': '🇱🇰', 'Myanmar': '🇲🇲', 'Cambodia': '🇰🇭', 'Laos': '🇱🇦',
  'Mongolia': '🇲🇳', 'Iraq': '🇮🇶', 'Libya': '🇱🇾', 'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴', 'Honduras': '🇭🇳', 'El Salvador': '🇸🇻', 'Nicaragua': '🇳🇮',
  'Dominican Republic': '🇩🇴', 'Trinidad and Tobago': '🇹🇹', 'Bahamas': '🇧🇸',
  'Barbados': '🇧🇧', 'Papua New Guinea': '🇵🇬', 'Vanuatu': '🇻🇺'
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  autoFailover: true,
  testBeforeConnect: true,
  autoConnect: false,
  notifications: true,
  refreshInterval: 300000,
  proxySource: 'proxymania',
  countryBlacklist: []
};

const ONBOARDING_STEPS = [
  { id: 'welcome', image: '🛡️', title: 'Welcome to ProxyMania VPN', content: 'Your free VPN service using ProxyMania proxy servers.' },
  { id: 'connectivity', image: '🔌', title: 'Quick Connection', content: 'Click any proxy or use Quick Connect to start browsing securely.' },
  { id: 'quality', image: '🟢', title: 'Connection Quality', content: 'See real-time connection quality. Green = excellent, Red = poor.' },
  { id: 'ip-detector', image: '🌐', title: 'IP Detector', content: 'Click "Check IPs" to verify your proxy is working.' },
  { id: 'site-rules', image: '🎯', title: 'Per-Site Rules', content: 'Auto-switch proxies for specific websites.' },
  { id: 'auto-rotation', image: '🔄', title: 'Auto-Rotation', content: 'Automatically rotate to fresh proxies at set intervals.' },
  { id: 'undo', image: '↩️', title: 'Undo Disconnect', content: 'Accidentally disconnected? Click Undo within 5 seconds!' },
  { id: 'shortcuts', image: '⌨️', title: 'Keyboard Shortcuts', content: 'Use Ctrl+K for search, Ctrl+Q for quick connect, and more!' }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { countryFlags, DEFAULT_SETTINGS, ONBOARDING_STEPS };
}
