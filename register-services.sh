#!/bin/bash

# KRONOS Service Mesh Registration Script
# Registers services with correct Docker container endpoints

echo "🔧 Registering KRONOS services with correct Docker endpoints..."

SERVICE_REGISTRY_URL="http://localhost:8080"

# Function to register a service
register_service() {
    local name="$1"
    local type="$2"
    local endpoint="$3"
    local metadata="$4"

    echo "📝 Registering service: $name ($type) -> $endpoint"

    curl -s -X POST "$SERVICE_REGISTRY_URL/services" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"type\": \"$type\",
            \"endpoint\": \"$endpoint\",
            \"metadata\": $metadata,
            \"healthCheck\": {
                \"endpoint\": \"$endpoint/health\",
                \"interval\": 30000,
                \"timeout\": 5000
            }
        }" > /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Successfully registered: $name"
    else
        echo "❌ Failed to register: $name"
    fi
}

# Wait for service registry to be ready
echo "⏳ Waiting for service registry..."
for i in {1..30}; do
    if curl -s "$SERVICE_REGISTRY_URL/health" > /dev/null; then
        break
    fi
    sleep 2
done

# Clear existing services first
echo "🧹 Clearing existing service registrations..."
curl -s -X DELETE "$SERVICE_REGISTRY_URL/services/kronos-service-registry" > /dev/null 2>&1
curl -s -X DELETE "$SERVICE_REGISTRY_URL/services/kronos-api-gateway" > /dev/null 2>&1
curl -s -X DELETE "$SERVICE_REGISTRY_URL/services/kronos-config-service" > /dev/null 2>&1

# Register infrastructure services with Docker container names
register_service "kronos-service-registry" "infrastructure" "http://docker-kronos-service-registry-1:8080" "{\"core\": true, \"version\": \"1.0.0\"}"
register_service "kronos-api-gateway" "infrastructure" "http://docker-kronos-api-gateway-1:3000" "{\"core\": true, \"version\": \"1.0.0\"}"
register_service "kronos-config-service" "configuration" "http://docker-kronos-config-service-1:4000" "{\"core\": true, \"version\": \"1.0.0\"}"
register_service "kronos-redis" "cache" "redis://docker-kronos-redis-1:6379" "{\"version\": \"7.0\", \"type\": \"redis\"}"

# Register external services (running outside Docker)
register_service "kronos-desktop-agent" "desktop-automation" "http://localhost:9990" "{\"capabilities\": [\"desktop-control\", \"application-automation\", \"file-management\", \"ai-agent\", \"vnc-access\"], \"desktop\": \"ubuntu-xfce\", \"visionLanguage\": true, \"accessibility\": true, \"version\": \"1.0.0\"}"

register_service "kronos-browser-automation-backend" "automation-api" "http://localhost:8002" "{\"capabilities\": [\"chat-api\", \"vm-control\", \"screenshot-service\", \"billing\"], \"version\": \"1.0.0\"}"

register_service "kronos-ui-automation" "vision-automation" "http://localhost:8003" "{\"capabilities\": [\"vision-language\", \"gui-interaction\", \"screen-analysis\", \"action-prediction\", \"coordinate-mapping\"], \"model\": \"UI-TARS-1.5-7B\", \"device\": \"cpu\", \"benchmarks\": [\"OSWorld-42.5%\", \"ScreenSpot-V2-94.2%\", \"AndroidWorld-64.2%\"], \"version\": \"1.0.0\"}"

# Register workflow and AI services
register_service "kronos-workflow-studio" "workflow" "http://localhost:3002" "{\"version\": \"1.0.0\"}"
register_service "kronos-unified-ai" "ai" "http://localhost:3003" "{\"version\": \"1.0.0\"}"

echo "🔍 Checking service registrations..."
curl -s "$SERVICE_REGISTRY_URL/services" | jq '.summary'

echo "✅ Service registration complete!"
echo "🔄 Services will now communicate using Docker container names internally."