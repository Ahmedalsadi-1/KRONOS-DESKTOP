# Project Analysis: Agent Orchestrator

## Overview
**agent-orchestrator** is a lightweight Node.js microservice that serves as a meta-agent API for summarizing and orchestrating multiple automation projects within the KRONOS-DESKTOP ecosystem. It provides centralized discovery, status monitoring, and capability overlap analysis across all automation agents.

## Key Components
- **index.js**: Main Express.js application with REST API endpoints
- **Dockerfile**: Alpine-based containerization for minimal footprint
- **agent.md**: Comprehensive manifest file with project inventory

## Dependencies
**Runtime Dependencies:**
- `express`: Web framework for REST API
- `cors`: Cross-origin resource sharing
- `helmet`: Security middleware
- `compression`: Response compression

## Core Features & Workflows
1. **Service Discovery**: Dynamic inventory parsing from manifest files
2. **Health Monitoring**: Status endpoints for all registered services
3. **Capability Analysis**: Overlap detection between automation platforms
4. **API Orchestration**: Unified interface for heterogeneous agent ecosystem
5. **Manifest Management**: Dynamic content generation from markdown sources

## API Endpoints
- `GET /`: Service health check
- `GET /inventory`: Parsed project inventory from manifest
- `GET /overlaps`: Capability overlap analysis
- `GET /manifest`: Raw manifest file access
- `GET /status`: Comprehensive service status with known services

## Docker Configuration
- **Base Image**: `node:20-alpine` for minimal size
- **Single Stage Build**: Optimized for fast startup
- **Port Exposure**: 8080 for external access
- **Read-Only Mounts**: Manifest files mounted as read-only volumes

## Integration Points
- **Docker Compose**: Core service in automation stack
- **Health Checks**: Automated monitoring in container orchestration
- **Service Dependencies**: Manages relationships between automation agents
- **CI/CD Integration**: GitHub Actions smoke testing validation</content>
<parameter name="filePath">agent-orchestrator/PROJECT_ANALYSIS.md