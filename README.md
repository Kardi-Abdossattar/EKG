# EKG - Enterprise Knowledge Graph

**Version 1.0 Final** | **Release Date**: December 2025

Un système de graphe de connaissances d'entreprise sécurisé avec authentification RBAC/ABAC, validation SHACL, et synchronisation automatique.

---

## 🚀 Démarrage Rapide

**Vous voulez lancer le système maintenant?**

➡️ **Consultez le [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md)**

Ce guide vous accompagne de A à Z:
- ✅ Installation et prérequis
- ✅ Construction des images Docker
- ✅ Lancement des 12 services
- ✅ Transformation et chargement des données
- ✅ Vérification de chaque composant
- ✅ Tests avec Postman
- ✅ Dépannage

**Durée estimée**: 30-45 minutes pour une première installation complète.

---

## 📚 Comprendre le Système

**Vous voulez comprendre l'architecture et les choix techniques?**

➡️ **Consultez l'[ARCHITECTURE.md](ARCHITECTURE.md)**

Cette documentation explique:
- 🏗️ Architecture en 5 couches
- 🔧 Chaque composant en détail (GraphDB, Neo4j, Keycloak, etc.)
- 🔄 Flux de données (ETL, authentification, monitoring)
- 🔐 Modèle de sécurité RBAC/ABAC
- 📊 Modèle de données RDF/SHACL
- 🤔 Décisions d'architecture (pourquoi GraphDB ET Neo4j?)

---

## 🎯 Qu'est-ce que l'EKG?

L'**Enterprise Knowledge Graph (EKG)** est un système complet de gestion de connaissances qui permet de:

1. **Intégrer** des données de sources multiples (CSV, APIs, bases de données)
2. **Transformer** les données en RDF (Resource Description Framework)
3. **Valider** la qualité avec SHACL (contraintes structurelles) et sanity checks (logique métier)
4. **Sécuriser** l'accès avec authentification OAuth2 et filtrage par labels de sécurité
5. **Interroger** via SPARQL (GraphDB) et Cypher (Neo4j)
6. **Monitorer** les performances et la qualité des données en temps réel

---

## 🌟 Fonctionnalités Clés

### 🔐 Sécurité Multi-Niveaux
- **OAuth2/OpenID Connect** via Keycloak
- **RBAC** (Role-Based Access Control): 4 rôles (viewer, curator, steward, admin)
- **ABAC** (Attribute-Based Access Control): Filtrage par security labels
- **Audit trail** complet de toutes les opérations

### 🔄 Synchronisation Automatique
- **Neo4j auto-sync**: Synchronisation GraphDB → Neo4j toutes les 30 secondes
- **Smart sync**: Détection de changements (ne sync que si nécessaire)
- **Pas de scripts manuels**: Tout est automatisé

### ✅ Validation de Qualité
- **SHACL**: Validation structurelle (datatypes, cardinalités, patterns)
- **Sanity checks**: Validation métier (duplicats, orphelins, incohérences)
- **Score de qualité**: 0-100 calculé automatiquement
- **Dashboards Grafana**: Visualisation en temps réel

### 📊 Double Base de Données Graphe
- **GraphDB** (RDF): Source de vérité, SPARQL, raisonnement OWL
- **Neo4j** (Property Graph): Performances, visualisation, Cypher
- **Meilleur des deux mondes**: Sémantique + performance

### 🔁 Pipeline ETL Automatisé
- **Apache Airflow**: Orchestration avec interface web
- **6 étapes**: Extract → Transform → Validate → Sanity → Metrics → Quality
- **Scheduling**: Daily (configurable à @hourly, @weekly, etc.)

### 📈 Monitoring Complet
- **Prometheus**: Collecte de métriques (GraphDB, API, système)
- **Grafana**: 2 dashboards (Performance + Quality)
- **Pushgateway**: Métriques custom from Airflow
- **Auto-refresh**: Toutes les 30 secondes

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UTILISATEURS (Postman, UI)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ HTTPS/REST + JWT
┌─────────────────────────────────────────────────────────────┐
│   SÉCURITÉ: Keycloak (OAuth2) + API Gateway (NestJS)        │
│   • Authentification JWT                                     │
│   • RBAC/ABAC Enforcement                                    │
│   • Security Label Filtering                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌────────────┐
│   GraphDB   │ │  Neo4j   │ │ PostgreSQL │
│ (RDF Store) │ │ (Graph)  │ │ (Metadata) │
│   SPARQL    │ │  Cypher  │ │  Airflow   │
│   SHACL     │ │ Auto-Sync│ │  Keycloak  │
└─────────────┘ └──────────┘ └────────────┘
        ▲             ▲
        │             │ Sync 30s
        │      ┌──────┴──────┐
        │      │ Neo4j-Sync  │
        │      │  (Python)   │
        │      └─────────────┘
        │
        ▼ ETL Daily
┌─────────────────────────────────┐
│   Airflow (Pipeline ETL)         │
│   CSV → RDF → Validate → Load   │
└─────────────────────────────────┘
        │
        ▼ Push Metrics
