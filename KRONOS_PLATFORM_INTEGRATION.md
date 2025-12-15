# KRONOS Unified Platform - Desktop Agent & UI Automation Integration

This document describes the integration of the KRONOS Desktop Agent and UI Automation components into the KRONOS unified platform service mesh.

## 🏗️ Architecture Overview

The KRONOS unified platform now includes:

### Core Services
- **Service Registry**: Centralized service discovery and health monitoring
- **API Gateway**: Unified entry point with intelligent routing and rate limiting
- **Orchestration Engine**: AI-powered workflow orchestration
- **Configuration Service**: Centralized configuration management
- **Security Service**: Authentication and authorization
- **Redis**: Caching and session storage
- **Monitoring**: Prometheus + Grafana for observability

### New Desktop Automation Services
- **Desktop Agent**: Full Ubuntu desktop environment with AI agent capabilities
- **UI Automation**: Vision-language GUI interaction using UI-TARS model

## 🚀 Quick Start

### Deploy the Full Platform

```bash
# Clone the repository
git clone https://github.com/kronos-ai/kronos.git
cd kronos

# Start all services
docker-compose -f kronos-platform/docker/docker-compose.yml up -d

# Or start individual services
docker-compose -f docker-compose.yml up -d kronos-desktop-agent kronos-ui-automation
```

### Service Endpoints

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| Service Registry | 8080 | Service discovery | `/health` |
| API Gateway | 3003 | Unified API access | `/health` |
| Desktop Agent | 9990 | Desktop automation | `/health` |
| UI Automation | 8003 | Vision-language GUI | `/health` |
| Orchestration Engine | 5000 | Workflow orchestration | `/health` |

## 🖥️ Desktop Agent Features

### Capabilities
- **Full Desktop Environment**: Ubuntu 22.04 with XFCE desktop
- **Application Automation**: Launch, control, and interact with any desktop application
- **File Management**: Read, write, organize files with full file system access
- **VNC Access**: Remote desktop viewing and control
- **AI Agent**: Natural language task execution
- **Accessibility Support**: Screen reader compatible, keyboard navigation

### API Endpoints

```bash
# Create a desktop automation task
curl -X POST http://localhost:3003/api/v1/desktop/task \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Open Firefox and navigate to example.com",
    "parameters": {
      "application": "firefox",
      "url": "https://example.com"
    }
  }'

# Get desktop screenshot
curl http://localhost:3003/api/v1/desktop/screenshot

# Execute specific action
curl -X POST http://localhost:3003/api/v1/desktop/action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "click",
    "coordinates": [500, 300]
  }'
```

### Environment Provisioning

The desktop environment is automatically provisioned with:
- Accessibility tools and libraries
- Automation frameworks (PyAutoGUI, Selenium)
- OCR capabilities (Tesseract)
- Screen capture utilities
- Window management tools
- Password managers integration

## 👁️ UI Automation Features

### Vision-Language Capabilities
- **UI-TARS Model**: State-of-the-art GUI interaction model
- **Screen Analysis**: Understand and describe interface elements
- **Action Prediction**: Intelligent next-step recommendations
- **Coordinate Mapping**: Precise element targeting
- **Multi-Modal Input**: Process screenshots, text instructions, coordinates

### Benchmarks
- **OSWorld**: 42.5% success rate
- **ScreenSpot-V2**: 94.2% accuracy
- **AndroidWorld**: 64.2% success rate
- **WebVoyager**: 84.8% performance

### API Endpoints

```bash
# Analyze screen content
curl -X POST http://localhost:3003/api/v1/ui/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_screenshot",
    "instructions": "Describe the main interface elements"
  }'

# Predict next action
curl -X POST http://localhost:3003/api/v1/ui/action \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_screenshot",
    "instructions": "Click the login button"
  }'

# Execute automation task
curl -X POST http://localhost:3003/api/v1/ui/task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Fill out the contact form",
    "parameters": {
      "formData": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  }'
```

## 🔄 Orchestration Engine Integration

### New Workflow Types

