#!/bin/bash
# PostgreSQL initialization script
# Creates separate databases for Airflow and Keycloak

set -e

echo "Checking and creating databases..."

# Function to create database if it doesn't exist
create_db_if_not_exists() {
    local db_name=$1
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE $db_name'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $db_name TO $POSTGRES_USER;
EOSQL
}

# Create Airflow database
create_db_if_not_exists "${AIRFLOW_DB:-airflow}"
echo "✓ Airflow database ready: ${AIRFLOW_DB:-airflow}"

# Create Keycloak database
create_db_if_not_exists "${KEYCLOAK_DB:-keycloak}"
echo "✓ Keycloak database ready: ${KEYCLOAK_DB:-keycloak}"

# Display all databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "\l"
