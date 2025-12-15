# EKG Platform - Quick Start Guide

**Version**: 2.0
**Date**: 2025-12-15
**Duration**: 20-30 minutes

Enterprise Knowledge Graph platform with automated RDF ingestion, SPARQL queries, and graph analytics.

---

## Prerequisites

- **Docker Desktop** 20.10+ (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** 2.0+
- **8 GB RAM minimum** (16 GB recommended)
- **Ports available**: 3000, 3001, 5432, 6379, 7200, 7474, 7687, 8080, 8180, 9090, 9091

Quick check:
```bash
docker --version
docker-compose --version
```

---

## Quick Start (Automated)

### Step 1: Clone and Setup Environment

```bash
git clone <repository-url>
cd infra

# Copy environment configuration
copy env\.env.example env\.env   # Windows CMD
# OR
cp env/.env.example env/.env     # PowerShell/Linux/Mac
```

### Step 2: Run Startup Script

**Option A - PowerShell (Windows - Recommended):**
```powershell
cd infra
.\start-ekg.ps1
```

**Option B - Bash (Linux/Mac):**
```bash
cd infra
./start-ekg.sh  # Coming soon - use manual commands below for now
```

The script will:
- ✅ Start all services in the correct order
- ✅ Wait for each service to be healthy before proceeding
- ✅ Create databases automatically (PostgreSQL: airflow, keycloak)
- ✅ Import Keycloak realm (EKG with roles)
- ✅ Display all service URLs when ready

**Duration**: ~15-20 minutes (includes GraphDB and Keycloak initialization)

---

## Manual Start (Alternative)

If you prefer manual control or the script fails:

### 1. Copy Environment File
```bash
# CMD
copy env\.env.example env\.env

# PowerShell/Linux/Mac
cp env/.env.example env/.env
```

### 2. Start Services Phase by Phase

**Phase 1: Infrastructure Base**
```bash
cd infra
docker-compose --env-file ./env/.env up -d postgres redis pushgateway
```
Wait ~3 minutes for PostgreSQL to be healthy.

**Phase 2: Data Services**
```bash
docker-compose --env-file ./env/.env up -d graphdb prometheus
```
⚠️ **GraphDB takes 5-6 minutes to start the first time** - wait for it to be healthy.

**Phase 3: Authentication & ETL**
```bash
docker-compose --env-file ./env/.env up -d keycloak airflow-init
```
⚠️ **Keycloak takes 5-6 minutes to start the first time** - wait for it to be healthy.

Then start Airflow services:
```bash
docker-compose --env-file ./env/.env up -d airflow-webserver airflow-scheduler
```

**Phase 4: Application Services**
```bash
docker-compose --env-file ./env/.env up -d neo4j
```
Wait ~2 minutes for Neo4j to be healthy.

```bash
docker-compose --env-file ./env/.env up -d api-gateway neo4j-autosync grafana
```

### 3. Check Service Health
```bash
docker-compose ps
```
All services should show "healthy" status.

---

## Access Services

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| GraphDB | 7200 | http://localhost:7200 | - |
| Neo4j | 7474 | http://localhost:7474 | neo4j / password |
| Airflow | 8080 | http://localhost:8080 | admin / admin |
| Keycloak | 8180 | http://localhost:8180 | admin / admin |
| API Gateway | 3000 | http://localhost:3000 | (token protected) |
| Prometheus | 9090 | http://localhost:9090 | - |
| Grafana | 3001 | http://localhost:3001 | admin / admin |

---

## Run Data Ingestion Pipeline

### Option 1: Airflow UI (Recommended)

1. Open Airflow: http://localhost:8080 (admin/admin)
2. Find DAG: `ekg_ingest_pipeline`
3. Toggle ON to enable the DAG
4. Click ▶️ to trigger manually

The pipeline will:
1. Extract CSV from `seed/` directory
2. Transform to RDF (TTL format)
3. Create GraphDB repository if needed
4. Upload ontologies (core → temporal → provenance → relations → security)
5. Upload SHACL shapes
6. Upload data (orgunits → persons → products → projects → assets)
7. Run sanity checks
8. Push metrics to Prometheus

**Duration**: ~5-10 minutes

### Option 2: Airflow CLI

```bash
docker exec -it ekg-airflow-scheduler airflow dags trigger ekg_ingest_pipeline
```

---

## Verify Installation

### 1. GraphDB
- URL: http://localhost:7200
- Check repository `ekg` exists
- Query: `SELECT * WHERE { ?s ?p ?o } LIMIT 10`

### 2. Neo4j
- URL: http://localhost:7474
- Login: neo4j/password
- Query: `MATCH (n) RETURN count(n) as total`
- Data syncs automatically from GraphDB every 30 seconds

### 3. Keycloak
- URL: http://localhost:8180
- Login: admin/admin
- Check realm `ekg` exists with roles: viewer, curator, steward

### 4. Grafana
- URL: http://localhost:3001
- Login: admin/admin
- Pre-configured dashboards for EKG metrics

---

## Common Issues

### GraphDB takes long to start
**Normal!** First-time initialization takes 5-6 minutes. Check logs:
```bash
docker logs ekg-graphdb
```

### Keycloak fails to start
May need more time or database issues. Check:
```bash
docker logs ekg-keycloak
docker logs ekg-postgres
```

### Neo4j authentication errors
If you see auth failures, reset Neo4j:
```bash
docker-compose down
rm -rf infra/neo4j/data  # Safe - data syncs from GraphDB
docker-compose up -d neo4j
```

### Airflow DAG not appearing
Wait 1-2 minutes for scheduler to pick up DAGs:
```bash
docker logs ekg-airflow-scheduler | grep ekg_ingest_pipeline
```

---

## Stop Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

---

## Project Structure

```
infra/
├── airflow/
│   ├── dags/          # Airflow DAGs (ekg_ingest_pipeline)
│   └── scripts/       # Python scripts for ETL
├── api-gateway/       # NestJS API Gateway
├── docker-compose.yml # Service orchestration
├── env/
│   ├── .env.example   # Example environment config
│   └── .env           # Your local config (git-ignored)
├── keycloak/
│   └── realm-export.json  # EKG realm configuration
├── neo4j-sync/        # Auto-sync service GraphDB → Neo4j
├── init-db.sh         # PostgreSQL database initialization
└── start-ekg.ps1      # Automated startup script (Windows)

ontology/              # OWL ontologies
shacl/                 # SHACL shapes
seed/                  # Source CSV data
data/generated/        # Generated RDF (git-ignored)
```

---

## Architecture

```
CSV Data (seed/)
    ↓
Airflow ETL Pipeline
    ↓
GraphDB (Triple Store - Source of Truth)
    ↓
    ├─→ Neo4j (Graph Analytics - Auto-synced)
    ├─→ API Gateway (SPARQL Queries + Auth)
    └─→ Prometheus/Grafana (Monitoring)
```

---

## Development

### Rebuild specific service
```bash
docker-compose build api-gateway
docker-compose up -d api-gateway
```

### View logs
```bash
docker-compose logs -f graphdb
docker-compose logs -f airflow-scheduler
```

### Execute commands in container
```bash
docker exec -it ekg-graphdb bash
docker exec -it ekg-airflow-scheduler bash
```

---

## Support

- **Issues**: Check logs first (`docker-compose logs <service>`)
- **Documentation**: See `/docs` directory
- **Reset**: `docker-compose down -v` for complete fresh start

---

**Next Steps**: After ingestion completes, explore GraphDB queries, test API endpoints, and configure Grafana dashboards!
