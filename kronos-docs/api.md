# API Reference

## Overview

The AI Emulators Ecosystem provides RESTful APIs and WebSocket endpoints for programmatic access to automation capabilities.

## Authentication

All API requests require authentication using API keys or JWT tokens.

### API Key Authentication
```bash
Authorization: Bearer your-api-key
```

### JWT Authentication
```bash
Authorization: Bearer your-jwt-token
```

## REST API Endpoints

### Base URL
```
https://api.ai-emulators.dev/v1
```

### Automation Endpoints

#### Desktop Automation (UI-TARS)

**POST** `/automation/desktop/action`
Execute a desktop automation action using vision-language models.

**Request Body:**
```json
{
  "instruction": "Click on the save button",
  "screenshot": "base64-encoded-image",
  "context": {
    "application": "vscode",
    "platform": "macos"
  }
}
```

**Response:**
```json
{
  "success": true,
  "action": {
    "type": "click",
    "coordinates": [100, 200],
    "confidence": 0.95
  },
  "result": {
    "screenshot": "base64-encoded-result",
    "description": "Successfully clicked save button"
  }
}
```

#### Computer Use Framework

**POST** `/automation/computer/task`
Execute a cross-platform computer automation task.

**Request Body:**
```json
{
  "platform": "desktop|mobile|web",
  "actions": [
    {
      "type": "navigate",
      "url": "https://example.com"
    },
    {
      "type": "click",
      "selector": "#submit-button"
    }
  ],
  "environment": {
    "browser": "chrome",
    "resolution": "1920x1080"
  }
}
```

#### Agent System (Bytebot)

**POST** `/agents/execute`
Execute a multi-modal AI agent task.

**Request Body:**
```json
{
  "agent": "bytebot-v1",
  "task": "Analyze this image and extract text",
  "inputs": {
    "image": "base64-encoded-image",
    "context": "Document analysis"
  },
  "options": {
    "model": "gpt-4-vision",
    "temperature": 0.7
  }
}
```

### Environment Management

#### GBox Provisioning

**POST** `/environments/provision`
Provision a new automation environment.

**Request Body:**
```json
{
  "type": "android-emulator|desktop-container|browser-instance",
  "configuration": {
    "os": "android-12",
    "device": "pixel-5",
    "resources": {
      "cpu": 2,
      "memory": "4GB",
      "storage": "10GB"
    }
  },
  "duration": "1h"
}
```

**Response:**
```json
{
  "environment_id": "env-12345",
  "status": "provisioning",
  "connection": {
    "host": "emulator.ai-emulators.dev",
    "port": 5555,
    "adb_port": 5037
  },
  "expires_at": "2025-01-01T12:00:00Z"
}
```

## WebSocket Endpoints

### Real-time Agent Communication

**WebSocket URL:** `wss://api.ai-emulators.dev/v1/ws/agents`

**Connection Protocol:**
```javascript
const ws = new WebSocket('wss://api.ai-emulators.dev/v1/ws/agents');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

**Message Types:**

#### Agent Task
```json
{
  "type": "agent_task",
  "task_id": "task-123",
  "agent": "bytebot-v1",
  "instruction": "Navigate to google.com and search for AI",
  "context": {
    "browser": "chrome",
    "viewport": "1920x1080"
  }
}
```

#### Agent Response
```json
{
  "type": "agent_response",
  "task_id": "task-123",
  "status": "completed",
  "result": {
    "actions": [
      {
        "type": "navigate",
        "url": "https://google.com"
      },
      {
        "type": "type",
        "selector": "input[name='q']",
        "text": "AI"
      }
    ],
    "screenshots": ["base64-image-1", "base64-image-2"]
  }
}
```

## MCP Protocol Integration

### MCP Server Connection

**Endpoint:** `/mcp/connect`

The ecosystem implements the Model Context Protocol for standardized AI agent communication.

```typescript
import { MCPClient } from '@ai-emulators/mcp-client';

const client = new MCPClient({
  serverUrl: 'wss://api.ai-emulators.dev/mcp',
  apiKey: 'your-api-key'
});

await client.connect();
const tools = await client.listTools();
```

### Available MCP Tools

- **desktop_automation**: UI interaction and control
- **web_scraping**: Data extraction from websites
- **file_operations**: File system manipulation
- **system_monitoring**: OS and application monitoring
- **network_requests**: HTTP client functionality

## Error Handling

All API responses include error information in a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "instruction",
      "reason": "Required field missing"
    }
  }
}
```

### Common Error Codes

- `AUTHENTICATION_ERROR`: Invalid or missing credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request parameters
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server-side error

## Rate Limiting

API requests are subject to rate limiting based on your plan:

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 10,000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## SDKs and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @ai-emulators/sdk
```

```typescript
import { AIEmulators } from '@ai-emulators/sdk';

const client = new AIEmulators({
  apiKey: 'your-api-key'
});

const result = await client.automate.desktop({
  instruction: 'Open calculator and compute 2+2',
  platform: 'macos'
});
```

### Python SDK

```bash
pip install ai-emulators
```

```python
from ai_emulators import AIEmulators

client = AIEmulators(api_key='your-api-key')

result = client.automate.desktop(
    instruction='Open calculator and compute 2+2',
    platform='macos'
)
```

## Versioning

API versions follow semantic versioning:
- **v1**: Current stable version
- Breaking changes will result in new major versions
- Deprecation notices provided 6 months before removal

## Support

- **API Status**: https://status.ai-emulators.dev
- **Documentation**: https://docs.ai-emulators.dev
- **Support**: support@ai-emulators.dev