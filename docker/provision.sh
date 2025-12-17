#!/bin/bash
# KRONOS Desktop Agent Environment Provisioning Script
# Sets up the desktop environment with accessibility features and automation tools

set -e

echo "🚀 Starting KRONOS Desktop Agent Environment Provisioning..."

# Install system packages for accessibility and automation
echo "📦 Installing system packages..."
apt-get update && apt-get install -y \
    x11-apps \
    x11-utils \
    x11-xserver-utils \
    xfce4 \
    xfce4-goodies \
    tigervnc-standalone-server \
    novnc \
    websockify \
    python3-pip \
    python3-dev \
    firefox \
    chromium-browser \
    libreoffice \
    gedit \
    gnome-terminal \
    evince \
    eog \
    scrot \
    imagemagick \
    tesseract-ocr \
    tesseract-ocr-eng \
    xdotool \
    wmctrl \
    xclip \
    notify-osd \
    at-spi2-core \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libcairo-gobject2 \
    libpango-1.0-0 \
    libatk1.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgirepository-1.0-1 \
    gir1.2-atk-1.0 \
    gir1.2-gtk-3.0 \
    gir1.2-gdkpixbuf-2.0 \
    gir1.2-pango-1.0 \
    gir1.2-glib-2.0 \
    gir1.2-freedesktop \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

# Install Python packages for automation and accessibility
echo "🐍 Installing Python packages..."
pip3 install --upgrade pip
pip3 install \
    pyautogui \
    pillow \
    opencv-python \
    pytesseract \
    pygetwindow \
    pynput \
    keyboard \
    mouse \
    screeninfo \
    mss \
    pyperclip \
    psutil \
    requests \
    flask \
    flask-cors \
    flask-socketio \
    eventlet \
    websocket-client \
    python-socketio \
    numpy \
    matplotlib \
    pandas

# Create accessibility configuration
echo "♿ Configuring accessibility features..."
mkdir -p /root/.config

# Enable accessibility features
cat > /root/.config/accessibility.conf << EOF
# KRONOS Accessibility Configuration
export GTK_MODULES=gail:atk-bridge
export GNOME_ACCESSIBILITY=1
export QT_ACCESSIBILITY=1
export ACCESSIBILITY_ENABLED=1
EOF

# Create desktop automation scripts
echo "🔧 Creating automation scripts..."
mkdir -p /opt/kronos/bin

# Screen capture script with accessibility annotations
cat > /opt/kronos/bin/capture_screen.sh << 'EOF'
#!/bin/bash
# KRONOS Screen Capture with Accessibility Support

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="/tmp/kronos_screen_${TIMESTAMP}.png"

# Capture screen
scrot "$FILENAME"

# Add accessibility metadata
convert "$FILENAME" \
    -set "Description" "KRONOS Desktop Agent Screenshot - $TIMESTAMP" \
    -set "Software" "KRONOS Desktop Agent" \
    -set "DateTime" "$(date -Iseconds)" \
    "$FILENAME"

echo "$FILENAME"
EOF

chmod +x /opt/kronos/bin/capture_screen.sh

# Window management script
cat > /opt/kronos/bin/manage_window.sh << 'EOF'
#!/bin/bash
# KRONOS Window Management Script

ACTION=$1
WINDOW_ID=$2

case $ACTION in
    "focus")
        wmctrl -i -a "$WINDOW_ID"
        ;;
    "maximize")
        wmctrl -i -r "$WINDOW_ID" -b add,maximized_vert,maximized_horz
        ;;
    "minimize")
        wmctrl -i -r "$WINDOW_ID" -b add,hidden
        ;;
    "close")
        wmctrl -i -c "$WINDOW_ID"
        ;;
    "list")
        wmctrl -l
        ;;
    *)
        echo "Usage: $0 {focus|maximize|minimize|close|list} [WINDOW_ID]"
        exit 1
        ;;
esac
EOF

chmod +x /opt/kronos/bin/manage_window.sh

# Create VNC startup script
cat > /opt/kronos/bin/start_vnc.sh << 'EOF'
#!/bin/bash
# KRONOS VNC Server Startup Script

# Set VNC password
echo "kronos2024!" | vncpasswd -f > /root/.vnc/passwd
chmod 600 /root/.vnc/passwd

# Start VNC server
vncserver :99 -geometry 1920x1080 -depth 24

# Start noVNC if available
if command -v websockify &> /dev/null; then
    websockify -D --web=/usr/share/novnc/ 5999 localhost:5999
fi

echo "VNC server started on port 5999"
EOF

chmod +x /opt/kronos/bin/start_vnc.sh

# Create application shortcuts
echo "📱 Creating application shortcuts..."
mkdir -p /root/Desktop

# Firefox shortcut
cat > /root/Desktop/firefox.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Firefox
Comment=Web Browser
Exec=firefox
Icon=firefox
Terminal=false
StartupNotify=false
EOF
chmod +x /root/Desktop/firefox.desktop

# Terminal shortcut
cat > /root/Desktop/terminal.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Terminal
Comment=Command Line
Exec=gnome-terminal
Icon=terminal
Terminal=false
StartupNotify=false
EOF
chmod +x /root/Desktop/terminal.desktop

# Text Editor shortcut
cat > /root/Desktop/text-editor.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Text Editor
Comment=Edit Text Files
Exec=gedit
Icon=gedit
Terminal=false
StartupNotify=false
EOF
chmod +x /root/Desktop/text-editor.desktop

# Set up environment variables
echo "🔧 Configuring environment variables..."
cat >> /root/.bashrc << 'EOF'

