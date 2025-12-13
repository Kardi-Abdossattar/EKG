# =============================================================================
# EKG Sécurisé - Healthcheck Script (TEP-00_INIT) - PowerShell Version
# =============================================================================
# Vérifie que tous les services de l'infrastructure sont opérationnels
# Usage: .\healthcheck.ps1

param(
    [int]$Timeout = 5
)

# Configuration
$GRAPHDB_URL = if ($env:GRAPHDB_URL) { $env:GRAPHDB_URL } else { "http://localhost:7200" }
$AIRFLOW_URL = if ($env:AIRFLOW_URL) { $env:AIRFLOW_URL } else { "http://localhost:8080" }
$KEYCLOAK_URL = if ($env:KEYCLOAK_URL) { $env:KEYCLOAK_URL } else { "http://localhost:8180" }
$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000" }
$PROMETHEUS_URL = if ($env:PROMETHEUS_URL) { $env:PROMETHEUS_URL } else { "http://localhost:9090" }
$GRAFANA_URL = if ($env:GRAFANA_URL) { $env:GRAFANA_URL } else { "http://localhost:3001" }

$FailedChecks = 0

Write-Host "=========================================="
Write-Host "EKG Infrastructure Health Check"
Write-Host "=========================================="
Write-Host ""

# Function to check HTTP endpoint
function Check-Http {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedCode = 200
    )

    Write-Host -NoNewline "Checking $Name... "

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode

        if ($statusCode -eq $ExpectedCode -or $statusCode -eq 200) {
            Write-Host "✓ OK" -ForegroundColor Green -NoNewline
            Write-Host " (HTTP $statusCode)"
            return $true
        } else {
            Write-Host "✗ FAILED" -ForegroundColor Red -NoNewline
            Write-Host " (HTTP $statusCode, expected $ExpectedCode)"
            $script:FailedChecks++
            return $false
        }
    } catch {
        Write-Host "✗ FAILED" -ForegroundColor Red -NoNewline
        Write-Host " ($($_.Exception.Message))"
        $script:FailedChecks++
        return $false
    }
}

# Function to check Docker container
function Check-Container {
    param(
        [string]$Name,
        [string]$ContainerName
    )

    Write-Host -NoNewline "Checking Docker container $Name... "

    try {
        $status = docker inspect -f '{{.State.Health.Status}}' $ContainerName 2>$null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ NOT RUNNING" -ForegroundColor Red
            $script:FailedChecks++
            return $false
        }

        if ($status -eq "healthy") {
            Write-Host "✓ HEALTHY" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠ $status" -ForegroundColor Yellow
            $script:FailedChecks++
            return $false
        }
    } catch {
        Write-Host "✗ ERROR" -ForegroundColor Red -NoNewline
        Write-Host " ($($_.Exception.Message))"
        $script:FailedChecks++
        return $false
    }
}

# =============================================================================
# Docker Container Health Checks
# =============================================================================
Write-Host "--- Docker Containers ---"
Check-Container -Name "GraphDB" -ContainerName "ekg-graphdb"
Check-Container -Name "PostgreSQL" -ContainerName "ekg-postgres"
Check-Container -Name "Airflow Webserver" -ContainerName "ekg-airflow-webserver"
Check-Container -Name "Airflow Scheduler" -ContainerName "ekg-airflow-scheduler"
Check-Container -Name "Keycloak" -ContainerName "ekg-keycloak"
Check-Container -Name "API Gateway" -ContainerName "ekg-api-gateway"
Check-Container -Name "Prometheus" -ContainerName "ekg-prometheus"
Check-Container -Name "Grafana" -ContainerName "ekg-grafana"
Write-Host ""

# =============================================================================
# HTTP Endpoint Health Checks
# =============================================================================
Write-Host "--- HTTP Endpoints ---"
Check-Http -Name "GraphDB REST API" -Url "$GRAPHDB_URL/rest/repositories"
Check-Http -Name "Airflow UI" -Url "$AIRFLOW_URL/health"
Check-Http -Name "Keycloak Web UI" -Url "$KEYCLOAK_URL/" -ExpectedCode 302
Check-Http -Name "API Gateway Health" -Url "$API_URL/health"
Check-Http -Name "Prometheus" -Url "$PROMETHEUS_URL/-/healthy"
Check-Http -Name "Grafana" -Url "$GRAFANA_URL/api/health"
Write-Host ""

# =============================================================================
# Advanced Checks
# =============================================================================
Write-Host "--- Advanced Checks ---"

# Check GraphDB repository exists
Write-Host -NoNewline "Checking GraphDB repository 'ekg'... "
try {
    $repoCheck = Invoke-RestMethod -Uri "$GRAPHDB_URL/rest/repositories/ekg" -TimeoutSec $Timeout -ErrorAction Stop
    if ($repoCheck.id) {
        Write-Host "✓ EXISTS" -ForegroundColor Green
    } else {
        Write-Host "⚠ NOT CREATED" -ForegroundColor Yellow -NoNewline
        Write-Host " (run: create repository via UI)"
    }
} catch {
    Write-Host "⚠ NOT CREATED" -ForegroundColor Yellow -NoNewline
    Write-Host " (create via GraphDB UI)"
}

# Check Prometheus targets
Write-Host -NoNewline "Checking Prometheus targets... "
try {
    $targets = Invoke-RestMethod -Uri "$PROMETHEUS_URL/api/v1/targets" -TimeoutSec $Timeout -ErrorAction Stop
    $upTargets = ($targets.data.activeTargets | Where-Object { $_.health -eq "up" }).Count
    if ($upTargets -gt 0) {
        Write-Host "✓ $upTargets targets UP" -ForegroundColor Green
    } else {
        Write-Host "⚠ No targets UP" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ SKIPPED" -ForegroundColor Yellow
}

# Check API Gateway dependencies
# Check Prometheus targets
Write-Host -NoNewline "Checking Prometheus targets... "
try {
    $targets = Invoke-RestMethod -Uri "$PROMETHEUS_URL/api/v1/targets" -TimeoutSec $Timeout -ErrorAction Stop
    $upTargets = ($targets.data.activeTargets | Where-Object { $_.health -eq "up" }).Count
    if ($upTargets -gt 0) {
        Write-Host "✓ $upTargets targets UP" -ForegroundColor Green
    } else {
        Write-Host "⚠ No targets UP" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠ SKIPPED" -ForegroundColor Yellow
}


Write-Host ""

# =============================================================================
# Summary
# =============================================================================
Write-Host "=========================================="
if ($FailedChecks -eq 0) {
    Write-Host "All checks passed ✓" -ForegroundColor Green
    Write-Host "Infrastructure is ready!"
    exit 0
} else {
    Write-Host "$FailedChecks check(s) failed ✗" -ForegroundColor Red
    Write-Host "Please review the logs: docker compose logs -f"
    exit 1
}
