#!/bin/bash

# Distribution script for ProxyVPN Extension
# Creates both ZIP (for Chrome Web Store) and CRX (for sideloading) packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$SCRIPT_DIR/dist"
PEM_FILE="$ROOT_DIR/proxy-vpn-extension.pem"
EXISTING_CRX="$ROOT_DIR/proxy-vpn-extension.crx"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building distribution packages...${NC}\n"

# Create dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Mode selection
MODE="${1:-both}"

# Function to create ZIP package
create_zip() {
    echo -e "${BLUE}📦 Creating ZIP package for Chrome Web Store...${NC}"
    
    # Create temporary directory for clean copy
    TEMP_DIR=$(mktemp -d)
    
    # Copy extension files, excluding unnecessary ones
    rsync -av --quiet \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.github' \
        --exclude='tests' \
        --exclude='dist' \
        --exclude='*.md' \
        --exclude='build.js' \
        --exclude='distribute.js' \
        --exclude='.gitignore' \
        --exclude='.gitattributes' \
        --exclude='package-lock.json' \
        --exclude='.DS_Store' \
        --exclude='*.sh' \
        "$SCRIPT_DIR/" "$TEMP_DIR/"
    
    # Create ZIP
    cd "$TEMP_DIR"
    zip -qr "$DIST_DIR/proxy-vpn-extension.zip" .
    cd - > /dev/null
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    # Show size
    SIZE=$(du -h "$DIST_DIR/proxy-vpn-extension.zip" | cut -f1)
    echo -e "${GREEN}✓ ZIP created: $DIST_DIR/proxy-vpn-extension.zip${NC}"
    echo -e "  Size: $SIZE"
}

# Function to create CRX package
create_crx() {
    echo -e "${BLUE}📦 Creating CRX package for sideloading...${NC}"
    
    ZIP_FILE="$DIST_DIR/proxy-vpn-extension.zip"
    CRX_FILE="$DIST_DIR/proxy-vpn-extension.crx"
    
    # Try using crx3 if available
    if command -v crx3 &> /dev/null; then
        crx3 "$ZIP_FILE" --key "$PEM_FILE" --output "$CRX_FILE"
        echo -e "${GREEN}✓ CRX created: $CRX_FILE${NC}"
    else
        # Check for existing CRX
        if [ -f "$EXISTING_CRX" ]; then
            echo -e "${YELLOW}⚠ crx3 not installed. Using existing CRX (may be outdated).${NC}"
            echo -e "   To rebuild CRX, install crx3: npm install -g crx3"
            cp "$EXISTING_CRX" "$CRX_FILE"
            echo -e "${GREEN}✓ CRX copied: $CRX_FILE${NC}"
        else
            echo -e "${YELLOW}⚠ crx3 not available and no existing CRX found.${NC}"
            echo -e "   Install crx3 with: npm install -g crx3"
        fi
    fi
}

# Build based on mode
case "$MODE" in
    zip)
        create_zip
        ;;
    crx)
        # Need ZIP first for CRX creation
        create_zip
        create_crx
        ;;
    both|*)
        create_zip
        create_crx
        ;;
esac

echo ""
echo -e "${GREEN}✅ Distribution build complete!${NC}"
echo ""
echo -e "${BLUE}📁 Output directory:${NC} $DIST_DIR"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "   • For Chrome Web Store: Upload the ZIP file to https://chrome.google.com/webstore/devconsole"
echo -e "   • For sideloading: Load the CRX file in Chrome at chrome://extensions (Developer mode)"
