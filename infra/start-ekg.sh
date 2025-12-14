#!/bin/bash
# =============================================================================
# EKG - Démarrage Contrôlé de Tous les Services
# =============================================================================
# Ce script démarre les services dans le bon ordre pour éviter les problèmes
# de dépendances circulaires.
#
# Usage: ./start-ekg.sh
# =============================================================================

set -e

echo "========================================="
echo "EKG - Démarrage des Services"
echo "========================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour attendre qu'un service soit healthy
wait_for_healthy() {
    local service=$1
    local max_wait=${2:-300}  # 5 minutes par défaut
    local waited=0

    echo -e "${YELLOW}⏳ Attente du démarrage de $service...${NC}"

    while [ $waited -lt $max_wait ]; do
        if docker-compose ps $service | grep -q "(healthy)"; then
            echo -e "${GREEN}✓ $service est prêt!${NC}"
            return 0
        fi
        sleep 5
        waited=$((waited + 5))
        echo "   ... $waited secondes écoulées"
    done

    echo -e "${YELLOW}⚠ Timeout en attendant $service (pas critique)${NC}"
    return 1
}

# Phase 1: Infrastructure de Base
echo ""
echo "Phase 1/4: Démarrage de l'infrastructure de base"
echo "------------------------------------------------"
docker-compose up -d postgres redis pushgateway
wait_for_healthy postgres 180
echo -e "${GREEN}✓ Phase 1 terminée${NC}"

# Phase 2: Services de Données
echo ""
echo "Phase 2/4: Démarrage de GraphDB et Prometheus"
echo "----------------------------------------------"
echo -e "${YELLOW}⚠ GraphDB prend 5-6 minutes à démarrer la première fois${NC}"
docker-compose up -d graphdb prometheus
wait_for_healthy graphdb 420
wait_for_healthy prometheus 60
echo -e "${GREEN}✓ Phase 2 terminée${NC}"

# Phase 3: Authentification et ETL
echo ""
echo "Phase 3/4: Démarrage de Keycloak et Airflow"
echo "--------------------------------------------"
echo -e "${YELLOW}⚠ Keycloak prend 5-6 minutes à démarrer la première fois${NC}"
docker-compose up -d keycloak airflow-init

wait_for_healthy keycloak 480

echo -e "${YELLOW}⏳ Attente de la fin de l'initialisation Airflow...${NC}"
sleep 10

docker-compose up -d airflow-webserver airflow-scheduler
echo -e "${GREEN}✓ Phase 3 terminée${NC}"

# Phase 4: Services Applicatifs
echo ""
echo "Phase 4/4: Démarrage de Neo4j, API Gateway, et Grafana"
echo "-------------------------------------------------------"
docker-compose up -d neo4j
wait_for_healthy neo4j 120

docker-compose up -d api-gateway neo4j-autosync grafana
wait_for_healthy grafana 60

echo ""
echo "========================================="
echo -e "${GREEN}✓ Tous les services sont démarrés!${NC}"
echo "========================================="
echo ""
echo "Services disponibles:"
echo "  - GraphDB:        http://localhost:7200"
echo "  - Neo4j:          http://localhost:7474"
echo "  - Keycloak:       http://localhost:8180"
echo "  - API Gateway:    http://localhost:3000"
echo "  - Airflow:        http://localhost:8080"
echo "  - Prometheus:     http://localhost:9090"
echo "  - Grafana:        http://localhost:3001"
echo ""
echo "Pour voir les logs: docker-compose logs -f"
echo "Pour arrêter:       docker-compose down"
echo ""
