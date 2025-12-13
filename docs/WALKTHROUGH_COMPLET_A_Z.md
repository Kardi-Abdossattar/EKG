# WALKTHROUGH COMPLET EKG - DE A À Z

**Date**: 2025-11-27
**Durée totale estimée**: 8-10 heures (peut être réparti sur plusieurs jours)
**Objectif**: Guide complet pour déployer, configurer et tester l'ensemble du système EKG depuis zéro

---

## TABLE DES MATIÈRES

- [Prérequis système](#prérequis-système)
- [Phase 0: Nettoyage et préparation](#phase-0-nettoyage-et-préparation)
- [TEP-00: Infrastructure de base](#tep-00-infrastructure-de-base)
- [TEP-01: Schéma et données](#tep-01-schéma-et-données)
- [TEP-02: Pipeline d'ingestion](#tep-02-pipeline-dingestion)
- [TEP-03: Monitoring qualité](#tep-03-monitoring-qualité)
- [TEP-03.5: Dual repository](#tep-035-dual-repository)
- [TEP-04: Trust ML](#tep-04-trust-ml)
- [TEP-05: Sécurité et gouvernance](#tep-05-sécurité-et-gouvernance)
- [TEP-06: Versioning et temporalité](#tep-06-versioning-et-temporalité)
- [TEP-07: API et applications](#tep-07-api-et-applications)
- [TEP-08: Durcissement et scalabilité](#tep-08-durcissement-et-scalabilité)
- [Tests finaux et validation](#tests-finaux-et-validation)

---

## PRÉREQUIS SYSTÈME

### Matériel recommandé
- **RAM**: 16GB minimum (32GB recommandé)
- **CPU**: 4 cores minimum (8 cores recommandé)
- **Disque**: 50GB libres minimum
- **OS**: Windows 10/11, Linux, macOS

### Logiciels requis

```bash
# Docker Desktop (avec compose v2)
docker --version  # 24.0+
docker compose version  # 2.20+

# Python 3.11+
python --version
pip --version

# Node.js 18+ (pour API Gateway)
node --version
npm --version

# Git Bash (Windows) ou terminal Unix
bash --version

# Outils optionnels mais recommandés
curl --version
jq --version
```

### Installer les dépendances Python

```bash
cd d:/2.0
pip install -r requirements.txt

# Vérifier installations
python -c "import requests, yaml, pykeen, torch; print('✓ Dépendances OK')"
```

---

## PHASE 0: NETTOYAGE ET PRÉPARATION

**⚠️ ATTENTION**: Cette phase va supprimer toutes les données existantes. Sauvegarder si nécessaire.

### 0.1 Arrêter tous les services

```bash
cd d:/2.0/infra
docker compose down -v
```

**Options**:
- `-v`: Supprime aussi les volumes (données GraphDB, PostgreSQL, etc.)
- Sans `-v`: Conserve les volumes (données persistantes)

### 0.2 Nettoyer les graphes GraphDB manuellement (si pas de -v)

Si vous avez conservé les volumes mais voulez vider les graphes:

```bash
# Démarrer seulement GraphDB
docker compose up -d graphdb

# Attendre démarrage
sleep 60

# Vider tous les graphes
curl -X POST "http://localhost:7200/repositories/ekg/statements" \
  -H "Content-Type: application/sparql-update" \
  --data-binary "DROP ALL"

# Recréer les graphes nommés essentiels
curl -X POST "http://localhost:7200/repositories/ekg/statements" \
  -H "Content-Type: application/sparql-update" \
  --data-binary "CREATE GRAPH <http://example.com/ontology>"

curl -X POST "http://localhost:7200/repositories/ekg/statements" \
  -H "Content-Type: application/sparql-update" \
  --data-binary "CREATE GRAPH <http://example.com/data>"
```

### 0.3 Nettoyer les dashboards Grafana

```bash
# Supprimer le volume Grafana pour reset les dashboards
docker volume rm infra_grafana-data

# Ou nettoyer manuellement via UI:
# 1. Ouvrir http://localhost:3001
# 2. Login: admin/admin
# 3. Dashboards → Manage → Sélectionner tous → Delete
```

### 0.4 Nettoyer les fichiers temporaires

```bash
cd d:/2.0

# Supprimer les fichiers staging
rm -rf staging_*/ data/generated/

# Supprimer les backups (optionnel)
rm -rf backups/

# Supprimer les snapshots (optionnel)
rm -rf snapshots/

# Supprimer les diffs (optionnel)
rm -rf diffs/

# Nettoyer les logs
rm -f *.log
```

### 0.5 Vérifier l'état propre

```bash
# Aucun conteneur ne devrait tourner
docker ps
# Résultat attendu: vide

# Lister les volumes (optionnel - voir ce qui reste)
docker volume ls

# Vérifier l'espace disque
df -h  # Linux/Mac
# Ou dans Windows PowerShell: Get-PSDrive
```

**✅ Checkpoint**: Système propre, prêt pour une installation fraîche.

---

## TEP-00: INFRASTRUCTURE DE BASE

**Durée**: 20-30 minutes
**Objectif**: Déployer tous les services Docker (GraphDB, Airflow, Keycloak, API, monitoring)

### 0.1 Configurer l'environnement

```bash
cd d:/2.0/infra

# Copier le fichier d'exemple
cp env/.env.example .env

# Éditer les secrets (IMPORTANT pour production!)
# Pour ce walkthrough, les valeurs par défaut fonctionnent
```

### 0.2 Démarrer tous les services

```bash
docker compose up -d

# Suivre les logs
docker compose logs -f
# Ctrl+C pour quitter les logs
```

**Attendre 3-5 minutes** pour que tous les services démarrent.

### 0.3 Vérifier le statut

```bash
docker compose ps

# Tous les services devraient être "healthy":
# - ekg-graphdb
# - ekg-postgres
# - ekg-airflow-webserver
# - ekg-airflow-scheduler
# - ekg-keycloak
# - ekg-api-gateway
# - ekg-prometheus
# - ekg-grafana
# - ekg-pushgateway
```

### 0.4 Healthcheck automatique

```bash
bash scripts/healthcheck.sh

# Résultat attendu:
# ✓ All checks passed
# Infrastructure is ready!
```

### 0.5 Créer le repository GraphDB "ekg"

**Via UI** (recommandé):
1. Ouvrir http://localhost:7200
2. Setup → Repositories → Create new repository
3. Configuration:
   - **Repository ID**: `ekg`
   - **Ruleset**: `OWL-RL (Optimized)`
   - **Enable SHACL validation**: ✅ **OUI**
4. Cliquer **Create**

**Via script** (alternatif):

```bash
curl -X PUT "http://localhost:7200/rest/repositories/ekg" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ekg",
    "title": "Enterprise Knowledge Graph",
    "type": "graphdb",
    "params": {
      "ruleset": "owl-rl-optimized",
      "enableShaclValidation": "true"
    }
  }'
```

### 0.6 Tests des interfaces

**GraphDB**: http://localhost:7200
**Airflow**: http://localhost:8080 (admin/admin)
**Keycloak**: http://localhost:8180 (admin/admin)
**API Gateway**: http://localhost:3000/health
**Prometheus**: http://localhost:9090
**Grafana**: http://localhost:3001 (admin/admin)

**✅ Checkpoint**: Tous les services sont UP et accessibles.

---

## TEP-01: SCHÉMA ET DONNÉES

**Durée**: 30-45 minutes
**Objectif**: Charger l'ontologie, les shapes SHACL et les données seed

### 1.1 Convertir CSV en RDF

```bash
cd d:/2.0

python scripts/csv_to_rdf.py seed/ data/generated/ job_initial

# Résultat attendu:
# ✓ Generated data/generated/orgunits.ttl
# ✓ Generated data/generated/persons.ttl
# ✓ Generated data/generated/products.ttl
# ✓ Generated data/generated/projects.ttl
# ✓ Generated data/generated/assets.ttl
```

### 1.2 Importer ontologies, SHACL et données

```bash
bash scripts/import_to_graphdb.sh ekg http://localhost:7200

# Processus:
# [1/3] Importing ontologies... ✓
# [2/3] Importing SHACL shapes... ✓
# [3/3] Importing instance data... ✓
# Total triples: ~350
```

### 1.3 Valider SHACL

```bash
python scripts/validate_shacl.py --repo ekg --url http://localhost:7200 -v

# Résultat attendu:
# ✅ SHACL Validation: PASSED
# No violations found.
```

### 1.4 Exécuter les sanity checks

```bash
bash scripts/run_sanity_checks.sh ekg http://localhost:7200

# Résultat attendu:
# [10/10] checks PASSED
# ✅ All sanity checks passed!
```

### 1.5 Requêtes de vérification

Ouvrir http://localhost:7200/sparql et exécuter:

```sparql
PREFIX ex: <http://example.com/schema#>

# Compter par type
SELECT ?type (COUNT(?entity) AS ?count)
WHERE {
    ?entity a ?type .
    FILTER(?type IN (ex:Person, ex:OrgUnit, ex:Product, ex:Project, ex:Asset))
}
GROUP BY ?type
ORDER BY DESC(?count)
```

**Résultat attendu**:
- Person: 8
- OrgUnit: 6
- Product: 4
- Project: 3
- Asset: 4

**✅ Checkpoint**: Données chargées et validées.

---

## TEP-02: PIPELINE D'INGESTION

**Durée**: 45-60 minutes
**Objectif**: Déployer et tester le DAG Airflow pour l'ingestion automatisée

### 2.1 Test manuel du pipeline

```bash
cd d:/2.0

# Exécuter le pipeline complet manuellement
bash scripts/test_pipeline_manual.sh

# Résultat attendu:
# [OK] CSV extraction complete
# [OK] RDF transformation complete
# [OK] RDF loaded to staging
# [OK] SHACL validation passed
# [OK] Transactional merge complete
# [OK] All sanity checks passed
# ✅ PIPELINE TEST COMPLETE - SUCCESS
```

### 2.2 Copier les fichiers vers Airflow

```bash
# Copier le DAG
docker cp pipelines/airflow_dags/ekg_ingest.py ekg-airflow-webserver:/opt/airflow/dags/
docker cp pipelines/airflow_dags/ekg_ingest.py ekg-airflow-scheduler:/opt/airflow/dags/

# Copier les scripts
docker cp scripts/ ekg-airflow-webserver:/opt/airflow/scripts/
docker cp scripts/ ekg-airflow-scheduler:/opt/airflow/scripts/

# Copier les données seed
docker cp seed/ ekg-airflow-webserver:/opt/airflow/seed/
docker cp seed/ ekg-airflow-scheduler:/opt/airflow/seed/

# Rendre exécutables
docker exec ekg-airflow-webserver chmod +x /opt/airflow/scripts/*.sh
docker exec ekg-airflow-scheduler chmod +x /opt/airflow/scripts/*.sh
```

### 2.3 Configurer les variables Airflow

```bash
docker exec -it ekg-airflow-webserver bash

airflow variables set GRAPHDB_URL "http://graphdb:7200"
airflow variables set GRAPHDB_REPO "ekg"

airflow variables list

exit
```

### 2.4 Déclencher le DAG

1. Ouvrir http://localhost:8080
2. Login: `admin` / `admin`
3. Activer le DAG `ekg_ingest_pipeline` (toggle ON)
4. Cliquer "Trigger DAG" (▶)
5. Observer l'exécution (2-5 minutes)

**Tasks attendues** (toutes vertes):
1. extract_csv
2. transform_csv_to_rdf
3. pre_shacl_validation
4. stage_rdf
5. merge_transactional
6. post_shacl_validation
7. sanity_checks
8. collect_metrics

### 2.5 Vérifier les résultats

```bash
# Compter les triplets
curl -s "http://localhost:7200/repositories/ekg/size" | jq

# Résultat attendu: ~350 triplets dans http://example.com/data
```

**✅ Checkpoint**: Pipeline Airflow fonctionnel, ingestion automatisée validée.

---

## TEP-03: MONITORING QUALITÉ

**Durée**: 60-90 minutes
**Objectif**: Déployer le monitoring avec Prometheus, Grafana et quality checks

### 3.1 Démarrer Pushgateway

```bash
cd d:/2.0/infra

docker compose up -d pushgateway

# Vérifier
curl http://localhost:9091/metrics | head -20
```

### 3.2 Installer dépendances monitoring

```bash
# Dans le conteneur Airflow
docker exec ekg-airflow-scheduler pip install prometheus-client

# Copier le script quality monitor
docker cp scripts/quality_monitor.py ekg-airflow-scheduler:/opt/airflow/scripts/
```

### 3.3 Exécuter le quality monitor

```bash
docker exec ekg-airflow-scheduler python3 /opt/airflow/scripts/quality_monitor.py \
  --url http://graphdb:7200 \
  --repo ekg \
  --graph http://example.com/data \
  --pushgateway http://pushgateway:9091 \
  --job ekg_quality_monitor

# Résultat attendu:
# ✅ Quality Score: 100.0/100
# SHACL Violations: 0
# Sanity Checks: all OK
```

### 3.4 Vérifier les métriques dans Prometheus

1. Ouvrir http://localhost:9090
2. Query: `ekg_quality_score`
3. Résultat: valeur = 100

### 3.5 Importer le dashboard Grafana

1. Ouvrir http://localhost:3001 (admin/admin)
2. Dashboards → Import
3. Upload: `infra/grafana/dashboards/ekg_quality_dashboard.json`
4. Sélectionner datasource: **Prometheus**
5. Import

**Dashboard panels attendus**:
- Quality Score: 100 (vert)
- SHACL Violations: 0
- Total Triples: ~350
- Entity Distribution (pie chart)
- Sanity Checks Summary (table)

### 3.6 Tester avec données erronnées

```bash
cd d:/2.0

# Backup données propres
cp seed/persons.csv seed/persons_backup.csv

# Activer données avec erreurs
cp seed/persons_with_errors.csv seed/persons.csv

# Re-trigger DAG Airflow ou pipeline manuel
bash scripts/test_pipeline_manual.sh

# Quality monitor devrait détecter les erreurs
docker exec ekg-airflow-scheduler python3 /opt/airflow/scripts/quality_monitor.py \
  --url http://graphdb:7200 \
  --repo ekg \
  --graph http://example.com/data \
  --pushgateway http://pushgateway:9091

# Résultat attendu:
# ⚠️ Quality Score: 40-60 (ROUGE)
# SHACL Violations: 3+
# Sanity Checks: plusieurs échecs
```

### 3.7 Vérifier les alertes Prometheus

1. Ouvrir http://localhost:9090/alerts
2. Alertes FIRING attendues:
   - EKGSHACLViolationsCritical
   - EKGQualityScoreLow
   - EKGDuplicateEmailsDetected

### 3.8 Restaurer les données propres

```bash
cp seed/persons_backup.csv seed/persons.csv
bash scripts/test_pipeline_manual.sh

# Quality score devrait revenir à 100
```

**✅ Checkpoint**: Monitoring opérationnel, alertes fonctionnelles.

---

## TEP-03.5: DUAL REPOSITORY

**Durée**: 30-45 minutes
**Objectif**: Configurer le système dual repo (staging sans SHACL, production avec SHACL)

### 3.5.1 Créer le repository staging

**Via GraphDB UI**:
1. http://localhost:7200 → Setup → Repositories
2. Create new repository:
   - **Repository ID**: `ekg_staging`
   - **Ruleset**: OWL-RL Optimized
   - **Enable SHACL**: ❌ **DÉCOCHÉ** (crucial!)
3. Create

**Vérifier**:

```bash
curl -s http://localhost:7200/rest/repositories/ekg_staging | grep "isShacl"
# Attendu: "isShacl": "false"
```

### 3.5.2 Tester le split validation

```bash
# Générer RDF avec erreurs
cp seed/persons_with_errors.csv seed/persons.csv
python scripts/csv_to_rdf.py seed/ staging_errors/ job_errors

# Charger dans staging (accepte tout - SHACL off)
bash scripts/cli_load_rdf.sh ekg_staging http://localhost:7200 staging_errors/ http://example.com/staging

# Exécuter split validation
python scripts/split_validation.py --url http://localhost:7200 --output split_report.json

# Résultat attendu:
# ✅ Split validation completed
# Production: 245 triples (propres)
# Quarantine: ~55 triples (invalides)
```

### 3.5.3 Vérifier quarantaine

Requête SPARQL dans repository `ekg_staging`:

```sparql
PREFIX ex: <http://example.com/schema#>

SELECT ?person ?fullName ?email
WHERE {
  GRAPH <http://example.com/quarantine> {
    ?person a ex:Person ;
            ex:fullName ?fullName .
    OPTIONAL { ?person ex:email ?email }
  }
}
```

**Résultat attendu**: 3-5 personnes avec erreurs (P_ERROR1, P_ERROR2, etc.)

**✅ Checkpoint**: Dual repo fonctionnel, quarantaine opérationnelle.

---

## TEP-04: TRUST ML

**Durée**: 15-90 minutes (selon approche)
**Objectif**: Intégrer trust scores et détection d'anomalies

**💡 NOUVEAU**: Si vous avez déjà entraîné vos modèles en dehors (Jupyter/Kaggle), suivez l'**Approche Rapide** (15 min). Sinon, suivez l'Approche Standard (90 min).

---

### **APPROCHE RAPIDE: Intégration de modèles pré-entraînés** (15 minutes)

**Prérequis**: Modèles déjà entraînés dans `notebooks/kaggle/working/`

#### 4.1 Vérifier les fichiers

```bash
cd d:/2.0

ls notebooks/kaggle/working/

# Fichiers requis:
# - transe_model.pkl
# - complex_model.pkl
# - trust_report.json
# - curation_queue.csv
# - triples_with_features.csv (ou .parquet)
```

#### 4.2 Test dry-run

```bash
python scripts/integrate_trust_ml_results.py \
  --models-dir notebooks/kaggle/working \
  --graphdb-url http://localhost:7200 \
  --graphdb-repo ekg

# Résultat attendu:
# [1/6] ✓ Loading pre-trained models...
# [2/6] ✓ Loading trust report...
#   - Total triples: 978
#   - Anomalies detected (ML): 139
# [5/6] [DRY RUN] Skipping actual insertion
# ✅ INTÉGRATION TERMINÉE (DRY RUN)
```

#### 4.3 Insertion réelle

```bash
python scripts/integrate_trust_ml_results.py \
  --models-dir notebooks/kaggle/working \
  --graphdb-url http://localhost:7200 \
  --graphdb-repo ekg \
  --insert

# Résultat attendu:
# ✓ 978 trust scores inserted
# ✓ 97 anomalies moved to quarantine
```

#### 4.4 Vérifier l'intégration

```bash
bash scripts/test_trust_integration.sh

# Résultat attendu:
# ✅ TRUST ML INTEGRATION TEST PASSED
# Trust Score mean: 0.9252
```

**✅ Checkpoint**: Trust ML intégré en 15 minutes ! Passer à TEP-05.

**📚 Détails**: Voir [docs/QUICKSTART_TRUST_ML.md](QUICKSTART_TRUST_ML.md)

---

### **APPROCHE STANDARD: Entraînement depuis zéro** (90 minutes)

#### 4.1 Installer dépendances ML

```bash
docker exec ekg-airflow-scheduler pip install torch pykeen scikit-learn SPARQLWrapper
```

#### 4.2 Copier les scripts Trust ML

```bash
docker cp trust/ ekg-airflow-scheduler:/opt/airflow/trust/
```

### 4.3 Charger données avec anomalies

```bash
docker cp seed/persons_anomalies.csv ekg-airflow-scheduler:/opt/airflow/seed/persons.csv

docker exec ekg-airflow-scheduler bash -c "
  cd /opt/airflow && \
  python3 scripts/csv_to_rdf.py seed/ staging/ job_anomalies && \
  bash scripts/cli_load_rdf.sh ekg http://graphdb:7200 staging/ http://example.com/data
"
```

### 4.4 Entraîner les embeddings

```bash
docker exec ekg-airflow-scheduler python3 /opt/airflow/trust/train.py \
  --url http://graphdb:7200 \
  --repo ekg \
  --graph http://example.com/data \
  --model transe \
  --embedding-dim 128 \
  --num-epochs 50 \
  --output /opt/airflow/models

# Durée: 2-5 minutes (CPU)
# Résultat attendu:
# ✅ Training completed
# Model saved: /opt/airflow/models/transe_latest.pkl
```

### 4.5 Calculer trust scores

```bash
docker exec ekg-airflow-scheduler python3 /opt/airflow/trust/infer.py \
  --url http://graphdb:7200 \
  --repo ekg \
  --graph http://example.com/data \
  --model /opt/airflow/models/transe_latest.pkl \
  --threshold 0.3 \
  --contamination 0.1 \
  --output /opt/airflow/staging/trust_report.json \
  --insert

# Résultat attendu:
# ✅ Detected 35 anomalous triples
# Trust scores inserted into graph
# Mean score: 0.72
```

### 4.6 Générer curation queue

```bash
docker exec ekg-airflow-scheduler python3 /opt/airflow/trust/curation_queue.py generate \
  --input /opt/airflow/staging/trust_report.json \
  --output /opt/airflow/staging/curation_queue.csv

# Résultat:
# ✅ Curation queue saved: 40 low-trust triples
```

### 4.7 Appliquer décisions de curation (simulé)

```bash
# Créer fichier de décisions
docker exec ekg-airflow-scheduler bash -c 'cat > /opt/airflow/staging/decisions.csv << EOF
subject,predicate,object,trustScore,isAnomaly,decision,reviewer,timestamp
http://example.com/data#P_ANOMALY1,http://example.com/schema#worksFor,http://example.com/data#OU_NONEXISTENT,0.15,True,REJECT,test_curator,2025-11-27T12:00:00
http://example.com/data#P_ANOMALY2,http://example.com/schema#validFrom,1970-01-01T00:00:00Z,0.18,True,REJECT,test_curator,2025-11-27T12:01:00
EOF'

# Appliquer
docker exec ekg-airflow-scheduler python3 /opt/airflow/trust/curation_queue.py apply \
  --decisions /opt/airflow/staging/decisions.csv \
  --url http://graphdb:7200 \
  --repo ekg

# Résultat:
# ✅ 2 rejections applied (moved to quarantine)
```

**✅ Checkpoint**: Trust ML opérationnel, anomalies détectées et curées.

---

## TEP-05: SÉCURITÉ ET GOUVERNANCE

**Durée**: 90-120 minutes
**Objectif**: Configurer RBAC/ABAC avec Keycloak, tester 4 personas

### 5.1 Importer le realm Keycloak

```bash
docker cp infra/keycloak/realm-export.json ekg-keycloak:/tmp/

docker exec ekg-keycloak /opt/keycloak/bin/kc.sh import \
  --file /tmp/realm-export.json \
  --override true

# Vérifier
curl -s http://localhost:8180/realms/ekg | jq '.realm'
# Résultat: "ekg"
```

### 5.2 Vérifier les utilisateurs

**Via Keycloak Admin Console**:
1. http://localhost:8180/admin (admin/admin)
2. Sélectionner realm: `ekg`
3. Users: 4 utilisateurs présents
   - alice.viewer (role: viewer, clearance: Public, Internal)
   - bob.curator (role: curator, clearance: +Confidential)
   - carol.steward (role: steward, clearance: +Secret)
   - dave.admin (role: admin, clearance: all)

### 5.3 Tester authentification

```bash
# Token alice (viewer)
curl -X POST http://localhost:8180/realms/ekg/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=postman" \
  -d "username=alice.viewer" \
  -d "password=viewer123" \
  | jq -r '.access_token'

# Copier le token pour les tests suivants
```

### 5.4 Tests RBAC avec Postman

1. Importer `tests/TEP-05_postman_collection.json` dans Postman
2. Exécuter tous les tests:
   - Folder "0. Authentication": Login 4 personas
   - Folder "1. Viewer Tests": 1/3 SUCCESS (expected)
   - Folder "2. Curator Tests": 3/4 SUCCESS
   - Folder "3. Steward Tests": 3/3 SUCCESS
   - Folder "4. Admin Tests": 4/4 SUCCESS

### 5.5 Vérifier audit trail

```bash
docker exec ekg-api-gateway cat /var/log/ekg/audit.log | tail -20 | jq

# Résultat: JSON lines avec:
# - timestamp
# - username (alice.viewer, bob.curator, ...)
# - method (GET, POST)
# - url
# - status (SUCCESS/FAILED)
```

### 5.6 Test ABAC - Filtrage par label

Créer des personnes avec différents labels:

```sparql
PREFIX ex: <http://example.com/schema#>

INSERT DATA {
  GRAPH <http://example.com/data> {
    ex:P_PUBLIC a ex:Person ;
      ex:fullName "Public Person" ;
      ex:email "public@example.com" ;
      ex:worksFor ex:OU_ENG ;
      ex:label ex:Public .

    ex:P_SECRET a ex:Person ;
      ex:fullName "Secret Person" ;
      ex:email "secret@example.com" ;
      ex:worksFor ex:OU_HR ;
      ex:label ex:Secret .
  }
}
```

Tester avec alice (viewer):

```bash
curl -H "Authorization: Bearer $TOKEN_ALICE" \
  "http://localhost:3000/api/v1/persons" | jq '.data[].label'

# Résultat attendu:
# - P_PUBLIC visible
# - P_SECRET FILTRÉ (pas dans les résultats)
```

**✅ Checkpoint**: RBAC/ABAC fonctionnels, audit trail opérationnel.

---

## TEP-06: VERSIONING ET TEMPORALITÉ

**Durée**: 60-90 minutes
**Objectif**: Snapshots, requêtes as-of, propagation de changements, rollback

### 6.1 Créer snapshot initial (T0)

```bash
cd d:/2.0

bash scripts/snapshot_trig.sh ekg http://localhost:7200 snapshots snapshot_t0

# Résultat:
# ✅ Snapshot created: snapshots/snapshot_t0.trig
# Metadata: snapshots/snapshot_t0.meta.json
# Compressed: snapshots/snapshot_t0.trig.gz
```

### 6.2 Charger données temporelles

```bash
# Utiliser persons_temporal.csv (avec validFrom/validTo)
python scripts/csv_to_rdf.py seed/ staging_temporal/ job_temporal

bash scripts/cli_load_rdf.sh ekg http://localhost:7200 staging_temporal/ http://example.com/data
```

### 6.3 Créer snapshot T1

```bash
bash scripts/snapshot_trig.sh ekg http://localhost:7200 snapshots snapshot_t1
```

### 6.4 Requête as-of (état au 2025-11-01)

Dans GraphDB UI (http://localhost:7200/sparql):

```sparql
PREFIX ex: <http://example.com/schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?person ?fullName ?role
WHERE {
  ?person a ex:Person ;
          ex:fullName ?fullName ;
          ex:role ?role ;
          ex:validFrom ?vf .

  OPTIONAL { ?person ex:validTo ?vt }

  # As-of timestamp
  BIND("2025-11-01T00:00:00Z"^^xsd:dateTime AS ?asOfTimestamp)

  FILTER(?vf <= ?asOfTimestamp)
  FILTER(!BOUND(?vt) || ?vt > ?asOfTimestamp)
}
```

### 6.5 Exécuter propagation (promotion)

```bash
python scripts/execute_propagation.py \
  --config rules/propagation.yaml \
  --rule PROP-001 \
  --context '{
    "personUri": "http://example.com/data#P_Ali",
    "promotionTimestamp": "2025-11-15T00:00:00Z",
    "newRoleValue": "Senior Engineer"
  }' \
  --url http://localhost:7200 \
  --repo ekg \
  --output propagation_report.json

# Résultat:
# ✅ PROPAGATION SUCCESSFUL
# - Closed old version
# - Created new version
```

### 6.6 Calculer diff T0 → T1

```bash
bash scripts/diff_nquads.sh \
  snapshots/snapshot_t0.trig \
  snapshots/snapshot_t1.trig \
  diffs

# Résultat:
# ✅ Diff computation SUCCESSFUL
# Added: 15 triples
# Deleted: 8 triples
```

### 6.7 Test rollback

```bash
# Simuler erreur (supprimer tous les emails)
# Puis rollback vers snapshot T1

bash scripts/rollback_snapshot.sh \
  snapshots/snapshot_t1.trig \
  ekg \
  http://localhost:7200

# Processus interactif:
# - Backup pré-rollback créé automatiquement
# - Confirmation requise: YES
# - Repository cleared et restauré
# - Vérification: emails restaurés
```

**✅ Checkpoint**: Versioning opérationnel, snapshots et rollback testés.

---

## TEP-07: API ET APPLICATIONS

**Durée**: 90-120 minutes
**Objectif**: API GraphQL/REST, projection Neo4j, UI React

### 7.1 Installer Neo4j avec n10s

```bash
docker run -d \
  --name ekg-neo4j \
  --network ekg-network \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4JLABS_PLUGINS='["n10s"]' \
  -e NEO4J_dbms_security_procedures_unrestricted=n10s.* \
  neo4j:5.15

sleep 60
```

### 7.2 Setup Neo4j projection

```bash
bash scripts/neo4j_setup_n10s.sh

# Résultat:
# [1/5] ✓ Neo4j connected
# [2/5] ✓ n10s initialized
# [3/5] ✓ Namespaces configured
# [4/5] ✓ RDF imported from GraphDB
# [5/5] ✓ Indexes created
```

### 7.3 Vérifier dans Neo4j Browser

1. http://localhost:7474 (neo4j/password)
2. Query: `MATCH (n) RETURN labels(n), count(n)`
3. Résultat attendu:
   - ex__Person: 12+
   - ex__OrgUnit: 7
   - ex__Product: 6

### 7.4 Tester API GraphQL

**GraphQL Playground**: http://localhost:3000/graphql

```graphql
query GetPersons {
  persons(limit: 5) {
    totalCount
    nodes {
      id
      fullName
      email
      trustScore
      worksFor {
        name
      }
    }
  }
}
```

**Résultat attendu**: 5 personnes avec OrgUnit résolu

### 7.5 Tester API REST

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/persons?limit=5" | jq

# Résultat: JSON avec pagination
```

### 7.6 Démarrer UI React

```bash
cd ui/explorer

npm install

cat > .env <<EOF
REACT_APP_GRAPHQL_URL=http://localhost:3000/graphql
REACT_APP_REST_URL=http://localhost:3000/api/v1
REACT_APP_NEO4J_URL=bolt://localhost:7687
EOF

npm start

# Ouvrir http://localhost:3001
# Login: alice / alice123
```

**✅ Checkpoint**: API GraphQL/REST fonctionnelles, Neo4j synchronisé, UI accessible.

---

## TEP-08: DURCISSEMENT ET SCALABILITÉ

**Durée**: 60-90 minutes
**Objectif**: Cache Redis, index SPARQL, tests de charge, backups

### 8.1 Démarrer Redis

```bash
cd d:/2.0/infra
docker compose up -d redis

# Vérifier
docker exec ekg-redis redis-cli ping
# Résultat: PONG
```

### 8.2 Créer index SPARQL

```bash
python scripts/create_sparql_indexes.py

# Résultat:
# ✅ INDEX SPARQL CRÉÉS ET OPTIMISÉS
# Average query time: 23ms (improved)
```

### 8.3 Générer dataset volumétrique

```bash
python scripts/generate_load_dataset.py --multiplier 100 --output data/load_test.ttl

# Résultat:
# ✅ DATASET GÉNÉRÉ: 1,812 entités
# Taille: 8.45 MB
```

### 8.4 Charger dataset de test

```bash
curl -X POST http://localhost:7200/repositories/ekg/statements \
  -H "Content-Type: application/x-turtle" \
  --data-binary @data/load_test.ttl \
  -w "\nTime: %{time_total}s\n"

# Temps attendu: < 30 secondes
```

### 8.5 Exécuter tests de charge K6

```bash
k6 run tests/load/k6_load_test.js

# Résultat critique:
# ✅ SLO p95 < 800ms: 687ms PASSED
# ✅ Error rate < 1%: 0.12% PASSED
# Cache hit rate: 73.45%
```

### 8.6 Backup automatisé

```bash
bash scripts/backup_graphdb.sh

# Résultat:
# ✅ BACKUP TERMINÉ
# Fichier: backups/graphdb/ekg_backup_20251127_143022.ttl.gz
# Triplets: 15,247
# Durée: 12s
```

### 8.7 Importer dashboard performance Grafana

1. http://localhost:3001 → Import
2. Upload: `infra/grafana/dashboards/ekg_performance.json`
3. Vérifier métriques:
   - SLO p95: < 800ms ✅
   - Cache Hit Rate: > 50% ✅
   - Service Health: All UP ✅

**✅ Checkpoint**: Système optimisé, tests de charge passants, backups opérationnels.

---

## TESTS FINAUX ET VALIDATION

### Checklist complète

- [ ] **TEP-00**: Infrastructure déployée (8 services healthy)
- [ ] **TEP-01**: Données chargées (350+ triplets, SHACL 0 violations)
- [ ] **TEP-02**: Pipeline Airflow (8 tasks SUCCESS)
- [ ] **TEP-03**: Monitoring (Quality Score 100, dashboards actifs)
- [ ] **TEP-03.5**: Dual repo (staging + production, quarantaine testée)
- [ ] **TEP-04**: Trust ML (embeddings entraînés, anomalies détectées)
- [ ] **TEP-05**: Sécurité (4 personas testés, audit trail fonctionnel)
- [ ] **TEP-06**: Versioning (snapshots, as-of, rollback validés)
- [ ] **TEP-07**: API/UI (GraphQL, REST, Neo4j, UI React opérationnels)
- [ ] **TEP-08**: Performance (p95 < 800ms, cache actif, backups OK)

### Commandes de validation rapide

```bash
# Statut services
docker compose ps

# Health check global
bash scripts/healthcheck.sh

# Compter triplets
curl -s "http://localhost:7200/repositories/ekg/size" | jq

# Quality score
docker exec ekg-airflow-scheduler python3 /opt/airflow/scripts/quality_monitor.py \
  --url http://graphdb:7200 --repo ekg --pushgateway http://pushgateway:9091

# Métriques Prometheus
curl -s http://localhost:9091/metrics | grep "ekg_quality_score"

# Snapshots créés
ls -lh snapshots/

# Backups disponibles
ls -lh backups/graphdb/
```

### Tests end-to-end

```bash
# Scénario complet:
# 1. Ingestion → 2. Validation → 3. Trust ML → 4. Query API → 5. UI

# 1. Ingestion via Airflow (trigger DAG)
# 2. Vérifier quality score = 100
# 3. Trust ML: calculer scores
# 4. Query API GraphQL: récupérer personnes
# 5. UI: visualiser dans React app

# Temps total: ~15 minutes
```

### Métriques de succès

| Critère | Cible | Résultat |
|---------|-------|----------|
| **Disponibilité** | 99% | À mesurer |
| **Latence p95** | < 800ms | À mesurer |
| **Quality Score** | 100/100 | ✅ |
| **SHACL Violations** | 0 | ✅ |
| **Taux d'erreur** | < 1% | À mesurer |
| **Backup RPO** | < 1h | ✅ |
| **Restore RTO** | < 5min | ✅ |

---

## FÉLICITATIONS! 🎉

Vous avez complété l'installation et la validation de bout en bout de l'EKG!

**Système opérationnel avec**:
- ✅ Infrastructure complète (9 services)
- ✅ Pipeline d'ingestion automatisé
- ✅ Monitoring et alertes
- ✅ Sécurité RBAC/ABAC
- ✅ Machine Learning (Trust Scores)
- ✅ Versioning et temporalité
- ✅ API produit (GraphQL/REST)
- ✅ UI d'exploration
- ✅ Performance optimisée
- ✅ Backups et PRA

**Prochaines étapes recommandées**:
1. Configurer alerting (Alertmanager → email/Slack)
2. Automatiser backups (cron quotidien)
3. Déployer en staging/production
4. Documenter cas d'usage métier
5. Former les utilisateurs finaux

**Documentation**:
- [Runbook PRA](docs/runbook_pra.md)
- [Guide API](docs/api_guide.md)
- [Troubleshooting](docs/troubleshooting.md)

---

**Document validé**: 2025-11-27
**Version**: 1.0
**Temps total**: 8-10 heures réparties sur plusieurs sessions
