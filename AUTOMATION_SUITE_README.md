# AI Automation Suite 🚀

A comprehensive containerized platform for AI-powered social media and content automation, featuring Python tools for Instagram, TikTok, YouTube, and AI-driven browser automation.

## Architecture Overview

### Python Automation Tools
- **OnlySnarf**: Social media content management and automation API server
- **InstaPy**: Instagram automation and growth tool
- **InstaGrapi**: Instagram API client with advanced automation capabilities
- **TikTok-Api**: TikTok platform automation toolkit
- **PyTube**: YouTube video downloading and metadata extraction
- **YouTube-Upload**: Automated YouTube video uploading

### Browser Automation Infrastructure
- **Selenium Grid Hub**: Centralized Selenium orchestration
- **Chrome Node**: Headless Chrome browser automation (VNC enabled)
- **Firefox Node**: Headless Firefox browser automation (VNC enabled)

### Infrastructure Features
- **Shared Volume Mounting**: Configuration and data persistence
- **Environment-based Configuration**: Secure credential management via `.env`
- **Network Isolation**: Dedicated bridge networks for service communication
- **Health Monitoring**: Built-in health checks and service discovery
- **Development Override**: Flexible configuration overrides

## Quick Start

### Prerequisites
- Docker Desktop or Docker Engine
- docker-compose >= 1.25.0
- Minimum 4GB RAM, 8GB recommended
- Ports 4444, 5000, 7900, 7901 available

### Launch Suite

```bash
# Make startup script executable (one-time setup)
chmod +x start-suite.sh

# Launch the entire suite
./start-suite.sh
```

Or manually:
```bash
# Build and start all services
docker-compose build --pull
docker-compose up -d --scale selenium-hub=1 --scale chrome-node=1 --scale firefox-node=1
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| OnlySnarf API | http://localhost:5000 | Main automation API server |
| Selenium Grid | http://localhost:4444 | Browser automation hub |
| Chrome VNC | http://localhost:7900 | Browser view (password: `secret`) |
| Firefox VNC | http://localhost:7901 | Browser view (password: `secret`) |

## Container Architecture

### Service Breakdown

#### Python Services (6 containers)
Each automation tool runs in its own Python 3.14 container with:
- Optimized base image (`python:3.14-slim`)
- Platform-specific system dependencies
- Virtual environment isolation
- Volume mounting for configuration

#### Browser Services (3 containers)
Selenium Grid infrastructure with:
- **Hub**: Request routing and session management
- **Chrome Node**: Headless Chrome with VNC access
- **Firefox Node**: Headless Firefox with VNC access
- High performance with accelerated hardware rendering

### Networking
- **Bridge Networks**: Isolated service communication
- **Port Mapping**: Standardized external ports (4444, 5000, 7900, 7901)
- **Service Discovery**: Internal hostname resolution

### Data Persistence
- **Configuration Volumes**: `/ai_emulators/config` mounted to all containers
- **Download Volumes**: `/ai_emulators/downloads` for output files
- **Logs**: Container logs accessible via `docker-compose logs`

## Configuration

### Environment Variables (.env)
```bash
# Selenium Grid Configuration
SELENIUM_GRID_URL=http://selenium-hub:4444/wd/hub

# API Credentials (examples)
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password
TIKTOK_USERNAME=your_username
TIKTOK_PASSWORD=your_password
YOUTUBE_API_KEY=your_api_key

# Browser Settings
CHROME_HEADLESS=true
FIREFOX_HEADLESS=true
VNC_PASSWORD=secret

# Download Paths
DOWNLOAD_DIR=/ai_emulators/downloads
LOG_DIR=/ai_emulators/logs
```

### Overrides (docker-compose.override.yml)
Development-specific configurations:
- Debug logging
- Extended environment variables
- Additional volume mounts
- Service scaling options

## Usage Examples

### Terminal Access
```bash
# Access OnlySnarf container
docker-compose exec onlysnarf bash

# Access Chrome browser container
docker-compose exec chrome-node bash

# View real-time logs
docker-compose logs -f onlysnarf
```

### API Usage
```bash
# OnlySnarf API call example
curl -X GET http://localhost:5000/api/status
```

### Browser Automation
```python
# Selenium Grid connection
driver = webdriver.Remote(
    command_executor='http://localhost:4444/wd/hub',
    options=webdriver.ChromeOptions()
)
# Your automation code here
```

## Development Commands

### Management
```bash
# View all container statuses
docker-compose ps

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose down && docker-compose build --pull && docker-compose up -d

# View logs for specific service
docker-compose logs -f onlysnarf

# Scale browser nodes
docker-compose up -d --scale chrome-node=3
```

### Debugging
```bash
# Access container shell
docker-compose exec onlysnarf sh

# Run container command directly
docker-compose exec onlysnarf python -c "import onlysnarf; print('OK')"

# Check service health
docker-compose exec selenium-hub curl -f http://localhost:4444/wd/hub/status
```

## Troubleshooting

### Common Issues

**Port Conflicts**
- Ensure ports 4444, 5000, 7900, 7901 are available
- Check running processes: `lsof -i :4444`

**Container Startup Failures**
- Check logs: `docker-compose logs [service-name]`
- Verify environment variables in `.env` file
- Ensure sufficient disk space (>10GB recommended)

**Browser Issues**
- VNC connections may require additional network configuration
- Check browser console logs: `docker-compose logs chrome-node`

### Performance Optimization

- **Resource Allocation**: Adjust `docker-compose.yml` resource limits
- **Memory**: Increase Docker Desktop memory limit to 8GB+
- **Disk**: Ensure adequate disk space for downloads and browser cache
- **Network**: Use host networking for latency-sensitive operations

## Security Considerations

- **Environment Variables**: Never commit `.env` files
- **Network Exposure**: Limit exposed ports to localhost
- **API Keys**: Rotate credentials regularly
- **Container Images**: Update base images frequently
- **Logs**: Monitor and rotate container logs

## Extension Points

### Adding New Tools

1. Create Dockerfile in tool directory
2. Update `docker-compose.yml` with new service
3. Mount shared volumes and networks
4. Add environment variables as needed
5. Update startup script

### Custom Automation

The suite is designed for extensibility. Each automation tool runs in isolation, allowing:
- Independent scaling
- Custom networking configurations
- Specialized resource allocation
- Platform-specific optimizations

## License & Attribution

This automation suite contains various open-source tools, each with their own licensing terms. Review individual project licenses before production use.

Built with Docker for containerization and Python for automation logic.
