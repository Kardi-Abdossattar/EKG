# =============================================================================
# EKG - Démarrage Contrôlé de Tous les Services (PowerShell)
# =============================================================================
# Ce script démarre les services dans le bon ordre pour éviter les problèmes
# de dépendances circulaires.
#
# Usage: .\start-ekg.ps1
# =============================================================================

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "EKG - Démarrage des Services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour attendre qu'un service soit healthy
function Wait-ForHealthy {
    param(
        [string]$Service,
        [int]$MaxWait = 300
    )

    $waited = 0
    Write-Host "⏳ Attente du démarrage de $Service..." -ForegroundColor Yellow

    while ($waited -lt $MaxWait) {
        $status = docker-compose --env-file ./env/.env ps $Service | Select-String "(healthy)"
        if ($status) {
            Write-Host "✓ $Service est prêt!" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 5
        $waited += 5
        Write-Host "   ... $waited secondes écoulées"
    }

    Write-Host "⚠ Timeout en attendant $Service (pas critique)" -ForegroundColor Yellow
    return $false
}

# Phase 1: Infrastructure de Base
Write-Host ""
Write-Host "Phase 1/4: Démarrage de l'infrastructure de base" -ForegroundColor Cyan
Write-Host "------------------------------------------------"
docker-compose --env-file ./env/.env up -d postgres redis pushgateway
Wait-ForHealthy -Service "postgres" -MaxWait 180
Write-Host "✓ Phase 1 terminée" -ForegroundColor Green

# Phase 2: Services de Données
Write-Host ""
Write-Host "Phase 2/4: Démarrage de GraphDB et Prometheus" -ForegroundColor Cyan
Write-Host "----------------------------------------------"
Write-Host "⚠ GraphDB prend 5-6 minutes à démarrer la première fois" -ForegroundColor Yellow
docker-compose --env-file ./env/.env up -d graphdb prometheus
Wait-ForHealthy -Service "graphdb" -MaxWait 420
Wait-ForHealthy -Service "prometheus" -MaxWait 60
Write-Host "✓ Phase 2 terminée" -ForegroundColor Green

# Phase 3: Authentification et ETL
Write-Host ""
Write-Host "Phase 3/4: Démarrage de Keycloak et Airflow" -ForegroundColor Cyan
Write-Host "--------------------------------------------"
Write-Host "⚠ Keycloak prend 5-6 minutes à démarrer la première fois" -ForegroundColor Yellow
docker-compose --env-file ./env/.env up -d keycloak airflow-init

Wait-ForHealthy -Service "keycloak" -MaxWait 480

Write-Host "⏳ Attente de la fin de l'initialisation Airflow..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

docker-compose --env-file ./env/.env up -d airflow-webserver airflow-scheduler
Write-Host "✓ Phase 3 terminée" -ForegroundColor Green

# Phase 4: Services Applicatifs
Write-Host ""
Write-Host "Phase 4/4: Démarrage de Neo4j, API Gateway, et Grafana" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------"
docker-compose --env-file ./env/.env up -d neo4j
Wait-ForHealthy -Service "neo4j" -MaxWait 120

docker-compose --env-file ./env/.env up -d api-gateway neo4j-autosync grafana
Wait-ForHealthy -Service "grafana" -MaxWait 60

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✓ Tous les services sont démarrés!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services disponibles:"
Write-Host "  - GraphDB:        http://localhost:7200"
Write-Host "  - Neo4j:          http://localhost:7474"
Write-Host "  - Keycloak:       http://localhost:8180"
Write-Host "  - API Gateway:    http://localhost:3000"
Write-Host "  - Airflow:        http://localhost:8080"
Write-Host "  - Prometheus:     http://localhost:9090"
Write-Host "  - Grafana:        http://localhost:3001"
Write-Host ""
Write-Host "Pour voir les logs: docker-compose logs -f"
Write-Host "Pour arrêter:       docker-compose down"
Write-Host ""
