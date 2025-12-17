# 🔧 Platform Setup Guide

This guide provides step-by-step instructions to configure all automation platforms for the **Unified Automation Platform**.

## 🎯 Quick Start Setup

### 1. Run the Automated Setup Script
```bash
chmod +x setup-platforms.sh
./setup-platforms.sh
```

The script will:
- ✅ Check platform availability
- ✅ Install Python dependencies (may need manual intervention)
- ✅ Generate security keys
- ✅ Verify port availability
- ⚠️ Provide guidance for platforms that need manual setup

---

## 📋 Platform-Specific Configuration

### 1. 🎯 UI-TARS Desktop Platform

**Status:** Python-based automation platform

**Installation Steps:**
```bash
# Create virtual environment (recommended for macOS)
python3 -m venv uitars-env
source uitars-env/bin/activate

# Install UI-TARS and dependencies
pip install ui-tars pyautogui opencv-python pillow

# Optional: Install with uv for better environment management
uv pip install ui-tars pyautogui opencv-python pillow
```

**Manual Installation (if automated script fails):**
```bash
# For macOS/Homebrew Python
pip3 install --user ui-tars pyautogui opencv-python pillow

# Or use pipx (recommended)
brew install pipx
pipx install ui-tars
```

**Configuration:**
```bash
# Update .env file
UITARS_PYTHON_PATH=/usr/local/bin/python3  # or path to your virtual env
UITARS_WORKSPACE_PATH=./workspace
UITARS_VISION_MODEL=microsoft/Florence-2-large
UITARS_PYTHON_ENV=uitars-env
```

**Testing:**
```bash
# Test UI-TARS installation
python3 -c "from ui_tars.action_parser import parse_action_to_structure_output; print('✅ UI-TARS working')"
```

---

### 2. 📱 GBOX Platform

**Status:** Container and device automation platform

**Installation Options:**

**Option A: Install CLI**
```bash
curl -fsSL https://raw.githubusercontent.com/babelcloud/gbox/main/install.sh | bash
```

**Option B: Manual Installation**
1. Visit https://gbox.ai
2. Download the binary for your system
3. Place it in `./gbox/gbox`
4. Make it executable: `chmod +x ./gbox/gbox`

**Configuration:**
```bash
# Update .env file
GBOX_BASE_URL=http://localhost:8080
GBOX_EXECUTABLE_PATH=./gbox/gbox
GBOX_CONTAINER_NAME=ai-automation-container
GBOX_API_KEY=your_api_key_from_gbox_ai
GBOX_MCP_ENABLED=true
```

**Authentication:**
```bash
# Login to GBOX (required)
gbox login
```

**Testing:**
```bash
# Test GBOX connectivity
gbox --version
```

---

### 3. 🌐 OpenComputerUse Platform

**Status:** Web and browser automation platform

**Setup:**
```bash
# Navigate to OpenComputerUse directory
cd ../open-computer-use

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys (see .env.example)
# Required: Supabase keys, Azure/OpenAI API keys, etc.
```

**Start the Backend:**
```bash
# Start the development server
npm run dev
```

**Configuration for Unified Platform:**
```bash
# In unified-automation-platform/.env
OPENCOMPUTERUSE_BASE_URL=http://localhost:8001
OPENCOMPUTERUSE_API_KEY=your_supabase_anon_key
OPENCOMPUTERUSE_TIMEOUT=30000
```

**Testing:**
```bash
# Check if port 8001 is responding
curl http://localhost:8001/health
```

---

### 4. 🤖 Bytebot Platform

**Status:** Computer input simulation and automation

**Setup:**
```bash
# Navigate to bytebot directory
cd ../bytebot

# Install dependencies
npm install

# Start the backend
npm run dev
```

**Configuration:**
```bash
# In unified-automation-platform/.env
BYTEBOT_BASE_URL=http://localhost:4000
BYTEBOT_WS_URL=ws://localhost:4001
BYTEBOT_API_KEY=your_bytebot_api_key
BYTEBOT_TIMEOUT=60000
BYTEBOT_EXECUTABLE_PATH=./bytebot/packages/cli/dist/index.js
```

