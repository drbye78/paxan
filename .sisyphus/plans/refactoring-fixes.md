# PeasyProxy Refactoring Plan — Fix All Identified Issues

## Overview
Fix all incomplete, skeletal, and non-production features identified in the codebase audit.

**Total Tasks**: 10  
**Estimated Time**: 3-4 days  
**Risk Level**: Medium (module system changes affect core functionality)

---

## Phase 1: Critical Fixes (HIGH Priority)

### T1: Convert Module System — `quality-monitor.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/quality-monitor.js`  
**Lines**: 432

#### Problem
Uses `require()` / `module.exports` (CommonJS) instead of ES modules. Cannot be imported by the ES module-based service worker.

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements
- [ ] Fix `startQualityMonitoring()` to actually use `intervalMs` parameter
- [ ] Add periodic monitoring using `chrome.alarms` API

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] `startQualityMonitoring()` creates a `chrome.alarms` alarm for periodic monitoring
- [ ] `stopQualityMonitoring()` clears the alarm
- [ ] No `require()` or `module.exports` remain

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/quality-monitor.js
# Should return no matches

# Check alarm creation
grep -n "chrome.alarms.create" src/background/quality-monitor.js
# Should show alarm creation in startQualityMonitoring
```

---

### T2: Convert Module System — `pac-engine.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/pac-engine.js`  
**Lines**: 542

#### Problem
1. Uses `require()` / `module.exports` (CommonJS)
2. Uses `new Function()` for PAC execution (security risk)
3. Has stub implementations that return dummy values

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements
- [ ] Replace `new Function()` with safer alternative or document the risk
- [ ] Implement or remove stub functions:
  - `isResolvable()` — currently always returns `true`
  - `dnsResolve()` — currently always returns `null`
  - `isInNet()` — currently always returns `false`
  - `myIpAddress()` — currently returns hardcoded `'127.0.0.1'`

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain
- [ ] `new Function()` usage is either:
  - Removed (PAC support dropped), OR
  - Documented with security warning and input validation added
- [ ] Stub functions are either:
  - Properly implemented, OR
  - Removed with clear comments explaining why

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/pac-engine.js
# Should return no matches

# Check for new Function usage
grep -n "new Function" src/background/pac-engine.js
# Should either not exist or have security comment
```

---

### T3: Convert Module System — `proxy-chain.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/proxy-chain.js`  
**Lines**: 626

#### Problem
1. Uses `require()` / `module.exports` (CommonJS)
2. Implements "sequential testing" but calls it "proxy chaining" (misleading)
3. Real proxy chaining requires SOCKS5 tunneling which is not implemented

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements
- [ ] Rename misleading functions:
  - `executeChain()` → `testProxiesSequentially()`
  - `executeChainRequest()` → `testProxySequence()`
- [ ] Update all comments to clarify this is NOT real proxy chaining
- [ ] Update exports to use new names

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain
- [ ] Function names accurately describe what they do
- [ ] Comments clearly state this is sequential testing, not chaining
- [ ] No references to "chain" in function names (except in storage keys for backward compatibility)

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/proxy-chain.js
# Should return no matches

# Check for misleading "chain" terminology in function names
grep -n "function.*[Cc]hain" src/background/proxy-chain.js
# Should only show storage-related functions, not execution functions
```

---

### T4: Convert Module System — `dns-leak-test.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/dns-leak-test.js`  
**Lines**: 387

#### Problem
1. Uses `require()` / `module.exports` (CommonJS)
2. Uses `setInterval()` for monitoring (won't persist in service worker)

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements
- [ ] Replace `setInterval()` with `chrome.alarms` API
- [ ] Add alarm handler registration

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain
- [ ] `startDnsMonitoring()` creates a `chrome.alarms` alarm
- [ ] `stopDnsMonitoring()` clears the alarm
- [ ] No `setInterval()` usage for monitoring

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/dns-leak-test.js
# Should return no matches

# Check no setInterval for monitoring
grep -n "setInterval" src/background/dns-leak-test.js
# Should return no matches

# Check alarm usage
grep -n "chrome.alarms" src/background/dns-leak-test.js
# Should show alarm create/clear
```

