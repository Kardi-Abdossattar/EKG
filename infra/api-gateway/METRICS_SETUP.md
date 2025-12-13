# Configuration Métriques Prometheus - TEP-08

## Métriques exposées

L'API Gateway expose des métriques Prometheus sur `/metrics` :

### Métriques HTTP (compatibles dashboard Grafana)
- `http_requests_total` - Total des requêtes HTTP (labels: method, endpoint, status, job)
- `http_request_duration_seconds` - Durée des requêtes (histogram avec buckets)

### Métriques Cache Redis
- `redis_cache_hits_total` - Total des cache hits
- `redis_cache_misses_total` - Total des cache misses
- `redis_memory_used_bytes` - Mémoire Redis utilisée
- `redis_memory_max_bytes` - Mémoire Redis maximale (512MB par défaut)

### Métriques système
- `api_gateway_process_cpu_user_seconds_total` - CPU utilisateur
- `api_gateway_process_resident_memory_bytes` - Mémoire résidente
- `api_gateway_nodejs_heap_size_used_bytes` - Heap Node.js utilisé

## Tests rapides

### 1. Vérifier l'endpoint /metrics

```bash
curl http://localhost:3000/metrics
```

Résultat attendu :
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/metrics",status="200",job="api-gateway"} 1

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",endpoint="/health",job="api-gateway"} 10
...

# HELP redis_cache_hits_total Total number of cache hits
# TYPE redis_cache_hits_total counter
redis_cache_hits_total 42

# HELP redis_cache_misses_total Total number of cache misses
# TYPE redis_cache_misses_total counter
redis_cache_misses_total 15
```

### 2. Générer du trafic pour tester

```bash
# Plusieurs requêtes pour générer des métriques
for i in {1..10}; do
  curl -s http://localhost:3000/health > /dev/null
done

# Vérifier que les compteurs augmentent
curl http://localhost:3000/metrics | grep "http_requests_total"
```

### 3. Tester le cache (HIT vs MISS)

```bash
# Première requête (cache MISS)
curl -X POST http://localhost:3000/api/sparql/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * WHERE { ?s ?p ?o } LIMIT 5"}'

# Deuxième requête identique (cache HIT)
curl -X POST http://localhost:3000/api/sparql/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * WHERE { ?s ?p ?o } LIMIT 5"}'

# Vérifier les métriques cache
curl http://localhost:3000/metrics | grep redis_cache
```

### 4. Vérifier dans Prometheus

1. Ouvrir Prometheus : http://localhost:9090
2. Aller dans "Graph"
3. Tester les requêtes :
   - `http_requests_total{job="api-gateway"}`
   - `rate(http_requests_total{job="api-gateway"}[5m])`
   - `redis_cache_hits_total / (redis_cache_hits_total + redis_cache_misses_total)`

### 5. Vérifier dans Grafana

1. Ouvrir Grafana : http://localhost:3001 (admin/admin)
2. Importer le dashboard : `infra/grafana/dashboards/ekg_performance.json`
3. Les 7 panels devraient afficher des données après quelques requêtes

## Dépannage

### "No data" dans Grafana

**Cause** : Prometheus ne scrape pas encore les métriques

**Solution** :
```bash
# 1. Vérifier que l'API Gateway expose /metrics
curl http://localhost:3000/metrics

# 2. Vérifier la config Prometheus
cat infra/prometheus/prometheus.yml | grep -A 5 "api-gateway"

# 3. Vérifier les targets Prometheus
# http://localhost:9090/targets
# Le job "api-gateway" doit être UP

# 4. Redémarrer Prometheus si nécessaire
docker compose restart prometheus
```

### Métriques Redis à 0

**Cause** : Aucune requête SPARQL avec cache n'a été faite

**Solution** :
```bash
# Faire quelques requêtes SPARQL pour activer le cache
curl -X POST http://localhost:3000/api/sparql/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT ?s WHERE { ?s a <http://example.com/schema#Person> } LIMIT 10"}'

# Répéter la même requête (devrait être cachée)
# Puis vérifier les métriques
curl http://localhost:3000/metrics | grep redis_cache
```

## Architecture

```
┌─────────────────┐
│  Requête HTTP   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  MetricsInterceptor     │ ◄─── Capture toutes les requêtes
│  (global interceptor)   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   MetricsService        │
│  - http_requests_total  │
│  - http_request_duration│
│  - redis_cache_*        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  /metrics endpoint      │ ───► Prometheus scrape (15s)
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│    Prometheus           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Grafana Dashboard      │ ◄─── Visualisation
└─────────────────────────┘
```

## Prochaines étapes

1. **Ajouter des métriques business** :
   - Nombre de requêtes SPARQL par utilisateur
   - Taux de validation SHACL
   - TrustScore moyen par type d'entité

2. **Alertes Prometheus** :
   - Les alertes sont déjà configurées dans `infra/prometheus/alerts/ekg_alerts.yml`
   - Tester avec `docker compose restart prometheus`

3. **Exporter des métriques Redis natives** :
   - Installer redis_exporter pour métriques détaillées
   - Ajouter au docker-compose.yml si nécessaire
