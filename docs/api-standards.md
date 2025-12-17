# API Standards and Conventions

This document defines the unified API standards across all Bytebot services, ensuring consistency, maintainability, and developer experience.

## Table of Contents

1. [REST API Conventions](#rest-api-conventions)
2. [WebSocket Standards](#websocket-standards)
3. [GraphQL Guidelines](#graphql-guidelines)
4. [Authentication & Authorization](#authentication--authorization)
5. [Error Handling](#error-handling)
6. [Versioning](#versioning)
7. [Documentation](#documentation)

## REST API Conventions

### Base URL Structure
```
https://api.bytebot.ai/{service}/{version}/{resource}
```

Examples:
- `https://api.bytebot.ai/agent/v1/tasks`
- `https://api.bytebot.ai/ui/v2/sessions`
- `https://api.bytebot.ai/auth/v1/users`

### HTTP Methods
- `GET` - Retrieve resources
- `POST` - Create new resources
- `PUT` - Update entire resource
- `PATCH` - Partial resource updates
- `DELETE` - Remove resources

### Resource Naming
- Use plural nouns for collections: `/users`, `/tasks`, `/sessions`
- Use kebab-case for multi-word resources: `/computer-actions`, `/message-contents`
- Nested resources: `/users/{userId}/tasks`

### Query Parameters
- Pagination: `?page=1&limit=20`
- Filtering: `?status=active&created_after=2024-01-01`
- Sorting: `?sort=created_at&order=desc`
- Fields: `?fields=id,name,email`

### Response Format
```json
{
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no response body
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

## WebSocket Standards

### Connection URL
```
wss://api.bytebot.ai/{service}/ws
```

### Message Format
```json
{
  "type": "event_name",
  "payload": { ... },
  "timestamp": "2024-01-01T12:00:00Z",
  "correlationId": "uuid"
}
```

### Event Types
- `session.started` - Session initialization
- `session.ended` - Session termination
- `task.created` - New task created
- `task.updated` - Task status changed
- `computer.action` - Computer control action
- `message.received` - New message
- `error.occurred` - Error notification

### Connection Management
- Heartbeat: Ping every 30 seconds
- Reconnection: Exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Authentication: JWT token in connection headers

## GraphQL Guidelines

### Schema Design
- Use Relay-style connections for pagination
- Implement proper type relationships
- Define clear input/output types

### Query Structure
```graphql
query GetUserTasks($userId: ID!, $first: Int, $after: String) {
  user(id: $userId) {
    tasks(first: $first, after: $after) {
      edges {
        node {
          id
          title
          status
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

### Mutation Structure
```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    task {
      id
      title
      status
    }
    errors {
      field
      message
    }
  }
}
```

## Authentication & Authorization

### Token Format
- JWT tokens with RS256 signing
- Access tokens: 15 minutes expiration
- Refresh tokens: 7 days expiration

### Scopes
- `read:tasks` - Read task data
- `write:tasks` - Create/update tasks
- `admin:users` - User management
- `computer:control` - Computer control access

### API Key Authentication
For service-to-service communication:
```
Authorization: Bearer {service-api-key}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "reason": "must be a valid email address"
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req-12345"
  }
}
```

### Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Invalid credentials
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource conflict
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Versioning

### API Versioning
- URL path versioning: `/v1/resource`
- Header versioning: `Accept: application/vnd.bytebot.v1+json`
- Semantic versioning: Major.Minor.Patch

### Breaking Changes
- Major version bump required
- Deprecation warnings in minor versions
- 12-month support window for deprecated versions

## Documentation

### OpenAPI Specification
- All REST APIs must provide OpenAPI 3.0 specs
- Auto-generated from code annotations
- Published at `/docs/api/{service}/{version}`

### GraphQL Schema
- Introspection enabled in development
- Schema documentation auto-generated
- Published at `/docs/graphql/{service}`

### SDK Generation
- TypeScript client libraries
- Python SDK for automation
- Go SDK for backend services

## Implementation Guidelines

### Request/Response Middleware
```typescript
// Request logging
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  logger.info('Request started', { requestId, method: req.method, url: req.url });
  next();
});

// Response formatting
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    const response = {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    };
    return originalJson.call(this, response);
  };
  next();
});
```

### Validation
```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional()
});
```

### Testing
```typescript
describe('Tasks API', () => {
  it('should create task with valid input', async () => {
    const response = await request(app)
      .post('/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Task' })
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
  });
});
```</content>
<parameter name="filePath">docs/api-standards.md