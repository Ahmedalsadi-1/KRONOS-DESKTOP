# Project Analysis: InstaPy

## Overview
**InstaPy** is a Python-based Instagram automation agent that uses Selenium WebDriver to directly interact with the Instagram web interface. It provides comprehensive engagement automation capabilities including liking, commenting, following, and relationship analysis, designed specifically for Instagram growth and engagement management.

## Key Components
- **Dockerfile**: Multi-stage build with Firefox ESR and GeckoDriver setup
- **agent.md**: Comprehensive documentation with API reference and integration guide
- **Configuration System**: Firefox profile and automation settings
- **Selenium Integration**: WebDriver automation with browser fingerprinting

## Dependencies
**Python Dependencies:**
- `instapy>=0.6.16`: Core automation library
- `selenium>=3.141.0`: Web browser automation
- `webdriver_manager>=3.8.3`: Automatic driver management
- `requests>=2.20.1`: HTTP client functionality
- `certifi>=2018.8.24`: SSL certificate handling

**Optional Dependencies:**
- `clarifai>=2.4.1`: AI-powered image analysis
- `python-telegram-bot>=12.0.0`: Telegram notifications
- `emoji>=1.6.0`: Emoji support in comments
- `PyVirtualDisplay>=0.2.1`: Headless display support

**System Dependencies:**
- `firefox-esr`: Browser for automation
- `geckodriver`: Firefox WebDriver
- `wget`: File downloading utilities

## Core Features & Workflows
1. **Content Engagement**: Automated liking by hashtags, locations, users, and feed
2. **Social Interaction**: Commenting with customizable templates and emoji support
3. **Relationship Management**: Following users by tags/locations, LIFO/FIFO unfollowing
4. **Content Analysis**: Relationship analysis (followers, following, non-followers)
5. **Safety Features**: Configurable quotas, randomized delays, content filtering

## Docker Configuration
- **Base Image**: `python:3.14-slim`
- **Browser Setup**: Firefox ESR with GeckoDriver installation
- **Volume Mounts**: Persistent data and configuration storage
- **Network**: Connected to automation-network with selenium-hub dependency
- **Security**: Non-root user execution with proper permissions

## Integration Points
- **Agent Orchestrator**: Listed as known service with REST API discovery
- **Unified Automation Platform**: Adapter integration for task orchestration
- **Selenium Grid**: Distributed browser automation support
- **Configuration Management**: Environment-based settings override</content>
<parameter name="filePath">instapy/PROJECT_ANALYSIS.md