┌─────────────────────────────────┐
│   Prometheus + Grafana           │
│   Monitoring & Dashboards        │
└─────────────────────────────────┘
```

---

## 🛠️ Technologies

| Composant | Technologie | Version | Port |
|-----------|-------------|---------|------|
| **RDF Triplestore** | Ontotext GraphDB | 10.8.1 | 7200 |
| **Graph Database** | Neo4j | 5.15 | 7474, 7687 |
| **Authentication** | Keycloak | 26.0.7 | 8180 |
| **API Gateway** | NestJS (Node.js) | 10.x | 3000 |
| **ETL Orchestration** | Apache Airflow | 2.10.3 | 8080 |
| **Monitoring** | Prometheus | 3.0.1 | 9090 |
| **Dashboards** | Grafana | 11.3.1 | 3001 |
| **Relational DB** | PostgreSQL | 16 | 5432 |
| **Cache** | Redis | 7.4 | 6379 |
| **Metrics Gateway** | Pushgateway | 1.10.0 | 9091 |

---

## 📦 Contenu du Repository

```
d:\2.0\
├── 📄 README.md                    # Ce fichier
├── 📄 QUICKSTART_GUIDE.md          # Guide de démarrage complet
├── 📄 ARCHITECTURE.md              # Documentation architecture
├── 📁 infra/                       # Infrastructure Docker
│   ├── docker-compose.yml         # Configuration des 12 services
│   ├── graphdb/                   # GraphDB config
│   ├── neo4j/                     # Neo4j config
│   ├── neo4j-sync/                # Service auto-sync Python
│   ├── prometheus/                # Prometheus config
│   ├── grafana/                   # Grafana dashboards
│   ├── api-gateway/               # NestJS API
│   └── airflow/                   # Airflow DAGs
├── 📁 seed/                        # Données sources (CSV)
│   ├── persons.csv
│   ├── orgunits.csv
│   ├── products.csv
│   ├── assets.csv
│   └── projects.csv
├── 📁 data/                        # Données générées
│   └── generated/                 # RDF Turtle files
├── 📁 ontology/                    # Ontologies OWL
│   ├── core.ttl
│   ├── relations.ttl
│   ├── security.ttl
│   ├── temporal.ttl
│   └── provenance.ttl
├── 📁 shacl/                       # Contraintes SHACL
│   ├── shapes_core.ttl
│   ├── shapes_provenance.ttl
│   ├── shapes_temporal.ttl
│   └── shapes_security_fixed.ttl
├── 📁 pipelines/                   # Airflow DAGs
│   └── airflow_dags/
│       └── ekg_ingest.py
├── 📁 scripts/                     # Scripts Python
│   ├── csv_to_rdf.py              # Transformation CSV→RDF
│   ├── validate_shacl.py          # Validation SHACL
│   └── quality_monitor.py         # Monitoring qualité
├── 📁 tests/                       # Tests
│   ├── TEP-05_postman_collection.json  # Collection Postman RBAC
│   └── sanity/                    # Sanity checks SPARQL
└── 📁 docs/                        # Documentation détaillée
    ├── IMPORT_ORDER_GUIDE.md
    ├── WALKTHROUGH_SIMPLIFIED.md
    └── AUTO_REFRESH_GUIDE.md
```

---

## 🚦 Démarrage en 5 Minutes

Si vous voulez juste voir le système fonctionner rapidement:

```bash
# 1. Cloner le projet
git clone <repository-url> ekg-project
cd ekg-project
git checkout release/v1.0-final

# 2. Lancer tous les services
cd infra
docker-compose up -d

# 3. Attendre que tout soit prêt (~2 minutes)
docker-compose ps

# 4. Vérifier GraphDB
curl http://localhost:7200/repositories/ekg

# 5. Vérifier l'API (devrait retourner 401 Unauthorized)
curl http://localhost:3000/ekg/persons
```

**Ensuite**, suivez le [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md) pour charger les données et tester tout le système.

---

## 🔐 Utilisateurs de Test

Pour tester l'authentification avec Postman:

| Username | Password | Rôle | Peut Lire | Peut Écrire | Quarantine | Audit |
|----------|----------|------|-----------|-------------|------------|-------|
| alice.viewer | viewer123 | viewer | Public, Internal | ❌ | ❌ | ❌ |
| bob.curator | curator123 | curator | + Confidential | ❌ | ✅ | ❌ |
| carol.steward | steward123 | steward | + Secret | ✅ | ✅ | ❌ |
| dave.admin | admin123 | admin | Tout | ✅ | ✅ | ✅ |

**Collection Postman**: `tests/TEP-05_postman_collection.json`

---

## 📊 Dashboards de Monitoring

Une fois le système lancé, vous pouvez accéder à:

### Grafana - Dashboards
**URL**: http://localhost:3001 (admin/admin)

1. **EKG Performance Dashboard**
   - Mémoire GraphDB (heap used vs max)
   - CPU Load
   - Espace disque disponible
   - Taux de requêtes API
   - Mémoire API Gateway
   - État de santé des services

2. **EKG Quality Monitor**
   - Score de qualité (0-100)
   - Violations SHACL
   - Résultats sanity checks

### Prometheus - Métriques
**URL**: http://localhost:9090

Requêtes utiles:
```promql
# Mémoire GraphDB
graphdb_heap_used_mem

