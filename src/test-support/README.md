# Test Support Files

This directory contains files that are used ONLY by the test suite and are NOT part of the actual Chrome extension runtime.

## Files

- `security.js` - Security validation functions (proxy validation, sanitization, etc.)
- `rate-limiter.js` - Rate limiting utilities (debounce, throttle, RateLimiter class)

## Why These Files Exist

The Chrome extension uses a monolithic architecture in `popup.js` for runtime functionality. However, the test suite was originally written to test a modular architecture. These files are kept to maintain test compatibility without modifying all the tests.

## Usage

These files should only be imported by:
- `tests/test-shim.js` - Test compatibility shim
- Test files that need these specific functions

## Note

These files are NOT referenced by:
- `manifest.json`
- `popup.html`
- `src/background/index.js`
- Any runtime extension code

If the test suite is refactored to test the actual extension code (popup.js), these files can be removed.
