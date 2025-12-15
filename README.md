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

## Step 3: Create Empty Repository ⏱️ 2 min

1. Open http://localhost:7200
2. **Setup** → **Repositories** → **Create new repository**
3. Configuration:
   - **Repository ID**: `ekg`
   - **Ruleset**: `OWL-RL (Optimized)`
   - **✅ Enable SHACL validation** (CHECK THIS!)
4. Click **Create**

**✅ Verify**: Repository `ekg` appears with 0 triples

---

## Step 4: Run DAG Pipeline ⏱️ 5-8 min

The Airflow DAG does **EVERYTHING automatically**:
- Extract CSV → Transform to RDF → Validate SHACL
- Run sanity checks → Collect metrics
- **Import to GraphDB** (ontologies + SHACL + data)
- Push metrics to Prometheus

### Execute:

1. Open http://localhost:8080
2. Login: `admin` / `admin`
3. Click **DAGs**
4. Find `ekg_ingest_pipeline`
5. **Toggle ON** (activate)
6. Click **▶ Trigger DAG**

### Monitor Progress:

10 tasks execute in sequence:
```
extract_csv → transform_csv_to_rdf → verify_graphdb_endpoint →
ensure_repository_exists → upload_ontologies → upload_shacl_shapes →
upload_data → sanity_checks → collect_metrics → quality_monitor
```

**✅ All tasks must be GREEN** (success)

### Verify Import:

```bash
curl -s "http://localhost:7200/repositories/ekg/size"
```

**Expected**: ~800+ triples

---

## Step 5: Verify Everything ⏱️ 5-10 min

### 5.1 Prometheus Metrics

**URL**: http://localhost:9090

**Query**:
```
ekg_triple_count{job="ekg_quality_monitor"}
```

**Expected**: Value showing triple count

**Check Status → Targets** (all should be UP):
- ✅ prometheus
- ✅ graphdb
- ✅ pushgateway

---

### 5.2 Grafana Dashboards

**URL**: http://localhost:3001
**Login**: admin / admin

**Dashboards**:

1. **EKG Performance**
   - GraphDB Heap Memory
   - CPU Load
   - Disk Space
   - API Gateway Requests

2. **EKG Quality**
   - Quality Score
   - SHACL Violations
   - Triple Count
   - Sanity Issues

**✅ All panels should display data**

---

### 5.3 Neo4j Graph Visualization

**URL**: http://localhost:7474
**Login**: neo4j / password

**Check Auto-Sync Logs**:
```bash
docker logs ekg-neo4j-autosync --tail 50
```

**Expected**:
```
✓ Neo4j connected!
✓ GraphDB connected!
✓ n10s initialized!
[timestamp] Syncing data from GraphDB...
[timestamp] Synced! Triples: 800+
```

**Visualize Complete Graph**:

```cypher
// Show ENTIRE graph
MATCH (n)-[r]->(m)
WHERE NOT n:_GraphConfig
  AND NOT n:_NsPrefDef
  AND NOT m:_GraphConfig
  AND NOT m:_NsPrefDef
RETURN n, r, m
LIMIT 500
```

**Expected**: Connected graph showing:
- 👥 Persons (ex__Person)
- 🏢 OrgUnits (ex__OrgUnit)
- 📦 Products (ex__Product)
- 💻 Assets (ex__Asset)
- 📁 Projects (ex__Project)
- Relationships: ex__worksFor, ex__manages, ex__ownedBy, etc.

**Count nodes by type**:
```cypher
MATCH (n)
WHERE NOT n:_GraphConfig AND NOT n:_NsPrefDef
RETURN labels(n) as type, count(*) as count
ORDER BY count DESC
```

---

### 5.4 Keycloak RBAC Testing with Postman

**File**: `tests/TEP-05_postman_collection.json`

#### Import Collection:

1. Open **Postman**
2. **Import** → Select `tests/TEP-05_postman_collection.json`
3. Collection "TEP-05 EKG Security & Governance" imported

#### Execute Tests (IN ORDER):

**Step 1: Authentication** (get tokens)
- ✅ Login as alice.viewer
- ✅ Login as bob.curator
- ✅ Login as carol.steward
- ✅ Login as dave.admin

**Step 2: Viewer Tests** (alice.viewer)
- ✅ GET /ekg/persons → SUCCESS (sees Public + Internal)
- ❌ GET /ekg/quarantine → 403 FORBIDDEN
- ❌ POST /ekg/sparql/update → 403 FORBIDDEN

**Step 3: Curator Tests** (bob.curator)
- ✅ GET /ekg/persons → SUCCESS (sees + Confidential)
- ✅ GET /ekg/quarantine → SUCCESS
- ✅ POST /ekg/quarantine/approve → SUCCESS
- ❌ POST /ekg/sparql/update → 403 FORBIDDEN

**Step 4: Steward Tests** (carol.steward)
- ✅ GET /ekg/persons → SUCCESS (sees + Secret)
- ✅ POST /ekg/sparql/update → SUCCESS
- ✅ GET /ekg/quarantine → SUCCESS

**Step 5: Admin Tests** (dave.admin)
- ✅ GET /ekg/persons → SUCCESS (full access)
- ✅ GET /ekg/quarantine → SUCCESS
- ✅ POST /ekg/sparql/update → SUCCESS
- ✅ POST /ekg/sparql/query → SUCCESS

**✅ ALL TESTS MUST PASS** (green in Postman)

#### RBAC/ABAC Matrix:

| User | Role | Clearance | Read | Quarantine | SPARQL Update |
|------|------|-----------|------|------------|---------------|
| alice.viewer | viewer | Public, Internal | ✅ | ❌ | ❌ |
| bob.curator | curator | + Confidential | ✅ | ✅ | ❌ |
| carol.steward | steward | + Secret | ✅ | ✅ | ✅ |
| dave.admin | admin | + Secret | ✅ | ✅ | ✅ |

---

## ✅ Final Checklist

- [x] **Step 1**: Environment configured (.env created)
- [x] **Step 2**: 12 services running and healthy
- [x] **Step 3**: GraphDB repository `ekg` created (SHACL enabled)
- [x] **Step 4**: Airflow DAG completed (10 tasks green)
- [x] **Step 5.1**: Prometheus collects metrics
- [x] **Step 5.2**: Grafana displays dashboards
- [x] **Step 5.3**: Neo4j visualizes complete connected graph
- [x] **Step 5.4**: Postman Keycloak RBAC tests pass

**🎉 Your EKG is operational!**

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