---

### T5: Convert Module System — `tab-manager.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/tab-manager.js`  
**Lines**: 461

#### Problem
Uses `require()` / `module.exports` (CommonJS) instead of ES modules.

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/tab-manager.js
# Should return no matches
```

---

### T6: Convert Module System — `proxy-validator.js`
**Priority**: 🔴 HIGH  
**File**: `src/background/proxy-validator.js`  
**Lines**: 561

#### Problem
Uses `require()` / `module.exports` (CommonJS) instead of ES modules.

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/background/proxy-validator.js
# Should return no matches
```

---

## Phase 2: Moderate Fixes (MEDIUM Priority)

### T7: Fix Message Handler Stubs — `index.js`
**Priority**: 🟡 MEDIUM  
**File**: `src/background/index.js`  
**Lines**: 488

#### Problem
Many message handlers return fake success responses without doing anything.

#### Stub Handlers to Fix
1. `handleProxyError` — Just logs, no error tracking
2. `clearErrorLogs` — Returns success, doesn't clear anything
3. `getStoredErrors` — Always returns empty array
4. `startOnboarding` / `completeOnboarding` — No onboarding logic
5. `resetSecurityAlerts` — No actual reset
6. `getHealthStatus` — Returns hardcoded values

#### Tasks
- [ ] Implement `handleProxyError`:
  - Store error in `errorLogs` array in storage
  - Include timestamp, proxy info, error message
  - Limit to last 50 errors
- [ ] Implement `clearErrorLogs`:
  - Clear `errorLogs` from storage
- [ ] Implement `getStoredErrors`:
  - Return actual stored errors from storage
- [ ] Implement `getHealthStatus`:
  - Return actual health data from health monitor
  - Remove hardcoded `quality: 'excellent'`
- [ ] Remove or implement onboarding handlers:
  - Either implement onboarding flow, OR
  - Remove handlers and document why

#### Acceptance Criteria
- [ ] `handleProxyError` stores errors in `chrome.storage.local`
- [ ] `clearErrorLogs` actually clears stored errors
- [ ] `getStoredErrors` returns real stored errors
- [ ] `getHealthStatus` returns real health data
- [ ] No hardcoded values in responses

#### Verification
```bash
# Check for hardcoded responses
grep -n "quality: 'excellent'" src/background/index.js
# Should return no matches

# Check for error storage
grep -n "errorLogs" src/background/index.js
# Should show storage operations
```

---

### T8: Convert Popup Modules — `popup.performance.js`
**Priority**: 🟡 MEDIUM  
**File**: `src/popup-modules/popup.performance.js`  
**Lines**: 505

