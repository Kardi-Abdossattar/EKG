#!/bin/bash
# PostgreSQL initialization script
# Creates separate databases for Airflow and Keycloak

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Airflow database
    CREATE DATABASE ${AIRFLOW_DB:-airflow};
    GRANT ALL PRIVILEGES ON DATABASE ${AIRFLOW_DB:-airflow} TO ${POSTGRES_USER};

    -- Create Keycloak database
    CREATE DATABASE ${KEYCLOAK_DB:-keycloak};
    GRANT ALL PRIVILEGES ON DATABASE ${KEYCLOAK_DB:-keycloak} TO ${POSTGRES_USER};

    -- Display created databases
    \l
EOSQL

echo "✓ Databases created successfully: ${AIRFLOW_DB:-airflow}, ${KEYCLOAK_DB:-keycloak}"
