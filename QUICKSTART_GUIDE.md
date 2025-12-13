# Guide de Démarrage Rapide - EKG (Enterprise Knowledge Graph)

**Version**: 1.0 Final
**Date**: 2025-12-13
**Pour**: Première installation complète

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Installation Initiale](#installation-initiale)
3. [Lancement des Services](#lancement-des-services)
4. [Transformation et Chargement des Données](#transformation-et-chargement-des-données)
5. [Vérification des Services](#vérification-des-services)
6. [Tests et Validation](#tests-et-validation)
7. [Arrêt et Redémarrage](#arrêt-et-redémarrage)
8. [Dépannage](#dépannage)

---

## Prérequis

### Logiciels Requis

- **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux) - Version 20.10+
- **Docker Compose** - Version 2.0+
- **Git** - Version 2.30+
- **Python** 3.11+ (pour les scripts locaux)
- **Node.js** 18+ (optionnel, pour le développement API Gateway)

### Vérification des Versions

```bash
docker --version
# Docker version 24.0.0 ou supérieur

docker-compose --version
# Docker Compose version 2.20.0 ou supérieur

git --version
# git version 2.40.0 ou supérieur
```

### Ressources Système Recommandées

- **RAM**: Minimum 8 GB, Recommandé 16 GB
- **CPU**: 4 cœurs minimum
- **Disque**: 20 GB d'espace libre
- **Réseau**: Ports disponibles: 3000, 3001, 5432, 6379, 7200, 7474, 7687, 8080, 8180, 9090, 9091

---

## Installation Initiale

### Étape 1: Cloner le Projet

```bash
# Cloner le repository
git clone <url-du-repository> ekg-project
cd ekg-project

# Vérifier qu'on est sur la branche release/v1.0-final
git checkout release/v1.0-final
```

### Étape 2: Structure du Projet

Vérifiez que vous avez cette structure:

```
d:\2.0\
├── infra/                    # Infrastructure Docker
│   ├── docker-compose.yml   # Configuration des services
│   ├── graphdb/             # GraphDB (triplestore RDF)
│   ├── neo4j/               # Neo4j (graph database)
│   ├── neo4j-sync/          # Service auto-sync Neo4j
│   ├── prometheus/          # Métriques système
│   ├── grafana/             # Dashboards de monitoring
│   ├── api-gateway/         # API REST avec sécurité
│   └── airflow/             # Orchestration ETL
├── seed/                     # Données sources (CSV)
├── data/                     # Données générées (RDF)
├── ontology/                 # Ontologies OWL
├── shacl/                    # Contraintes de validation
├── pipelines/                # DAGs Airflow
├── scripts/                  # Scripts utilitaires
├── docs/                     # Documentation détaillée
└── tests/                    # Tests et collections Postman
```

### Étape 3: Configuration de l'Environnement

```bash
# Copier le fichier d'environnement (si disponible)
cp .env.example .env

# Éditer les variables si nécessaire (optionnel pour un démarrage rapide)
# Les valeurs par défaut sont prêtes à l'emploi
```

---

## Lancement des Services

### Étape 1: Construire les Images Docker

**⏱️ Durée estimée**: 10-15 minutes (première fois)

```bash
cd infra

# Construction de toutes les images
docker-compose build

# Vérifier que les images sont créées
docker images | grep ekg
```

Vous devriez voir:
- `ekg-api-gateway:latest`
- `ekg-neo4j-autosync:latest`

### Étape 2: Démarrer les Services

**⏱️ Durée estimée**: 2-3 minutes

```bash
# Démarrer tous les services en arrière-plan
docker-compose up -d

# Suivre les logs (Ctrl+C pour quitter)
docker-compose logs -f
```

### Étape 3: Attendre que Tous les Services Soient Prêts

```bash
# Vérifier l'état des conteneurs
docker-compose ps

# Tous les services doivent être "healthy" ou "running"
```

**Services lancés** (12 conteneurs):

| Service | Port | URL | Statut Attendu |
|---------|------|-----|----------------|
| GraphDB | 7200 | http://localhost:7200 | healthy |
| Neo4j | 7474, 7687 | http://localhost:7474 | healthy |
| Neo4j Auto-Sync | - | (background) | running |
| Postgres | 5432 | localhost:5432 | healthy |
| Redis | 6379 | localhost:6379 | healthy |
| Keycloak | 8180 | http://localhost:8180 | healthy |
| API Gateway | 3000 | http://localhost:3000 | healthy |
| Airflow Webserver | 8080 | http://localhost:8080 | healthy |
| Airflow Scheduler | - | (background) | healthy |
| Prometheus | 9090 | http://localhost:9090 | healthy |
| Pushgateway | 9091 | http://localhost:9091 | healthy |
| Grafana | 3001 | http://localhost:3001 | healthy |

**⚠️ IMPORTANT**: Attendez que tous les services soient `healthy` avant de continuer. Cela peut prendre 1-2 minutes.

---

## Transformation et Chargement des Données

### Méthode 1: Automatique via Airflow (Recommandé)

**⏱️ Durée estimée**: 5-10 minutes

#### 1. Accéder à Airflow

```
URL: http://localhost:8080
Username: admin
Password: admin
```

#### 2. Activer et Déclencher le DAG

1. Dans l'interface Airflow, cliquez sur **DAGs** dans le menu
2. Trouvez le DAG `ekg_ingest`
3. **Activez-le** en cliquant sur le toggle (OFF → ON)
4. Cliquez sur le bouton **▶ Play** (Trigger DAG)
5. Confirmez en cliquant sur **Trigger**

#### 3. Suivre l'Exécution

Le DAG s'exécute en 6 étapes:

```
1. Extract Data (seed/*.csv → data/generated/*.ttl)
   ⏱️ ~30 secondes

2. Transform to RDF (conversion CSV → RDF)
   ⏱️ ~1 minute

3. Validate with SHACL (validation structurelle)
   ⏱️ ~2 minutes

4. Run Sanity Checks (validation métier)
   ⏱️ ~1 minute

5. Collect Metrics (statistiques)
   ⏱️ ~10 secondes

6. Quality Monitor (score de qualité)
   ⏱️ ~30 secondes
```

#### 4. Vérifier la Réussite

✅ **Toutes les tâches doivent être vertes** (success)

Si une tâche échoue:
- Cliquez sur la tâche rouge
- Consultez les logs pour voir l'erreur
- Corrigez le problème
- Relancez le DAG

#### 5. Importer dans GraphDB

Une fois le DAG terminé avec succès:

1. Ouvrir GraphDB: http://localhost:7200
2. Aller dans **Import** → **RDF** → **Upload RDF files**
3. Importer dans l'ordre suivant:

**Phase 1: Ontologies** (graphe: `http://example.com/ontology`)
```
- data/ontology/core.ttl
- data/ontology/relations.ttl
- data/ontology/security.ttl
- data/ontology/temporal.ttl
- data/ontology/provenance.ttl
```

**Phase 2: SHACL** (graphe: `http://rdf4j.org/schema/rdf4j#SHACLShapeGraph`)
```
- data/shacl/shapes_core.ttl
- data/shacl/shapes_provenance.ttl
- data/shacl/shapes_temporal.ttl
- data/shacl/shapes_security_fixed.ttl
```

**Phase 3: Données** (graphe: `http://example.com/data`)
```
- data/generated/persons.ttl
- data/generated/orgunits.ttl
- data/generated/products.ttl
- data/generated/assets.ttl
- data/generated/projects.ttl
```

**💡 Astuce**: Pour chaque fichier, sélectionnez le graphe nommé approprié dans le menu déroulant "Import targets".

### Méthode 2: Manuelle via Scripts

Si vous préférez lancer les scripts manuellement:

```bash
# 1. Transformation CSV → RDF
cd d:/2.0
python scripts/csv_to_rdf.py

# 2. Validation SHACL
python scripts/validate_shacl.py

# 3. Import dans GraphDB (via script)
bash scripts/cli_load_rdf.sh
```

---

## Vérification des Services

### 1. GraphDB

```bash
# Vérifier le nombre de triplets
curl -s "http://localhost:7200/repositories/ekg/size" | jq
```

**Attendu**:
- Ontologies: ~500 triplets
- SHACL: ~500 triplets
- Données: ~245 triplets
- **Total**: ~1245 triplets

**Interface Web**: http://localhost:7200
- Lancez une requête SPARQL de test:

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

**Attendu**: 8 personnes (Ali, Sara, John, Emma, Chen, Raj, Lina, Maria)

### 2. Neo4j (Auto-Sync)

**Interface Web**: http://localhost:7474
- Username: `neo4j`
- Password: `password`

**Vérifier l'auto-sync**:

```bash
# Consulter les logs du service auto-sync
docker logs ekg-neo4j-autosync --tail 50
```

**Attendu**:
```
✓ Neo4j connected!
✓ GraphDB connected!
✓ n10s already configured
[2025-12-13 04:47:08] Change detected: 0 → 245 triples
Syncing 245 triples from GraphDB...
✓ Synced! Triples: 245, Nodes: 34
```

**Requête Neo4j de test**:

```cypher
// Compter les nœuds
MATCH (n)
WHERE NOT n:_GraphConfig AND NOT n:_NsPrefDef
RETURN labels(n) as type, count(*) as count
ORDER BY count DESC
```

**Attendu**:
- 8 `ex__Person`
- 6 `ex__OrgUnit`
- 4 `ex__Product`
- 4 `ex__Asset`
- 3 `ex__Project`

**Requête avec relations**:

```cypher
MATCH (p:ex__Person)-[:ex__worksFor]->(o:ex__OrgUnit)
RETURN p.ex__fullName as person, o.ex__name as organization
LIMIT 10
```

### 3. Prometheus

**URL**: http://localhost:9090

**Vérifier les targets**:
1. Aller dans **Status** → **Targets**
2. Tous doivent être **UP** (verts):
   - ✅ prometheus (self)
   - ✅ graphdb
   - ✅ api-gateway
   - ✅ pushgateway

**Requête Prometheus de test**:

```
graphdb_heap_used_mem
```

**Attendu**: Graphe montrant l'utilisation mémoire de GraphDB (~500-600 MB)

### 4. Grafana

**URL**: http://localhost:3001
- Username: `admin`
- Password: `admin`

**Dashboards disponibles**:

1. **EKG Performance Dashboard (TEP-08)**
   - Mémoire GraphDB (Heap Used vs Max)
   - CPU Load
   - Espace disque libre
   - Taux de requêtes API
   - Mémoire API Gateway
   - État de santé des services

2. **EKG Quality Monitor**
   - Score de qualité (0-100)
   - Violations SHACL
   - Résultats sanity checks

**Vérification**:
- Les graphiques doivent afficher des données
- Auto-refresh: 30 secondes
- Tous les services doivent apparaître comme "UP" (valeur = 1)

### 5. Keycloak

**URL**: http://localhost:8180
- Username: `admin`
- Password: `admin`

**Vérifier le realm**:
1. Sélectionner le realm **ekg** (menu déroulant en haut à gauche)
2. Aller dans **Users**
3. Vérifier que 4 utilisateurs existent:
   - alice.viewer
   - bob.curator
   - carol.steward
   - dave.admin

**Test de connexion**:

```bash
# Tester login alice.viewer
curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=postman&username=alice.viewer&password=viewer123&grant_type=password" \
  | jq -r '.access_token' | head -c 50

# Doit retourner un token JWT (commence par "eyJ...")
```

### 6. API Gateway

**URL**: http://localhost:3000

**Test sans authentification** (doit échouer):

```bash
curl -s http://localhost:3000/ekg/persons | jq
```

**Attendu**:
```json
{
  "message": "No token provided",
  "error": "Unauthorized",
  "statusCode": 401
}
```

**Test avec authentification** (doit réussir):

```bash
# 1. Obtenir un token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=postman&username=alice.viewer&password=viewer123&grant_type=password" \
  | jq -r '.access_token')

# 2. Requête avec le token
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/ekg/persons?limit=5" | jq
```

**Attendu**: Liste de 5 personnes avec filtrage par label de sécurité

---

## Tests et Validation

### Test Complet avec Postman

**Collection**: `tests/TEP-05_postman_collection.json`

#### 1. Importer dans Postman

1. Ouvrir Postman
2. **Import** → Sélectionner le fichier `tests/TEP-05_postman_collection.json`
3. La collection "TEP-05 EKG Security & Governance" apparaît

#### 2. Exécuter les Tests

**Ordre d'exécution** (IMPORTANT):

1. **0. Authentication** (obtenir les tokens)
   - Login as alice.viewer ✅
   - Login as bob.curator ✅
   - Login as carol.steward ✅
   - Login as dave.admin ✅

2. **1. Viewer Tests (alice.viewer)**
   - GET /ekg/persons (SUCCESS) ✅
   - GET /ekg/quarantine (FAIL 403) ✅
   - POST /ekg/sparql/update (FAIL 403) ✅

3. **2. Curator Tests (bob.curator)**
   - GET /ekg/persons (SUCCESS) ✅
   - GET /ekg/quarantine (SUCCESS) ✅
   - POST /ekg/quarantine/approve (SUCCESS) ✅
   - POST /ekg/sparql/update (FAIL 403) ✅

4. **3. Steward Tests (carol.steward)**
   - GET /ekg/persons (SUCCESS) ✅
   - POST /ekg/sparql/update (SUCCESS) ✅
   - GET /ekg/quarantine (SUCCESS) ✅

5. **4. Admin Tests (dave.admin)**
   - GET /ekg/persons (SUCCESS) ✅
   - GET /ekg/quarantine (SUCCESS) ✅
   - POST /ekg/sparql/update (SUCCESS) ✅
   - POST /ekg/sparql/query (SUCCESS) ✅

**Résultat attendu**: ✅ **Tous les tests passent** (verts)

### Matrice RBAC/ABAC

| Utilisateur | Rôle | Clearance | Lecture | Quarantine | SPARQL Update | Audit |
|-------------|------|-----------|---------|------------|---------------|-------|
| alice.viewer | viewer | Public, Internal | ✅ | ❌ | ❌ | ❌ |
| bob.curator | curator | + Confidential | ✅ | ✅ | ❌ | ❌ |
| carol.steward | steward | + Secret | ✅ | ✅ | ✅ | ❌ |
| dave.admin | admin | + Secret | ✅ | ✅ | ✅ | ✅ |

---

## Arrêt et Redémarrage

### Arrêter Tous les Services

```bash
cd d:/2.0/infra
docker-compose down

# Avec suppression des volumes (⚠️ perte des données)
docker-compose down -v
```

### Redémarrer les Services

```bash
cd d:/2.0/infra
docker-compose up -d

# Suivre les logs
docker-compose logs -f
```

**Note**: Au redémarrage:
- GraphDB: Les données persistent (volume `graphdb-data`)
- Neo4j: Se synchronise automatiquement avec GraphDB en 30 secondes
- Prometheus/Grafana: Les métriques reprennent
- Airflow: Les DAGs sont préservés

### Redémarrer un Service Spécifique

```bash
docker-compose restart graphdb
docker-compose restart neo4j
docker-compose restart grafana
```

---

## Dépannage

### Problème: Un service ne démarre pas

**Solution**:

```bash
# Voir les logs du service
docker-compose logs <nom-du-service>

# Exemples:
docker-compose logs graphdb
docker-compose logs neo4j
docker-compose logs airflow-scheduler
```

### Problème: Port déjà utilisé

**Erreur**: `Bind for 0.0.0.0:7200 failed: port is already allocated`

**Solution**:

```bash
# Trouver quel processus utilise le port
netstat -ano | findstr :7200  # Windows
lsof -i :7200                 # Linux/Mac

# Arrêter le processus ou changer le port dans docker-compose.yml
```

### Problème: Neo4j ne se synchronise pas

**Vérification**:

```bash
# Logs du service auto-sync
docker logs ekg-neo4j-autosync --tail 100

# Vérifier que GraphDB a des données
curl -s "http://localhost:7200/repositories/ekg/size"
```

**Solution**: Si aucune donnée dans GraphDB, importer d'abord (voir section "Transformation et Chargement")

### Problème: Grafana affiche "No Data"

**Vérifications**:

1. Prometheus est-il UP?
   ```bash
   curl http://localhost:9090/-/healthy
   ```

2. Prometheus scrape-t-il GraphDB?
   ```bash
   curl -s "http://localhost:9090/api/v1/targets" | jq '.data.activeTargets[] | select(.labels.job=="graphdb")'
   ```

3. Redémarrer Grafana:
   ```bash
   docker-compose restart grafana
   ```

### Problème: Airflow DAG échoue

**Diagnostics**:

1. Cliquer sur la tâche rouge dans l'interface Airflow
2. Onglet **Logs** → Lire l'erreur
3. Erreurs communes:
   - `FileNotFoundError`: Volume mal monté → vérifier docker-compose.yml
   - `Connection refused`: Service dépendant pas prêt → attendre 1-2 min
   - `SHACL validation failed`: Données invalides → vérifier les CSV sources

### Problème: Keycloak renvoie 401

**Vérifications**:

1. Le token est-il expiré? (durée: 5 minutes)
   - Re-générer un nouveau token

2. Le client "postman" existe-t-il?
   - Aller dans Keycloak → Clients → Vérifier "postman"

3. Le mot de passe est-il correct?
   - Voir `tests/TEP-05_postman_collection.json` pour les credentials

### Problème: Espace disque insuffisant

**Vérification**:

```bash
# Voir l'espace utilisé par Docker
docker system df

# Nettoyer les images/conteneurs inutilisés
docker system prune -a
```

---

## Commandes Utiles

### Docker

```bash
# Lister tous les conteneurs
docker ps -a

# Logs en temps réel
docker-compose logs -f <service>

# Accéder au shell d'un conteneur
docker exec -it ekg-graphdb bash
docker exec -it ekg-neo4j bash

# Redémarrer tous les services
docker-compose restart

# Voir l'utilisation des ressources
docker stats
```

### GraphDB

```bash
# Nombre de triplets
curl -s http://localhost:7200/repositories/ekg/size

# Requête SPARQL via curl
curl -s -X POST http://localhost:7200/repositories/ekg \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  -d "SELECT * WHERE { ?s ?p ?o } LIMIT 10"
```

### Neo4j

```bash
# Cypher shell
docker exec -it ekg-neo4j cypher-shell -u neo4j -p password

# Compter les nœuds
docker exec ekg-neo4j cypher-shell -u neo4j -p password \
  "MATCH (n) RETURN count(n)"
```

### Prometheus

```bash
# Vérifier les cibles
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Requête métrique
curl -s "http://localhost:9090/api/v1/query?query=up" | jq
```

---

## Prochaines Étapes

Après avoir complété ce guide:

1. ✅ **Tous les services sont opérationnels**
2. ✅ **Les données sont chargées et validées**
3. ✅ **L'auto-sync Neo4j fonctionne**
4. ✅ **Le monitoring est actif**
5. ✅ **La sécurité RBAC/ABAC est testée**

**Consultez maintenant**:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - Comprendre le système en détail
- [`docs/`](docs/) - Documentation technique complète
- API Gateway: Développer de nouvelles routes sécurisées
- Airflow: Ajouter de nouveaux pipelines ETL

---

**Support**: Pour toute question, consultez la documentation dans `docs/` ou ouvrez une issue.

**Version**: 1.0 Final - 2025-12-13
