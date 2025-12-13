#!/bin/bash
# TEP-03 Quality Monitor - Setup Script
# Execute from project root: bash scripts/setup_tep03.sh

set -e

echo "========================================"
echo "TEP-03 QUALITY MONITOR - SETUP"
echo "========================================"
echo ""

# Check we're in project root
if [ ! -f "infra/docker-compose.yml" ]; then
  echo "❌ Error: Run this script from project root (d:/2.0)"
  exit 1
fi

echo "✓ Running from project root"
echo ""

# Step 1: Start Pushgateway
echo "Step 1/7: Starting Pushgateway..."
cd infra
docker compose up -d pushgateway
echo "  Waiting for Pushgateway to be healthy..."
sleep 10
docker compose ps pushgateway
cd ..
echo "✓ Pushgateway started"
echo ""

# Step 2: Restart Prometheus & Grafana
echo "Step 2/7: Restarting Prometheus & Grafana (new config)..."
cd infra
docker compose restart prometheus grafana
echo "  Waiting for services to restart..."
sleep 15
docker compose ps prometheus grafana
cd ..
echo "✓ Prometheus & Grafana restarted"
echo ""

# Step 3: Install Python dependencies in Airflow
echo "Step 3/7: Installing prometheus-client in Airflow..."
docker exec ekg-airflow-webserver pip install -q prometheus-client
echo "✓ Python dependencies installed"
echo ""

# Step 4: Copy scripts to Airflow container
echo "Step 4/7: Copying scripts to Airflow container..."
docker cp scripts/quality_monitor.py ekg-airflow-webserver:/opt/airflow/scripts/
docker cp pipelines/airflow_dags/ekg_ingest.py ekg-airflow-webserver:/opt/airflow/dags/
echo "✓ Scripts copied"
echo ""

# Step 5: Test quality monitor
echo "Step 5/7: Testing quality monitor..."
docker exec ekg-airflow-webserver python3 scripts/quality_monitor.py \
  --url http://graphdb:7200 \
  --repo ekg \
  --graph http://example.com/data \
  --pushgateway http://pushgateway:9091 \
  --output /tmp/quality_report_test.json

echo ""
echo "✓ Quality monitor executed"
echo ""

# Step 6: Verify metrics in Pushgateway
echo "Step 6/7: Verifying metrics in Pushgateway..."
METRICS_COUNT=$(curl -s http://localhost:9091/metrics | grep -c "ekg_" || true)
if [ "$METRICS_COUNT" -gt 0 ]; then
  echo "✓ Found $METRICS_COUNT EKG metrics in Pushgateway"
else
  echo "⚠️  No EKG metrics found (may be normal on first run)"
fi
echo ""

# Step 7: Final checks
echo "Step 7/7: Running final checks..."

echo "  - Checking Pushgateway health..."
curl -sf http://localhost:9091/metrics > /dev/null && echo "    ✓ Pushgateway accessible" || echo "    ❌ Pushgateway not accessible"

echo "  - Checking Prometheus health..."
curl -sf http://localhost:9090/-/healthy > /dev/null && echo "    ✓ Prometheus healthy" || echo "    ❌ Prometheus unhealthy"

echo "  - Checking Grafana health..."
curl -sf http://localhost:3001/api/health > /dev/null && echo "    ✓ Grafana healthy" || echo "    ❌ Grafana unhealthy"

echo "  - Checking API Gateway metrics..."
curl -sf http://localhost:3000/metrics > /dev/null && echo "    ✓ API metrics accessible" || echo "    ❌ API metrics not accessible"

echo ""
echo "========================================"
echo "✅ TEP-03 SETUP COMPLETED"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. View Prometheus targets:"
echo "   http://localhost:9090/targets"
echo ""
echo "2. Import Grafana dashboard:"
echo "   - Open http://localhost:3001"
echo "   - Login: admin/admin"
echo "   - Dashboards > Import"
echo "   - Upload: infra/grafana/dashboards/ekg_quality_dashboard.json"
echo ""
echo "3. Test with error injection:"
echo "   bash scripts/test_error_injection.sh"
echo ""
echo "4. Full walkthrough:"
echo "   See docs/TEP-03_WALKTHROUGH.md"
echo ""
