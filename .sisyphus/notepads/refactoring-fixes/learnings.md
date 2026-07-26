# Refactoring Fixes — Learnings

## Module System Patterns

### ES Module Conversion Pattern
When converting from CommonJS to ES modules:

**Before (CommonJS)**:
```javascript
const { THRESHOLDS } = require('../popup/constants.js');
// ... code ...
module.exports = {
  functionName,
  ClassName
};
```

**After (ES Modules)**:
```javascript
import { THRESHOLDS } from '../popup/constants.js';
// ... code ...
export {
  functionName,
  ClassName
};
```

### Chrome Alarms Pattern
For periodic monitoring in service workers:

**Before (Won't persist)**:
```javascript
let monitorInterval = null;

function startMonitoring(intervalMs) {
  monitorInterval = setInterval(() => {
    // monitoring logic
  }, intervalMs);
}

function stopMonitoring() {
  clearInterval(monitorInterval);
}
```

**After (Persists across service worker restarts)**:
```javascript
const ALARM_NAME = 'myMonitoringAlarm';

async function startMonitoring(intervalMinutes = 5) {
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });
}

function stopMonitoring() {
  chrome.alarms.clear(ALARM_NAME);
}

// In alarm handler (registered elsewhere)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // monitoring logic
  }
});
```

## Gotchas

### Import Paths
- ES modules require file extensions: `import { foo } from './bar.js'`
- Relative paths are required: `./module.js` not `module.js`

### Export Syntax
- Named exports: `export { foo, bar }`
- Default exports: `export default MyClass`
- Named function exports: `export function myFunc() {}`

### Chrome Alarms
- Minimum interval is 1 minute (Chrome limitation)
- Alarms persist across service worker restarts
- Must register `chrome.alarms.onAlarm` listener in service worker

## Decisions

### PAC Engine Security
- Decision: Document the `new Function()` usage with security warning
- Rationale: PAC scripts are a standard browser feature, but users should be aware of risks
- Alternative considered: Remove PAC support entirely
- Chose documentation over removal to maintain feature parity

### Proxy Chain Naming
- Decision: Rename to "sequential testing" terminology
- Rationale: Current naming is misleading - it's not real proxy chaining
- Real chaining would require SOCKS5 tunneling which is out of scope

### Message Handler Stubs
- Decision: Implement real logic for error tracking and health status
- Rationale: These are useful features that should work
- Onboarding handlers: Remove if not implementing onboarding flow
