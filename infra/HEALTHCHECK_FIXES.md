# Guide de résolution des healthchecks Docker

## Problèmes résolus

### Changements effectués dans docker-compose.yml

1. **PostgreSQL** : Correction de la variable d'environnement dans healthcheck
   - ❌ Avant : `pg_isready -U ${POSTGRES_USER:-ekg_admin}` (variable non résolue)
   - ✅ Après : `pg_isready -U ekg_admin` (valeur hardcodée)
   - Ajout : `start_period: 10s`

2. **GraphDB** : Remplacement de `curl` par `wget`
   - ❌ Avant : `CMD curl -f http://localhost:7200/rest/repositories`
   - ✅ Après : `CMD-SHELL wget --quiet --tries=1 --spider http://localhost:7200/rest/repositories || exit 1`
   - Augmentation : `start_period: 90s` (GraphDB est lent au démarrage)

3. **Airflow Webserver** : Correction de la commande curl
   - ❌ Avant : `CMD curl -f http://localhost:8080/health`
   - ✅ Après : `CMD-SHELL curl --fail http://localhost:8080/health || exit 1`
   - Augmentation : `start_period: 80s`
   - **IMPORTANT** : Port changé de `8081` à `8080` pour correspondre à la doc

4. **Airflow Scheduler** : Correction de la variable hostname
   - ❌ Avant : `$(hostname)` (non résolu dans array JSON)
   - ✅ Après : `$${HOSTNAME}` (échappement Docker Compose)
   - Augmentation : `start_period: 80s`

5. **Keycloak** : Utilisation de TCP check au lieu de HTTP
   - ❌ Avant : `CMD curl -f http://localhost:8080/q/health/ready` (curl absent)
   - ✅ Après : `CMD-SHELL exec 3<>/dev/tcp/localhost/8080 || exit 1` (TCP natif bash)
   - Augmentation : `start_period: 90s`

6. **API Gateway** : Correction wget
   - ❌ Avant : `CMD wget --quiet --tries=1 --spider`
   - ✅ Après : `CMD-SHELL wget --quiet --tries=1 --spider ... || exit 1`
   - Augmentation : `start_period: 45s`

7. **Prometheus & Grafana** : Ajout de `start_period`
   - Ajout : `start_period: 30s` pour tous les deux

---

## Commandes de diagnostic

### 1. Vérifier l'état des healthchecks

```bash
# Tous les conteneurs
docker compose ps

# Détails d'un conteneur spécifique
docker inspect ekg-graphdb --format='{{json .State.Health}}' | jq

# Logs des healthchecks
docker inspect ekg-graphdb --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

### 2. Tester manuellement un healthcheck

**GraphDB** :
```bash
docker exec ekg-graphdb wget --quiet --tries=1 --spider http://localhost:7200/rest/repositories
echo $?  # Devrait retourner 0 si OK
```

**PostgreSQL** :
```bash
docker exec ekg-postgres pg_isready -U ekg_admin -d ekg_meta
```

**Airflow Webserver** :
```bash
docker exec ekg-airflow-webserver curl --fail http://localhost:8080/health
```

**Keycloak** (TCP check) :
```bash
docker exec ekg-keycloak bash -c "exec 3<>/dev/tcp/localhost/8080 && echo OK"
```

**API Gateway** :
```bash
docker exec ekg-api-gateway wget --quiet --tries=1 --spider http://localhost:3000/health
```

### 3. Forcer un healthcheck manuel

```bash
# Tester le healthcheck sans attendre l'interval
docker inspect ekg-graphdb --format='{{.State.Health.Status}}'

# Redémarrer un conteneur pour réinitialiser le healthcheck
docker compose restart graphdb
```

---

## Tableau récapitulatif des start_period

| Service | start_period | Raison |
|---------|--------------|--------|
| postgres | 10s | Démarrage rapide |
| graphdb | 90s | JVM lent, initialisation GraphDB |
| airflow-webserver | 80s | Attend DB migration, initialisation Flask |
| airflow-scheduler | 80s | Attend DB, initialisation scheduler |
| keycloak | 90s | Démarrage Quarkus + migration DB |
| api-gateway | 45s | Build NestJS + connexion dépendances |
| prometheus | 30s | Chargement config + TSDB |
| grafana | 30s | Initialisation + provisioning |

---

## Alternatives de healthcheck

### Option 1 : HTTP avec curl (si disponible)

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl --fail http://localhost:8080/health || exit 1"]
```

### Option 2 : HTTP avec wget (Alpine Linux)

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1"]
```

### Option 3 : TCP socket check (toujours disponible)

```yaml
healthcheck:
  test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 || exit 1"]
```

### Option 4 : Process check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pgrep -f 'java.*keycloak' || exit 1"]
```

