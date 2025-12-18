#!/bin/bash

# KRONOS Desktop Distribution Build Script
# This script creates professional DMG/EXE/AppImage distributions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="KRONOS Desktop Agent"
VERSION=$(node -p -e "require('./package.json').version")
BUILD_DIR="dist"
ASSETS_DIR="assets"
SCRIPTS_DIR="scripts"

echo -e "${BLUE}🚀 Building ${PROJECT_NAME} v${VERSION}${NC}"
echo "=================================="

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf ${BUILD_DIR}
mkdir -p ${BUILD_DIR}

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --silent

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm run test:build || {
  echo -e "${RED}❌ Tests failed!${NC}"
  exit 1
}

# Build web application
echo -e "${YELLOW}🌐 Building web application...${NC}"
npm run build:web || {
  echo -e "${RED}❌ Web build failed!${NC}"
  exit 1
}

# Build Electron application
echo -e "${YELLOW}⚡ Building Electron application...${NC}"
npm run build:electron || {
  echo -e "${RED}❌ Electron build failed!${NC}"
  exit 1
}

# Create distributables
echo -e "${YELLOW}📦 Creating distributables...${NC}"

# macOS DMG
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo -e "${GREEN}🍎 Building macOS DMG...${NC}"
  npm run dist:mac || {
    echo -e "${RED}❌ macOS build failed!${NC}"
    exit 1
  }
fi

# Windows EXE
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ "$OSTYPE" == "win"* ]]; then
  echo -e "${GREEN}🪟 Building Windows EXE...${NC}"
  npm run dist:win || {
    echo -e "${RED}❌ Windows build failed!${NC}"
    exit 1
  }
fi

# Linux AppImage
if [[ "$OSTYPE" == "linux"* ]] || [[ "$OSTYPE" == "freebsd"* ]]; then
  echo -e "${GREEN}🐧 Building Linux AppImage...${NC}"
  npm run dist:linux || {
    echo -e "${RED}❌ Linux build failed!${NC}"
    exit 1
  }
fi

# Code signing (if certificates available)
if [ -n "$CSC_LINK" ] && [ -n "$CSC_KEY_PASSWORD" ]; then
  echo -e "${GREEN}✍️  Signing applications...${NC}"
  npm run build:signed || {
    echo -e "${YELLOW}⚠️  Signing failed, continuing unsigned...${NC}"
  }
fi

# Create checksums
echo -e "${YELLOW}🔐 Creating checksums...${NC}"
cd ${BUILD_DIR}

# Create checksums for all distributables
find . -name "*.dmg" -exec sha256sum {} \; | sed 's/  / */g' > CHECKSUMS.txt
find . -name "*.exe" -exec sha256sum {} \; | sed 's/  / */g' >> CHECKSUMS.txt
find . -name "*.AppImage" -exec sha256sum {} \; | sed 's/  / */g' >> CHECKSUMS.txt
find . -name "*.zip" -exec sha256sum {} \; | sed 's/  / */g' >> CHECKSUMS.txt

echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo "=================================="
echo -e "${BLUE}📁 Distribution files:${NC}"
ls -la ${BUILD_DIR}/

echo -e "${BLUE}📋 Checksums created:${NC}"
cat CHECKSUMS.txt

echo -e "${GREEN}🎉 ${PROJECT_NAME} v${VERSION} build complete!${NC}"

# Check if we should create release
if [ "$1" = "--release" ]; then
  echo -e "${YELLOW}🚀 Creating GitHub release...${NC}"
  
  # This would integrate with GitHub CLI for automated releases
  echo -e "${BLUE}📝 To create a release, run:${NC}"
  echo "gh release create ${VERSION} --title '${PROJECT_NAME} v${VERSION}' --notes 'Professional automation platform with cross-platform support'"
fi