# KRONOS Desktop Agent Environment
export KRONOS_DESKTOP_AGENT=1
export DISPLAY=:99
export KRONOS_AUTOMATION_ENABLED=1
export KRONOS_ACCESSIBILITY_ENABLED=1

# Add KRONOS bin to PATH
export PATH="/opt/kronos/bin:$PATH"

# Python path for automation scripts
export PYTHONPATH="/opt/kronos/lib:$PYTHONPATH"

EOF

# Create Python automation library
echo "📚 Creating Python automation library..."
mkdir -p /opt/kronos/lib

cat > /opt/kronos/lib/kronos_automation.py << 'EOF'
#!/usr/bin/env python3
"""
KRONOS Desktop Automation Library
Provides high-level automation functions with accessibility support
"""

import pyautogui
import time
import subprocess
import psutil
import os
from typing import Optional, Tuple, Dict, Any
from PIL import Image
import pytesseract
import cv2
import numpy as np

class KronosDesktopAutomation:
    def __init__(self):
        # Configure PyAutoGUI
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.5

        # Set up OCR
        self.ocr_config = '--oem 3 --psm 6'

    def capture_screen(self, region: Optional[Tuple[int, int, int, int]] = None) -> Image.Image:
        """Capture screen with optional region"""
        if region:
            screenshot = pyautogui.screenshot(region=region)
        else:
            screenshot = pyautogui.screenshot()
        return screenshot

    def find_image(self, image_path: str, confidence: float = 0.8) -> Optional[Tuple[int, int]]:
        """Find image on screen"""
        try:
            location = pyautogui.locateOnScreen(image_path, confidence=confidence)
            if location:
                return (location.left + location.width // 2, location.top + location.height // 2)
        except pyautogui.ImageNotFoundException:
            pass
        return None

    def click_at(self, x: int, y: int, clicks: int = 1, button: str = 'left'):
        """Click at specific coordinates"""
        pyautogui.click(x, y, clicks=clicks, button=button)

    def type_text(self, text: str, interval: float = 0.02):
        """Type text with configurable interval"""
        pyautogui.typewrite(text, interval=interval)

    def press_key(self, key: str):
        """Press a single key"""
        pyautogui.press(key)

    def hotkey(self, *keys):
        """Press hotkey combination"""
        pyautogui.hotkey(*keys)

    def extract_text_from_image(self, image: Image.Image) -> str:
        """Extract text from image using OCR"""
        return pytesseract.image_to_string(image, config=self.ocr_config)

    def wait_for_image(self, image_path: str, timeout: int = 10, confidence: float = 0.8) -> bool:
        """Wait for image to appear on screen"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.find_image(image_path, confidence):
                return True
            time.sleep(0.5)
        return False

    def get_window_info(self) -> Dict[str, Any]:
        """Get information about active window"""
        try:
            window = pygetwindow.getActiveWindow()
            return {
                'title': window.title,
                'size': (window.width, window.height),
                'position': (window.left, window.top),
                'isMinimized': window.isMinimized,
                'isMaximized': window.isMaximized
            }
        except:
            return {}

    def launch_application(self, app_path: str, arguments: Optional[list] = None) -> bool:
        """Launch application with optional arguments"""
        try:
            if arguments:
                subprocess.Popen([app_path] + arguments)
            else:
                subprocess.Popen([app_path])
            return True
        except Exception as e:
            print(f"Failed to launch {app_path}: {e}")
            return False

    def is_process_running(self, process_name: str) -> bool:
        """Check if process is running"""
        for proc in psutil.process_iter(['pid', 'name']):
            if proc.info['name'] == process_name:
                return True
        return False

    def get_screen_size(self) -> Tuple[int, int]:
        """Get screen size"""
        return pyautogui.size()

# Global instance
automation = KronosDesktopAutomation()

def capture_screen():
    """Capture full screen"""
    return automation.capture_screen()

def click_at_coordinates(x, y):
    """Click at coordinates"""
    automation.click_at(x, y)

def type_text(text):
    """Type text"""
    automation.type_text(text)

def extract_text_from_screen():
    """Extract text from screen"""
    screen = automation.capture_screen()
    return automation.extract_text_from_image(screen)

if __name__ == "__main__":
    print("KRONOS Desktop Automation Library")
    print(f"Screen size: {automation.get_screen_size()}")
EOF

# Set proper permissions
chmod +x /opt/kronos/lib/kronos_automation.py

# Create a simple test script to verify setup
cat > /opt/kronos/bin/test_setup.sh << 'EOF'
#!/bin/bash
# KRONOS Setup Test Script

echo "🧪 Testing KRONOS Desktop Agent Setup..."

# Test Python automation library
echo "Testing Python automation library..."
python3 -c "
import sys
sys.path.append('/opt/kronos/lib')
from kronos_automation import automation
print('✅ Python automation library loaded')
print(f'Screen size: {automation.get_screen_size()}')
"

# Test screen capture
echo "Testing screen capture..."
if /opt/kronos/bin/capture_screen.sh > /dev/null 2>&1; then
    echo "✅ Screen capture working"
else
    echo "❌ Screen capture failed"
fi

# Test window management
echo "Testing window management..."
if /opt/kronos/bin/manage_window.sh list > /dev/null 2>&1; then
    echo "✅ Window management working"
else
    echo "❌ Window management failed"
fi

echo "🎉 KRONOS Desktop Agent setup complete!"
EOF

chmod +x /opt/kronos/bin/test_setup.sh

echo "✅ KRONOS Desktop Agent environment provisioning complete!"
echo "🔄 Run '/opt/kronos/bin/test_setup.sh' to verify the setup"
echo "🚀 The desktop agent is ready for automation tasks"