#### Problem
Uses `require()` / `module.exports` (CommonJS) instead of ES modules.

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/popup-modules/popup.performance.js
# Should return no matches
```

---

### T9: Convert Popup Modules — `popup.rules.js`
**Priority**: 🟡 MEDIUM  
**File**: `src/popup-modules/popup.rules.js`  
**Lines**: 420

#### Problem
Uses `require()` / `module.exports` (CommonJS) instead of ES modules.

#### Tasks
- [ ] Convert `require()` to `import` statements
- [ ] Convert `module.exports` to `export` statements

#### Acceptance Criteria
- [ ] File uses `import` / `export` syntax
- [ ] No `require()` or `module.exports` remain

#### Verification
```bash
# Check no CommonJS syntax remains
grep -n "require\|module.exports" src/popup-modules/popup.rules.js
# Should return no matches
```

---

## Phase 3: Low Priority Fixes

### T10: Fix Hardcoded Test Password
**Priority**: 🟢 LOW  
**File**: `src/test-support/security.js`  
**Lines**: ~310

#### Problem
Default password `'PeasyProxySecureKey'` is hardcoded in encryption functions.

#### Tasks
- [ ] Remove default password parameter from `encryptProxyData()`
- [ ] Remove default password parameter from `decryptProxyData()`
- [ ] Update all callers to explicitly pass password

#### Acceptance Criteria
- [ ] No hardcoded passwords in code
- [ ] Functions require explicit password parameter
- [ ] All callers updated

#### Verification
```bash
# Check for hardcoded password
grep -n "PeasyProxySecureKey" src/test-support/security.js
# Should return no matches
```

---

## Final Verification Wave

### F1: Module System Verification
**Reviewer**: Automated check  
**Acceptance Criteria**:
- [ ] No `require()` statements in any `.js` file under `src/`
- [ ] No `module.exports` in any `.js` file under `src/`
- [ ] All files use ES module syntax (`import`/`export`)

```bash
# Run these checks
grep -r "require(" src/ --include="*.js" | grep -v node_modules
grep -r "module.exports" src/ --include="*.js" | grep -v node_modules
# Both should return no matches
```

### F2: Security Verification
**Reviewer**: Automated check  
**Acceptance Criteria**:
- [ ] No `new Function()` usage without security documentation
- [ ] No hardcoded passwords
- [ ] No `eval()` usage

```bash
# Run these checks
grep -rn "new Function" src/ --include="*.js"
grep -rn "PeasyProxySecureKey" src/ --include="*.js"
grep -rn "eval(" src/ --include="*.js" | grep -v "test"
# All should return no matches (or documented exceptions)
```

### F3: Feature Completeness Verification
**Reviewer**: Manual code review  
**Acceptance Criteria**:
- [ ] No stub functions returning hardcoded values
- [ ] All message handlers implement actual logic
- [ ] Quality monitoring uses `chrome.alarms` for periodic checks
- [ ] DNS monitoring uses `chrome.alarms` for periodic checks

### F4: Build Verification
**Reviewer**: Automated check  
**Acceptance Criteria**:
- [ ] `npm run build` completes successfully
- [ ] No import/export errors
- [ ] Extension loads in Chrome without errors

```bash
# Run build
npm run build
# Should complete with exit code 0
```

---

## Task Dependencies

```
T1 (quality-monitor.js) ──────┐
T2 (pac-engine.js) ──────────┤
T3 (proxy-chain.js) ─────────┤
T4 (dns-leak-test.js) ───────┼──► F1 (Module System Verification)
T5 (tab-manager.js) ─────────┤
T6 (proxy-validator.js) ─────┤
T8 (popup.performance.js) ───┤
T9 (popup.rules.js) ─────────┘

T7 (index.js stubs) ──────────────► F3 (Feature Completeness)

T10 (test-support password) ──────► F2 (Security Verification)

F1 + F2 + F3 ─────────────────────► F4 (Build Verification)
```

## Parallelization

**Can run in parallel**:
- T1, T2, T3, T4, T5, T6 (all module conversions are independent)
- T8, T9 (popup module conversions)
- T10 (password fix)

**Must run sequentially**:
- T7 depends on T1-T6 being complete (needs to import from converted modules)
- F1-F4 depend on all T1-T10 being complete

---

## Execution Order

### Batch 1 (Parallel)
- T1: Convert `quality-monitor.js`
- T2: Convert `pac-engine.js`
- T3: Convert `proxy-chain.js`
- T4: Convert `dns-leak-test.js`
- T5: Convert `tab-manager.js`
- T6: Convert `proxy-validator.js`
- T8: Convert `popup.performance.js`
- T9: Convert `popup.rules.js`
- T10: Fix hardcoded password

### Batch 2 (After Batch 1)
- T7: Fix message handler stubs in `index.js`

### Batch 3 (Final Verification Wave)
- F1: Module system verification
- F2: Security verification
- F3: Feature completeness verification
- F4: Build verification

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Module conversion breaks imports | Medium | High | Test each file after conversion |
| PAC engine security regression | Low | High | Document security decision |
| Service worker alarm conflicts | Low | Medium | Use unique alarm names |
| Build fails after changes | Medium | High | Run build after each batch |

---

## Success Criteria

All tasks complete when:
1. ✅ Zero `require()` / `module.exports` in `src/`
2. ✅ Zero hardcoded passwords
3. ✅ Zero stub functions with dummy returns
4. ✅ All monitoring uses `chrome.alarms`
5. ✅ All message handlers implement real logic
6. ✅ `npm run build` succeeds
7. ✅ Extension loads in Chrome without errors
