# =============================================================================
# EKG - Demarrage Controle de Tous les Services (PowerShell)
# =============================================================================
# Ce script demarre les services dans le bon ordre pour eviter les problemes
# de dependances circulaires.
#
# Usage: .\start-ekg.ps1
# =============================================================================

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "EKG - Demarrage des Services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour attendre qu'un service soit healthy
function Wait-ForHealthy {
    param(
        [string]$Service,
        [int]$MaxWait = 300
    )

    $waited = 0
    Write-Host "Attente du demarrage de $Service..." -ForegroundColor Yellow

    while ($waited -lt $MaxWait) {
        $status = docker-compose --env-file ./env/.env ps $Service | Select-String "(healthy)"
        if ($status) {
            Write-Host "[OK] $Service est pret!" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 5
        $waited += 5
        Write-Host "   ... $waited secondes ecoulees"
    }

    Write-Host "[WARN] Timeout en attendant $Service (pas critique)" -ForegroundColor Yellow
    return $false
}

# Fonction pour verifier que les bases de donnees PostgreSQL sont creees
function Wait-ForDatabases {
    param(
        [string[]]$Databases = @("airflow", "keycloak"),
        [int]$MaxWait = 120
    )

    $waited = 0
    Write-Host "Verification de la creation des bases de donnees..." -ForegroundColor Yellow

    while ($waited -lt $MaxWait) {
        $allExist = $true
        foreach ($db in $Databases) {
            $result = docker exec ekg-postgres psql -U ekg_admin -d ekg_meta -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>$null
            if ($result -ne "1") {
                $allExist = $false
                break
            }
        }

        if ($allExist) {
            Write-Host "[OK] Toutes les bases de donnees sont creees!" -ForegroundColor Green
            foreach ($db in $Databases) {
                Write-Host "  - $db" -ForegroundColor Gray
            }
            return $true
        }

        Start-Sleep -Seconds 3
        $waited += 3
    }

    Write-Host "[WARN] Timeout en attendant la creation des bases de donnees" -ForegroundColor Yellow
    return $false
}

# Phase 1: Infrastructure de Base
Write-Host ""
Write-Host "Phase 1/4: Demarrage de l'infrastructure de base" -ForegroundColor Cyan
Write-Host "------------------------------------------------"
docker-compose --env-file ./env/.env up -d postgres redis pushgateway
Wait-ForHealthy -Service "postgres" -MaxWait 180

# Verifier que les bases de donnees sont creees avant de continuer
Wait-ForDatabases -Databases @("airflow", "keycloak") -MaxWait 120

Write-Host "[OK] Phase 1 terminee" -ForegroundColor Green

# Phase 2: Services de Donnees
Write-Host ""
Write-Host "Phase 2/4: Demarrage de GraphDB et Prometheus" -ForegroundColor Cyan
Write-Host "----------------------------------------------"
Write-Host "[WARN] GraphDB prend 5-6 minutes a demarrer la premiere fois" -ForegroundColor Yellow
docker-compose --env-file ./env/.env up -d graphdb prometheus
Wait-ForHealthy -Service "graphdb" -MaxWait 420
Wait-ForHealthy -Service "prometheus" -MaxWait 60
Write-Host "[OK] Phase 2 terminee" -ForegroundColor Green

# Phase 3: Authentification et ETL
Write-Host ""
Write-Host "Phase 3/4: Demarrage de Keycloak et Airflow" -ForegroundColor Cyan
Write-Host "--------------------------------------------"
Write-Host "[WARN] Keycloak prend 5-6 minutes a demarrer la premiere fois" -ForegroundColor Yellow
docker-compose --env-file ./env/.env up -d keycloak airflow-init

Wait-ForHealthy -Service "keycloak" -MaxWait 480

Write-Host "Attente de la fin de l'initialisation Airflow..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

docker-compose --env-file ./env/.env up -d airflow-webserver airflow-scheduler
Write-Host "[OK] Phase 3 terminee" -ForegroundColor Green

# Phase 4: Services Applicatifs
Write-Host ""
Write-Host "Phase 4/4: Demarrage de Neo4j, API Gateway, et Grafana" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------"
docker-compose --env-file ./env/.env up -d neo4j
Wait-ForHealthy -Service "neo4j" -MaxWait 120

docker-compose --env-file ./env/.env up -d api-gateway neo4j-autosync grafana
Wait-ForHealthy -Service "grafana" -MaxWait 60

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "[OK] Tous les services sont demarres!" -ForegroundColor Green
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
Write-Host "Pour arreter:       docker-compose down"
Write-Host ""
