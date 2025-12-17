#!/bin/bash

# Unified Automation Platform - Platform Setup Script
# This script configures and installs dependencies for all automation platforms

set -e

echo "🚀 Setting up Unified Automation Platform..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Python package if not exists
install_python_package() {
    local package="$1"
    if ! python3 -c "import $package" >/dev/null 2>&1; then
        echo "Installing Python package: $package"
        pip3 install "$package"
    else
        echo "✓ Python package '$package' is already installed"
    fi
}

# 1. UI-TARS Setup
echo ""
echo "🎯 Setting up UI-TARS Desktop Platform..."
if ! command_exists python3; then
    echo "❌ Python 3 is required for UI-TARS. Please install Python 3.8+ first."
    exit 1
fi

# Create UI-TARS workspace if it doesn't exist
mkdir -p ./workspace
mkdir -p ./UI-TARS-desktop/models

echo "Installing UI-TARS Python dependencies..."
install_python_package "ui-tars"
install_python_package "pyautogui"
install_python_package "opencv-python"
install_python_package "pillow"

# Verify UI-TARS installation
if python3 -c "from ui_tars.action_parser import parse_action_to_structure_output; print('✓ UI-TARS is working')" 2>/dev/null; then
    echo "✅ UI-TARS Desktop Platform configured successfully"
else
    echo "⚠️  UI-TARS Desktop Platform requires manual model setup. See UI-TARS-desktop/README_deploy.md"
fi

# 2. GBOX Setup
echo ""
echo "📱 Setting up GBOX Platform..."

GBOX_INSTALLED=false
if [ -f "./gbox/gbox" ]; then
    echo "✓ GBOX binary found in ./gbox/"
    chmod +x ./gbox/gbox
    GBOX_INSTALLED=true
elif command_exists gbox; then
    echo "✓ System GBOX installation found"
    GBOX_INSTALLED=true
else
    echo "⚠️  GBOX not found. Options:"
    echo "  1. Install via: curl -fsSL https://raw.githubusercontent.com/babelcloud/gbox/main/install.sh | bash"
    echo "  2. Or login to https://gbox.ai and download the binary"
    echo "  3. Place the binary in ./gbox/gbox"

    # Try to install GBOX CLI
    if command_exists curl; then
        echo "Attempting to install GBOX CLI..."
        curl -fsSL https://raw.githubusercontent.com/babelcloud/gbox/main/install.sh | bash || echo "Auto-installation failed. Please install manually."
    fi
fi

if [ "$GBOX_INSTALLED" = true ]; then
    echo "✅ GBOX Platform configured successfully"
else
    echo "⚠️  GBOX Platform requires manual installation and login (gbox login)"
fi

# 3. OpenComputerUse Setup
echo ""
echo "🌐 Checking OpenComputerUse Platform..."

# Check if port 8001 is in use (OpenComputerUse backend)
if command_exists lsof && lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ OpenComputerUse backend detected on port 8001"
elif [ -d "../open-computer-use" ]; then
    echo "⚠️  OpenComputerUse backend not running. You may need to:"
    echo "  1. cd ../open-computer-use"
    echo "  2. npm install"
    echo "  3. npm run dev"
    echo "  4. Configure the .env file with your API keys"
else
    echo "⚠️  OpenComputerUse directory not found in parent directory"
    echo "   You can clone it from: https://github.com/[owner]/open-computer-use"
fi

# 4. Bytebot Setup
echo ""
echo "🤖 Checking Bytebot Platform..."

# Check if port 4000 is in use
if command_exists lsof && lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Bytebot backend detected on port 4000"
elif [ -d "../bytebot" ]; then
    echo "⚠️  Bytebot backend not running. You may need to:"
    echo "  1. cd ../bytebot"
    echo "  2. npm install"
    echo "  3. npm run dev"
    echo "  4. Configure API keys as needed"
else
    echo "⚠️  Bytebot directory not found. Please ensure bytebot is available in ../bytebot"
fi

# 5. AI Browser Setup
echo ""
echo "🖥️  Checking Ai-Browser Platform..."

if [ -d "../ai-browser" ]; then
    echo "✅ Ai-Browser source directory found"
    # Check for server.js (standalone server)
    if [ -f "../ai-browser/server.js" ]; then
        echo "✅ Ai-Browser server found"
    fi
    # Check for package.json (Electron app)
    if [ -f "../ai-browser/package.json" ]; then
        echo "✅ Ai-Browser package configuration found"
    fi
else
    echo "⚠️  Ai-Browser directory not found. Please ensure ai-browser is available in ../ai-browser"
fi

# 6. Generate random security keys
echo ""
echo "🔐 Generating security keys..."

if command_exists openssl; then
    # Extract values inside $() for the env file
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)

    # Create temporary .env with real values
    cp .env .env.backup
    sed -i.tmp "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i.tmp "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    rm .env.tmp 2>/dev/null || true

    echo "✅ Security keys generated and updated in .env"
    echo "   JWT_SECRET: (32 bytes, generated)"
    echo "   ENCRYPTION_KEY: (16 bytes, generated)"
else
    echo "⚠️  openssl not found. Please manually set JWT_SECRET and ENCRYPTION_KEY in .env"
fi

# 7. Install Node.js dependencies for Unified Platform
echo ""
echo "📦 Installing Unified Automation Platform dependencies..."

if [ -f "package-lock.json" ]; then
    echo "Using npm install..."
    npm install
else
    echo "Using npm install..."
    npm install
fi

# 8. Check for required ports
echo ""
echo "🔍 Checking port availability..."

check_port() {
    local port=$1
    local service=$2
    if command_exists lsof && lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port ($service) is already in use"
    else
        echo "✅ Port $port ($service) is available"
    fi
}

check_port 3000 "React Frontend"
check_port 3001 "WebSocket Server"
# Note: Other ports are checked above

# 9. Final status
echo ""
echo "🎉 Unified Automation Platform setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure API keys for each platform in .env:"
echo "   - GBBOX_API_KEY (get from gbox.ai)"
echo "   - OPENCOMPUTERUSE_API_KEY"
echo "   - BYTEBOT_API_KEY"
echo "   - LLM API keys for ai-browser"
echo ""
echo "2. Start individual platforms:"
echo "   - OpenComputerUse: cd ../open-computer-use && npm run dev"
echo "   - Bytebot: cd ../bytebot && npm run dev"
echo "   - Ai-Browser: cd ../ai-browser && npm start"
echo "   - GBox: gbox login (if CLI available)"
echo ""
echo "3. Build and run the Unified Platform:"
echo "   npm run build:all"
echo "   npm start"
echo ""
echo "4. Test platform connections through the UI"
echo ""
echo "⚡ Happy automating! 🚀"
