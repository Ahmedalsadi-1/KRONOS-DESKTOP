#!/bin/bash

# KRONOS Distributed Tracing Deployment Script
# Sets up complete distributed tracing infrastructure with Jaeger and OpenTelemetry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting KRONOS Distributed Tracing Deployment${NC}"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if required directories exist
if [ ! -d "kronos-platform/tracing" ]; then
    echo -e "${RED}❌ Tracing directory not found${NC}"
    exit 1
fi

if [ ! -d "kronos-platform/monitoring" ]; then
    echo -e "${RED}❌ Monitoring directory not found${NC}"
    exit 1
fi

# Create required directories
mkdir -p kronos-platform/tracing/config
mkdir -p kronos-platform/tracing/logs

# Create OpenTelemetry collector configuration
echo -e "${BLUE}📝 Creating OpenTelemetry collector configuration...${NC}"
cat > kronos-platform/tracing/config/otel-collector-config.yml << 'EOF'
receivers:
  # OTLP gRPC receiver for high-throughput trace collection
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
    attributes:
      - key: environment
        value: production
        action: upsert
      - key: service_cluster
        value: kronos-platform
        action: upsert

  # OTLP HTTP receiver for fallback and compatibility
  otlp/http:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
    attributes:
      - key: environment
        value: production
        action: upsert
      - key: service_cluster
        value: kronos-platform
        action: upsert

  # Jaeger receiver for direct Jaeger protocol support
  jaeger:
    protocols:
      grpc:
        endpoint: jaeger:14250
    tls:
      insecure: true

  # Prometheus receiver for metrics collection
  prometheus:
    config:
      scrape_configs:
        - job_name: 'kronos-otel-collector'
          scrape_interval: 15s
          static_configs:
            - targets: ['0.0.0.0:8888']
          metric_relabel_configs:
            - source_labels: [__name__]
              target_label: metric_name
              regex: 'otel_(.*)'
              replacement: '$1'

processors:
  # Batch processor for performance optimization
  batch:
    timeout: 1s
    send_batch_size: 8192
    send_batch_max_size: 8192

  # Memory limiter for resource management
  memory_limiter:
    check_interval: 1s
    limit_mib: 512

  # Resource processor for adding service metadata
  resource:
    attributes:
      - key: service.name
        from_attributes: ["service.name"]
      - key: service.version
        from_attributes: ["service.version"]
      - key: service.instance.id
        from_attributes: ["host.name"]
      - key: cloud.provider
        from_attributes: ["cloud.provider"]
      - key: cloud.region
        from_attributes: ["cloud.region"]
      - key: deployment.environment
        from_attributes: ["deployment.environment"]

  # Resource detection for KRONOS services
  resourcedetection:
    detectors:
      - env
      - system
      - docker
    timeout: 2s

  # Attributes processor for custom KRONOS trace enrichment
  attributes:
    actions:
      - key: service.namespace
        value: kronos
        action: upsert
      - key: platform.version
        value: 1.0.0
        action: upsert
      - key: tracing.sampling.rate
        value: 0.1
        action: upsert

exporters:
  # Jaeger exporter for distributed trace storage
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
    sending_queue:
      enabled: true
      num_consumers: 10
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s

  # OTLP HTTP exporter for redundancy
  otlphttp:
    endpoint: http://jaeger:14250/api/traces
    tls:
      insecure: true
    headers:
      - "Content-Type: application/json"

  # Prometheus exporter for metrics
  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: kronos
    const_labels:
      environment: production
      platform: kronos

extensions:
  # Health check extension for monitoring collector status
  health_check:
    endpoint: 0.0.0.0:13133
    port: 13133

  # ZPages for web-based debugging and monitoring
  zpages:
    endpoint: 0.0.0.0:55679

  # Performance monitoring extension
  memory_ballast:
    enabled: true
    limit_mib: 256

service:
  # Pipelines for different data types
  pipelines:
    # High-performance traces pipeline
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource, resourcedetection, attributes]
      exporters: [jaeger, otlphttp]
    
    # Comprehensive metrics pipeline  
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch, resource, resourcedetection, attributes]
      exporters: [prometheus]
    
    # Logs pipeline with structured logging
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource, resourcedetection, attributes]
      exporters: [logging]
