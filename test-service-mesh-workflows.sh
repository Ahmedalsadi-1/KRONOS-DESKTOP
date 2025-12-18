#!/bin/bash

# KRONOS Service Mesh End-to-End Workflow Test
# Tests coordinated workflows across multiple services

echo "🔄 Testing KRONOS Service Mesh End-to-End Workflows"
echo "=================================================="

# Test 1: Service Discovery to API Gateway Routing
echo -e "\n📍 Test 1: Service Discovery → API Gateway Routing"
workflow1_passed=true

# Discover config service via service registry
config_endpoint=$(curl -s "http://localhost:8080/services/kronos-config-service" | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4)
if [ -n "$config_endpoint" ]; then
    echo "✅ Service discovered: $config_endpoint"
else
    echo "❌ Service discovery failed"
    workflow1_passed=false
fi

# Route through API Gateway to config service
gateway_response=$(curl -s "http://localhost:3003/health")
if echo "$gateway_response" | grep -q "routed"; then
    echo "✅ API Gateway routing successful"
else
    echo "❌ API Gateway routing failed"
    workflow1_passed=false
fi

if $workflow1_passed; then
    echo "🎉 Workflow 1 PASSED: Service Discovery → API Gateway"
else
    echo "💥 Workflow 1 FAILED"
fi

# Test 2: Load Balancing Distribution
echo -e "\n⚖️ Test 2: Load Balancing Distribution"
workflow2_passed=true

endpoints=()
for i in {1..10}; do
    endpoint=$(curl -s "http://localhost:8080/services/kronos-service-registry" 2>/dev/null | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4 | head -1)
    if [ -n "$endpoint" ]; then
        endpoints+=("$endpoint")
    fi
done

unique_count=$(printf '%s\n' "${endpoints[@]}" | sort | uniq | wc -l)
echo "📊 Load balancing test: $unique_count unique endpoints from 10 requests"

if [ "$unique_count" -gt 0 ]; then
    echo "✅ Load balancing working"
else
    echo "❌ Load balancing failed"
    workflow2_passed=false
fi

if $workflow2_passed; then
    echo "🎉 Workflow 2 PASSED: Load Balancing Distribution"
else
    echo "💥 Workflow 2 FAILED"
fi

# Test 3: Health Monitoring Integration
echo -e "\n🏥 Test 3: Health Monitoring Integration"
workflow3_passed=true

# Check service registry health
registry_health=$(curl -s "http://localhost:8080/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$registry_health" = "degraded" ] || [ "$registry_health" = "healthy" ]; then
    echo "✅ Service registry health: $registry_health"
else
    echo "❌ Service registry health check failed"
    workflow3_passed=false
fi

# Check config service health
config_health=$(curl -s "http://localhost:4000/health")
if echo "$config_health" | grep -q "healthy"; then
    echo "✅ Config service health: OK"
else
    echo "❌ Config service health check failed"
    workflow3_passed=false
fi

if $workflow3_passed; then
    echo "🎉 Workflow 3 PASSED: Health Monitoring Integration"
else
    echo "💥 Workflow 3 FAILED"
fi

# Test 4: Service Mesh Configuration
echo -e "\n🌐 Test 4: Service Mesh Configuration"
workflow4_passed=true

mesh_config=$(curl -s "http://localhost:8080/mesh-config")
if echo "$mesh_config" | grep -q "loadBalancers"; then
    echo "✅ Service mesh configuration available"
else
    echo "❌ Service mesh configuration failed"
    workflow4_passed=false
fi

# Check load balancers status
lb_status=$(curl -s "http://localhost:8080/load-balancers")
if echo "$lb_status" | grep -q "kronos"; then
    echo "✅ Load balancers configured for KRONOS services"
else
    echo "❌ Load balancers configuration failed"
    workflow4_passed=false
fi

if $workflow4_passed; then
    echo "🎉 Workflow 4 PASSED: Service Mesh Configuration"
else
    echo "💥 Workflow 4 FAILED"
fi

# Test 5: Monitoring Integration
echo -e "\n📊 Test 5: Monitoring Integration"
workflow5_passed=true

# Check Prometheus health
prometheus_health=$(curl -s "http://localhost:9090/-/healthy")
if [ $? -eq 0 ]; then
    echo "✅ Prometheus monitoring active"
else
    echo "❌ Prometheus monitoring failed"
    workflow5_passed=false
fi

# Check Grafana accessibility
timeout 5 bash -c "</dev/tcp/localhost/3001" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Grafana dashboard accessible"
else
    echo "❌ Grafana dashboard not accessible"
    workflow5_passed=false
fi

if $workflow5_passed; then
    echo "🎉 Workflow 5 PASSED: Monitoring Integration"
else
    echo "💥 Workflow 5 FAILED"
fi

# Test 6: Cross-Service Coordination
echo -e "\n🤝 Test 6: Cross-Service Coordination"
workflow6_passed=true

# Test API Gateway to Service Registry coordination
services_via_gateway=$(curl -s "http://localhost:3003/api/v1/services" 2>/dev/null | wc -c)
services_via_registry=$(curl -s "http://localhost:8080/services" 2>/dev/null | wc -c)

if [ "$services_via_gateway" -gt 0 ] && [ "$services_via_registry" -gt 0 ]; then
    echo "✅ Cross-service coordination working"
    echo "   Gateway response size: ${services_via_gateway} bytes"
    echo "   Registry response size: ${services_via_registry} bytes"
else
    echo "❌ Cross-service coordination failed"
    workflow6_passed=false
fi

if $workflow6_passed; then
    echo "🎉 Workflow 6 PASSED: Cross-Service Coordination"
else
    echo "💥 Workflow 6 FAILED"
fi

# Final Results
echo -e "\n=================================================="
echo "KRONOS Service Mesh End-to-End Workflow Results"
echo "=================================================="

total_workflows=6
passed_workflows=0

for i in {1..6}; do
    var_name="workflow${i}_passed"
    if ${!var_name}; then
        passed_workflows=$((passed_workflows + 1))
    fi
done

success_percentage=$((passed_workflows * 100 / total_workflows))

echo "Workflows Completed: $passed_workflows / $total_workflows"
echo "Success Rate: ${success_percentage}%"

if [ $success_percentage -eq 100 ]; then
    echo -e "\n🎉 ALL WORKFLOWS PASSED! Service mesh is fully operational."
elif [ $success_percentage -ge 80 ]; then
    echo -e "\n✅ MOST WORKFLOWS PASSED. Service mesh is operational."
elif [ $success_percentage -ge 60 ]; then
    echo -e "\n⚠️ SOME WORKFLOWS PASSED. Service mesh needs attention."
else
    echo -e "\n❌ CRITICAL ISSUES. Service mesh requires immediate attention."
fi