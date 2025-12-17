# Unified API Gateway Specification

## Overview
The Unified API Gateway serves as the single entry point for all automation services, providing standardized authentication, routing, and monitoring capabilities.

## Core Endpoints

### Task Management
```typescript
// POST /api/v1/tasks
interface CreateTaskRequest {
  type: 'desktop_automation' | 'social_media' | 'content_processing' | 'workflow';
  tool?: string; // Specific tool preference
  payload: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  timeout?: number; // seconds
}

// GET /api/v1/tasks/{taskId}
interface TaskStatusResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  environmentId?: string;
}
```

### Agent Management
```typescript
// GET /api/v1/agents
interface ListAgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    type: string;
    capabilities: string[];
    status: 'available' | 'busy' | 'offline';
    lastSeen: string;
  }>;
}

// GET /api/v1/agents/{agentId}/capabilities
interface AgentCapabilitiesResponse {
  browserAutomation: boolean;
  desktopControl: boolean;
  terminalAccess: boolean;
  fileOperations: boolean;
  apiIntegration: boolean;
  supportedPlatforms: string[];
}
```

### Environment Management
```typescript
// POST /api/v1/environments
interface ProvisionEnvironmentRequest {
  type: 'desktop' | 'mobile' | 'browser';
  platform?: 'linux' | 'windows' | 'macos' | 'android';
  duration?: number; // minutes, auto-cleanup
  config?: Record<string, any>;
}

// GET /api/v1/environments/{envId}/status
interface EnvironmentStatusResponse {
  id: string;
  status: 'provisioning' | 'ready' | 'failed' | 'terminated';
  connectionDetails?: {
    host: string;
    port: number;
    protocol: 'vnc' | 'rdp' | 'adb';
  };
  expiresAt?: string;
}
```

## WebSocket Events

### Real-time Updates
```typescript
interface WebSocketEvent {
  type: string;
  payload: any;
  timestamp: string;
}

// Task progress updates
{
  type: 'task_progress',
  payload: {
    taskId: string;
    progress: number;
    message?: string;
    screenshot?: string; // base64
  }
}

// Agent status changes
{
  type: 'agent_status',
  payload: {
    agentId: string;
    status: 'available' | 'busy' | 'offline';
    currentTaskId?: string;
  }
}

// Environment lifecycle
{
  type: 'environment_event',
  payload: {
    environmentId: string;
    event: 'provisioned' | 'ready' | 'failed' | 'terminated';
    details?: any;
  }
}
```</content>
<parameter name="filePath">docs/api-gateway-spec.md