EOF

echo -e "${GREEN}✅ OpenTelemetry configuration created${NC}"

# Create enhanced Docker Compose configuration
echo -e "${BLUE}🐳 Creating enhanced Docker Compose configuration...${NC}"
cat > kronos-platform/docker/docker-compose.tracing.enhanced.yml << 'EOF'
version: '3.8'

services:
  # Jaeger - Distributed Trace Storage and Visualization
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: kronos-jaeger
    ports:
      - "16686:16686"
      - "16687:16687"
      - "14250:14250"
      - "4317:4317"
    environment:
      - COLLECTOR_OTLP_ENABLED: "true"
      - COLLECTOR_ZIPKIN_HOST_PORT: "9411"
      - SPAN_STORAGE_TYPE: "badger"
      - QUERY_TRACER_MAX_DURATION: "2h"
    volumes:
      - jaeger-data:/badger-db
      - ./config:/etc/jaeger
    networks:
      - kronos-network
    depends_on:
      - redis

  # OpenTelemetry Collector - High-Performance Trace Collection
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: kronos-otel-collector
    command: ["/etc/otel-collector-config.yml"]
    ports:
      - "4317:4317"
      - "4318:4318"
      - "8888:8888"
      - "8889:8889"
      - "13133:13133"
    environment:
      - OTEL_EXPORTER_JAEGER_ENDPOINT: "http://jaeger:14250"
      - OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
      - OTEL_TRACES_SAMPLER: "parentbased_root"
      - OTEL_RESOURCE_ATTRIBUTES: "service.name=kronos,service.namespace=platform,service.version=1.0.0"
      - OTEL_BSP_SCHEDULE: "always_on"
      - OTEL_METRICS_EXPORTER: "prometheus"
    volumes:
      - ./config:/etc/otel
      - ./data:/var/log/otel
    networks:
      - kronos-network
    depends_on:
      - redis

  # Prometheus - Metrics Collection and Storage
  prometheus:
    image: prom/prometheus:latest
    container_name: kronos-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    volumes:
      - prometheus-data:/prometheus
      - ./config:/etc/prometheus
    networks:
      - kronos-network
    depends_on:
      - otel-collector

  # Grafana - Visualization and Monitoring Dashboard
  grafana:
    image: grafana/grafana:latest
    container_name: kronos-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD: "admin"
      - GF_USERS_ALLOW_SIGN_UP: "false"
      - GF_INSTALL_PLUGINS: "grafana-piechart-panel,grafana-worldmap-panel,grafana-simple-json-datasource"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./config:/etc/grafana/provisioning
    networks:
      - kronos-network
    depends_on:
      - prometheus

  # Redis - Distributed Cache and Queue Backend
  redis:
    image: redis:7-alpine
    container_name: kronos-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./config:/usr/local/etc/redis
    networks:
      - kronos-network
    command:
      - redis-server --appendonly yes --protected-mode no

# Health Checks for All Services
  healthchecks:
    api-gateway:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--tries=2", "http://localhost:3000/health"]
      interval: 15s
      timeout: 10s
      retries: 3
      
    orchestration-engine:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--tries=2", "http://localhost:5001/health"]
      interval: 15s
      timeout: 10s
      retries: 3
      
    otel-collector:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--tries=2", "http://otel-collector:4318/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

# Restart Policy
  restart:
  unless-stopped

# Logging Configuration
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
EOF

echo -e "${GREEN}✅ Enhanced Docker Compose configuration created${NC}"

# Create environment file for tracing
echo -e "${BLUE}🔧 Setting up environment variables...${NC}"
cat > kronos-platform/tracing/.env << 'EOF'
# OpenTelemetry Configuration
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14250
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_TRACES_SAMPLER=parentbased_root
OTEL_RESOURCE_ATTRIBUTES=service.name=kronos,service.namespace=platform,service.version=1.0.0
OTEL_BSP_SCHEDULE=always_on
OTEL_METRICS_EXPORTER=prometheus

