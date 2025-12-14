# EKG Quickstart Guide - 5 Simple Steps

**Version**: 2.0 Simplified  
**Date**: 2025-12-14  
**Duration**: 20-30 minutes total

---

## 🚀 5-Step Setup

1. **Build** → Docker images
2. **Start** → Services with script
3. **Create** → Empty GraphDB repository
4. **Ingest** → Run Airflow DAG (automatic)
5. **Verify** → Prometheus, Grafana, Neo4j, Keycloak

---

## Prerequisites

- **Docker Desktop** 20.10+ (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** 2.0+
- **8 GB RAM minimum** (16 GB recommended)
- **Ports available**: 3000, 3001, 5432, 6379, 7200, 7474, 7687, 8080, 8180, 9090, 9091

```bash
# Quick check
docker --version
docker-compose --version
```

---

## Step 1: Build Images ⏱️ 10-15 min

```bash
cd ekg-project/infra
docker-compose build
```

**Expected**: Images `ekg-api-gateway` and `ekg-neo4j-autosync` created

---

## Step 2: Start Services ⏱️ 15-20 min

Start services in phases to avoid dependency issues:

### Phase 1: Infrastructure Base
```bash
cd infra
docker-compose --env-file ./env/.env up -d postgres redis pushgateway
```
Wait ~3 minutes for PostgreSQL to be healthy.

### Phase 2: Data Services
```bash
docker-compose --env-file ./env/.env up -d graphdb prometheus
```
⚠️ **GraphDB takes 5-6 minutes to start the first time** - wait for it to be healthy.

### Phase 3: Authentication & ETL
```bash
docker-compose --env-file ./env/.env up -d keycloak airflow-init
```
⚠️ **Keycloak takes 5-6 minutes to start the first time** - wait for it to be healthy.

Then start Airflow services:
```bash
docker-compose --env-file ./env/.env up -d airflow-webserver airflow-scheduler
```

### Phase 4: Application Services
```bash
docker-compose --env-file ./env/.env up -d neo4j
```
Wait ~2 minutes for Neo4j to be healthy.

```bash
docker-compose --env-file ./env/.env up -d api-gateway neo4j-autosync grafana
```

### Check Service Health
```bash
docker-compose ps
```
All services should show "healthy" status.

**Services running**:

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

8 tasks execute in sequence:
```
extract_csv → transform_to_rdf → validate_shacl → sanity_checks → 
collect_metrics → quality_monitor → import_to_graphdb → update_metrics
```

**✅ All tasks must be GREEN** (success)

### Verify Import:

```bash
curl -s "http://localhost:7200/repositories/ekg/size"
```

**Expected**: ~798 triples

---

## Step 5: Verify Everything ⏱️ 5-10 min

### 5.1 Prometheus Metrics

**URL**: http://localhost:9090

**Query**:
```
ekg_triple_count{job="ekg_post_import_metrics"}
```

**Expected**: Value = 798

**Check Status → Targets** (all should be UP):
- ✅ prometheus
- ✅ graphdb
- ✅ graphdb-repository
- ✅ api-gateway
- ✅ pushgateway

---

### 5.2 Grafana Dashboards

**URL**: http://localhost:3001  
**Login**: admin / admin

**2 Dashboards**:

1. **EKG Performance**
   - GraphDB Heap Memory
   - CPU Load
   - Disk Space
   - API Gateway Requests
   
2. **EKG Quality**
   - Quality Score: 100
   - SHACL Violations: 0
   - Triple Count: 798
   - Sanity Issues: 0

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
[2025-12-14] Change detected: 0 → 798 triples
Syncing 798 triples...
✓ Synced! Triples: 798
```

**Visualize Complete Graph** (1 connected graph):

```cypher
// Show ENTIRE graph in 1 visualization
MATCH (n)-[r]->(m)
WHERE NOT n:_GraphConfig 
  AND NOT n:_NsPrefDef 
  AND NOT m:_GraphConfig 
  AND NOT m:_NsPrefDef
RETURN n, r, m
LIMIT 500
```

**Expected**: Connected graph showing:
- 👥 Persons (ex__Person) - 8 nodes
- 🏢 OrgUnits (ex__OrgUnit) - 6 nodes
- 📦 Products (ex__Product) - 4 nodes
- 💻 Assets (ex__Asset) - 4 nodes
- 📁 Projects (ex__Project) - 3 nodes
- Relationships: ex__worksFor, ex__manages, ex__usedIn, etc.

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

- [x] **Step 1**: Docker images built
- [x] **Step 2**: 12 services running and healthy
- [x] **Step 3**: GraphDB repository `ekg` created (SHACL enabled)
- [x] **Step 4**: Airflow DAG completed (8 tasks green)
- [x] **Step 5.1**: Prometheus collects 798 triples
- [x] **Step 5.2**: Grafana displays dashboards
- [x] **Step 5.3**: Neo4j visualizes complete connected graph
- [x] **Step 5.4**: Postman Keycloak RBAC tests pass

**🎉 Your EKG is operational!**

---

## Stop & Restart

### Stop All:
```bash
cd infra
docker-compose down

# ⚠️ Delete all data:
docker-compose down -v
```

### Restart:
Repeat the commands from Step 2 in order (Phase 1 through Phase 4).

**Note**: Data persists in Docker volumes. No need to recreate repository or re-run DAG.

---

## Troubleshooting

### Service won't start:
```bash
docker-compose logs <service-name>
```

### DAG fails:
1. Click red task in Airflow
2. Read **Logs**
3. Common errors:
   - `Repository 'ekg' not found`: Create repository (Step 3)
   - `SHACL validation failed`: Check CSV data
   - Restart Airflow: `docker-compose restart airflow-scheduler airflow-webserver`

### Neo4j not syncing:
```bash
docker logs ekg-neo4j-autosync --tail 100
curl http://localhost:7200/repositories/ekg/size
```

### Grafana shows "No Data":
```bash
curl http://localhost:9090/-/healthy
docker-compose restart grafana
```

### Port already in use:
```bash
# Windows
netstat -ano | findstr :7200
# Linux/Mac
lsof -i :7200
```

---

## Useful Commands

```bash
# View all containers
docker ps -a

# Real-time logs
docker-compose logs -f <service>

# Restart a service
docker-compose restart <service>

# Shell access
docker exec -it ekg-graphdb bash

# Resource usage
docker stats

# GraphDB triple count
curl http://localhost:7200/repositories/ekg/size

# Neo4j cypher shell
docker exec -it ekg-neo4j cypher-shell -u neo4j -p password

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets
```

---

## Next Steps

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed system architecture
- [docs/WALKTHROUGH_COMPLET_A_Z.md](docs/WALKTHROUGH_COMPLET_A_Z.md) - In-depth tutorial
- Develop new secured API routes
- Add new ETL pipelines

---

**Version**: 2.0 Simplified - December 14, 2025