**Testing:**
```bash
# Check if bytebot is running
curl http://localhost:4000/health
```

---

### 5. 🖥️ AI-Browser Platform

**Status:** Browser automation with LLM integration

**Setup:**
```bash
# Navigate to ai-browser directory
cd ../ai-browser

# Install dependencies
npm install

# Copy and configure environment
cp .env.template .env
# Edit .env with your API keys for LLM providers
```

**Configuration:**
```bash
# In unified-automation-platform/.env
AIBROWSER_API_URL=http://localhost:3006
AIBROWSER_EXECUTABLE=./ai-browser/server.js
AIBROWSER_PROFILE_DIR=./profiles

# Replicate LLM API keys
DEEPSEEK_API_KEY=your_deepseek_key
QWEN_API_KEY=your_alibaba_key
GOOGLE_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
```

---

## 🔐 API Keys Configuration

### Required API Keys

**Core Platforms:**
- **GBOX**: Get from https://gbox.ai (account required)
- **OpenComputerUse**: Supabase keys, Azure/OpenRouter API keys
- **Bytebot**: May require local setup

**LLM Integration (for sophisticated platforms):**
- **OpenAI API Key**: For advanced features
- **Anthropic Claude**: For reasoning and analysis
- **Google Gemini**: For vision tasks
- **DeepSeek**: Alternative AI provider
- **Azure OpenAI**: Enterprise option
- **OpenRouter**: Multi-provider routing

### Environment Variables
```bash
# Copy template and fill in your keys
cp .env.example .env
# Edit .env with actual API keys and configurations
```

---

## 🚀 Starting the Unified Platform

### 1. Start Individual Platforms
```bash
# Terminal 1: OpenComputerUse
cd ../open-computer-use && npm run dev

# Terminal 2: Bytebot
cd ../bytebot && npm run dev

# Terminal 3: AI-Browser (optional)
cd ../ai-browser && npm run dev

# GBOX: Should be available via system CLI if installed
```

### 2. Build and Run Unified Platform
```bash
# Install dependencies
npm install

# Build both frontend and Electron
npm run build:all

# Start the application
npm start
```

### 3. Alternative: Development Mode
```bash
# Use concurrently for development
npm run start:electron  # Terminal 1 (Electron main)
npm run start:renderer  # Terminal 2 (React dev server)
```

---

## 🔍 Troubleshooting

### Port Conflicts
- **Port 3000**: React development server
- **Port 3001**: WebSocket streaming
- **Port 8001**: OpenComputerUse backend
- **Port 4000**: Bytebot backend
- **Port 3006**: AI-Browser API

**Check for conflicts:**
```bash
lsof -ti:3000,3001,8001,4000,3006
# Kill conflicting processes if needed
kill -9 <PID>
```

### Python Issues (macOS)
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install packages
pip install ui-tars pyautogui opencv-python pillow
```

### Permission Issues
```bash
# Make executables runnable
chmod +x ./gbox/gbox
chmod +x ./bytebot/packages/cli/dist/index.js
chmod +x ./ai-browser/server.js
chmod +x setup-platforms.sh
```

---

## 📊 Status Verification

### Automated Check
```bash
./setup-platforms.sh
```

### Manual Verification
```bash
# Check ports
lsof -Pi :8001,4000,3006 -sTCP:LISTEN

# Test Python packages
python3 -c "import ui_tars; print('UI-TARS: OK')"

# Check GBOX
gbox --version

# Test localhost connections
curl -f http://localhost:8001/health && echo "OpenComputerUse: OK"
curl -f http://localhost:4000/health && echo "Bytebot: OK"
curl -f http://localhost:3006/health && echo "AI-Browser: OK"
```

---

## 🎯 Next Steps

1. **Configure API keys** for each platform
2. **Start platform backends** in separate terminals
3. **Launch the unified app** with `npm start`
4. **Test platform connections** through the UI
5. **Create your first automation task** via the unified interface

**Need help?** Check the platform-specific README files or create an issue in the respective repositories.
