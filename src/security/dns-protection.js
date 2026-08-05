/**
 * DNS Protection Module
 * Thin re-export from dns-leak-test.js for architectural clarity.
 * All DNS protection logic lives in dns-leak-test.js.
 */
export {
  enableDnsProtection,
  disableDnsProtection,
  getDnsProtectionStatus
} from '../background/dns-leak-test.js';
