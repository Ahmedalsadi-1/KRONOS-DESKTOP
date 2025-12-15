#!/bin/bash

# KRONOS Desktop Notarize Script for macOS
# This script notarizes the macOS application after build

set -e

# Configuration
APP_ID="com.kronos.desktop"
DMG_PATH="dist"
TEAM_ID="YOUR_TEAM_ID"  # Replace with actual Apple Developer Team ID

echo -e "${BLUE}🍎 Notarizing KRONOS Desktop Agent...${NC}"

# Check if we have the required tools
if ! command -v xcrun &> /dev/null; then
  echo -e "${RED}❌ xcrun not found. Please install Xcode Command Line Tools.${NC}"
  exit 1
fi

if ! command -v altool &> /dev/null; then
  echo -e "${RED}❌ altool not found. Please install Xcode Command Line Tools.${NC}"
  exit 1
fi

# Find the latest DMG
DMG_FILE=$(find ${DMG_PATH} -name "*.dmg" | head -n 1)

if [ -z "$DMG_FILE" ]; then
  echo -e "${RED}❌ No DMG file found in ${DMG_PATH}${NC}"
  exit 1
fi

echo -e "${YELLOW}📁 Found DMG: ${DMG_FILE}${NC}"

# Upload for notarization
echo -e "${YELLOW}☁️ Uploading to Apple notarization service...${NC}"

xcrun altool --notarize-app \
  --primary-bundle-id "${APP_ID}" \
  --username "your-apple-id@example.com" \
  --password "@keychain:AC_PASSWORD" \
  --asc-provider "Apple" \
  --file "${DMG_FILE}" \
  --wait

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Notarization failed!${NC}"
  xcrun altool --notarization-history --username "your-apple-id@example.com" --password "@keychain:AC_PASSWORD"
  exit 1
fi

# Staple the ticket to the DMG
echo -e "${YELLOW}📎 Stapling notarization ticket...${NC}"

DMG_BASENAME=$(basename "${DMG_FILE}" .dmg)
STAPLED_DMG="${DMG_PATH}/${DMG_BASENAME}-stapled.dmg"

xcrun stapler staple "${DMG_FILE}" --output "${STAPLED_DMG}"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Stapling failed!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Successfully stapled notarization ticket${NC}"

# Verify the staple
echo -e "${YELLOW}🔍 Verifying staple...${NC}"

xcrun stapler validate "${STAPLED_DMG}"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Staple validation failed!${NC}"
  exit 1
fi

# Replace original DMG with stapled version
mv "${STAPLED_DMG}" "${DMG_FILE}"

echo -e "${GREEN}✅ Notarization completed successfully!${NC}"
echo -e "${BLUE}📦 Stapled DMG: ${DMG_FILE}${NC}"

# Create zip version for distribution
echo -e "${YELLOW}📦 Creating ZIP version...${NC}"

ZIP_FILE="${DMG_PATH}/${DMG_BASENAME}.zip"
zip -r "${ZIP_FILE}" "$(basename "${DMG_FILE}" .dmg)"

echo -e "${GREEN}✅ ZIP version created: ${ZIP_FILE}${NC}"

# Update checksums
cd ${DMG_PATH}
sha256sum "${DMG_FILE}" > CHECKSUMS.txt
sha256sum "${ZIP_FILE}" >> CHECKSUMS.txt

echo -e "${BLUE}📋 Updated checksums:${NC}"
cat CHECKSUMS.txt

echo -e "${GREEN}🎉 KRONOS Desktop Agent notarization complete!${NC}"