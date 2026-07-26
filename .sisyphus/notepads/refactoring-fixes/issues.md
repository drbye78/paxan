# Refactoring Fixes — Issues

## Known Issues

### Module Conversion
- Some modules may have circular dependencies
- Need to verify import order doesn't break

### Chrome Alarms
- Alarm names must be unique across the extension
- Need to coordinate alarm names with existing monitoring

### Build Process
- `build.js` may need updates if it has special handling for modules
- Need to verify esbuild handles ES modules correctly

## Blockers

None identified yet.

## Workarounds

### If esbuild doesn't handle ES modules
- Check `build.js` configuration
- May need to update esbuild options for ES module output

### If Chrome alarms conflict
- Use namespaced alarm names: `peasyproxy_dns_monitoring`
- Check existing alarm names in codebase before adding new ones