# Services UP/DOWN
up{job=~"graphdb|api-gateway"}

# Score de qualité
ekg_quality_score
```

### Airflow - Pipeline ETL
**URL**: http://localhost:8080 (admin/admin)

- Voir l'historique des exécutions du DAG `ekg_ingest`
- Déclencher manuellement le pipeline
- Consulter les logs de chaque tâche

### Neo4j Browser
**URL**: http://localhost:7474 (neo4j/password)

- Visualiser le graphe
- Exécuter des requêtes Cypher
- Explorer les relations

### GraphDB Workbench
**URL**: http://localhost:7200

- Explorer les triplets RDF
- Exécuter des requêtes SPARQL
- Valider avec SHACL

### Keycloak Admin Console
**URL**: http://localhost:8180 (admin/admin)

- Gérer les utilisateurs
- Configurer les rôles
- Voir les tokens actifs

---

## 🎓 Cas d'Usage

### 1. Gestion des Employés
```sparql
# Trouver tous les employés d'une organisation
PREFIX ex: <http://example.com/schema#>

SELECT ?person ?name ?email ?role
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name ;
          ex:email ?email ;
          ex:role ?role ;
          ex:worksFor ?org .
  ?org ex:name "Engineering" .
}
```

### 2. Audit de Provenance
```sparql
# Tracer l'origine des données
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?entity ?source ?timestamp
WHERE {
  ?entity prov:wasDerivedFrom ?source ;
          prov:generatedAtTime ?timestamp .
}
ORDER BY DESC(?timestamp)
```

### 3. Recherche Multi-Critères
```sparql
# Personnes avec un rôle spécifique et un label de sécurité
PREFIX ex: <http://example.com/schema#>

SELECT ?person ?name
WHERE {
  ?person a ex:Person ;
          ex:fullName ?name ;
          ex:role "Software Engineer" ;
          ex:label ex:Internal .
}
```

---

## 🐛 Support et Dépannage

### Problèmes Courants

**Service ne démarre pas?**
```bash
docker-compose logs <nom-du-service>
```

**Port déjà utilisé?**
```bash
# Windows
netstat -ano | findstr :7200

# Linux/Mac
lsof -i :7200
```

**Neo4j ne se synchronise pas?**
```bash
docker logs ekg-neo4j-autosync --tail 100
```

**Grafana affiche "No Data"?**
```bash
# Vérifier que Prometheus scrape
curl http://localhost:9090/api/v1/targets
```

➡️ **Plus de détails**: Consultez la section "Dépannage" dans [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md)

---

## 📖 Documentation Complète

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](README.md) | Vue d'ensemble (ce fichier) | Tout le monde |
| [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md) | Installation de A à Z | DevOps, Développeurs |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture technique | Architectes, Développeurs |
| [docs/IMPORT_ORDER_GUIDE.md](docs/IMPORT_ORDER_GUIDE.md) | Import manuel GraphDB | Data Engineers |
| [docs/AUTO_REFRESH_GUIDE.md](docs/AUTO_REFRESH_GUIDE.md) | Configuration auto-sync | DevOps |

---

## 🤝 Contribution

Ce projet est une version finale (v1.0). Pour toute modification:

1. Créer une nouvelle branche depuis `release/v1.0-final`
2. Faire vos changements
3. Tester complètement (Postman, Airflow DAG, etc.)
4. Créer une pull request avec description détaillée

---

## 📝 License

[À définir selon votre organisation]

---

## 👥 Auteurs

- **Équipe EKG** - Architecture et développement
- **Claude Sonnet 4.5** - Assistance technique et documentation

---

## 🎉 Remerciements

Technologies open-source utilisées:
- Ontotext GraphDB Community Edition
- Neo4j Community Edition
- Apache Airflow
- Keycloak
- Prometheus & Grafana
- NestJS
- PostgreSQL
- Redis

---

**Version**: 1.0 Final
**Dernière mise à jour**: 2025-12-13
**Support**: Consultez la documentation ou ouvrez une issue

---

## 🚀 Prochaines Étapes

Maintenant que vous avez lu cette introduction:

1. **Déployer le système** → [QUICKSTART_GUIDE.md](QUICKSTART_GUIDE.md)
2. **Comprendre l'architecture** → [ARCHITECTURE.md](ARCHITECTURE.md)
3. **Tester l'API** → `tests/TEP-05_postman_collection.json`
4. **Explorer les dashboards** → http://localhost:3001

**Bonne exploration de votre Knowledge Graph! 📊🔗**
