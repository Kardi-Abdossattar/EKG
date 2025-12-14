# EKG (Enterprise Knowledge Graph) - Comprehensive Documentation

**Version**: 2.0
**Last Updated**: 2025-12-14
**Author**: EKG Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Data Flow & Processing Pipeline](#data-flow--processing-pipeline)
6. [Security Architecture](#security-architecture)
7. [Deployment & Infrastructure](#deployment--infrastructure)
8. [API Reference](#api-reference)
9. [Monitoring & Observability](#monitoring--observability)
10. [Development Workflow](#development-workflow)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Configuration Reference](#configuration-reference)

---

## Executive Summary

The **Enterprise Knowledge Graph (EKG)** is a comprehensive semantic data platform that combines RDF triplestores, property graph databases, and modern API technologies to provide a secure, governed, and observable knowledge management system.

### Key Features

- **Dual Graph Storage**: GraphDB (RDF) + Neo4j (Property Graph) with automatic synchronization
- **Security-First Design**: Role-Based Access Control (RBAC) + Attribute-Based Access Control (ABAC)
- **Data Quality**: Automated SHACL validation and sanity checks
- **ETL Pipeline**: Apache Airflow orchestration for CSV → RDF transformation
- **API Gateway**: NestJS-based REST + GraphQL endpoints with JWT authentication
- **Observability**: Prometheus metrics + Grafana dashboards
- **Authentication**: Keycloak OIDC/OAuth2 integration

### System Metrics

- **Services**: 12 containerized microservices
- **Ports**: 3000, 3001, 5432, 6379, 7200, 7474, 7687, 8080, 8180, 9090, 9091
- **Resource Requirements**: 8GB RAM minimum, 16GB recommended
- **Startup Time**: 15-20 minutes (first time), 5-8 minutes (subsequent)

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  (Web Apps, Postman, Custom Clients)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS (JWT Bearer Token)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (NestJS)                        │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │ REST APIs    │ GraphQL      │ SPARQL Proxy │ Health/      │ │
│  │              │              │              │ Metrics      │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Security Layer: JWT Auth, RBAC, ABAC, Audit            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────┬───────────────────────┬────────────────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────────────┐
│   KEYCLOAK      │    │       REDIS CACHE           │
│   (Auth)        │    │   (Query Cache)             │
└─────────────────┘    └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────────────────┐    ┌─────────────────────────┐   │
│  │   GraphDB (RDF)          │◄──►│   Neo4j (Property)      │   │
│  │   - SPARQL Endpoint      │    │   - Cypher Queries      │   │
│  │   - SHACL Validation     │    │   - n10s Plugin         │   │
│  │   - OWL-RL Reasoning     │    │   - Auto-Sync Service   │   │
│  └──────────────────────────┘    └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ▲                               ▲
         │                               │
┌─────────────────────────────────────────────────────────────────┐
│                   ETL ORCHESTRATION (Airflow)                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │ Extract  │Transform │ Validate │  Load    │ Monitor      │  │
│  │ CSV      │ CSV→RDF  │ SHACL    │ GraphDB  │ Quality      │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              OBSERVABILITY LAYER                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   Prometheus     │◄───│   Pushgateway    │                  │
│  │   (Metrics)      │    │   (ETL Metrics)  │                  │
│  └────────┬─────────┘    └──────────────────┘                  │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │    Grafana       │                                           │
│  │  (Dashboards)    │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                                │
│  PostgreSQL (Airflow + Keycloak Metadata)                       │
│  Docker Network (ekg-network)                                   │
│  Docker Volumes (Persistent Storage)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

1. **Client Authentication**: Client requests token from Keycloak
2. **API Request**: Client sends JWT token to API Gateway
3. **Token Validation**: API Gateway validates JWT and extracts roles/clearances
4. **Authorization**: RBAC/ABAC guards check permissions
5. **Query Execution**: SPARQL queries sent to GraphDB (with label filtering)
6. **Cache Check**: Redis cache checked for repeated queries
7. **Result Filtering**: Results filtered by security clearance
8. **Auto-Sync**: Neo4j syncs with GraphDB every 30 seconds
9. **Metrics Collection**: All operations logged to Prometheus
10. **Audit Trail**: Security events logged (future enhancement)

---

## Technology Stack

### Backend Services

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **RDF Triplestore** | GraphDB Community | 10.8.1 | Primary semantic data store |
| **Property Graph** | Neo4j | 5.15 | Graph analytics and visualization |
| **API Gateway** | NestJS (Node.js) | 10.4.8 | REST/GraphQL API layer |
| **ETL Orchestration** | Apache Airflow | 2.10.3 | Data pipeline automation |
| **Authentication** | Keycloak | 26.0.7 | OIDC/OAuth2 identity provider |
| **Cache** | Redis | 7.4 | Query result caching |
| **Metrics** | Prometheus | 3.0.1 | Time-series metrics storage |
| **Monitoring** | Grafana | 11.3.1 | Metrics visualization |
| **Database** | PostgreSQL | 16 | Airflow/Keycloak metadata |
| **Metrics Gateway** | Pushgateway | 1.10.0 | Batch job metrics |

### Libraries & Frameworks

**NestJS API Gateway**:
- `@nestjs/passport`, `@nestjs/jwt` - Authentication
- `@nestjs/graphql`, `@apollo/server` - GraphQL support
- `axios` - HTTP client for GraphDB
- `prom-client` - Prometheus metrics
- `cache-manager-redis-yet` - Redis caching
- `class-validator`, `class-transformer` - DTO validation

**Airflow Python Environment**:
- `rdflib` - RDF manipulation
- `pyshacl` - SHACL validation
- `requests` - HTTP client
- `neo4j` - Neo4j driver

**Neo4j Plugins**:
- `n10s` (neosemantics) - RDF import/export
- `apoc` - Advanced procedures

---

## Core Components

### 1. GraphDB (RDF Triplestore)

**Purpose**: Primary semantic knowledge store using RDF triples

**Key Features**:
- SPARQL 1.1 query endpoint
- OWL-RL reasoning (optimized)
- SHACL validation support
- Named graphs for data isolation
- RESTful API

**Configuration**:
```yaml
Image: ontotext/graphdb:10.8.1
Port: 7200
JVM Heap: 1-2GB
CORS: Enabled
Import Directory: /root/graphdb-import
```

**Graphs**:
- `http://example.com/data` - Main data graph
- `http://example.com/ontology` - Schema/ontology
- `http://example.com/shacl` - SHACL shapes
- `http://example.com/quarantine` - Invalid data

**Health Check**:
```bash
curl http://localhost:7200/rest/repositories
```

**Sample SPARQL Query**:
```sparql
PREFIX ex: <http://example.com/schema#>

SELECT ?person ?name ?email
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name ;
          ex:email ?email .
}
LIMIT 10
```

---

### 2. Neo4j (Property Graph Database)

**Purpose**: Graph analytics, visualization, and fast traversals

**Key Features**:
- Cypher query language
- n10s plugin for RDF import
- Auto-sync with GraphDB
- Full-text search indexes
- APOC procedures

**Configuration**:
```yaml
Image: neo4j:5.15
Ports:
  - 7474 (HTTP)
  - 7687 (Bolt)
Auth: neo4j/password
Plugins: n10s, apoc
```

**Auto-Sync Service**:
- Polling interval: 30 seconds
- Syncs from GraphDB graph: `http://example.com/data`
- Clears old data before sync
- Uses n10s RDF import

**Sample Cypher Query**:
```cypher
MATCH (p:ex__Person)-[:ex__worksFor]->(o:ex__OrgUnit)
RETURN p.ex__fullName AS person, o.ex__name AS org
LIMIT 10
```

**Indexes**:
- `person_email` on `ex__Person.ex__email`
- `person_fullname` on `ex__Person.ex__fullName`
- `orgunit_name` on `ex__OrgUnit.ex__name`

---

### 3. API Gateway (NestJS)

**Purpose**: Secure, unified API endpoint for knowledge graph access

**Architecture**:
```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── auth/                      # Authentication & Authorization
│   ├── jwt.strategy.ts        # JWT validation (DEV: no signature check)
│   ├── jwt-auth.guard.ts      # Auth guard
│   ├── roles.guard.ts         # RBAC guard
│   └── security-clearance.guard.ts  # ABAC guard
├── sparql/                    # SPARQL proxy service
│   ├── sparql.service.ts      # Query execution + label filtering
│   └── sparql.controller.ts   # REST endpoints
├── graphql/                   # GraphQL API
│   ├── resolvers/             # GraphQL resolvers
│   └── schema.gql             # Schema definition
├── rest/                      # REST API controllers
│   └── controllers/           # Entity endpoints
├── cache/                     # Redis caching
│   └── cache.service.ts       # Cache abstraction
├── metrics/                   # Prometheus metrics
│   └── metrics.service.ts     # Custom metrics
└── health/                    # Health checks
    └── health.controller.ts   # /health endpoint
```

**Key Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/metrics` | Prometheus metrics | No |
| GET | `/api` | Swagger docs | No |
| POST | `/ekg/sparql/query` | Execute SPARQL SELECT | Yes (Viewer+) |
| POST | `/ekg/sparql/update` | Execute SPARQL UPDATE | Yes (Steward+) |
| GET | `/ekg/persons` | List persons | Yes (Viewer+) |
| GET | `/ekg/orgunits` | List org units | Yes (Viewer+) |
| GET | `/ekg/quarantine` | List quarantined data | Yes (Curator+) |
| POST | `/ekg/quarantine/:id/approve` | Approve quarantine | Yes (Curator+) |

**Security Flow**:
1. Extract JWT from `Authorization: Bearer <token>`
2. Decode JWT payload (DEV MODE: no signature verification)
3. Extract `realm_access.roles` or `roles` array
4. Map roles to security clearances:
   - `viewer` → [Public, Internal]
   - `curator` → [Public, Internal, Confidential]
   - `steward/admin` → [Public, Internal, Confidential, Secret]
5. Inject SPARQL FILTER for label-based access control
6. Post-filter results by security label

**Example Security Filter**:
```sparql
OPTIONAL { ?entity ex:label ?securityLabel }
FILTER (!BOUND(?securityLabel) || ?securityLabel IN (ex:Public, ex:Internal))
```

---

### 4. Apache Airflow (ETL Orchestration)

**Purpose**: Automate data ingestion, transformation, and quality monitoring

**DAG: `ekg_ingest_pipeline`**

**Pipeline Stages**:

```
┌──────────────┐
│ Extract CSV  │ (30s)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Transform RDF │ (1-2 min)
│ csv_to_rdf.py│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ SHACL Valid  │ (30s)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Sanity Checks │ (30s)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Collect Metric│ (10s)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Quality Mon.  │ (20s)
│→ Prometheus  │
└──────────────┘
```

**Task Details**:

1. **Extract CSV** (`extract_csv`)
   - Validates presence of CSV files in `/opt/airflow/seed/`
   - Required files: `orgunits.csv`, `persons.csv`, `products.csv`, `projects.csv`, `assets.csv`
   - Counts rows in each file
   - Pushes metadata to XCom

2. **Transform CSV to RDF** (`transform_csv_to_rdf`)
   - Runs `csv_to_rdf.py` script
   - Converts CSV → Turtle (TTL) format
   - Output directory: `/opt/airflow/generated/`
   - Applies namespace prefixes: `ex:`, `prov:`, `xsd:`
   - Adds provenance metadata: `prov:wasDerivedFrom`, `prov:generatedAtTime`
   - Adds security labels: `ex:label ex:Public/Internal/Confidential/Secret`

3. **SHACL Validation** (`shacl_validation`)
   - Runs `validate_shacl.py`
   - Validates against SHACL shapes in GraphDB
   - Checks cardinality, datatypes, value ranges
   - Logs violations

4. **Sanity Checks** (`sanity_checks`)
   - Runs `run_sanity_checks.sh`
   - SPARQL queries to check data integrity:
     - Orphaned references (e.g., person → non-existent orgUnit)
     - Missing required properties
     - Duplicate emails
     - Invalid date ranges

5. **Collect Metrics** (`collect_metrics`)
   - Aggregates pipeline statistics
   - Pushes to XCom for downstream tasks

6. **Quality Monitor** (`quality_monitor`)
   - Runs `quality_monitor.py`
   - Calculates quality score (0-100)
   - Pushes metrics to Prometheus Pushgateway
   - Generates JSON report

**Airflow Configuration**:
- Executor: LocalExecutor (single-machine)
- Database: PostgreSQL (metadata)
- Scheduler: Checks DAGs every 30s
- Web UI: Port 8080
- Default User: admin/admin

---

### 5. Keycloak (Authentication & Authorization)

**Purpose**: OIDC/OAuth2 identity provider

**Configuration**:
- Realm: `ekg`
- Port: 8180 (HTTP), 9000 (Management)
- Admin: admin/admin
- Database: PostgreSQL

**Realm Structure**:
```
ekg (realm)
├── Clients
│   ├── ekg-api (confidential client)
│   └── postman (public client for testing)
├── Roles
│   ├── viewer
│   ├── curator
│   ├── steward
│   └── admin
└── Users
    ├── alice.viewer (viewer role)
    ├── bob.curator (curator role)
    ├── carol.steward (steward role)
    └── dave.admin (admin role)
```

**Token Endpoint**:
```bash
POST http://localhost:8180/realms/ekg/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=postman&
username=alice.viewer&
password=viewer123&
grant_type=password
```

**Token Claims**:
```json
{
  "sub": "user-uuid",
  "preferred_username": "alice.viewer",
  "email": "alice@example.com",
  "realm_access": {
    "roles": ["viewer"]
  },
  "exp": 1702500000,
  "iat": 1702499700
}
```

**Health Endpoints** (Port 9000):
- `/health` - Overall health
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe
- `/metrics` - Prometheus metrics

---

### 6. Prometheus + Grafana (Observability)

**Prometheus Configuration**:

**Scrape Jobs**:
- `prometheus` (self) - 15s interval
- `graphdb` - 30s interval (`/rest/monitor/infrastructure`)
- `api-gateway` - 15s interval (`/metrics`)
- `pushgateway` - 15s interval (ETL metrics)

**Alert Rules** (future):
- `ekg_alerts.yml` - Service health, resource limits
- `quality_alerts.yml` - Data quality thresholds

**Grafana Dashboards**:

1. **EKG Performance Dashboard**:
   - GraphDB heap memory (used vs max)
   - GraphDB CPU load
   - Disk space free
   - API Gateway request rate
   - API Gateway memory usage
   - Service health status (up/down)

2. **EKG Quality Monitor**:
   - Quality score (0-100)
   - SHACL violations count
   - Sanity check results
   - ETL pipeline success rate

**Access**:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

**Custom Metrics** (from API Gateway):
- `http_requests_total{method, path, status}`
- `http_request_duration_seconds{method, path}`
- `cache_hits_total{cache_key}`
- `cache_misses_total{cache_key}`
- `sparql_queries_total{user, clearance}`

---

## Data Flow & Processing Pipeline

### CSV to Knowledge Graph: Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: SOURCE DATA (CSV Files)                                 │
│ Location: /seed/                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ETL PIPELINE (Airflow DAG)                              │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 2a. CSV Extraction                                       │   │
│ │ - Validate files exist                                   │   │
│ │ - Count rows                                             │   │
│ └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 2b. CSV → RDF Transformation (csv_to_rdf.py)            │   │
│ │ - Read CSV rows                                          │   │
│ │ - Generate RDF triples in Turtle format                 │   │
│ │ - Add security labels (ex:label)                        │   │
│ │ - Add provenance (prov:wasDerivedFrom)                  │   │
│ │ - Output: /generated/*.ttl                              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 2c. SHACL Validation                                     │   │
│ │ - Load SHACL shapes from GraphDB                        │   │
│ │ - Validate generated RDF                                 │   │
│ │ - Report violations (if any)                            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 2d. Sanity Checks                                        │   │
│ │ - Check referential integrity                           │   │
│ │ - Validate business rules                               │   │
│ └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: LOAD TO GRAPHDB (Manual Import via UI)                  │
│ - Navigate to http://localhost:7200                            │
│ - Import → RDF → Select repository 'ekg'                       │
│ - Upload generated/*.ttl files                                 │
│ - Choose graph: http://example.com/data                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: AUTO-SYNC TO NEO4J                                      │
│ - Neo4j-AutoSync service polls GraphDB every 30s               │
│ - Detects triple count change                                  │
│ - Clears old Neo4j data                                        │
│ - Imports RDF via n10s.rdf.import.fetch                        │
│ - Creates property graph nodes/relationships                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: QUERY ACCESS                                            │
│                                                                  │
│ ┌──────────────────────┐      ┌──────────────────────┐         │
│ │  GraphDB             │      │  Neo4j               │         │
│ │  SPARQL Queries      │      │  Cypher Queries      │         │
│ │  via API Gateway     │      │  Direct Browser      │         │
│ └──────────────────────┘      └──────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Example Data Transformation

**Input CSV** (`persons.csv`):
```csv
id,fullName,email,orgUnitId,role,hasRole,label,validFrom
P001,Ali Hassan,ali@acme.com,ORG001,Data Scientist,Curator,Internal,2024-01-01T00:00:00Z
```

**Output RDF** (Turtle):
```turtle
@prefix ex: <http://example.com/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

ex:P001 a ex:Person ;
    ex:fullName "Ali Hassan" ;
    ex:email "ali@acme.com" ;
    ex:worksFor ex:ORG001 ;
    ex:role "Data Scientist" ;
    ex:hasRole <http://example.com/schema#Curator> ;
    ex:label <http://example.com/schema#Internal> ;
    ex:validFrom "2024-01-01T00:00:00Z"^^xsd:dateTime ;
    prov:wasDerivedFrom "seed/persons.csv" ;
    ex:classifiedAt "2025-12-14T10:30:00Z"^^xsd:dateTime ;
    prov:generatedAtTime "2025-12-14T10:30:00Z"^^xsd:dateTime .
```

**Neo4j Node** (after sync):
```
(:ex__Person {
  uri: "http://example.com/schema#P001",
  ex__fullName: "Ali Hassan",
  ex__email: "ali@acme.com",
  ex__role: "Data Scientist",
  ex__validFrom: "2024-01-01T00:00:00Z"
})
-[:ex__worksFor]->
(:ex__OrgUnit {
  uri: "http://example.com/schema#ORG001"
})
```

---

## Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: AUTHENTICATION (Keycloak JWT)                          │
│ - OIDC/OAuth2 token validation                                 │
│ - User identity verification                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: AUTHORIZATION (RBAC)                                   │
│ - Role-based guards check user roles                           │
│ - Roles: viewer, curator, steward, admin                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: DATA ACCESS CONTROL (ABAC)                             │
│ - Security clearance mapping                                    │
│ - Label-based filtering in SPARQL queries                      │
│ - Labels: Public, Internal, Confidential, Secret               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: AUDIT TRAIL (Future)                                   │
│ - Log all security events                                       │
│ - Track data access patterns                                    │
└─────────────────────────────────────────────────────────────────┘
```

### RBAC/ABAC Matrix

| Role | Security Clearance | Read Data | Quarantine | SPARQL Update | Audit Logs |
|------|-------------------|-----------|------------|---------------|------------|
| **viewer** | Public, Internal | ✅ | ❌ | ❌ | ❌ |
| **curator** | + Confidential | ✅ | ✅ (approve) | ❌ | ❌ |
| **steward** | + Secret | ✅ | ✅ | ✅ | ❌ |
| **admin** | All levels | ✅ | ✅ | ✅ | ✅ |

### Security Clearance Hierarchy

```
Secret (Level 4)
  └── Confidential (Level 3)
      └── Internal (Level 2)
          └── Public (Level 1)
```

**Access Rule**: Users can access data at their clearance level AND all lower levels.

Example: A `curator` (Confidential clearance) can access:
- ✅ Public data
- ✅ Internal data
- ✅ Confidential data
- ❌ Secret data

### SPARQL Query Filtering

**User Request**:
```sparql
SELECT ?person ?name
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name .
}
```

**Injected Filter** (for `viewer` role):
```sparql
SELECT ?person ?name
WHERE {
  OPTIONAL { ?person ex:label ?securityLabel }
  FILTER (!BOUND(?securityLabel) || ?securityLabel IN (ex:Public, ex:Internal))

  ?person a ex:Person ;
          ex:fullName ?name .
}
```

**Result**: Only persons with labels `Public` or `Internal` are returned.

---

## Deployment & Infrastructure

### Docker Compose Stack

**Network**: `ekg-network` (bridge)

**Volumes**:
- `graphdb-data` - GraphDB repository data
- `graphdb-import` - GraphDB import staging
- `postgres-data` - PostgreSQL databases
- `airflow-logs` - Airflow task logs
- `keycloak-data` - Keycloak realm data
- `prometheus-data` - Prometheus TSDB + Pushgateway
- `grafana-data` - Grafana dashboards
- `redis-data` - Redis persistence

**Service Dependencies**:
```
postgres (base)
  ├── airflow-init
  │   ├── airflow-webserver
  │   └── airflow-scheduler
  └── keycloak

graphdb
  ├── neo4j
  │   └── neo4j-autosync
  ├── api-gateway
  └── airflow (mounts)

redis
  └── api-gateway

pushgateway
  └── prometheus
      └── grafana
```

### Environment Variables

See [infra/env/.env.example](infra/env/.env.example) for complete list.

**Key Variables**:
```env
# PostgreSQL
POSTGRES_USER=ekg_admin
POSTGRES_PASSWORD=ChangeMe123!

# Airflow
AIRFLOW_USER=admin
AIRFLOW_PASSWORD=admin
AIRFLOW_FERNET_KEY=<generated>

# GraphDB
GRAPHDB_URL=http://graphdb:7200
GRAPHDB_REPOSITORY=ekg

# Keycloak
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=ekg
KEYCLOAK_ADMIN=admin

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# API Gateway
NODE_ENV=development
PORT=3000

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Grafana
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin
```

### Health Checks

All services have custom health checks with appropriate timeouts:

| Service | Check Type | Timeout | Interval | Start Period |
|---------|-----------|---------|----------|--------------|
| postgres | `pg_isready` | 10s | 10s | 180s |
| graphdb | `wget /rest/repositories` | 10s | 30s | 360s |
| neo4j | `wget localhost:7474` | 10s | 10s | 90s |
| keycloak | TCP check port 9000 | 15s | 30s | 420s |
| airflow-webserver | `curl /health` | 10s | 30s | 80s |
| airflow-scheduler | `airflow jobs check` | 20s | 45s | 80s |
| api-gateway | `wget /health` | 10s | 30s | 45s |
| prometheus | `wget /-/healthy` | 10s | 30s | 30s |
| grafana | `wget /api/health` | 10s | 30s | 30s |
| redis | `redis-cli ping` | 3s | 10s | 10s |
| pushgateway | `wget /-/healthy` | 10s | 30s | 10s |

---

## API Reference

### REST API Endpoints

Base URL: `http://localhost:3000`

#### Health Check

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-14T10:00:00.000Z",
  "dependencies": {
    "graphdb": { "status": "up" },
    "keycloak": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

#### SPARQL Query

```http
POST /ekg/sparql/query
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/sparql-query

SELECT ?person ?name WHERE {
  ?person a ex:Person ; ex:fullName ?name .
} LIMIT 10
```

**Response** (SPARQL JSON Results):
```json
{
  "head": { "vars": ["person", "name"] },
  "results": {
    "bindings": [
      {
        "person": { "type": "uri", "value": "http://example.com/schema#P001" },
        "name": { "type": "literal", "value": "Ali Hassan" }
      }
    ]
  }
}
```

#### List Persons

```http
GET /ekg/persons?limit=10&offset=0
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "data": [
    {
      "uri": "http://example.com/schema#P001",
      "fullName": "Ali Hassan",
      "email": "ali@acme.com",
      "orgUnit": "http://example.com/schema#ORG001",
      "role": "Data Scientist",
      "label": "http://example.com/schema#Internal"
    }
  ],
  "meta": {
    "total": 8,
    "limit": 10,
    "offset": 0
  }
}
```

#### Get Quarantine Data

```http
GET /ekg/quarantine
Authorization: Bearer <JWT_TOKEN>
Roles: curator, steward, admin
```

**Response**:
```json
{
  "quarantinedEntities": [],
  "count": 0
}
```

#### SPARQL Update (Restricted)

```http
POST /ekg/sparql/update
Authorization: Bearer <JWT_TOKEN>
Roles: steward, admin
Content-Type: application/sparql-update

PREFIX ex: <http://example.com/schema#>

INSERT DATA {
  GRAPH <http://example.com/data> {
    ex:P999 a ex:Person ;
            ex:fullName "Test User" ;
            ex:email "test@example.com" .
  }
}
```

**Response**: `204 No Content`

### GraphQL API

**Endpoint**: `http://localhost:3000/graphql`

**Schema** (excerpt):
```graphql
type Person {
  uri: String!
  fullName: String!
  email: String!
  worksFor: OrgUnit
  role: String
  label: String
}

type OrgUnit {
  uri: String!
  name: String!
  parentUnit: OrgUnit
  members: [Person!]!
}

type Query {
  persons(limit: Int, offset: Int): [Person!]!
  person(uri: String!): Person
  orgUnits(limit: Int): [OrgUnit!]!
  orgUnit(uri: String!): OrgUnit
}
```

**Sample Query**:
```graphql
query GetPersons {
  persons(limit: 5) {
    uri
    fullName
    email
    worksFor {
      name
    }
  }
}
```

---

## Monitoring & Observability

### Key Metrics

**GraphDB Metrics** (scraped from `/rest/monitor/infrastructure`):
- `graphdb_heap_used_mem` - JVM heap memory used (bytes)
- `graphdb_heap_max_mem` - JVM heap memory max (bytes)
- `graphdb_system_cpu_load` - CPU load percentage
- `graphdb_disk_free_space` - Available disk space (bytes)

**API Gateway Metrics** (exposed on `/metrics`):
- `http_requests_total` - Total HTTP requests by method/path/status
- `http_request_duration_seconds` - Request duration histogram
- `cache_hits_total` - Redis cache hits
- `cache_misses_total` - Redis cache misses
- `sparql_queries_total` - SPARQL queries executed
- `sparql_query_duration_seconds` - Query execution time

**ETL Metrics** (pushed to Pushgateway):
- `ekg_pipeline_success` - Pipeline run success (1=success, 0=fail)
- `ekg_pipeline_duration_seconds` - Total pipeline duration
- `ekg_csv_files_processed` - Number of CSV files processed
- `ekg_ttl_files_generated` - Number of TTL files generated
- `ekg_quality_score` - Overall data quality score (0-100)
- `ekg_shacl_violations` - SHACL violations detected
- `ekg_sanity_check_failures` - Sanity check failures

### Grafana Dashboards

**Dashboard 1: EKG Performance**

Panels:
1. **Service Status** (Gauge)
   - Shows up/down status of all services
   - Query: `up{job=~"graphdb|api-gateway|prometheus"}`

2. **GraphDB Memory** (Graph)
   - Heap used vs heap max
   - Query: `graphdb_heap_used_mem`, `graphdb_heap_max_mem`

3. **API Request Rate** (Graph)
   - Requests per second
   - Query: `rate(http_requests_total[5m])`

4. **API Latency P95** (Graph)
   - 95th percentile response time
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`

5. **Cache Hit Rate** (Stat)
   - Percentage of cache hits
   - Query: `(cache_hits_total / (cache_hits_total + cache_misses_total)) * 100`

**Dashboard 2: EKG Quality Monitor**

Panels:
1. **Quality Score** (Gauge)
   - Overall score 0-100
   - Query: `ekg_quality_score`

2. **SHACL Violations** (Stat)
   - Total violations
   - Query: `ekg_shacl_violations`

3. **ETL Pipeline Success Rate** (Graph)
   - Success/failure over time
   - Query: `ekg_pipeline_success`

4. **Data Freshness** (Stat)
   - Time since last successful pipeline run
   - Query: `time() - ekg_pipeline_last_success_timestamp`

---

## Development Workflow

### Local Development Setup

**Prerequisites**:
- Docker Desktop 20.10+
- Docker Compose 2.0+
- Git 2.30+
- 16GB RAM recommended

**Steps**:

1. **Clone Repository**:
```bash
git clone <repository-url> ekg-project
cd ekg-project
```

2. **Configure Environment**:
```bash
cp infra/env/.env.example infra/env/.env
# Edit .env if needed
```

3. **Build Images**:
```bash
cd infra
docker-compose build
```

4. **Start Services** (with automated startup script):
```bash
# Windows PowerShell
.\start-ekg.ps1

# Linux/Mac
chmod +x start-ekg.sh
./start-ekg.sh
```

5. **Create GraphDB Repository**:
- Open http://localhost:7200
- Setup → Repositories → Create new repository
- ID: `ekg`, Ruleset: OWL-RL, Enable SHACL: ✅

6. **Run ETL Pipeline**:
- Open http://localhost:8080 (admin/admin)
- Enable DAG `ekg_ingest_pipeline`
- Trigger manually

7. **Verify**:
```bash
# Check services
docker-compose ps

# Check GraphDB triple count
curl http://localhost:7200/repositories/ekg/size

# Check Neo4j sync logs
docker logs ekg-neo4j-autosync --tail 50

# Test API
curl http://localhost:3000/health
```

### Making Code Changes

**API Gateway** (NestJS):
```bash
cd infra/api-gateway

# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run start:dev

# Run tests
npm test

# Build for production
npm run build

# Rebuild Docker image
cd ..
docker-compose build api-gateway
docker-compose up -d api-gateway
```

**Airflow DAGs**:
```bash
# Edit DAG file
vi infra/airflow/dags/ekg_ingest.py

# Changes auto-detected by Airflow (no restart needed)
# Check Airflow UI for DAG updates
```

**ETL Scripts**:
```bash
# Edit transformation script
vi infra/airflow/scripts/csv_to_rdf.py

# Test locally
docker exec -it ekg-airflow-scheduler bash
python /opt/airflow/scripts/csv_to_rdf.py /opt/airflow/seed /opt/airflow/generated test_job
```

**Neo4j Sync**:
```bash
# Edit sync script
vi infra/neo4j-sync/sync.py

# Rebuild and restart
cd infra
docker-compose build neo4j-autosync
docker-compose up -d neo4j-autosync

# Monitor logs
docker logs -f ekg-neo4j-autosync
```

### Testing

**Unit Tests** (API Gateway):
```bash
cd infra/api-gateway
npm test
```

**Integration Tests** (Postman Collection):
```bash
# Import collection
tests/TEP-05_postman_collection.json

# Run in Postman or Newman
newman run tests/TEP-05_postman_collection.json
```

**SPARQL Tests**:
```bash
# Test query via curl
curl -X POST http://localhost:7200/repositories/ekg \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  -d "SELECT * WHERE { ?s ?p ?o } LIMIT 10"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Service Won't Start / Unhealthy

**Symptoms**: `docker-compose ps` shows service as `unhealthy` or `restarting`

**Solutions**:
```bash
# Check logs
docker-compose logs <service-name>

# Common issues:
# - Port already in use: Stop conflicting process or change port
# - Insufficient memory: Increase Docker memory limit
# - Dependency not ready: Wait longer for dependencies

# Restart specific service
docker-compose restart <service-name>

# Force recreate
docker-compose up -d --force-recreate <service-name>
```

#### 2. GraphDB Returns Empty Results

**Symptoms**: SPARQL queries return 0 results

**Diagnosis**:
```bash
# Check triple count
curl http://localhost:7200/repositories/ekg/size

# If 0, repository might be empty or wrong repository selected
```

**Solutions**:
- Verify repository `ekg` exists and is selected
- Check if data import completed successfully
- Verify data is in correct graph: `http://example.com/data`

#### 3. Neo4j Not Syncing

**Symptoms**: Neo4j shows no nodes after GraphDB import

**Diagnosis**:
```bash
# Check sync logs
docker logs ekg-neo4j-autosync --tail 100

# Look for errors like:
# - "No data in GraphDB graph"
# - "Connection refused"
# - "n10s not initialized"
```

**Solutions**:
```bash
# Restart sync service
docker-compose restart neo4j-autosync

# Verify GraphDB has data
curl "http://localhost:7200/repositories/ekg/statements?context=%3Chttp://example.com/data%3E"

# Check Neo4j connectivity
docker exec ekg-neo4j-autosync ping -c 3 graphdb
```

#### 4. Keycloak Returns 401 Unauthorized

**Symptoms**: API Gateway rejects all requests with 401

**Diagnosis**:
```bash
# Test token generation
curl -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=postman&username=alice.viewer&password=viewer123&grant_type=password"

# Should return JSON with access_token
```

**Solutions**:
- Verify Keycloak realm `ekg` exists
- Check user credentials (alice.viewer/viewer123)
- Ensure client `postman` is configured
- Token might be expired (TTL: 5 minutes) - request new token

#### 5. Airflow DAG Fails

**Symptoms**: DAG tasks show red (failed) in Airflow UI

**Diagnosis**:
```bash
# View task logs in Airflow UI
# Click task → Log

# Common errors:
# - ModuleNotFoundError: Missing Python dependencies
# - FileNotFoundError: Volume mount issue
# - SHACL validation failed: Invalid data
```

**Solutions**:
```bash
# For missing dependencies, recreate containers
docker-compose up -d --force-recreate airflow-scheduler airflow-webserver

# For file issues, check volume mounts
docker exec ekg-airflow-scheduler ls -la /opt/airflow/seed
docker exec ekg-airflow-scheduler ls -la /opt/airflow/scripts

# For SHACL errors, check generated TTL files
docker exec ekg-airflow-scheduler cat /opt/airflow/generated/persons.ttl
```

#### 6. Prometheus Not Scraping Metrics

**Symptoms**: Grafana shows "No Data" for all panels

**Diagnosis**:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Should show all targets as "up"
```

**Solutions**:
```bash
# Restart Prometheus
docker-compose restart prometheus

# Verify service endpoints
curl http://localhost:7200/rest/monitor/infrastructure
curl http://localhost:3000/metrics
curl http://localhost:9091/metrics
```

#### 7. Out of Memory Errors

**Symptoms**: Services crash with OOM errors, Docker becomes unresponsive

**Solutions**:
```bash
# Increase Docker memory limit (Docker Desktop → Settings → Resources)
# Recommended: 8GB minimum, 16GB preferred

# Reduce GraphDB JVM heap
# Edit docker-compose.yml:
# GDB_JAVA_OPTS: -Xmx1g -Xms512m

# Clear unused Docker resources
docker system prune -a
docker volume prune
```

---

## Configuration Reference

### GraphDB Configuration

**JVM Options** (`docker-compose.yml`):
```yaml
GDB_JAVA_OPTS: >-
  -Xmx2g -Xms1g
  -Dgraphdb.connector.port=7200
  -Dgraphdb.workbench.cors.enable=true
  -Dgraphdb.workbench.importDirectory=/root/graphdb-import
```

**Repository Settings** (manual setup):
- Repository ID: `ekg`
- Ruleset: OWL-RL (Optimized)
- SHACL Validation: Enabled
- Consistency Checks: Enabled

### Neo4j Configuration

**Environment Variables**:
```yaml
NEO4J_AUTH: neo4j/password
NEO4J_PLUGINS: '["n10s", "apoc"]'
NEO4J_dbms_security_procedures_unrestricted: "n10s.*,apoc.*"
NEO4J_dbms_security_procedures_allowlist: "n10s.*,apoc.*"
NEO4J_apoc_import_file_enabled: "true"
NEO4J_apoc_trigger_enabled: "true"
```

**n10s Configuration** (auto-initialized by sync service):
```cypher
CALL n10s.graphconfig.init({
    handleVocabUris: 'SHORTEN',
    handleMultival: 'ARRAY',
    handleRDFTypes: 'LABELS',
    multivalPropList: ['http://example.com/schema#role', 'http://example.com/schema#label']
})
```

### Airflow Configuration

**Executor**: LocalExecutor (single-node)

**Database Connection**:
```
postgresql+psycopg2://ekg_admin:ChangeMe123!@postgres:5432/airflow
```

**DAG Configuration**:
```python
default_args = {
    'owner': 'ekg-team',
    'depends_on_past': False,
    'email_on_failure': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=1),
    'execution_timeout': timedelta(minutes=30),
}
```

### Keycloak Configuration

**Realm Settings**:
- Realm: `ekg`
- Token Lifespan: 5 minutes (default)
- Refresh Token Lifespan: 30 minutes
- SSL Required: None (dev mode)

**Client Settings** (postman):
- Access Type: Public
- Direct Access Grants: Enabled
- Valid Redirect URIs: *

**Client Settings** (ekg-api):
- Access Type: Confidential
- Service Accounts: Enabled

### Prometheus Configuration

**Global Settings**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'ekg-dev'
    environment: 'development'
```

**Scrape Configs**: See [infra/prometheus/prometheus.yml](infra/prometheus/prometheus.yml)

### Redis Configuration

**Persistence**:
```
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
```

**Memory Management**:
```
maxmemory 512mb
maxmemory-policy allkeys-lru
```

---

## Appendix

### Port Reference

| Port | Service | Protocol | Description |
|------|---------|----------|-------------|
| 3000 | API Gateway | HTTP | REST + GraphQL API |
| 3001 | Grafana | HTTP | Monitoring dashboards |
| 5432 | PostgreSQL | TCP | Database (internal) |
| 6379 | Redis | TCP | Cache (internal) |
| 7200 | GraphDB | HTTP | RDF triplestore + SPARQL |
| 7474 | Neo4j | HTTP | Browser UI |
| 7687 | Neo4j | Bolt | Cypher query protocol |
| 8080 | Airflow | HTTP | Web UI + API |
| 8180 | Keycloak | HTTP | Admin console + OIDC |
| 9000 | Keycloak | HTTP | Management/health |
| 9090 | Prometheus | HTTP | Metrics + PromQL |
| 9091 | Pushgateway | HTTP | Batch metrics |

### File Structure

```
infra/
├── docker-compose.yml          # Main orchestration file
├── env/
│   └── .env.example            # Environment variables template
├── airflow/
│   ├── dags/
│   │   └── ekg_ingest.py       # ETL pipeline DAG
│   ├── scripts/
│   │   ├── csv_to_rdf.py       # CSV → RDF converter
│   │   ├── validate_shacl.py   # SHACL validator
│   │   ├── quality_monitor.py  # Quality metrics
│   │   └── run_sanity_checks.sh
│   └── plugins/                # Custom Airflow plugins
├── api-gateway/
│   ├── src/
│   │   ├── main.ts
│   │   ├── auth/               # JWT + RBAC + ABAC
│   │   ├── sparql/             # SPARQL proxy
│   │   ├── graphql/            # GraphQL API
│   │   ├── rest/               # REST API
│   │   ├── cache/              # Redis caching
│   │   ├── metrics/            # Prometheus metrics
│   │   └── health/             # Health checks
│   ├── Dockerfile
│   └── package.json
├── neo4j-sync/
│   ├── sync.py                 # Auto-sync service
│   └── Dockerfile
├── neo4j/
│   ├── plugins/                # n10s + apoc JARs
│   └── data/                   # Database files
├── prometheus/
│   ├── prometheus.yml          # Scrape configuration
│   └── alerts/                 # Alert rules
├── grafana/
│   ├── provisioning/
│   │   └── datasources/        # Prometheus datasource
│   └── dashboards/             # JSON dashboards
├── keycloak/
│   └── realm-export.json       # Realm configuration
└── scripts/
    ├── start-ekg.ps1           # Windows startup
    ├── start-ekg.sh            # Linux/Mac startup
    └── healthcheck.ps1         # Health check script
```

### Glossary

- **ABAC**: Attribute-Based Access Control - access control based on attributes (e.g., security clearance)
- **APOC**: Awesome Procedures On Cypher - Neo4j extension library
- **DAG**: Directed Acyclic Graph - Airflow workflow definition
- **ETL**: Extract, Transform, Load - data processing pipeline
- **n10s**: Neosemantics - Neo4j plugin for RDF/Linked Data
- **OIDC**: OpenID Connect - authentication layer on OAuth 2.0
- **OWL-RL**: Web Ontology Language - Rule Language profile for reasoning
- **RBAC**: Role-Based Access Control - access control based on roles
- **SHACL**: Shapes Constraint Language - RDF data validation
- **SPARQL**: SPARQL Protocol and RDF Query Language
- **TTL**: Turtle - RDF serialization format

---

## Support & Resources

### Documentation

- [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md) - 5-step setup guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design overview
- [docs/WALKTHROUGH_COMPLET_A_Z.md](docs/WALKTHROUGH_COMPLET_A_Z.md) - Complete tutorial
- [infra/HEALTHCHECK_SOLUTION.md](infra/HEALTHCHECK_SOLUTION.md) - Health check details
- [infra/KEYCLOAK_NOTES.md](infra/KEYCLOAK_NOTES.md) - Keycloak configuration notes

### External Documentation

- [GraphDB Documentation](https://graphdb.ontotext.com/documentation/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Apache Airflow](https://airflow.apache.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Prometheus Documentation](https://prometheus.io/docs/)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-14
**Maintained By**: EKG Team
