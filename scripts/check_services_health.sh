#!/bin/bash
# EKG Services Health Check Script
# Verifies all Docker services are running and healthy

set -e

echo "=========================================="
echo "EKG Services Health Check"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Services to check
SERVICES=(
    "ekg-graphdb:GraphDB:http://localhost:7200/rest/repositories"
    "ekg-postgres:PostgreSQL:tcp://localhost:5432"
    "ekg-keycloak:Keycloak:http://localhost:9001/health"
    "ekg-airflow-webserver:Airflow Webserver:http://localhost:8080/health"
    "ekg-airflow-scheduler:Airflow Scheduler:running"
    "ekg-api-gateway:API Gateway:http://localhost:3000/health"
    "ekg-prometheus:Prometheus:http://localhost:9090/-/healthy"
    "ekg-grafana:Grafana:http://localhost:3001/api/health"
    "ekg-neo4j:Neo4j:http://localhost:7474"
    "ekg-redis:Redis:tcp://localhost:6379"
    "ekg-pushgateway:Pushgateway:http://localhost:9091/-/healthy"
)

check_container_running() {
    local container=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        return 0
    else
        return 1
    fi
}

check_container_healthy() {
    local container=$1
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-health")

    if [ "$health" = "healthy" ]; then
        return 0
    elif [ "$health" = "no-health" ]; then
        # Container has no healthcheck, just check if running
        if check_container_running "$container"; then
            return 0
        fi
    fi
    return 1
}

check_http_endpoint() {
    local url=$1
    if command -v curl &> /dev/null; then
        curl -sf "$url" > /dev/null 2>&1
        return $?
    elif command -v wget &> /dev/null; then
        wget -q -O /dev/null "$url" 2>&1
        return $?
    else
        echo -e "${YELLOW}[SKIP]${NC} (no curl/wget available)"
        return 2
    fi
}

total=0
passed=0
failed=0
skipped=0

echo "Checking Docker services..."
echo ""

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r container name endpoint <<< "$service_info"
    total=$((total + 1))

    printf "%-30s " "$name"

    # Check if container is running
    if ! check_container_running "$container"; then
        echo -e "${RED}[FAIL]${NC} Container not running"
        failed=$((failed + 1))
        continue
    fi

    # Check health status
    if [ "$endpoint" = "running" ]; then
        # Just check if running (no healthcheck)
        echo -e "${GREEN}[OK]${NC} Running"
        passed=$((passed + 1))
    elif [[ "$endpoint" == http* ]]; then
        # Check HTTP endpoint
        if check_http_endpoint "$endpoint"; then
            echo -e "${GREEN}[OK]${NC} Healthy (${endpoint})"
            passed=$((passed + 1))
        else
            health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [ "$health_status" = "starting" ]; then
                echo -e "${YELLOW}[STARTING]${NC} Healthcheck in progress..."
                skipped=$((skipped + 1))
            else
                echo -e "${RED}[FAIL]${NC} Endpoint unreachable (${endpoint})"
                failed=$((failed + 1))
            fi
        fi
    elif [[ "$endpoint" == tcp* ]]; then
        # Check TCP port
        host=$(echo "$endpoint" | sed 's|tcp://||' | cut -d: -f1)
        port=$(echo "$endpoint" | cut -d: -f3)
        if nc -z "$host" "$port" 2>/dev/null; then
            echo -e "${GREEN}[OK]${NC} Port ${port} open"
            passed=$((passed + 1))
        else
            echo -e "${RED}[FAIL]${NC} Port ${port} closed"
            failed=$((failed + 1))
        fi
    fi
done

echo ""
echo "=========================================="
echo "Summary:"
echo "  Total:    $total services"
echo -e "  ${GREEN}Passed:${NC}   $passed"
if [ $skipped -gt 0 ]; then
    echo -e "  ${YELLOW}Starting:${NC} $skipped"
fi
if [ $failed -gt 0 ]; then
    echo -e "  ${RED}Failed:${NC}   $failed"
fi
echo "=========================================="

if [ $failed -gt 0 ]; then
    echo ""
    echo -e "${RED}Some services are not healthy!${NC}"
    echo "Run 'docker compose logs <service-name>' to investigate."
    exit 1
elif [ $skipped -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Some services are still starting. Please wait...${NC}"
    exit 2
else
    echo ""
    echo -e "${GREEN}All services are healthy!${NC}"
    exit 0
fi
