#!/bin/bash

# =============================================================================
# Script de test des healthchecks Docker
# =============================================================================
# Teste manuellement chaque healthcheck pour diagnostiquer les problèmes

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Test manuel des healthchecks Docker"
echo "=========================================="
echo ""

# Function to test healthcheck
test_healthcheck() {
    local container=$1
    local command=$2
    local name=$3

    echo -n "Testing $name... "

    if docker exec "$container" bash -c "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Command: $command"
        echo "  Try: docker exec $container bash -c \"$command\""
        return 1
    fi
}

# =============================================================================
# Test PostgreSQL
# =============================================================================
echo "--- PostgreSQL ---"
test_healthcheck "ekg-postgres" \
    "pg_isready -U ekg_admin -d ekg_meta" \
    "PostgreSQL readiness"

# =============================================================================
# Test GraphDB
# =============================================================================
echo ""
echo "--- GraphDB ---"
test_healthcheck "ekg-graphdb" \
    "wget --quiet --tries=1 --spider http://localhost:7200/rest/repositories" \
    "GraphDB REST API"

# Alternative: check if port is listening
test_healthcheck "ekg-graphdb" \
    "nc -z localhost 7200" \
    "GraphDB port 7200"

# =============================================================================
# Test Airflow Webserver
# =============================================================================
echo ""
echo "--- Airflow Webserver ---"
test_healthcheck "ekg-airflow-webserver" \
    "curl --fail --silent --output /dev/null http://localhost:8080/health" \
    "Airflow health endpoint"

# Alternative: check if gunicorn is running
test_healthcheck "ekg-airflow-webserver" \
    "pgrep -f 'airflow webserver'" \
    "Airflow webserver process"

# =============================================================================
# Test Airflow Scheduler
# =============================================================================
echo ""
echo "--- Airflow Scheduler ---"
test_healthcheck "ekg-airflow-scheduler" \
    "airflow jobs check --job-type SchedulerJob --hostname \$HOSTNAME" \
    "Airflow scheduler job"

# Alternative: check if scheduler is running
test_healthcheck "ekg-airflow-scheduler" \
    "pgrep -f 'airflow scheduler'" \
    "Airflow scheduler process"

# =============================================================================
# Test Keycloak
# =============================================================================
echo ""
echo "--- Keycloak ---"
test_healthcheck "ekg-keycloak" \
    "timeout 2 bash -c '</dev/tcp/localhost/8080' 2>/dev/null" \
    "Keycloak TCP port 8080"

# Alternative: check process
test_healthcheck "ekg-keycloak" \
    "pgrep -f 'java.*keycloak'" \
    "Keycloak Java process"

# =============================================================================
# Test API Gateway
# =============================================================================
echo ""
echo "--- API Gateway ---"
test_healthcheck "ekg-api-gateway" \
    "wget --quiet --tries=1 --spider http://localhost:3000/health" \
    "API Gateway health endpoint"

# Alternative: check Node process
test_healthcheck "ekg-api-gateway" \
    "pgrep -f 'node.*main.js'" \
    "API Gateway Node.js process"

# =============================================================================
# Test Prometheus
# =============================================================================
echo ""
echo "--- Prometheus ---"
test_healthcheck "ekg-prometheus" \
    "wget --quiet --tries=1 --spider http://localhost:9090/-/healthy" \
    "Prometheus health endpoint"

# =============================================================================
# Test Grafana
# =============================================================================
echo ""
echo "--- Grafana ---"
test_healthcheck "ekg-grafana" \
    "wget --quiet --tries=1 --spider http://localhost:3000/api/health" \
    "Grafana health endpoint"

echo ""
echo "=========================================="
echo "Tests completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check Docker health status: docker compose ps"
echo "2. View container health details: docker inspect <container> --format='{{json .State.Health}}' | jq"
echo "3. Check logs: docker compose logs <service>"
