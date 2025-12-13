#!/bin/bash
# EKG Services Restart Script
# Safely restarts all Docker services with proper healthcheck verification

set -e

cd "$(dirname "$0")/../infra"

echo "=========================================="
echo "EKG Services Restart"
echo "=========================================="
echo ""

echo "Step 1: Stopping all services..."
docker compose down

echo ""
echo "Step 2: Starting services..."
docker compose up -d

echo ""
echo "Step 3: Waiting for services to become healthy..."
echo "This may take 2-3 minutes..."
echo ""

# Wait for services to start
sleep 10

# Check health status every 10 seconds for up to 3 minutes
max_attempts=18
attempt=0

while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    echo "Checking service health (attempt $attempt/$max_attempts)..."

    if ../scripts/check_services_health.sh; then
        echo ""
        echo "=========================================="
        echo "✅ All services are healthy!"
        echo "=========================================="
        echo ""
        echo "Services are available at:"
        echo "  - GraphDB:       http://localhost:7200"
        echo "  - Airflow:       http://localhost:8080 (admin/admin)"
        echo "  - Grafana:       http://localhost:3001 (admin/admin)"
        echo "  - Neo4j:         http://localhost:7474 (neo4j/password)"
        echo "  - Keycloak:      http://localhost:8180 (admin/admin)"
        echo "  - API Gateway:   http://localhost:3000"
        echo "  - Prometheus:    http://localhost:9090"
        echo ""
        exit 0
    fi

    if [ $attempt -lt $max_attempts ]; then
        echo "Some services still starting... waiting 10 seconds"
        sleep 10
    fi
done

echo ""
echo "=========================================="
echo "⚠️  Warning: Some services may not be healthy yet"
echo "=========================================="
echo ""
echo "Run 'docker compose logs <service-name>' to check for issues."
echo "Or run '../scripts/check_services_health.sh' to recheck."
echo ""

exit 1
