#!/bin/bash

# =============================================================================
# EKG Sécurisé - Healthcheck Script (TEP-00_INIT)
# =============================================================================
# Vérifie que tous les services de l'infrastructure sont opérationnels
# Usage: bash healthcheck.sh

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GRAPHDB_URL="${GRAPHDB_URL:-http://localhost:7200}"
AIRFLOW_URL="${AIRFLOW_URL:-http://localhost:8080}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
API_URL="${API_URL:-http://localhost:3000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"

TIMEOUT=5
FAILED_CHECKS=0

echo "=========================================="
echo "EKG Infrastructure Health Check"
echo "=========================================="
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected_codes=${3:-200}

    echo -n "Checking $name... "

    if command -v curl &> /dev/null; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    elif command -v wget &> /dev/null; then
        response=$(wget --timeout=$TIMEOUT -O /dev/null -q --server-response "$url" 2>&1 | grep "HTTP/" | tail -1 | awk '{print $2}' || echo "000")
    else
        echo -e "${RED}✗ FAILED${NC} (curl/wget not found)"
        ((FAILED_CHECKS++))
        return 1
    fi

    # Check if response matches any of the expected codes
    if echo "$expected_codes" | grep -qw "$response"; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response, expected one of: $expected_codes)"
        ((FAILED_CHECKS++))
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local name=$1
    local container_name=$2

    echo -n "Checking Docker container $name... "

    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠ SKIPPED${NC} (docker not found)"
        return 0
    fi

    status=$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "not_found")

    if [ "$status" = "healthy" ]; then
        echo -e "${GREEN}✓ HEALTHY${NC}"
        return 0
    elif [ "$status" = "not_found" ]; then
        echo -e "${RED}✗ NOT RUNNING${NC}"
        ((FAILED_CHECKS++))
        return 1
    else
        echo -e "${YELLOW}⚠ $status${NC}"
        ((FAILED_CHECKS++))
        return 1
    fi
}

# =============================================================================
# Docker Container Health Checks
# =============================================================================
echo "--- Docker Containers ---"
check_container "GraphDB" "ekg-graphdb"
check_container "PostgreSQL" "ekg-postgres"
check_container "Airflow Webserver" "ekg-airflow-webserver"
check_container "Airflow Scheduler" "ekg-airflow-scheduler"
check_container "Keycloak" "ekg-keycloak"
check_container "API Gateway" "ekg-api-gateway"
check_container "Prometheus" "ekg-prometheus"
check_container "Grafana" "ekg-grafana"
echo ""

# =============================================================================
# HTTP Endpoint Health Checks
# =============================================================================
echo "--- HTTP Endpoints ---"
check_http "GraphDB REST API" "$GRAPHDB_URL/rest/repositories"
check_http "Airflow UI" "$AIRFLOW_URL/health"
check_http "Keycloak Health" "http://localhost:9000/health/ready"
check_http "API Gateway Health" "$API_URL/health"
check_http "Prometheus" "$PROMETHEUS_URL/-/healthy"
check_http "Grafana" "$GRAFANA_URL/api/health"
echo ""

# =============================================================================
# Advanced Checks
# =============================================================================
echo "--- Advanced Checks ---"

# Check GraphDB repository exists
echo -n "Checking GraphDB repository 'ekg'... "
if command -v curl &> /dev/null; then
    repo_check=$(curl -s --max-time $TIMEOUT "$GRAPHDB_URL/rest/repositories/ekg" 2>/dev/null || echo "error")
    if [[ "$repo_check" == *"id"* ]]; then
        echo -e "${GREEN}✓ EXISTS${NC}"
    else
        echo -e "${YELLOW}⚠ NOT CREATED${NC} (run: create repository via UI)"
    fi
else
    echo -e "${YELLOW}⚠ SKIPPED${NC}"
fi

# Check Prometheus targets
echo -n "Checking Prometheus targets... "
if command -v curl &> /dev/null; then
    targets=$(curl -s --max-time $TIMEOUT "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null | grep -o '"health":"up"' | wc -l || echo "0")
    if [ "$targets" -gt 0 ]; then
        echo -e "${GREEN}✓ $targets targets UP${NC}"
    else
        echo -e "${YELLOW}⚠ No targets UP${NC}"
    fi
else
    echo -e "${YELLOW}⚠ SKIPPED${NC}"
fi

# Check API Gateway dependencies
echo -n "Checking API Gateway dependencies... "
if command -v curl &> /dev/null; then
    api_health=$(curl -s --max-time $TIMEOUT "$API_URL/health" 2>/dev/null || echo "{}")
    graphdb_dep=$(echo "$api_health" | grep -o '"graphdb".*"status":"up"' || echo "")
    keycloak_dep=$(echo "$api_health" | grep -o '"keycloak".*"status":"up"' || echo "")

    if [[ -n "$graphdb_dep" ]] && [[ -n "$keycloak_dep" ]]; then
        echo -e "${GREEN}✓ All dependencies UP${NC}"
    else
        echo -e "${YELLOW}⚠ Some dependencies DOWN${NC}"
    fi
else
    echo -e "${YELLOW}⚠ SKIPPED${NC}"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=========================================="
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}All checks passed ✓${NC}"
    echo "Infrastructure is ready!"
    exit 0
else
    echo -e "${RED}$FAILED_CHECKS check(s) failed ✗${NC}"
    echo "Please review the logs: docker compose logs -f"
    exit 1
fi
