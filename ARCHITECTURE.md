# Architecture du Système EKG (Enterprise Knowledge Graph)

**Version**: 1.0 Final
**Date**: 2025-12-13
**Projet**: Graphe de Connaissances d'Entreprise Sécurisé

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Technique](#architecture-technique)
3. [Composants du Système](#composants-du-système)
4. [Flux de Données](#flux-de-données)
5. [Modèle de Sécurité](#modèle-de-sécurité)
6. [Modèle de Données](#modèle-de-données)
7. [Automatisation et Monitoring](#automatisation-et-monitoring)
8. [Décisions d'Architecture](#décisions-darchitecture)

---

## Vue d'Ensemble

### Objectif du Système

Le système EKG est un **graphe de connaissances d'entreprise sécurisé** qui permet de:

- 🔄 **Intégrer** des données provenant de sources CSV
- 🔍 **Transformer** les données en RDF (Resource Description Framework)
- ✅ **Valider** les données avec SHACL (Shapes Constraint Language)
- 🔐 **Sécuriser** l'accès aux données sensibles (RBAC/ABAC)
- 📊 **Interroger** les données via SPARQL et Cypher
- 📈 **Monitorer** la qualité et les performances
- 🔁 **Synchroniser** automatiquement les bases de données

### Cas d'Usage

1. **Gestion des Personnes**: Employés, rôles, organisations, clearances de sécurité
2. **Gestion des Assets**: Équipements, propriétaires, classifications
3. **Gestion des Projets**: Projets, responsables, dates, statuts
4. **Gestion des Produits**: Produits, managers, versions
5. **Gouvernance des Données**: Provenance, traçabilité, audit, qualité

### Technologies Principales

| Catégorie | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Triplestore RDF** | GraphDB | 10.8.1 | Stockage et requête SPARQL |
| **Graph Database** | Neo4j | 5.15 | Graphe de propriétés + Cypher |
| **Authentification** | Keycloak | 26.0.7 | OAuth2/OIDC, RBAC |
| **API Gateway** | NestJS | 10.x | REST API sécurisée |
| **ETL/Orchestration** | Apache Airflow | 2.10.3 | Pipelines de données |
| **Monitoring** | Prometheus + Grafana | 3.0 + 11.3 | Métriques et dashboards |
| **Base Relationnelle** | PostgreSQL | 16 | Metadata Airflow/Keycloak |
| **Cache** | Redis | 7.4 | Sessions et cache |

---

## Architecture Technique

### Diagramme d'Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          UTILISATEURS / CLIENTS                          │
│                    (Postman, Web UI, Applications)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         COUCHE SÉCURITÉ                                  │
│  ┌──────────────┐          ┌─────────────────────────────────┐          │
│  │  Keycloak    │◄─────────┤      API Gateway (NestJS)       │          │
│  │  (OAuth2)    │  Validate│  - JWT Validation               │          │
│  │              │    Token │  - RBAC/ABAC Enforcement        │          │
│  └──────────────┘          │  - Security Label Filtering     │          │
│                            └─────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        COUCHE DONNÉES                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   GraphDB    │   │    Neo4j     │   │  PostgreSQL  │                │
│  │ (RDF Store)  │   │ (Property    │   │  (Metadata)  │                │
│  │              │   │  Graph)      │   │              │                │
│  │ • SPARQL     │   │ • Cypher     │   │ • Airflow    │                │
│  │ • SHACL      │   │ • n10s RDF   │   │ • Keycloak   │                │
│  │ • Ontologies │   │ • Auto-sync  │   │              │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│         ▲                  ▲                                             │
│         │                  │ Auto-sync                                   │
│         │                  │ (every 30s)                                 │
│         │           ┌──────┴──────┐                                      │
│         │           │ Neo4j-Sync  │                                      │
│         │           │  (Python)   │                                      │
│         │           └─────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │ Load Data
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      COUCHE ETL/ORCHESTRATION                            │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │              Apache Airflow (DAG Scheduler)              │            │
│  │  ┌────────────┐ ┌─────────────┐ ┌────────────┐         │            │
│  │  │  Extract   │→│ Transform   │→│  Validate  │         │            │
│  │  │ (CSV→RDF)  │ │ (Enrich)    │ │  (SHACL)   │         │            │
│  │  └────────────┘ └─────────────┘ └────────────┘         │            │
│  │         │                │              │                │            │
│  │         ▼                ▼              ▼                │            │
│  │  ┌────────────┐ ┌─────────────┐ ┌────────────┐         │            │
│  │  │   Sanity   │→│   Metrics   │→│  Quality   │         │            │
│  │  │  Checks    │ │  Collector  │ │  Monitor   │         │            │
│  │  └────────────┘ └─────────────┘ └────────────┘         │            │
│  └─────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Push Metrics
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    COUCHE MONITORING                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │ Prometheus   │──▶│   Grafana    │   │ Pushgateway  │                │
│  │ (Metrics DB) │   │ (Dashboards) │◄──│ (Metrics)    │                │
│  │              │   │              │   │              │                │
│  │ • Scraping   │   │ • Perf. Mon. │   │ • Quality    │                │
│  │ • GraphDB    │   │ • Quality    │   │ • Custom     │                │
│  │ • API GW     │   │ • Alerts     │   │              │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architecture en Couches

Le système suit une **architecture en 5 couches**:

1. **Couche Présentation**: Clients (Postman, Web UI)
2. **Couche Sécurité**: Keycloak + API Gateway
3. **Couche Données**: GraphDB, Neo4j, PostgreSQL
4. **Couche ETL**: Airflow (pipelines de transformation)
5. **Couche Monitoring**: Prometheus, Grafana, Pushgateway

---

## Composants du Système

### 1. GraphDB (Triplestore RDF)

**Rôle**: Stockage principal des données RDF et ontologies

**Caractéristiques**:
- **Type**: Base de données orientée graphe RDF
- **Langage de requête**: SPARQL 1.1
- **Validation**: SHACL (Shapes Constraint Language)
- **Graphes nommés**:
  - `http://example.com/ontology` - Ontologies OWL
  - `http://example.com/data` - Données métier
  - `http://rdf4j.org/schema/rdf4j#SHACLShapeGraph` - Contraintes SHACL

**Capacités**:
- ✅ Inférence OWL-RL (raisonnement sémantique)
- ✅ Requêtes SPARQL fédérées
- ✅ Validation SHACL automatique
- ✅ API REST (RDF4J)
- ✅ Interface web Workbench

**Métriques exposées** (Prometheus):
- `graphdb_heap_used_mem` - Mémoire utilisée
- `graphdb_heap_max_mem` - Mémoire maximale
- `graphdb_cpu_load` - Charge CPU
- `graphdb_data_dir_free` - Espace disque

**Volumes persistants**:
- `graphdb-data:/opt/graphdb/home` - Données et configuration

### 2. Neo4j (Property Graph Database)

**Rôle**: Base de données graphe pour requêtes Cypher et visualisations

**Caractéristiques**:
- **Type**: Base de données orientée graphe de propriétés
- **Langage de requête**: Cypher
- **Plugin**: n10s (neosemantics) pour import RDF
- **Auto-sync**: Synchronisation automatique avec GraphDB toutes les 30 secondes

**Architecture n10s**:
```
GraphDB (RDF/SPARQL)
    │
    │ HTTP GET /statements?context=<http://example.com/data>
    │
    ▼
neo4j-autosync (Python)
    │
    │ n10s.rdf.import.fetch()
    │
    ▼
Neo4j (Property Graph/Cypher)
```

**Transformation RDF → Neo4j**:
- **Classes RDF** → **Labels Neo4j**: `ex:Person` → `:ex__Person`
- **Propriétés RDF** → **Properties Neo4j**: `ex:fullName` → `ex__fullName`
- **Relations RDF** → **Relationships Neo4j**: `ex:worksFor` → `:ex__worksFor`

**Configuration n10s**:
```cypher
CALL n10s.graphconfig.init({
  handleVocabUris: 'SHORTEN',      // Raccourcit les URIs
  handleMultival: 'ARRAY',         // Propriétés multi-valuées → tableaux
  handleRDFTypes: 'LABELS',        // Types RDF → labels Neo4j
  multivalPropList: ['ex:role', 'ex:label']
})
```

**Indexes créés**:
- `person_email` - Index sur `ex__Person.ex__email`
- `person_fullname` - Index sur `ex__Person.ex__fullName`
- `orgunit_name` - Index sur `ex__OrgUnit.ex__name`
- `product_name` - Index sur `ex__Product.ex__name`
- `security_label` - Index sur `Resource.ex__label`

**Volumes persistants**:
- `./neo4j/data:/data` - Base de données Neo4j
- `./neo4j/plugins:/var/lib/neo4j/plugins` - Plugins (n10s, APOC)

### 3. Neo4j Auto-Sync Service

**Rôle**: Service Python autonome pour synchronisation automatique GraphDB ↔ Neo4j

**Implémentation**: `infra/neo4j-sync/sync.py`

**Algorithme**:
```python
while True:
    # 1. Récupérer le nombre de triplets dans GraphDB
    graphdb_count = get_graphdb_triple_count()

    # 2. Comparer avec le dernier compte connu
    if graphdb_count != last_count:
        # 3. Changement détecté → synchroniser
        clear_neo4j_data()
        import_from_graphdb()
        last_count = graphdb_count
        print(f"✓ Synced! Triples: {graphdb_count}")
    else:
        # 4. Pas de changement
        print(f"No changes ({graphdb_count} triples)")

    # 5. Attendre 30 secondes
    sleep(30)
```

**Avantages**:
- ✅ **Automatique**: Pas d'intervention manuelle
- ✅ **Smart**: Sync seulement si changements détectés
- ✅ **Robuste**: Gestion des erreurs, reconnexion automatique
- ✅ **Persistant**: Redémarre avec Docker Compose
- ✅ **Configurable**: Intervalle via variable d'environnement `SYNC_INTERVAL`

**Variables d'environnement**:
```yaml
NEO4J_URI: bolt://neo4j:7687
NEO4J_USER: neo4j
NEO4J_PASS: password
GRAPHDB_URL: http://graphdb:7200
GRAPHDB_REPO: ekg
SYNC_INTERVAL: "30"  # secondes
```

### 4. Keycloak (Authentification)

**Rôle**: Serveur d'authentification OAuth2/OpenID Connect

**Configuration**:
- **Realm**: `ekg`
- **Client public**: `postman` (pour tests Postman)
- **Protocole**: OAuth2 Password Grant (pour API)

**Utilisateurs de test**:

| Username | Password | Rôle | Clearance | Description |
|----------|----------|------|-----------|-------------|
| alice.viewer | viewer123 | viewer | Public, Internal | Utilisateur basique |
| bob.curator | curator123 | curator | + Confidential | Curateur de données |
| carol.steward | steward123 | steward | + Secret | Data steward |
| dave.admin | admin123 | admin | + Secret | Administrateur |

**Flux d'authentification**:
```
1. Client → POST /realms/ekg/protocol/openid-connect/token
           (username, password, client_id, grant_type)

2. Keycloak → Validation credentials

3. Keycloak → Retourne JWT access_token
           {
             "access_token": "eyJhbG...",
             "expires_in": 300,
             "token_type": "Bearer"
           }

4. Client → GET /ekg/persons
           Authorization: Bearer eyJhbG...

5. API Gateway → Valide le token avec Keycloak
              → Extrait les rôles du JWT
              → Applique les filtres ABAC

6. API Gateway → Retourne les données filtrées
```

**JWT Token (décodé)**:
```json
{
  "sub": "2d431c8e-37e9-4c98-a6c1-498a47e27421",
  "realm_access": {
    "roles": ["viewer"]
  },
  "preferred_username": "alice.viewer",
  "email": "alice.viewer@example.com",
  "name": "Alice Viewer"
}
```

**Volumes persistants**:
- `keycloak-data:/opt/keycloak/data`

### 5. API Gateway (NestJS)

**Rôle**: API REST sécurisée avec RBAC/ABAC

**Endpoints principaux**:

| Endpoint | Méthode | Rôle requis | Description |
|----------|---------|-------------|-------------|
| `/ekg/persons` | GET | viewer+ | Liste des personnes (filtré par label) |
| `/ekg/orgunits` | GET | viewer+ | Unités organisationnelles |
| `/ekg/products` | GET | viewer+ | Produits |
| `/ekg/quarantine` | GET | curator+ | Données en quarantaine |
| `/ekg/quarantine/approve` | POST | curator+ | Approuver une entité |
| `/ekg/sparql/query` | POST | viewer+ | Requête SPARQL (filtrage auto) |
| `/ekg/sparql/update` | POST | steward+ | Mise à jour SPARQL |
| `/audit/logs` | GET | admin | Logs d'audit |
| `/metrics` | GET | public | Métriques Prometheus |

**Middleware de sécurité**:

1. **JwtAuthGuard**: Valide le token JWT avec Keycloak
2. **RolesGuard**: Vérifie que l'utilisateur a le rôle requis
3. **SecurityLabelFilter**: Filtre les résultats selon le clearance level

**Exemple de filtrage ABAC** (dans SPARQL):
```typescript
// Utilisateur avec clearance "Internal"
const allowedLabels = ['Public', 'Internal'];

// Ajout automatique du filtre dans la requête SPARQL
FILTER (?label IN (ex:Public, ex:Internal))
```

**Métriques exposées**:
- `api_requests_total` - Compteur de requêtes
- `api_request_duration_seconds` - Durée des requêtes
- `api_gateway_process_resident_memory_bytes` - Mémoire utilisée
- `api_gateway_process_cpu_user_seconds_total` - CPU utilisé

**Volumes**:
- `./api-gateway:/app` (développement)

### 6. Apache Airflow (Orchestration ETL)

**Rôle**: Orchestration des pipelines de transformation et validation

**DAG principal**: `ekg_ingest`

**6 étapes du pipeline**:

```
1. extract_data
   ├── Lit les CSV dans seed/
   └── Durée: ~30s

2. transform_data
   ├── Convertit CSV → RDF (Turtle)
   ├── Script: csv_to_rdf.py
   ├── Output: data/generated/*.ttl
   └── Durée: ~1min

3. validate_shacl
   ├── Valide les RDF avec SHACL
   ├── Script: validate_shacl.py
   ├── Shapes: shacl/*.ttl
   └── Durée: ~2min

4. run_sanity_checks
   ├── Requêtes SPARQL de validation métier
   ├── Script: sanity_checks.py
   ├── Détecte: duplicats, orphelins, incohérences
   └── Durée: ~1min

5. collect_metrics
   ├── Collecte des statistiques
   ├── Compte les entités, triplets, violations
   └── Durée: ~10s

6. quality_monitor
   ├── Calcule le score de qualité (0-100)
   ├── Push vers Pushgateway (Prometheus)
   ├── Output: quality_report.json
   └── Durée: ~30s
```

**Schédule**: `@daily` (tous les jours à minuit)

**Volumes montés**:
```yaml
- ../seed:/opt/airflow/seed           # Données sources
- ../data:/opt/airflow/data           # Données générées
- ../scripts:/opt/airflow/scripts     # Scripts Python
- ../tests:/opt/airflow/tests         # Tests de sanité
- ./airflow/dags:/opt/airflow/dags   # DAGs
```

**Variables Airflow**:
- `GRAPHDB_URL`: http://graphdb:7200
- `GRAPHDB_REPO`: ekg

**Composants**:
- **Webserver**: Interface web (port 8080)
- **Scheduler**: Exécution des DAGs
- **PostgreSQL**: Metadata database
- **Redis**: Celery broker (optionnel)

### 7. Prometheus (Monitoring)

**Rôle**: Collecte et stockage de métriques time-series

**Targets scrapés** (toutes les 15-30s):

| Job | Endpoint | Intervalle | Métriques |
|-----|----------|------------|-----------|
| prometheus | http://prometheus:9090/metrics | 15s | Auto-monitoring |
| graphdb | http://graphdb:7200/rest/monitor/infrastructure | 30s | Mémoire, CPU, disque |
| api-gateway | http://api-gateway:3000/metrics | 15s | Requêtes HTTP, latence |
| pushgateway | http://pushgateway:9091/metrics | 15s | Métriques custom (qualité) |

**Configuration**: `infra/prometheus/prometheus.yml`

**Requêtes utiles**:
```promql
# Mémoire GraphDB
graphdb_heap_used_mem / graphdb_heap_max_mem * 100

# Taux de requêtes API
rate(api_requests_total[5m])

# Services UP/DOWN
up{job=~"graphdb|api-gateway|pushgateway"}
```

**Volumes**:
- `prometheus-data:/prometheus`
- `./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml`

### 8. Grafana (Dashboards)

**Rôle**: Visualisation des métriques

**Dashboards provisionnés**:

#### 1. EKG Performance Dashboard (TEP-08)
**Panels**:
- **GraphDB Memory Usage**: Heap used vs max (time series)
- **GraphDB CPU Load**: Charge CPU en % (gauge)
- **GraphDB Disk Space Free**: Espace disque disponible (stat)
- **API Gateway Request Rate**: Requêtes/sec (time series)
- **API Gateway Memory**: Mémoire processus (time series)
- **Service Health Status**: État UP/DOWN des services (bar chart)

**Auto-refresh**: 30 secondes

#### 2. EKG Quality Monitor
**Panels**:
- **Quality Score**: Score 0-100 (gauge)
- **SHACL Violations**: Nombre de violations (stat)
- **Sanity Check Results**: Issues détectées (table)
- **Quality Trend**: Évolution du score (time series)

**Source de données**: Prometheus (Pushgateway)

**Provisioning**:
```yaml
# infra/grafana/provisioning/dashboards/dashboard.yml
providers:
  - name: 'EKG Dashboards'
    folder: 'EKG'
    updateIntervalSeconds: 30  # Reload automatique
    path: /var/lib/grafana/dashboards
```

**Volumes**:
- `grafana-data:/var/lib/grafana`
- `./grafana/provisioning:/etc/grafana/provisioning`
- `./grafana/dashboards:/var/lib/grafana/dashboards`

### 9. Pushgateway

**Rôle**: Recevoir les métriques poussées par les jobs batch (Airflow)

**Utilisation dans Airflow**:
```python
# Dans le task quality_monitor
subprocess.run([
    "python", "scripts/quality_monitor.py",
    "--pushgateway", "http://pushgateway:9091",
    "--job", "ekg_quality_monitor"
])
```

**Métriques poussées**:
- `ekg_quality_score` - Score de qualité (0-100)
- `ekg_shacl_violations` - Nombre de violations SHACL
- `ekg_sanity_issues` - Nombre d'issues détectées
- `ekg_triple_count` - Nombre total de triplets
- `ekg_entity_count` - Nombre d'entités par type

### 10. PostgreSQL

**Rôle**: Base de données relationnelle pour Airflow et Keycloak

**Databases**:
- `airflow` - Metadata Airflow (DAGs, task instances, logs)
- `keycloak` - Configuration Keycloak (realms, users, clients)

**Volumes**:
- `postgres-data:/var/lib/postgresql/data`

### 11. Redis

**Rôle**: Cache et broker pour Celery (Airflow)

**Utilisation**:
- Sessions utilisateurs
- Cache de requêtes
- Message queue pour Airflow Celery executor (si activé)

**Volumes**:
- `redis-data:/data`

---

## Flux de Données

### 1. Flux ETL Complet (CSV → RDF → GraphDB → Neo4j)

```
┌──────────────┐
│  seed/*.csv  │ Données sources (Personnes, Orgs, Produits)
└──────┬───────┘
       │
       ▼ Airflow DAG: extract_data
┌──────────────────────────────────────────┐
│  scripts/csv_to_rdf.py                   │
│  ┌────────────────────────────────────┐  │
│  │ Transformation CSV → RDF           │  │
│  │ - Génération URIs                  │  │
│  │ - Typage (ex:Person, ex:OrgUnit)   │  │
│  │ - Relations (ex:worksFor)          │  │
│  │ - Labels de sécurité               │  │
│  │ - Métadonnées provenance           │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │
       ▼ Output: data/generated/*.ttl
┌──────────────────────────────────────────┐
│  persons.ttl, orgunits.ttl,              │
│  products.ttl, assets.ttl, projects.ttl  │
└──────┬───────────────────────────────────┘
       │
       ▼ Airflow DAG: validate_shacl
┌──────────────────────────────────────────┐
│  scripts/validate_shacl.py               │
│  ┌────────────────────────────────────┐  │
│  │ Validation SHACL                   │  │
│  │ - Datatypes corrects?              │  │
│  │ - Cardinalités respectées?         │  │
│  │ - Patterns regex valides?          │  │
│  │ - Relations cohérentes?            │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │
       ▼ Si validation OK
┌──────────────────────────────────────────┐
│  Import Manuel GraphDB                   │
│  1. Ontologies → http://example.com/ontology
│  2. SHACL → http://rdf4j.org/.../SHACLShapeGraph
│  3. Données → http://example.com/data   │
└──────┬───────────────────────────────────┘
       │
       ▼ GraphDB stocke les triplets RDF
┌──────────────────────────────────────────┐
│  GraphDB Repository: ekg                 │
│  - 245 triplets de données               │
│  - 500 triplets d'ontologies             │
│  - 500 triplets SHACL                    │
└──────┬───────────────────────────────────┘
       │
       │ Auto-sync (toutes les 30s)
       │
       ▼ neo4j-autosync service
┌──────────────────────────────────────────┐
│  1. Check GraphDB triple count           │
│  2. Si changement détecté:               │
│     - CLEAR Neo4j data                   │
│     - CALL n10s.rdf.import.fetch()       │
│     - Import RDF → Property Graph        │
│  3. Sinon: attendre 30s                  │
└──────┬───────────────────────────────────┘
       │
       ▼ Neo4j Property Graph
┌──────────────────────────────────────────┐
│  Neo4j Database                          │
│  - 34 nodes (8 Person, 6 OrgUnit, ...)   │
│  - Relationships (worksFor, ownedBy, ...) │
│  - Properties (fullName, email, ...)     │
└──────────────────────────────────────────┘
```

### 2. Flux d'Authentification et Requête API

```
┌─────────────┐
│   Client    │ (Postman, Web App)
│  (Postman)  │
└──────┬──────┘
       │
       │ 1. POST /realms/ekg/protocol/openid-connect/token
       │    {username, password, client_id, grant_type}
       │
       ▼
┌──────────────────────┐
│     Keycloak         │
│  1. Validate creds   │
│  2. Generate JWT     │
│  3. Include roles    │
└──────┬───────────────┘
       │
       │ 2. Return access_token (JWT)
       │    {access_token: "eyJhbG...", expires_in: 300}
       │
       ▼
┌─────────────┐
│   Client    │ Stocke le token
└──────┬──────┘
       │
       │ 3. GET /ekg/persons
       │    Authorization: Bearer eyJhbG...
       │
       ▼
┌──────────────────────────────────────┐
│         API Gateway (NestJS)          │
│  ┌────────────────────────────────┐  │
│  │ 1. JwtAuthGuard                │  │
│  │    - Extract token             │  │
│  │    - Validate with Keycloak    │  │
│  │    - Decode JWT → roles        │  │
│  │                                │  │
│  │ 2. RolesGuard                  │  │
│  │    - Check required role       │  │
│  │    - viewer? curator? admin?   │  │
│  │                                │  │
│  │ 3. Build SPARQL Query          │  │
│  │    - Add security label filter │  │
│  │    - viewer: Public, Internal  │  │
│  │    - curator: + Confidential   │  │
│  │    - steward: + Secret         │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
       │
       │ 4. POST /repositories/ekg
       │    SELECT ?person ?name ...
       │    FILTER (?label IN (ex:Public, ex:Internal))
       │
       ▼
┌──────────────────────┐
│      GraphDB         │
│  Execute SPARQL      │
│  Return filtered     │
│  results             │
└──────┬───────────────┘
       │
       │ 5. SPARQL results (JSON)
       │
       ▼
┌──────────────────────────────────────┐
│         API Gateway                   │
│  Format response                      │
│  {                                    │
│    data: [...],                       │
│    meta: {                            │
│      user: {username, roles, clearance}
│    }                                  │
│  }                                    │
└──────┬───────────────────────────────┘
       │
       │ 6. Return JSON response
       │
       ▼
┌─────────────┐
│   Client    │ Affiche les données filtrées
└─────────────┘
```

### 3. Flux de Monitoring

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   GraphDB    │    │ API Gateway  │    │ Pushgateway  │
│              │    │              │    │              │
│ /rest/monitor│    │ /metrics     │    │ /metrics     │
│ /infrastructure│  │              │    │              │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │ Scrape every 30s  │ Scrape every 15s  │ Scrape every 15s
       │                   │                   │
       ▼                   ▼                   ▼
┌────────────────────────────────────────────────────┐
│              Prometheus                             │
│  ┌──────────────────────────────────────────────┐  │
│  │ Time Series Database                         │  │
│  │ - graphdb_heap_used_mem: 550000000           │  │
│  │ - graphdb_cpu_load: 28.5                     │  │
│  │ - api_requests_total: 1523                   │  │
│  │ - ekg_quality_score: 80                      │  │
│  └──────────────────────────────────────────────┘  │
└────────┬───────────────────────────────────────────┘
         │
         │ PromQL queries (every 30s)
         │
         ▼
┌────────────────────────────────────────────────────┐
│                  Grafana                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ Dashboard: EKG Performance                   │  │
│  │ - Panel 1: graphdb_heap_used_mem (chart)     │  │
│  │ - Panel 2: graphdb_cpu_load (gauge)          │  │
│  │ - Panel 3: up{job="graphdb"} (status)        │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Dashboard: EKG Quality Monitor               │  │
│  │ - Panel 1: ekg_quality_score (gauge)         │  │
│  │ - Panel 2: ekg_shacl_violations (stat)       │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
         │
         │ User views dashboards
         │
         ▼
┌─────────────┐
│  Browser    │ http://localhost:3001
│  (User)     │
└─────────────┘
```

---

## Modèle de Sécurité

### Architecture RBAC + ABAC

Le système implémente un **double niveau de sécurité**:

1. **RBAC (Role-Based Access Control)**: Contrôle d'accès basé sur les rôles
2. **ABAC (Attribute-Based Access Control)**: Filtrage basé sur les attributs (security labels)

### Matrice de Contrôle d'Accès

| Rôle | Clearance | Données Visibles | Peut Lire | Peut Écrire | Quarantine | Audit |
|------|-----------|------------------|-----------|-------------|------------|-------|
| **viewer** | Public, Internal | Données non-sensibles | ✅ | ❌ | ❌ | ❌ |
| **curator** | + Confidential | + Données confidentielles | ✅ | ❌ | ✅ | ❌ |
| **steward** | + Secret | + Données secrètes | ✅ | ✅ | ✅ | ❌ |
| **admin** | + Secret | Toutes les données | ✅ | ✅ | ✅ | ✅ |

### Labels de Sécurité

**Hiérarchie** (du moins au plus sensible):
```
Public < Internal < Confidential < Secret
```

**Application aux données**:
```turtle
# Personne avec label "Confidential"
ex:P_John a ex:Person ;
  ex:fullName "John Smith" ;
  ex:email "john.smith@example.com" ;
  ex:label ex:Confidential .  # Seulement visible par curator+

# Personne avec label "Public"
ex:P_Alice a ex:Person ;
  ex:fullName "Alice Wonder" ;
  ex:label ex:Public .  # Visible par tous
```

### Filtrage SPARQL Automatique

**Dans l'API Gateway**:
```typescript
function buildSecurityFilter(userClearance: string[]): string {
  // Mapping clearance → labels autorisés
  const labelMap = {
    'Public': ['ex:Public'],
    'Internal': ['ex:Public', 'ex:Internal'],
    'Confidential': ['ex:Public', 'ex:Internal', 'ex:Confidential'],
    'Secret': ['ex:Public', 'ex:Internal', 'ex:Confidential', 'ex:Secret']
  };

  const allowedLabels = userClearance.flatMap(c => labelMap[c]);

  return `
    OPTIONAL { ?entity ex:label ?label }
    FILTER (!BOUND(?label) || ?label IN (${allowedLabels.join(', ')}))
  `;
}
```

**Exemple pour viewer**:
```sparql
SELECT ?person ?name
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name .
  OPTIONAL { ?person ex:label ?label }
  FILTER (!BOUND(?label) || ?label IN (ex:Public, ex:Internal))
}
```

**Exemple pour steward**:
```sparql
SELECT ?person ?name
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name .
  OPTIONAL { ?person ex:label ?label }
  FILTER (!BOUND(?label) || ?label IN (ex:Public, ex:Internal, ex:Confidential, ex:Secret))
}
```

### Audit Trail

**Logs d'audit** (stockés dans PostgreSQL via API Gateway):
```json
{
  "timestamp": "2025-12-13T10:30:00Z",
  "user": "alice.viewer",
  "action": "READ",
  "resource": "/ekg/persons",
  "status": "SUCCESS",
  "ip": "192.168.1.100",
  "userAgent": "PostmanRuntime/7.32.0"
}
```

**Requêtes auditées**:
- ✅ Toutes les requêtes API (GET, POST, PUT, DELETE)
- ✅ Tentatives d'accès refusées (403)
- ✅ Échecs d'authentification (401)
- ✅ Modifications SPARQL UPDATE
- ✅ Approbations de quarantaine

---

## Modèle de Données

### Ontologies OWL

**5 modules ontologiques**:

1. **core.ttl** - Classes et propriétés de base
```turtle
ex:Person a owl:Class ;
  rdfs:label "Person" ;
  rdfs:comment "Represents a person in the organization" .

ex:fullName a owl:DatatypeProperty ;
  rdfs:domain ex:Person ;
  rdfs:range xsd:string .

ex:email a owl:DatatypeProperty ;
  rdfs:domain ex:Person ;
  rdfs:range xsd:string .
```

2. **relations.ttl** - Propriétés d'objet (relations)
```turtle
ex:worksFor a owl:ObjectProperty ;
  rdfs:domain ex:Person ;
  rdfs:range ex:OrgUnit ;
  rdfs:label "works for" .

ex:managedBy a owl:ObjectProperty ;
  rdfs:domain ex:Project ;
  rdfs:range ex:Person ;
  rdfs:label "managed by" .
```

3. **security.ttl** - Ontologie de sécurité
```turtle
ex:SecurityLabel a owl:Class ;
  rdfs:label "Security Label" .

ex:Public a ex:SecurityLabel ;
  rdfs:label "Public" .

ex:Confidential a ex:SecurityLabel ;
  rdfs:label "Confidential" .

ex:label a owl:ObjectProperty ;
  rdfs:domain owl:Thing ;
  rdfs:range ex:SecurityLabel .
```

4. **temporal.ttl** - Versioning et validité temporelle
```turtle
ex:validFrom a owl:DatatypeProperty ;
  rdfs:range xsd:dateTime ;
  rdfs:label "valid from" .

ex:validTo a owl:DatatypeProperty ;
  rdfs:range xsd:dateTime ;
  rdfs:label "valid to" .

ex:version a owl:DatatypeProperty ;
  rdfs:range xsd:string .
```

5. **provenance.ttl** - Traçabilité (PROV-O)
```turtle
@prefix prov: <http://www.w3.org/ns/prov#> .

prov:wasDerivedFrom a owl:ObjectProperty ;
  rdfs:label "was derived from" .

prov:wasGeneratedBy a owl:ObjectProperty ;
  rdfs:label "was generated by" .

prov:generatedAtTime a owl:DatatypeProperty ;
  rdfs:range xsd:dateTime .
```

### Contraintes SHACL

**Validation structurelle** (exemples):

```turtle
# shacl/shapes_core.ttl
ex:PersonShape a sh:NodeShape ;
  sh:targetClass ex:Person ;

  # Propriété obligatoire: fullName
  sh:property [
    sh:path ex:fullName ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Person must have exactly one fullName"
  ] ;

  # Propriété obligatoire: email (avec pattern)
  sh:property [
    sh:path ex:email ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
    sh:message "Email must be valid format"
  ] ;

  # Propriété optionnelle: role (multi-valué)
  sh:property [
    sh:path ex:role ;
    sh:datatype xsd:string
  ] .
```

```turtle
# shacl/shapes_provenance.ttl
ex:ProvenanceMetadataShape a sh:NodeShape ;
  sh:targetSubjectsOf prov:wasDerivedFrom, prov:wasGeneratedBy ;

  # Toute entité avec provenance doit avoir generatedAtTime
  sh:property [
    sh:path prov:generatedAtTime ;
    sh:datatype xsd:dateTime ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Entity with provenance must have generatedAtTime"
  ] .
```

### Exemple de Données RDF

```turtle
@prefix ex: <http://example.com/schema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Personne
ex:P_Ali a ex:Person ;
  ex:fullName "Ali Karim" ;
  ex:email "ali.karim@example.com" ;
  ex:role "Software Engineer", "Team Lead" ;
  ex:label ex:Internal ;
  ex:validFrom "2025-10-15T00:00:00Z"^^xsd:dateTime ;
  ex:worksFor ex:OU_Engineering ;
  prov:wasDerivedFrom "seed/persons.csv" ;
  prov:generatedAtTime "2025-12-13T03:38:08Z"^^xsd:dateTime .

# Unité organisationnelle
ex:OU_Engineering a ex:OrgUnit ;
  ex:name "Engineering" ;
  ex:label ex:Public ;
  ex:parentUnit ex:OU_Technology .

# Produit
ex:PROD_Platform a ex:Product ;
  ex:name "EKG Platform" ;
  ex:version "1.0" ;
  ex:managedBy ex:P_Ali ;
  ex:label ex:Confidential .
```

---

## Automatisation et Monitoring

### Auto-Refresh et Synchronisation

| Composant | Type | Fréquence | Automatique | Description |
|-----------|------|-----------|-------------|-------------|
| **Neo4j** | Sync | 30s | ✅ | Synchronisation avec GraphDB |
| **Prometheus** | Scraping | 15-30s | ✅ | Collecte métriques |
| **Grafana** | Refresh | 30s | ✅ | Rafraîchissement dashboards |
| **Airflow** | Scheduled | Daily | ✅ | Exécution DAG ETL |
| **GraphDB** | Manual | - | ❌ | Import manuel via UI |

### Pipeline de Qualité

**Score de qualité** (0-100):

```python
def calculate_quality_score(metrics):
    total_score = 100

    # Pénalités
    total_score -= metrics['shacl_violations'] * 5      # -5 par violation
    total_score -= metrics['duplicates'] * 3            # -3 par doublon
    total_score -= metrics['orphans'] * 2               # -2 par orphelin
    total_score -= metrics['missing_prov'] * 1          # -1 par provenance manquante

    # Bonus
    if metrics['shacl_violations'] == 0:
        total_score += 10  # +10 si aucune violation

    return max(0, min(100, total_score))
```

**Métriques poussées vers Prometheus**:
```python
from prometheus_client import CollectorRegistry, Gauge, push_to_gateway

registry = CollectorRegistry()

# Score de qualité (gauge)
quality_score = Gauge('ekg_quality_score', 'Data quality score (0-100)', registry=registry)
quality_score.set(80)

# Violations SHACL
shacl_violations = Gauge('ekg_shacl_violations', 'Number of SHACL violations', registry=registry)
shacl_violations.set(0)

# Push vers Pushgateway
push_to_gateway('pushgateway:9091', job='ekg_quality_monitor', registry=registry)
```

---

## Décisions d'Architecture

### Pourquoi GraphDB ET Neo4j?

**GraphDB (RDF Triplestore)**:
- ✅ Stockage sémantique avec ontologies
- ✅ Raisonnement OWL-RL
- ✅ Validation SHACL intégrée
- ✅ Standard W3C (SPARQL, RDF)
- ✅ Flexibilité schéma

**Neo4j (Property Graph)**:
- ✅ Requêtes Cypher plus intuitives
- ✅ Visualisation graphe native
- ✅ Performance pour traversées
- ✅ Indexes optimisés
- ✅ Intégrations tierces (BI tools)

**Approche hybride**:
- GraphDB = **Source de vérité** (single source of truth)
- Neo4j = **Vue matérialisée** (materialized view) pour performances et visualisation
- Synchronisation automatique toutes les 30s

### Pourquoi Python pour l'ETL au lieu d'un outil dédié?

**Raisons**:
- ✅ Flexibilité totale pour transformations custom
- ✅ Intégration facile avec Airflow (Python natif)
- ✅ Bibliothèques RDF (rdflib) matures
- ✅ Pas de licensing coûteux (Talend, Informatica)
- ✅ Facilité de débogage et tests

**Alternatives considérées**:
- ❌ Apache NiFi: Trop complexe pour ce besoin
- ❌ Talend: Coûteux, propriétaire
- ❌ XSLT/RML: Moins flexible que Python

### Pourquoi Keycloak pour l'authentification?

**Raisons**:
- ✅ Standard OAuth2/OpenID Connect
- ✅ Open-source, gratuit
- ✅ Interface admin complète
- ✅ Support RBAC natif
- ✅ Intégrations multiples (LDAP, SAML, etc.)
- ✅ Production-ready

**Alternatives considérées**:
- ❌ Auth0: Payant au-delà de 7000 users
- ❌ Custom JWT: Réinventer la roue, risques sécurité
- ❌ Firebase Auth: Vendor lock-in Google

### Pourquoi NestJS pour l'API Gateway?

**Raisons**:
- ✅ Architecture modulaire (controllers, services, guards)
- ✅ Decorators TypeScript (métadonnées propres)
- ✅ Middleware et guards pour sécurité
- ✅ Support natif Swagger/OpenAPI
- ✅ Performance (Node.js asynchrone)
- ✅ Communauté active

**Alternatives considérées**:
- ❌ Express.js: Trop basique, pas de structure
- ❌ FastAPI (Python): Moins performant que Node.js
- ❌ Spring Boot (Java): Trop lourd pour cette API simple

### Pourquoi Airflow pour l'orchestration?

**Raisons**:
- ✅ Standard de facto pour ETL/ELT
- ✅ Interface web complète
- ✅ Gestion des dépendances (DAG)
- ✅ Retry automatique des tâches
- ✅ Monitoring et alerting intégrés
- ✅ Extensible (custom operators)

**Alternatives considérées**:
- ❌ Prefect: Moins mature qu'Airflow
- ❌ Luigi (Spotify): Moins de features
- ❌ Cron: Pas de gestion dépendances ni UI

### Pourquoi SHACL et pas OWL pour la validation?

**SHACL (choisi)**:
- ✅ Spécialement conçu pour validation
- ✅ Messages d'erreur explicites
- ✅ Validation fermée (Closed World Assumption)
- ✅ Rapports de violation détaillés
- ✅ Pas de raisonnement coûteux

**OWL**:
- ❌ Conçu pour inférence, pas validation
- ❌ Open World Assumption (absence ≠ invalide)
- ❌ Performance (raisonnement lourd)

**Approche**:
- OWL pour **définir le modèle** (ontologies)
- SHACL pour **valider les données** (contraintes)

---

## Glossaire

**ABAC**: Attribute-Based Access Control - Contrôle d'accès basé sur les attributs
**APOC**: Awesome Procedures On Cypher - Bibliothèque de procédures Neo4j
**DAG**: Directed Acyclic Graph - Graphe orienté acyclique (workflow Airflow)
**ETL**: Extract, Transform, Load - Pipeline de transformation de données
**JWT**: JSON Web Token - Token d'authentification encodé
**n10s**: Neosemantics - Plugin Neo4j pour RDF
**OAuth2**: Open Authorization 2.0 - Protocole d'autorisation
**OIDC**: OpenID Connect - Couche d'authentification sur OAuth2
**OWL**: Web Ontology Language - Langage d'ontologies W3C
**PROV-O**: Provenance Ontology - Ontologie de traçabilité W3C
**RBAC**: Role-Based Access Control - Contrôle d'accès basé sur les rôles
**RDF**: Resource Description Framework - Modèle de données W3C
**SHACL**: Shapes Constraint Language - Langage de contraintes W3C
**SPARQL**: SPARQL Protocol and RDF Query Language - Langage de requête RDF
**URI**: Uniform Resource Identifier - Identifiant unique de ressource

---

**Version**: 1.0 Final - 2025-12-13
**Auteurs**: Équipe EKG
**License**: MIT (si open-source) ou Propriétaire
