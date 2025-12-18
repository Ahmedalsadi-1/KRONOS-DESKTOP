#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

class DMGBuilder {
  constructor() {
    this.buildDir = path.join(__dirname, '..', 'dist');
    this.resourcesDir = path.join(__dirname, '..', 'build-resources');
    this.iconPath = path.join(this.resourcesDir, 'icon.icns');
  }

  async build() {
    console.log('Building KRONOS Desktop Agent for macOS...');
    
    try {
      // Ensure build directory exists
      await this.ensureDirectory(this.buildDir);
      await this.ensureDirectory(this.resourcesDir);
      
      // Copy icon to resources if not exists
      if (!fs.existsSync(this.iconPath)) {
        console.log('Icon not found, creating placeholder...');
        await this.createPlaceholderIcon();
      }
      
      // Run electron-builder
      const result = execSync('npm run build:dmg', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      if (result.error) {
        throw new Error(`Build failed: ${result.error.message}`);
      }
      
      console.log('DMG build completed successfully');
      
      // Verify DMG was created
      const dmgPath = path.join(this.buildDir, 'KRONOS Desktop Agent-1.0.0.dmg');
      if (fs.existsSync(dmgPath)) {
        const stats = await fs.stat(dmgPath);
        console.log(`DMG created: ${dmgPath}`);
        console.log(`DMG size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
      
      return {
        success: true,
        dmgPath,
        size: stats ? stats.size : 0
      };
    } catch (error) {
      console.error('DMG build failed:', error);
      return { success: false, error: error.message };
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async createPlaceholderIcon() {
    try {
      // Create a simple placeholder icon
      const iconSizes = [16, 32, 64, 128, 256, 512];
      
      // Create iconset structure
      let iconXml = '<?xml version="1.0" encoding="UTF-8"?>\\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\\n<plist version="1.0">\\n<dict>\\n';
      iconXml += '  <key>CFBundleDocumentTypes</key>\\n';
      iconXml += '  <array>\\n';
      
      for (const size of iconSizes) {
        const filename = `icon_${size}x${size}.png`;
        iconXml += `    <dict>\\n`;
        iconXml += `      <key>CFBundleTypeRole</key>\\n`;
        iconXml += `      <string>Editor</string>\\n`;
        iconXml += `      <key>CFBundleTypeName</key>\\n`;
        iconXml += `      <string>KRONOS Desktop Agent Icon</string>\\n`;
        iconXml += `      <key>CFBundleTypeIconFile</key>\\n`;
        iconXml += `      <string>${filename}</string>\\n`;
        iconXml += `      <key>LSItemContentString</key>\\n`;
        iconXml += `      <string>${filename}</string>\\n`;
        iconXml += `    </dict>\\n`;
      }
      
      iconXml += '  </array>\\n';
      iconXml += '  <key>UTExportedTypeDeclarations</key>\\n';
      iconXml += '  <array>\\n';
      
      for (const size of iconSizes) {
        const filename = `icon_${size}x${size}.png`;
        iconXml += `    <dict>\\n`;
        iconXml += `      <key>UTExportedType</key>\\n`;
        iconXml += `      <string>public.png</string>\\n`;
        iconXml += `      <key>UTExportedTypeName</key>\\n`;
        iconXml += `      <string>KRONOS Icon ${size}x${size}</string>\\n`;
        iconXml += `    </dict>\\n`;
      }
      
      iconXml += '  </array>\\n';
      iconXml += '</dict>\\n';
      
      await fs.writeFile(path.join(this.resourcesDir, 'icon.icns'), iconXml);
      console.log('Placeholder iconset created');
    } catch (error) {
      console.error('Failed to create placeholder icon:', error);
    }
  }
}

// Run builder if this script is called directly
if (require.main === module) {
  const builder = new DMGBuilder();
  builder.build()
    .then((result) => {
    if (result.success) {
      console.log('✅ DMG build completed successfully!');
      console.log(`📦 Output: ${result.dmgPath}`);
    } else {
      console.error('❌ DMG build failed:', result.error);
      process.exit(1);
    }
  })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}