# Service Configuration
KRONOS_SERVICE_NAME=kronos-api-gateway
KRONOS_SERVICE_VERSION=1.0.0
KRONOS_SERVICE_INSTANCE_ID=api-gateway-$(hostname)
KRONOS_DEPLOYMENT_ENVIRONMENT=production
KRONOS_SERVICE_NAMESPACE=kronos
KRONOS_PLATFORM_VERSION=1.0.0

# Sampling Configuration
OTEL_TRACE_ID_RATIO=0.1
OTEL_TRACE_ID_RATIO=0.05
OTEL_TRACE_ID_RATIO=0.2
OTEL_TRACE_ID_RATIO=0.25
OTEL_TRACE_ID_RATIO=0.1
OTEL_TRACE_ID_RATIO=0.5
OTEL_TRACE_ID_RATIO=0.3

# Network Configuration
KRONOS_NETWORK=kronos-network
EOF

echo -e "${GREEN}✅ Environment configuration created${NC}"

# Start the tracing stack
echo -e "${BLUE}🚀 Starting distributed tracing infrastructure...${NC}"
docker-compose -f docker/docker-compose.tracing.enhanced.yml --env-file tracing/.env up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Check service health
echo -e "${BLUE}🔍 Checking service health...${NC}"
sleep 5

# Health check functions
check_service_health() {
    local service_name=$1
    local url=$2
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts for $service_name...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name health check failed${NC}"
    return 1
}

# Check all services
echo -e "${BLUE}📊 Checking API Gateway...${NC}"
check_service_health "API Gateway" "http://localhost:3000/health"

echo -e "${BLUE}⚙️  Checking Orchestration Engine...${NC}"
check_service_health "Orchestration Engine" "http://localhost:5001/health"

echo -e "${BLUE}🌐 Checking Service Registry...${NC}"
check_service_health "Service Registry" "http://localhost:8080/health"

echo -e "${BLUE}📊 Checking OpenTelemetry Collector...${NC}"
check_service_health "OpenTelemetry Collector" "http://otel-collector:4318/v1/health"

echo -e "${BLUE}📈 Checking Jaeger...${NC}"
check_service_health "Jaeger" "http://jaeger:16686"

# Display service URLs
echo -e "${GREEN}"
echo -e "${NC}"
echo -e "${BLUE}🔗 Service URLs:${NC}"
echo -e "${NC}  • Jaeger UI: http://localhost:16686${NC}"
echo -e "${NC}  • Grafana Dashboard: http://localhost:3000${NC}"
echo -e "${NC}  • API Gateway: http://localhost:3000${NC}"
echo -e "${NC}  • Orchestration Engine: http://localhost:5001${NC}"
echo -e "${NC}  • Service Registry: http://localhost:8080${NC}"
echo -e "${NC}  • OpenTelemetry Collector: http://otel-collector:4318${NC}"
echo -e "${NC}"
echo -e "${GREEN}🎉 Distributed tracing deployment complete!${NC}"
echo -e "${NC}"
echo -e "${BLUE}📋 Tracing Stack Components:${NC}"
echo -e "${NC}  • Jaeger Collector: Trace collection and visualization${NC}"
echo -e "${NC}  • OpenTelemetry Collector: High-performance trace processing${NC}"
echo -e "${NC}  • Prometheus: Metrics aggregation${NC}"
echo -e "${NC}  • Grafana: Observability dashboard${NC}"
echo -e "${NC}  • Redis: Distributed caching${NC}"
echo -e "${NC}  • Service Registry: Service discovery${NC}"
echo -e "${NC}"
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo -e "${NC} 1. Deploy tracing-enabled services:${NC}"
echo -e "${NC}    docker-compose -f docker-compose.tracing.enhanced.yml --env-file tracing/.env up -d${NC}"
echo -e "${NC} 2. Update service configurations to use enhanced versions${NC}"
echo -e "${NC} 3. Configure sampling strategies per service characteristics${NC}"
echo -e "${NC} 4. Set up monitoring dashboards${NC}"
echo -e "${NC} 5. Test distributed tracing with MCP server${NC}"
echo -e "${NC}    python tracing-mcp-server.py${NC}"
echo -e "${NC}"
echo -e "${GREEN}✨ Distributed tracing with Jaeger is ready for KRONOS platform!${NC}"