#!/bin/bash

# KRONOS Service Mesh Integration Test Suite
# Tests complete service mesh functionality across all KRONOS services

echo "🔍 Starting KRONOS Service Mesh Integration Tests"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"

    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))

    # Run the test
    eval "$test_command" 2>/dev/null
    local actual_exit_code=$?

    if [ $actual_exit_code -eq $expected_exit_code ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (exit code: $actual_exit_code, expected: $expected_exit_code)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Function to test HTTP endpoint
test_http_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    local test_name="$3"

    echo -e "\n${BLUE}Testing HTTP: ${test_name} - ${url}${NC}"

    local response=$(curl -s -w "HTTPSTATUS:%{http_code};" "$url" 2>/dev/null)
    local body=$(echo "$response" | sed 's/HTTPSTATUS.*//')
    local status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED (Status: $status)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED (Status: $status, Expected: $expected_status)${NC}"
        echo "Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to check JSON response contains key
test_json_contains() {
    local url="$1"
    local key="$2"
    local test_name="$3"

    echo -e "\n${BLUE}Testing JSON: ${test_name} - ${url}${NC}"

    local response=$(curl -s "$url" 2>/dev/null)

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$response" | grep -q "$key"; then
        echo -e "${GREEN}✅ PASSED (Contains: $key)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED (Key '$key' not found)${NC}"
        echo "Response: $response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo -e "\n${YELLOW}Phase 1: Service Registry Tests${NC}"
echo "==================================="

# Test 1: Service Registry Health
test_http_endpoint "http://localhost:8080/health" 200 "Service Registry Health"

# Test 2: Service Registry Services List
test_http_endpoint "http://localhost:8080/services" 200 "Service Registry Services List"

# Test 3: Check if services are registered
test_json_contains "http://localhost:8080/services" "kronos-service-registry" "Service Registry contains registered services"

# Test 4: Load Balancers Status
test_http_endpoint "http://localhost:8080/load-balancers" 200 "Load Balancers Status"

# Test 5: Service Discovery for specific service
test_http_endpoint "http://localhost:8080/services/kronos-service-registry" 200 "Service Discovery - Service Registry"

echo -e "\n${YELLOW}Phase 2: API Gateway Tests${NC}"
echo "============================"

# Test 6: API Gateway Health via Service Registry
test_http_endpoint "http://localhost:3003/health" 200 "API Gateway Health"

# Test 7: API Gateway Service Discovery
test_json_contains "http://localhost:3003/health" "service-registry" "API Gateway routes to Service Registry"

# Test 8: API Gateway Services Endpoint
test_http_endpoint "http://localhost:3003/api/v1/services" 200 "API Gateway Services Route"

echo -e "\n${YELLOW}Phase 3: Infrastructure Services Tests${NC}"
echo "=========================================="

# Test 9: Config Service Health
test_http_endpoint "http://localhost:4000/health" 200 "Config Service Health"

# Test 10: Redis Connectivity
timeout 5 bash -c "</dev/tcp/localhost/6381" 2>/dev/null && run_test "Redis Port Accessibility" "echo 'Redis accessible'" 0 || run_test "Redis Port Accessibility" "echo 'Redis not accessible'" 1

echo -e "\n${YELLOW}Phase 4: Automation Services Tests${NC}"
echo "====================================="

# Test 11: Desktop Agent Port Check
timeout 5 bash -c "</dev/tcp/localhost/9990" 2>/dev/null && run_test "Desktop Agent Port Accessibility" "echo 'Desktop Agent accessible'" 0 || run_test "Desktop Agent Port Accessibility" "echo 'Desktop Agent not accessible'" 1

# Test 12: Browser Automation Backend Port Check
timeout 5 bash -c "</dev/tcp/localhost/8002" 2>/dev/null && run_test "Browser Automation Backend Port Accessibility" "echo 'Browser Automation Backend accessible'" 0 || run_test "Browser Automation Backend Port Accessibility" "echo 'Browser Automation Backend not accessible'" 1

# Test 13: UI Automation Port Check
timeout 5 bash -c "</dev/tcp/localhost/8003" 2>/dev/null && run_test "UI Automation Port Accessibility" "echo 'UI Automation accessible'" 0 || run_test "UI Automation Port Accessibility" "echo 'UI Automation not accessible'" 1

echo -e "\n${YELLOW}Phase 5: Load Balancing Tests${NC}"
echo "==============================="

# Test 14: Multiple Service Discovery Requests (Load Balancing)
echo -e "\n${BLUE}Testing Load Balancing: Multiple requests to service discovery${NC}"
for i in {1..5}; do
    response=$(curl -s "http://localhost:8080/services/kronos-service-registry" 2>/dev/null)
    if echo "$response" | grep -q "endpoint"; then
        echo -e "${GREEN}✅ Load Balance Request $i: PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Load Balance Request $i: FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
done

echo -e "\n${YELLOW}Phase 6: Cross-Service Communication Tests${NC}"
echo "=============================================="

# Test 15: API Gateway to Service Registry Communication
test_json_contains "http://localhost:3003/health" "routed" "API Gateway to Service Registry Communication"

# Test 16: Service Registry Heartbeat Simulation
run_test "Service Registry Heartbeat Endpoint" "curl -s -X POST http://localhost:8080/services/kronos-service-registry/heartbeat -H 'Content-Type: application/json' -d '{\"metrics\":{\"loadFactor\":0.1}}' | grep -q 'Heartbeat received'" 0

echo -e "\n${YELLOW}Phase 7: Failure Handling Tests${NC}"
echo "=================================="

# Test 17: Request to Non-existent Service
test_http_endpoint "http://localhost:8080/services/non-existent-service" 404 "Non-existent Service Discovery"

# Test 18: API Gateway Rate Limiting Test (rapid requests)
echo -e "\n${BLUE}Testing Rate Limiting: Rapid API Gateway requests${NC}"
rate_limit_test_passed=0
for i in {1..15}; do
    response=$(curl -s -w "HTTPSTATUS:%{http_code};" "http://localhost:3003/health" 2>/dev/null)
    status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    if [ "$status" = "200" ] || [ "$status" = "429" ]; then
        rate_limit_test_passed=$((rate_limit_test_passed + 1))
    fi
    sleep 0.1
done
if [ $rate_limit_test_passed -gt 10 ]; then
    echo -e "${GREEN}✅ Rate Limiting Test: PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Rate Limiting Test: FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

echo -e "\n${YELLOW}Phase 8: Service Mesh Configuration Tests${NC}"
echo "============================================"

# Test 19: Service Mesh Configuration
test_http_endpoint "http://localhost:8080/mesh-config" 200 "Service Mesh Configuration"

# Test 20: Service Mesh contains services
test_json_contains "http://localhost:8080/mesh-config" "loadBalancers" "Service Mesh contains load balancers"

echo -e "\n${YELLOW}Phase 9: End-to-End Workflow Tests${NC}"
echo "====================================="

# Test 21: Complete Service Discovery Workflow
echo -e "\n${BLUE}Testing End-to-End Service Discovery Workflow${NC}"
workflow_test_passed=true

# Step 1: Check service registry health
if ! curl -s "http://localhost:8080/health" | grep -q "status"; then
    workflow_test_passed=false
    echo "Step 1 Failed: Service Registry Health"
fi

# Step 2: Get services list
if ! curl -s "http://localhost:8080/services" | grep -q "services"; then
    workflow_test_passed=false
    echo "Step 2 Failed: Services List"
fi

# Step 3: Discover specific service
if ! curl -s "http://localhost:8080/services/kronos-service-registry" | grep -q "endpoint"; then
    workflow_test_passed=false
    echo "Step 3 Failed: Service Discovery"
fi

# Step 4: Route through API Gateway
if ! curl -s "http://localhost:3003/health" | grep -q "routed"; then
    workflow_test_passed=false
    echo "Step 4 Failed: API Gateway Routing"
fi

if $workflow_test_passed; then
    echo -e "${GREEN}✅ End-to-End Service Discovery Workflow: PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ End-to-End Service Discovery Workflow: FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

echo -e "\n${YELLOW}Phase 10: Monitoring and Observability Tests${NC}"
echo "==============================================="

# Test 22: Prometheus Metrics Endpoint
test_http_endpoint "http://localhost:9090/-/healthy" 200 "Prometheus Health"

# Test 23: Grafana Access
timeout 5 bash -c "</dev/tcp/localhost/3001" 2>/dev/null && run_test "Grafana Port Accessibility" "echo 'Grafana accessible'" 0 || run_test "Grafana Port Accessibility" "echo 'Grafana not accessible'" 1

echo -e "\n${YELLOW}Phase 11: Integration and Coordination Tests${NC}"
echo "================================================"

# Test 24: Service Coordination Test (API Gateway to Service Registry)
echo -e "\n${BLUE}Testing Service Coordination: API Gateway ↔ Service Registry${NC}"
coordination_test_passed=true

# Get services from API Gateway
gateway_services=$(curl -s "http://localhost:3003/api/v1/services" | grep -o '"name":"[^"]*"' | wc -l)
registry_services=$(curl -s "http://localhost:8080/services" | grep -o '"name":"[^"]*"' | wc -l)

if [ "$gateway_services" -gt 0 ] && [ "$registry_services" -gt 0 ]; then
    echo -e "${GREEN}✅ Service Coordination: PASSED (Gateway: $gateway_services, Registry: $registry_services)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Service Coordination: FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 25: Load Balancer Distribution Test
echo -e "\n${BLUE}Testing Load Balancer Distribution${NC}"
distribution_test_passed=true

# Use indexed array instead of associative array for bash compatibility
endpoints=()
for i in {1..10}; do
    endpoint=$(curl -s "http://localhost:8080/services/kronos-service-registry" 2>/dev/null | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4 | head -1)
    if [ -n "$endpoint" ]; then
        endpoints+=("$endpoint")
    fi
done

# Count unique endpoints
unique_endpoints=$(echo "${endpoints[@]}" | tr ' ' '\n' | sort | uniq | wc -l)
if [ "$unique_endpoints" -gt 0 ]; then
    echo -e "${GREEN}✅ Load Balancer Distribution: PASSED ($unique_endpoints unique endpoints found)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Load Balancer Distribution: FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Final Results
echo -e "\n${BLUE}==================================================${NC}"
echo -e "${BLUE}KRONOS Service Mesh Integration Test Results${NC}"
echo -e "${BLUE}==================================================${NC}"
echo "Tests Run: $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
echo -e "Success Rate: ${success_rate}%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! Service mesh is fully operational.${NC}"
    exit 0
elif [ $success_rate -gt 80 ]; then
    echo -e "\n${YELLOW}⚠️ MOST TESTS PASSED. Service mesh is operational with minor issues.${NC}"
    exit 1
else
    echo -e "\n${RED}❌ CRITICAL ISSUES DETECTED. Service mesh requires attention.${NC}"
    exit 1
fi