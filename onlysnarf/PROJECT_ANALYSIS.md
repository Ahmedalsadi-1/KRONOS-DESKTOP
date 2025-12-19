# Project Analysis: OnlySnarf

## Overview
**OnlySnarf** is a Python-based automation tool specifically designed for OnlyFans content creators. It utilizes Selenium web scraping to interact directly with the OnlyFans platform, providing programmatic access to content posting, user messaging, and monetization features without relying on official APIs.

## Key Components
- **Dockerfile**: Containerization with Chrome/Chromium browser setup
- **Configuration System**: User credentials and automation settings in ~/.onlysnarf/
- **REST API Server**: Flask-based API for programmatic access
- **agent.md**: Comprehensive integration documentation

## Dependencies
**Python Dependencies:**
- `selenium>=4.0.0`: Web browser automation
- `webdriver_manager>=3.8.3`: ChromeDriver management
- `flask>=2.0.0`: REST API framework
- `requests>=2.25.0`: HTTP client
- `inquirer>=2.7.0`: Interactive CLI prompts
- `validators>=0.18.0`: Input validation

**System Dependencies:**
- `google-chrome-stable`: Browser for automation
- `chromium-driver`: Chrome WebDriver
- `ffmpeg`: Video processing for content uploads
- `wget`: File downloading utilities

## Core Features & Workflows
1. **Content Publishing**: Automated posting of text, images, videos, and polls
2. **User Communication**: Bulk messaging with pricing and scheduling
3. **Monetization Tools**: Discount campaigns and grandfathered pricing
4. **User Management**: Discovery and caching of platform user information
5. **Profile Synchronization**: Backup and sync of creator profile settings

## Docker Configuration
- **Base Image**: `python:3.14-slim`
- **Browser Setup**: Chrome/Chromium installation with ARM64 support
- **Volume Mounts**: Persistent config storage and downloads directory
- **Network**: Connected to automation-network with selenium-hub
- **Security**: Non-root execution with proper file permissions

## API Endpoints
- `POST /message`: Send messages to users with media attachments
- `POST /post`: Upload content posts with scheduling and pricing
- `GET /users`: Retrieve user information and engagement metrics

## Integration Points
- **Agent Orchestrator**: Registered service with health monitoring
- **Unified Automation Platform**: Adapter integration for orchestration
- **Selenium Grid**: Distributed browser automation support
- **Configuration Management**: Environment variable overrides</content>
<parameter name="filePath">onlysnarf/PROJECT_ANALYSIS.md