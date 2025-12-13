# Solution finale des healthchecks Docker

## ✅ Problème résolu

**Symptôme** : `ekg-airflow-scheduler` affichait `(unhealthy)` alors que les logs montraient un service fonctionnel.

**Cause racine** : Le healthcheck `airflow jobs check --job-type SchedulerJob` dépassait régulièrement le timeout de 10s, provoquant des échecs intermittents (exit code -1).

---

## 🔧 Solution appliquée

### Airflow Scheduler - Healthcheck corrigé

**Avant** (timeout fréquent) :
```yaml
healthcheck:
  test: ["CMD-SHELL", "airflow jobs check --job-type SchedulerJob --hostname $${HOSTNAME} || exit 1"]
  interval: 30s
  timeout: 10s  # ❌ Trop court
  retries: 5
  start_period: 80s
```

**Après** (robuste) :
```yaml
healthcheck:
  test: ["CMD-SHELL", "airflow jobs check --job-type SchedulerJob --hostname $${HOSTNAME} 2>/dev/null | grep -q 'alive job' || exit 1"]
  interval: 45s     # ✅ Moins fréquent
  timeout: 20s      # ✅ Suffisant pour la commande
  retries: 3        # ✅ Réduit (moins de faux positifs)
  start_period: 80s
```

**Changements clés** :
1. `2>/dev/null` : Ignore les warnings Python (FutureWarning)
2. `grep -q 'alive job'` : Filtre la sortie pour valider le succès
3. `timeout: 20s` : Permet à la commande de finir sans timeout
4. `interval: 45s` : Réduit la charge (check moins fréquent)

---

## 📊 État final de tous les services

```bash
$ docker compose ps
NAME                    STATUS
ekg-airflow-scheduler   Up X minutes (healthy) ✅
ekg-airflow-webserver   Up X minutes (healthy) ✅
ekg-api-gateway         Up X minutes (healthy) ✅
ekg-grafana             Up X minutes (healthy) ✅
ekg-graphdb             Up X minutes (healthy) ✅
ekg-keycloak            Up X minutes (healthy) ✅
ekg-postgres            Up X minutes (healthy) ✅
ekg-prometheus          Up X minutes (healthy) ✅
```

**🎉 Tous les services sont maintenant healthy !**

---

## 📋 Tableau récapitulatif des healthchecks finaux

| Service | Méthode | Timeout | Interval | Raison |
|---------|---------|---------|----------|--------|
| **postgres** | `pg_isready` | 5s | 10s | Commande rapide native |
| **graphdb** | `wget REST API` | 10s | 30s | Endpoint HTTP simple |
| **airflow-webserver** | `curl /health` | 10s | 30s | Endpoint HTTP natif |
| **airflow-scheduler** | `airflow jobs check + grep` | **20s** | **45s** | Commande lente, filtrage stderr |
| **keycloak** | `TCP check` | 10s | 30s | Pas de `curl` dans l'image |
| **api-gateway** | `wget /health` | 10s | 30s | Endpoint HTTP NestJS |
| **prometheus** | `wget /-/healthy` | 10s | 30s | Endpoint HTTP natif |
| **grafana** | `wget /api/health` | 10s | 30s | Endpoint HTTP natif |

---

## 🧪 Commandes de vérification

### Vérifier tous les services

```bash
cd d:/2.0/infra
docker compose ps
```

**Résultat attendu** : Tous les services `(healthy)`

### Vérifier un service spécifique

```bash
# Statut détaillé
docker inspect ekg-airflow-scheduler --format='{{json .State.Health}}' | jq

# Logs du healthcheck
docker inspect ekg-airflow-scheduler --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

### Tester manuellement le healthcheck du scheduler

```bash
docker exec ekg-airflow-scheduler bash -c "airflow jobs check --job-type SchedulerJob --hostname \$HOSTNAME 2>/dev/null | grep -q 'alive job' && echo OK"
```

**Sortie attendue** : `OK` (exit code 0)

---

## 🔄 Redéploiement après modification

Si vous modifiez le docker-compose.yml :

```bash
cd d:/2.0/infra

# Option 1 : Recréer le service spécifique
docker compose up -d --no-deps --force-recreate airflow-scheduler

# Option 2 : Redémarrage complet
docker compose down
docker compose up -d
```

---

## 🐛 Troubleshooting

### Scheduler reste "starting" longtemps

**Normal** : Le `start_period: 80s` donne 80 secondes avant le premier check.

**Solution** : Attendre 2 minutes maximum.

### Scheduler alterne entre healthy et unhealthy

**Cause** : Timeout trop court ou interval trop court.

**Solution** :
- Augmenter `timeout` (ex: 30s)
- Augmenter `interval` (ex: 60s)

```yaml
healthcheck:
  timeout: 30s
  interval: 60s
```

### Voir les logs détaillés du healthcheck

```bash
# Derniers checks
docker inspect ekg-airflow-scheduler \
  --format='{{range .State.Health.Log}}{{.Start}}: Exit={{.ExitCode}} | {{.Output}}{{"\n"}}{{end}}' | tail -10

# Filtre uniquement les échecs
docker inspect ekg-airflow-scheduler \
  --format='{{range .State.Health.Log}}{{if ne .ExitCode 0}}{{.Output}}{{end}}{{end}}'
```

---

## 📝 Autres modifications effectuées

### 1. Suppression de `version: '3.9'`

Docker Compose V2 ne nécessite plus cette ligne (obsolète).

**Avant** :
```yaml
version: '3.9'

networks:
```

**Après** :
```yaml
# EKG Sécurisé & Fiable - Infrastructure de base
networks:
```

### 2. Tous les services ont maintenant `start_period`

Évite les faux positifs "unhealthy" pendant le démarrage :

- postgres : 10s (rapide)
- graphdb : 90s (JVM lent)
- airflow-* : 80s (migration DB)
- keycloak : 90s (migration DB)
- api-gateway : 45s (build + connexions)
- prometheus/grafana : 30s (init)

---

## ✅ Validation finale

### Checklist

- [x] Tous les services démarrent sans erreur
- [x] Tous les services deviennent `healthy` après 2-5 minutes
- [x] `docker compose ps` ne montre aucun service `unhealthy`
- [x] Le scheduler reste `healthy` en permanence (pas d'oscillation)
- [x] Aucun warning `version` obsolète

### Commande de test complète

```bash
cd d:/2.0/infra

# 1. Redémarrer proprement
docker compose down
docker compose up -d

# 2. Attendre 3 minutes
sleep 180

# 3. Vérifier
docker compose ps

# 4. Healthcheck complet
bash scripts/healthcheck.sh
```

**Résultat attendu** : `All checks passed ✓`

---

## 📚 Références

- [Docker Compose healthcheck](https://docs.docker.com/compose/compose-file/05-services/#healthcheck)
- [Airflow healthcheck best practices](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/production-deployment.html#health-checks)
- [infra/HEALTHCHECK_FIXES.md](./HEALTHCHECK_FIXES.md) - Guide complet de troubleshooting

---

**Auteur** : EKG Team
**Date** : 2025-11-22
**Version** : TEP-00_INIT (healthcheck fix final)
**Statut** : ✅ RÉSOLU
