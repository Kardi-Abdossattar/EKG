# Notes sur Keycloak 26.0.7 - Endpoints et Healthchecks

## 📚 Documentation officielle

À partir de **Keycloak 26+**, les endpoints `/health` et `/metrics` ont été déplacés du port HTTP standard (8080) vers un **port de management dédié (9000)**.

Source : [Keycloak Management Interface Documentation](https://www.keycloak.org/server/management-interface)

---

## 🔍 Comportement par environnement

### Mode Development (`start-dev`)

En mode développement, Keycloak fonctionne avec :
- **Port HTTP standard** : 8080 (Admin Console, OIDC endpoints)
- **Port de management** : **NON ACTIVÉ par défaut**

Le healthcheck Docker doit donc utiliser le **port 8080** :

```yaml
healthcheck:
  test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 || exit 1"]
```

### Mode Production (`start`)

En mode production, Keycloak active le port de management :
- **Port HTTPS** : 8443 (Admin Console, OIDC endpoints)
- **Port de management** : 9000 (`/health`, `/metrics`)

Le healthcheck devrait alors utiliser :

```yaml
ports:
  - "8180:8443"
  - "9000:9000"

healthcheck:
  test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/9000 || exit 1"]
```

---

## ⚙️ Configuration actuelle (TEP-00_INIT)

### docker-compose.yml

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.0.7
  ports:
    - "8180:8080"  # Port HTTP (Admin Console, OIDC)
    - "9000:9000"  # Port de management (health, metrics)
  environment:
    KC_HEALTH_ENABLED: "true"
    KC_METRICS_ENABLED: "true"
  healthcheck:
    test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/9000 || exit 1"]
  command:
    - start-dev
```

**✅ Configuration avec port de management activé**

Les endpoints de health sont maintenant disponibles sur le port 9000 même en mode dev.

---

## 🔄 Migration vers le mode production

Pour activer le port de management en mode production :

### Option 1 : Activer le port de management en mode dev

```yaml
keycloak:
  ports:
    - "8180:8080"
    - "9000:9000"
  environment:
    KC_HEALTH_ENABLED: "true"
    KC_METRICS_ENABLED: "true"
    # Le port 9000 sera activé automatiquement
  healthcheck:
    test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/9000 || exit 1"]
```

### Option 2 : Utiliser l'ancienne interface (déprécié)

```yaml
keycloak:
  environment:
    # DÉPRÉCIÉ : sera supprimé dans les futures versions
    KC_LEGACY_OBSERVABILITY_INTERFACE: "true"
  healthcheck:
    test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 || exit 1"]
```

**⚠️ Non recommandé** : Cette option sera supprimée.

---

## 🧪 Tests manuels

### Vérifier le port 8080 (mode dev actuel)

```bash
# TCP check
docker exec ekg-keycloak bash -c "exec 3<>/dev/tcp/localhost/8080 && echo OK"

# HTTP check (root)
docker exec ekg-keycloak curl -I http://localhost:8080/

# HTTP check (admin console)
docker exec ekg-keycloak curl -I http://localhost:8080/admin/
```

### Vérifier le port 9000 (management, activé en TEP-00)

```bash
# Health endpoint (status global)
curl http://localhost:9000/health

# Résultat :
{
    "status": "UP",
    "checks": [
        {
            "name": "Keycloak database connections async health check",
            "status": "UP"
        }
    ]
}

# Readiness probe
curl http://localhost:9000/health/ready

# Liveness probe
curl http://localhost:9000/health/live

# Metrics Prometheus
curl http://localhost:9000/metrics
```

**✅ Tous ces endpoints fonctionnent en TEP-00_INIT**

---

## 📊 Endpoints disponibles

### Port 8080 (HTTP - Mode dev)

| Endpoint | Description |
|----------|-------------|
| `/` | Redirect vers `/admin/` |
| `/admin/` | Admin Console UI |
| `/realms/{realm}` | Realm endpoints |
| `/realms/{realm}/protocol/openid-connect` | OIDC endpoints |

### Port 9000 (Management - Production)

| Endpoint | Description |
|----------|-------------|
| `/health` | Health aggregé |
| `/health/live` | Liveness probe |
| `/health/ready` | Readiness probe |
| `/metrics` | Métriques Prometheus |

---

## 🔧 API Gateway - Health Check

Le health controller de l'API Gateway utilise désormais l'endpoint root `/` pour vérifier Keycloak :

```typescript
private async checkKeycloak() {
  const keycloakUrl = process.env.KEYCLOAK_URL || 'http://keycloak:8080';

  // Endpoint root (toujours disponible, redirige vers /admin)
  const response = await axios.get(`${keycloakUrl}/`, {
    timeout: 5000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 500,
  });

  return {
    status: response.status < 500 ? 'up' : 'down',
  };
}
```

**Résultat** : ✅ Fonctionne en mode dev et production

---

## ✅ Validation

```bash
# Vérifier que Keycloak est healthy
docker compose ps keycloak

# Tester l'API Gateway health
curl http://localhost:3000/health

# Résultat attendu :
{
  "status": "ok",
  "dependencies": {
    "keycloak": { "status": "up" }
  }
}
```

---

## 📝 Recommandations

### Pour TEP-00_INIT (dev) ✅

- ✅ Utiliser le port 8080 avec TCP check
- ✅ Mode `start-dev`
- ✅ Pas besoin d'exposer le port 9000

### Pour Production (TEP-08) 🔜

- 🔜 Activer le port de management 9000
- 🔜 Utiliser `start` au lieu de `start-dev`
- 🔜 Configurer TLS/HTTPS
- 🔜 Healthcheck sur le port 9000

---

## 🔗 Références

- [Keycloak Management Interface](https://www.keycloak.org/server/management-interface)
- [Keycloak Health Checks](https://www.keycloak.org/server/health)
- [Keycloak Metrics](https://www.keycloak.org/server/configuration-metrics)
- [Keycloak Production Guide](https://www.keycloak.org/server/configuration-production)

---

**Auteur** : EKG Team
**Date** : 2025-11-22
**Version** : TEP-00_INIT
**Statut** : ✅ Configuration dev validée