#### Desktop Application Automation
```json
{
  "name": "Desktop Application Automation",
  "definition": {
    "steps": [
      {
        "id": "launch-app",
        "type": "kronos-desktop-agent",
        "parameters": {
          "action": "launch_app",
          "application": "libreoffice",
          "parameters": ["--writer"]
        }
      },
      {
        "id": "navigate-ui",
        "type": "kronos-ui-automation",
        "parameters": {
          "action": "navigate",
          "instructions": "Open a new document and navigate to the formatting toolbar"
        }
      }
    ]
  }
}
```

#### Vision-Guided Desktop Automation
```json
{
  "name": "Vision-Guided Desktop Automation",
  "definition": {
    "steps": [
      {
        "id": "capture-screen",
        "type": "kronos-desktop-agent",
        "parameters": {
          "action": "screenshot"
        }
      },
      {
        "id": "analyze-screen",
        "type": "kronos-ui-automation",
        "parameters": {
          "action": "analyze",
          "instructions": "Identify all clickable buttons and input fields"
        }
      },
      {
        "id": "execute-actions",
        "type": "kronos-desktop-agent",
        "parameters": {
          "action": "execute_plan",
          "plan": "{{analysisResult}}"
        }
      }
    ]
  }
}
```

### Cross-Service Workflows

The orchestration engine can now coordinate between:
- Browser automation (web scraping, form filling)
- Desktop automation (application control, file management)
- UI automation (vision-guided interaction)
- AI services (content generation, analysis)

## 🔒 Security & Access Control

### Authentication
- JWT-based authentication for API access
- Service-to-service authentication via API keys
- Role-based access control for desktop operations

### Network Security
- Isolated service networks
- Encrypted communication between services
- Rate limiting and DDoS protection

## 📊 Monitoring & Observability

### Metrics Collected
- Service health and response times
- Workflow execution statistics
- Desktop automation success rates
- UI interaction accuracy metrics
- Resource utilization (CPU, memory, disk)

### Dashboards
- Grafana dashboards for real-time monitoring
- Service mesh topology visualization
- Performance analytics and alerting

## 🛠️ Development & Testing

### Local Development
```bash
# Start platform services
cd kronos-platform/docker
docker-compose up -d

# Start individual desktop agent
cd kronos-desktop-agent/docker
docker build -t kronos-desktop-agent .
docker run -p 9990:9990 -p 5999:5999 kronos-desktop-agent
```

### Testing
```bash
# Run integration tests
npm test -- --testPathPattern=integration

# Test desktop automation
curl -X POST http://localhost:3003/api/v1/desktop/task \
  -d '{"description": "Take a screenshot"}'

# Test UI automation
curl -X POST http://localhost:3003/api/v1/ui/analyze \
  -d '{"image": "test_screenshot.jpg", "instructions": "Analyze this interface"}'
```

## 📚 API Documentation

### OpenAPI Specifications
- Service Registry: `/api/v1/services`
- Desktop Agent: `/api/v1/desktop/*`
- UI Automation: `/api/v1/ui/*`
- Orchestration: `/api/v1/workflows`

### Postman Collections
Import the provided Postman collection for comprehensive API testing.

## 🚀 Deployment Options

### Docker Compose (Recommended)
```bash
docker-compose -f kronos-platform/docker/docker-compose.yml up -d
```

### Kubernetes
```bash
# Using Helm charts
helm install kronos ./kronos-platform/helm
```

### Cloud Deployment
- Railway (desktop agent)
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances

## 🤝 Contributing

### Adding New Desktop Automation Features
1. Extend the automation library in `/opt/kronos/lib/`
2. Add new API endpoints in the desktop agent
3. Update orchestration engine workflows
4. Add tests and documentation

### Improving UI Automation
1. Update UI-TARS model integration
2. Add new action types and capabilities
3. Improve coordinate mapping accuracy
4. Enhance multi-modal processing

## 📄 License

This integration is part of the KRONOS platform and follows the same Apache 2.0 license.

## 🆘 Support

- **Documentation**: https://docs.kronos.ai
- **Community**: https://discord.com/invite/kronos
- **Issues**: https://github.com/kronos-ai/kronos/issues
- **Discussions**: https://github.com/kronos-ai/kronos/discussions

---

**Built with ❤️ by the KRONOS Team**