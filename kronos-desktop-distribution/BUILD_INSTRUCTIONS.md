# Build Instructions

## Prerequisites
- Node.js 18+ installed
- npm dependencies installed (run `npm install`)
- Git initialized for version control

## Development

```bash
# Start development server
npm run dev

# Start renderer only
npm run dev:renderer

# Type check
npm run lint

# Build for development
npm run build

# Build DMG for macOS
npm run build:dmg

# Build EXE for Windows
npm run build:exe

# Build all platforms
npm run build:all

# Package without compression
npm run build:dir

# Run configuration wizard
npm run configure

# Setup initial configuration
npm run setup

# Notarize DMG (macOS only)
npm run notarize

# Sign applications (if certificates available)
npm run sign
```

## Build Output Structure

```
kronos-desktop-distribution/
├── dist/                          # Built application
│   ├── main.js              # Main Electron process
│   ├── renderer/            # React frontend bundle
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── App.css
│   └── index.html
├── build-resources/               # Build resources
│   ├── icon.icns           # macOS icon
│   ├── icon.ico            # Windows icon
│   └── entitlements.mac.plist
├── release/                    # Final distribution
│   ├── KRONOS Desktop Agent-1.0.0.dmg    # macOS DMG
│   ├── KRONOS Desktop Agent Setup 1.0.0.exe   # Windows installer
│   ├── win-unpacked/                # Windows portable
│   └── ...                     # Other build artifacts
└── scripts/                    # Build and setup scripts
    ├── build-dmg.js           # DMG builder
    ├── build-exe.js           # EXE builder
    ├── setup-wizard.js         # Configuration wizard
    └── ...                   # Other utilities
```

## Distribution Files

### macOS (DMG)
- **File**: `KRONOS Desktop Agent-1.0.0.dmg`
- **Size**: ~80MB (with embedded AI services)
- **Icon**: Custom KRONOS icon with multiple resolutions
- **Installation**: Drag-and-drop to Applications folder
- **Compatibility**: macOS 10.15+ (Intel & Apple Silicon)

### Windows (EXE)
- **File**: `KRONOS Desktop Agent Setup 1.0.0.exe`
- **Size**: ~120MB (with embedded AI services)
- **Features**:
  - Custom NSIS installer with component selection
  - Optional components for different AI modules
  - Desktop shortcuts creation
  - Automatic updates enabled
  - Registry entries for Windows integration
- **Compatibility**: Windows 10+ (x64)

## Key Features Implemented

### ✅ Core Distribution System
- **Electron Builder Configuration**: Multi-platform builds (DMG, EXE, AppImage)
- **Setup Wizard**: First-time user configuration with visual interface
- **Auto Updater**: Automatic checking and downloading of updates
- **Code Signing Ready**: Entitlements and signing infrastructure
- **Configuration Management**: Persistent user settings and preferences

### ✅ Cross-Platform AI Integration
- **Embedded AI Services**: Full AI services integration (Computer Vision, Web Automation, etc.)
- **Service Status Monitoring**: Real-time status tracking and management
- **Configuration Wizard**: Step-by-step setup process with validation
- **Update Mechanism**: Seamless background updates with user prompts

### ✅ User Experience
- **Modern React UI**: Clean, responsive interface with Tailwind CSS
- **Dark/Light Themes**: User preference support
- **System Tray Integration**: Minimize to tray option
- **First-Run Experience**: Guided setup for new users

### ✅ Advanced Features
- **Modular Component Selection**: Users can choose which AI components to install
- **Service Health Monitoring**: Real-time CPU, memory, disk usage tracking
- **Project Management**: Built-in project and workflow management
- **WebSocket Communication**: Real-time service communication
- **Error Handling**: Comprehensive error reporting and recovery

### ✅ Build Automation
- **Multi-Target Support**: DMG (macOS), EXE (Windows), AppImage (Linux)
- **Custom Installer Branding**: KRONOS-themed installers with custom pages
- **Resource Optimization**: Optimized asset inclusion and compression
- **Development Tools**: Hot reload, dev tools, and debugging support

### ✅ Security & Compliance
- **Code Signing Support**: macOS notarization and Windows signing ready
- **Entitlements Management**: Proper macOS app sandboxing
- **Secure Auto-Updates**: Verified update delivery and validation
- **User Data Protection**: Encrypted configuration storage

## Architecture Benefits

1. **Unified Distribution**: Single application bundle instead of individual services
2. **Simplified Installation**: All dependencies embedded - no external setup required
3. **Cross-Platform**: Native builds for Windows, macOS, and Linux
4. **Update Ready**: Automatic updates with security verification
5. **Professional Branding**: Consistent KRONOS experience across all platforms
6. **Developer Friendly**: Easy build and customization pipeline

## Next Steps

1. **Code Signing**: Set up Apple Developer account and Windows code signing certificates
2. **CI/CD Pipeline**: Automated builds and releases
3. **Distribution**: Upload to GitHub releases and platform app stores
4. **Testing**: Test installation on clean virtual machines
5. **Documentation**: Create user guides and API documentation