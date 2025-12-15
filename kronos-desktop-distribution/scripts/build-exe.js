#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class EXEBuilder {
  constructor() {
    this.buildDir = path.join(__dirname, '..', 'dist');
    this.resourcesDir = path.join(__dirname, '..', 'build-resources');
    this.iconPath = path.join(this.resourcesDir, 'icon.ico');
  }

  async build() {
    console.log('Building KRONOS Desktop Agent for Windows...');
    
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
      const result = execSync('npm run build:exe', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      if (result.error) {
        throw new Error(`Build failed: ${result.error.message}`);
      }
      
      console.log('EXE build completed successfully');
      
      // Verify EXE was created
      const exePath = path.join(this.buildDir, 'win-unpacked', 'KRONOS Desktop Agent.exe');
      if (fs.existsSync(exePath)) {
        const stats = await fs.stat(exePath);
        console.log(`EXE created: ${exePath}`);
        console.log(`EXE size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Verify installer
      const installerPath = path.join(this.buildDir, 'KRONOS Desktop Agent Setup 1.0.0.exe');
      if (fs.existsSync(installerPath)) {
        const stats = await fs.stat(installerPath);
        console.log(`Installer created: ${installerPath}`);
        console.log(`Installer size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
      
      return {
        success: true,
        exePath,
        installerPath,
        size: stats ? stats.size : 0
      };
    } catch (error) {
      console.error('EXE build failed:', error);
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
      // For Windows, we'll copy a placeholder icon or use existing
      const placeholderIconPath = path.join(this.resourcesDir, 'icon.ico');
      if (!fs.existsSync(placeholderIconPath)) {
        console.log('Creating placeholder icon for Windows build...');
      }
    } catch (error) {
      console.error('Failed to create placeholder icon:', error);
    }
  }
}

// Run builder if this script is called directly
if (require.main === module) {
  const builder = new EXEBuilder();
  builder.build()
    .then((result) => {
      if (result.success) {
        console.log('✅ EXE build completed successfully!');
        console.log(`📦 Output: ${result.exePath}`);
      } else {
        console.error('❌ EXE build failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}