#!/usr/bin/env bash
# =============================================================================
# EKG - Airflow Connections Initializer
# Creates idempotent Airflow connections based on environment variables.
# Safe to run multiple times.
# =============================================================================

set -euo pipefail

echo "[init-connections] Starting Airflow connections initialization..."

# Small delay just in case DB is waking up
sleep 5

# ---------------------------------------------------------------------------
# Helper function: add connection if missing
# ---------------------------------------------------------------------------
add_connection_if_missing() {
  local conn_id="$1"
  shift

  if airflow connections get "$conn_id" >/dev/null 2>&1; then
    echo "[init-connections] Connection '$conn_id' already exists – skipping."
  else
    echo "[init-connections] Creating connection '$conn_id'..."
    airflow connections add "$conn_id" "$@"
    echo "[init-connections] Connection '$conn_id' created."
  fi
}

# ---------------------------------------------------------------------------
# Build URIs from environment (with sane defaults)
# ---------------------------------------------------------------------------

# PostgreSQL (Airflow metadata or other Postgres usage)
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${AIRFLOW_DB:-airflow}"
POSTGRES_USER="${POSTGRES_USER:-ekg_admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-admin}"

POSTGRES_URI="postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

# GraphDB
GRAPHDB_URL="${GRAPHDB_URL:-http://graphdb:7200}"

# API Gateway
API_PORT="${API_PORT:-3000}"
API_GATEWAY_URL="${API_GATEWAY_URL:-http://api-gateway:${API_PORT}}"

# Keycloak (OIDC)
KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"

# ---------------------------------------------------------------------------
# Create connections (idempotent)
# ---------------------------------------------------------------------------

# 1. PostgreSQL – Airflow metadata / general Postgres
add_connection_if_missing "postgres_airflow" --conn-uri "${POSTGRES_URI}"

# 2. GraphDB – HTTP REST endpoint
add_connection_if_missing "graphdb" --conn-uri "${GRAPHDB_URL}"

# 3. API Gateway – HTTP endpoint
add_connection_if_missing "api_gateway" --conn-uri "${API_GATEWAY_URL}"

# 4. Keycloak – OIDC server
add_connection_if_missing "keycloak" --conn-uri "${KEYCLOAK_URL}"

echo "[init-connections] All done."