### Option 5 : Désactiver le healthcheck (debugging)

```yaml
healthcheck:
  disable: true
```

---

## Troubleshooting par service

### GraphDB reste "unhealthy"

**Symptôme** :
```
ekg-graphdb   Up 5 minutes (unhealthy)
```

**Solutions** :

1. Vérifier les logs :
```bash
docker compose logs graphdb | tail -50
```

2. Vérifier si le port répond :
```bash
docker exec ekg-graphdb wget -O- http://localhost:7200/rest/repositories
```

3. Vérifier la mémoire :
```bash
docker stats ekg-graphdb
```

4. Augmenter `start_period` si le démarrage est lent :
```yaml
start_period: 120s  # 2 minutes
```

### Airflow "unhealthy"

**Symptôme** :
```
ekg-airflow-webserver   Up 3 minutes (health: starting)
```

**Solutions** :

1. Vérifier si airflow-init s'est terminé :
```bash
docker compose ps airflow-init
# Doit être "Exited (0)"
```

2. Vérifier les logs :
```bash
docker compose logs airflow-webserver | grep -i health
```

3. Tester manuellement l'endpoint :
```bash
docker exec ekg-airflow-webserver curl http://localhost:8080/health
```

4. Si `/health` n'existe pas, utiliser `/` :
```yaml
test: ["CMD-SHELL", "curl --fail http://localhost:8080/ || exit 1"]
```

### Keycloak "unhealthy"

**Symptôme** :
```
ekg-keycloak   Up 4 minutes (unhealthy)
```

**Solutions** :

1. Vérifier si le port 8080 écoute :
```bash
docker exec ekg-keycloak netstat -tulpn | grep 8080
```

2. Tester le TCP check :
```bash
docker exec ekg-keycloak bash -c "timeout 2 bash -c '</dev/tcp/localhost/8080' && echo OK"
```

3. Alternative : vérifier le processus Java :
```yaml
healthcheck:
  test: ["CMD-SHELL", "pgrep -f 'java.*keycloak' || exit 1"]
```

### API Gateway "unhealthy"

**Symptôme** :
```
ekg-api-gateway   Up 2 minutes (health: starting)
```

**Solutions** :

1. Vérifier si le build NestJS est terminé :
```bash
docker compose logs api-gateway | grep -i "listening\|error"
```

2. Vérifier si wget est disponible :
```bash
docker exec ekg-api-gateway which wget
```

3. Si wget manque, installer ou utiliser Node.js :
```yaml
healthcheck:
  test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1))\""]
```

---

## Redéploiement après modification

### Option 1 : Redémarrage complet

```bash
# Arrêter tous les services
docker compose down

# Redémarrer avec les nouveaux healthchecks
docker compose up -d

# Suivre les logs
docker compose logs -f
```

### Option 2 : Redémarrage d'un service spécifique

```bash
# Recréer un service avec la nouvelle config
docker compose up -d --force-recreate graphdb

# Vérifier le statut
docker compose ps graphdb
```

### Option 3 : Sans interruption (rolling update)

```bash
# Recréer avec no-deps (sans recréer les dépendances)
docker compose up -d --no-deps --force-recreate graphdb
```

---

## Vérification finale

Une fois tous les services redémarrés :

```bash
# Attendre 2-5 minutes, puis vérifier
docker compose ps

# Tous les services doivent afficher "healthy"
# Exemple :
# NAME                     STATUS
# ekg-graphdb              Up 3 minutes (healthy)
# ekg-postgres             Up 3 minutes (healthy)
# ekg-airflow-webserver    Up 2 minutes (healthy)
# ekg-keycloak             Up 2 minutes (healthy)
# ekg-api-gateway          Up 1 minute (healthy)
# ekg-prometheus           Up 1 minute (healthy)
# ekg-grafana              Up 1 minute (healthy)

# Lancer le healthcheck script
bash scripts/healthcheck.sh
```

**Résultat attendu** : `All checks passed ✓`

---

## Notes importantes

1. **start_period** : Période de grâce avant que les healthchecks ne comptent comme échecs
   - Permet aux services lents de démarrer sans être marqués "unhealthy"

2. **interval** : Fréquence des checks (30s par défaut)

3. **retries** : Nombre d'échecs consécutifs avant "unhealthy" (3-5 recommandé)

4. **timeout** : Temps maximum pour chaque check (10s recommandé)

5. **CMD vs CMD-SHELL** :
   - `CMD` : Exécute directement (pas de shell, pas de variables)
   - `CMD-SHELL` : Exécute via `/bin/sh -c` (permet variables, pipes, ||)

---

**Auteur** : EKG Team
**Date** : 2025-11-22
**Version** : TEP-00_INIT (fixes healthcheck)
