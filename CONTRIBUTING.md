# Contributing to ProxyMania VPN

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Getting Started

### Prerequisites

- Google Chrome (v88+)
- Git
- Text editor (VS Code recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/proxy-vpn-extension.git

# Navigate to project
cd proxy-vpn-extension

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project folder
```

---

## How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Chrome version
   - Screenshots if applicable

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Describe the use case
4. Explain expected benefits

### Submitting Code

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Changelog updated (if applicable)

### PR Title Format

```
type: short description

Examples:
feat: add dark mode toggle
fix: resolve connection timer issue
docs: update installation instructions
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested this change

## Checklist
- [ ] Code follows project guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
```

---

## Coding Standards

### JavaScript

```javascript
// Use const/let, avoid var
const value = getValue();
let counter = 0;

// Async/await for async operations
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}

// Arrow functions for callbacks
proxies.forEach(proxy => {
  console.log(proxy.ipPort);
});

// Template literals for strings
const message = `Connected to ${proxy.country}`;

// Consistent naming
function calculateProxyScore(proxy) { }  // camelCase for functions
const PROXY_TIMEOUT = 5000;  // UPPER_CASE for constants
class ProxyManager { }  // PascalCase for classes
```

### CSS

```css
/* Use CSS variables */
:root {
  --bg-primary: #1a1a2e;
  --text-primary: #ffffff;
}

/* BEM-like naming */
.proxy-item { }
.proxy-item--active { }
.proxy-item__flag { }

/* Organize properties */
.element {
  /* Positioning */
  position: relative;
  
  /* Display & Box Model */
  display: flex;
  margin: 10px;
  
  /* Typography */
  font-size: 14px;
  
  /* Visual */
  background: var(--bg-primary);
}
```

### File Organization

```
proxy-vpn-extension/
├── manifest.json      # Extension config
├── popup.html         # UI structure
├── popup.js           # UI logic
├── background.js      # Service worker
├── styles.css         # Styling
└── ...
```

---

## Commit Messages

### Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

### Examples

```
feat(proxy): add auto-failover functionality

Implemented automatic proxy switching when connection fails.
Added failover queue with 3 retry attempts.

Closes #42
```

```
fix(timer): resolve connection timer persistence issue

Timer now correctly persists across popup close/open.
Fixed storage key mismatch.
```

```
docs(readme): update installation instructions

Added detailed steps for loading unpacked extension.
Included troubleshooting section.
```

---

## Development Workflow

```bash
# Create feature branch
git checkout -b feat/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature

Co-authored-by: Qwen-Coder <qwen-coder@alibabacloud.com>"

# Push and create PR
git push origin feat/your-feature-name
```

---

## Questions?

- Check existing [documentation](README.md)
- Open an issue for questions
- Join discussions

---

Thank you for contributing! 🎉
