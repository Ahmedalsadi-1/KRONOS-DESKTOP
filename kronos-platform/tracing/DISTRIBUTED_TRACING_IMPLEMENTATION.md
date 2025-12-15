# KRONOS Distributed Tracing Implementation

## Overview

This implementation provides comprehensive distributed tracing with Jaeger integration across all KRONOS platform services using OpenTelemetry protocol.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   KRONOS Distributed Tracing              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   Jaeger     │    │ OpenTelemetry │    │ Services    │ │
│  │   Collector   │    │ Collector      │    │ (Gateway,  │ │
│  │              │    │              │    │ Orchestration, │ │
│  └─────────────┘    └──────────────┘    │ Automation)  │ │
│        ▲               ▲                 │    │             │ │
│        │               │                 │    │             │ │
│   Traces & Metrics   Spans & Context    │    Propagation   │ │
└─────────────────────────────────────────────────────────┘
```

## Features

### 1. OpenTelemetry Collector
- Multi-protocol receivers (OTLP gRPC/HTTP, Jaeger, Prometheus)
- Intelligent sampling strategies based on service characteristics
- Resource detection and attribute enrichment
- Performance monitoring with memory limiter

### 2. Service Instrumentation
- Automatic trace context propagation
- Distributed correlation IDs across service boundaries
- Performance baselines and anomaly detection
- Service health monitoring via traces

### 3. MCP Integration
- Real-time trace analysis and correlation
- Performance metrics calculation
- Sampling optimization recommendations
- Comprehensive trace reporting

### 4. Jaeger Integration
- Direct Jaeger protocol support
- Fallback HTTP export
- Distributed context visualization
- Service dependency mapping

## Implementation Status

✅ **Completed Components:**
- OpenTelemetry Collector configuration
- Tracing MCP server with comprehensive analysis tools
- Docker compose setup for tracing stack
- Service integration templates

🔄 **In Progress:**
- Service instrumentation implementation
- Context propagation middleware
- Performance monitoring integration

## Usage

### Starting Tracing Stack
```bash
cd kronos-platform/tracing
docker-compose -f docker-compose.tracing.yml up
```

### Using MCP Tracing Tools
```bash
python tracing-mcp-server.py
```

### Instrumenting Services
Each service includes OpenTelemetry instrumentation with:
- Automatic trace creation
- Context propagation headers
- Performance metrics
- Error tracking
- Sampling configuration

## Sampling Strategies

### Service-Specific Sampling
- **API Gateway**: 10% sampling (high traffic)
- **Orchestration Engine**: 5% sampling (critical path)
- **Browser Automation**: 20% sampling (user operations)
- **UI Automation**: 15% sampling (expensive operations)
- **Desktop Agent**: 25% sampling (system operations)

### Adaptive Sampling
- Error-based: Increase sampling during high error rates
- Latency-based: Adjust based on response times
- Throughput-based: Scale with traffic volume

## Trace Correlation

### Distributed Context
- **trace-id**: Root trace identifier
- **correlation-id**: Business process identifier
- **span-id**: Individual operation identifier
- **baggage**: Cross-service metadata propagation

### Service Discovery Integration
- Automatic service registration with tracing metadata
- Health status monitoring via trace analysis
- Dependency mapping from trace data
- Performance baseline enforcement

## Performance Monitoring

### Metrics Collection
- Request duration (P50, P95, P99)
- Error rates and types
- Throughput patterns
- Service dependency latency
- Resource utilization

### Anomaly Detection
- Performance deviation from baselines
- Error pattern analysis
- Throughput anomalies
- Service health degradation

## Integration Points

### API Gateway Integration
```javascript
// Trace middleware
app.use(otelMiddleware({
  serviceName: 'kronos-api-gateway',
  serviceVersion: '1.0.0',
  samplingRate: 0.1
}));
```

### Service Integration
```javascript
// Context propagation
const headers = {
  'x-trace-id': span.traceId,
  'x-span-id': span.spanId,
  'x-correlation-id': correlationId,
  'x-service-name': serviceName
};
```

## Benefits

### Observability
- End-to-end request tracing
- Service performance insights
- Error root cause analysis
- Dependency visualization

### Performance Optimization
- Sampling strategy optimization
- Resource usage monitoring
- Bottleneck identification

### Debugging
- Distributed context following
- Service interaction mapping
- Timeline reconstruction

## Next Steps

1. Deploy tracing stack with Docker Compose
2. Enable MCP server for trace analysis
3. Configure sampling strategies per service
4. Set up Jaeger UI for visualization
5. Integrate with monitoring dashboards

## Configuration

### Environment Variables
```bash
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14250
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_TRACES_SAMPLER=parentbased_root
OTEL_RESOURCE_ATTRIBUTES=service.name=kronos,service.namespace=platform
OTEL_BSP_SCHEDULE=always_on
```

### Service Registration
Services automatically register with tracing metadata on startup, providing:
- Service capabilities and dependencies
- Performance baselines
- Health check endpoints
- Version information

This comprehensive distributed tracing implementation provides complete observability across the KRONOS platform with intelligent sampling, correlation, and performance monitoring capabilities.