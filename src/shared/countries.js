// PeasyProxy - Shared Country Code Mapping
// Single source of truth for country code → name resolution.
// Used by proxy-fetcher (background) and popup UI.

const COUNTRY_CODES = {
  'US': 'United States', 'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
  'JP': 'Japan', 'CN': 'China', 'BR': 'Brazil', 'CA': 'Canada', 'AU': 'Australia',
  'RU': 'Russia', 'IN': 'India', 'KR': 'South Korea', 'NL': 'Netherlands',
  'ES': 'Spain', 'IT': 'Italy', 'PL': 'Poland', 'SG': 'Singapore', 'HK': 'Hong Kong',
  'TW': 'Taiwan', 'ID': 'Indonesia', 'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Philippines',
  'MY': 'Malaysia', 'AR': 'Argentina', 'MX': 'Mexico', 'UA': 'Ukraine', 'TR': 'Turkey',
  'ZA': 'South Africa', 'SE': 'Sweden', 'NO': 'Norway', 'CH': 'Switzerland', 'AT': 'Austria',
  'BE': 'Belgium', 'PT': 'Portugal', 'GR': 'Greece', 'CZ': 'Czech Republic', 'RO': 'Romania',
  'HU': 'Hungary', 'BG': 'Bulgaria', 'IE': 'Ireland', 'NZ': 'New Zealand', 'PK': 'Pakistan',
  'BD': 'Bangladesh', 'IR': 'Iran', 'IL': 'Israel', 'AE': 'UAE', 'SA': 'Saudi Arabia',
  'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya', 'CL': 'Chile', 'CO': 'Colombia',
  'PE': 'Peru', 'VE': 'Venezuela', 'EC': 'Ecuador', 'UY': 'Uruguay', 'CR': 'Costa Rica',
  'PA': 'Panama', 'GT': 'Guatemala', 'CU': 'Cuba', 'JM': 'Jamaica',
  'FJ': 'Fiji', 'IS': 'Iceland', 'LU': 'Luxembourg', 'MT': 'Malta',
  'CY': 'Cyprus', 'GE': 'Georgia', 'AM': 'Armenia', 'KZ': 'Kazakhstan',
  'BY': 'Belarus', 'LT': 'Lithuania', 'LV': 'Latvia', 'EE': 'Estonia',
  'HR': 'Croatia', 'RS': 'Serbia', 'SK': 'Slovakia', 'SI': 'Slovenia',
  'DK': 'Denmark', 'FI': 'Finland', 'MA': 'Morocco', 'TN': 'Tunisia',
  'DZ': 'Algeria', 'GH': 'Ghana', 'ET': 'Ethiopia', 'TZ': 'Tanzania',
  'UG': 'Uganda', 'ZW': 'Zimbabwe', 'AO': 'Angola', 'ZM': 'Zambia',
  'MZ': 'Mozambique', 'BW': 'Botswana', 'NA': 'Namibia', 'NP': 'Nepal',
  'LK': 'Sri Lanka', 'MM': 'Myanmar', 'KH': 'Cambodia', 'LA': 'Laos',
  'MN': 'Mongolia', 'IQ': 'Iraq', 'LY': 'Libya', 'PY': 'Paraguay',
  'BO': 'Bolivia', 'HN': 'Honduras', 'SV': 'El Salvador', 'NI': 'Nicaragua',
  'DO': 'Dominican Republic', 'TT': 'Trinidad and Tobago', 'BS': 'Bahamas',
  'BB': 'Barbados', 'PG': 'Papua New Guinea', 'VU': 'Vanuatu'
};

/**
 * Convert a 2-letter country code to its full name.
 * @param {string} code - ISO 3166-1 alpha-2 code (e.g. 'US', 'DE')
 * @returns {string} Full country name or the code itself if unknown
 */
export function getCountryName(code) {
  return COUNTRY_CODES[code?.toUpperCase()] || code || 'Unknown';
}

/**
 * Get all known country codes.
 * @returns {string[]} Array of uppercase 2-letter codes
 */
export function getAllCountryCodes() {
  return Object.keys(COUNTRY_CODES);
}

/**
 * Check if a code is a known country code.
 * @param {string} code
 * @returns {boolean}
 */
export function isCountryCode(code) {
  return code?.toUpperCase() in COUNTRY_CODES;
}
