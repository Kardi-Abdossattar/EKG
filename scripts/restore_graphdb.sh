#!/bin/bash
#
# Script de restauration GraphDB - TEP-08_HARDEN_SCALE
# Usage: ./scripts/restore_graphdb.sh <backup_file.ttl.gz>
#

set -euo pipefail

# Configuration
GRAPHDB_URL="${GRAPHDB_URL:-http://localhost:7200}"
REPOSITORY="${REPOSITORY:-ekg}"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier les arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Usage: $0 <backup_file.ttl.gz>${NC}"
    echo ""
    echo "Backups disponibles:"
    ls -lh backups/graphdb/ekg_backup_*.ttl.gz 2>/dev/null || echo "  Aucun backup trouvé"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}✗ Fichier '${BACKUP_FILE}' introuvable${NC}"
    exit 1
fi

echo "========================================================================"
echo "  RESTAURATION GRAPHDB - TEP-08_HARDEN_SCALE"
echo "========================================================================"
echo "  Repository:  ${REPOSITORY}"
echo "  Backup:      ${BACKUP_FILE}"
echo "========================================================================"

# Lire les métadonnées si disponibles
META_FILE="${BACKUP_FILE}.meta"
if [ -f "${META_FILE}" ]; then
    echo -e "\n${YELLOW}Métadonnées du backup:${NC}"
    cat "${META_FILE}"
    echo ""
fi

# Confirmation
echo -e "${RED}⚠️  ATTENTION: Cette opération va SUPPRIMER toutes les données actuelles !${NC}"
read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " CONFIRM

if [ "${CONFIRM}" != "oui" ]; then
    echo "Restauration annulée."
    exit 0
fi

# Vérifier GraphDB
echo -e "\n${YELLOW}[1/7]${NC} Vérification de GraphDB..."
if ! curl -sf "${GRAPHDB_URL}/rest/repositories" > /dev/null; then
    echo -e "${RED}✗ GraphDB inaccessible${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} GraphDB accessible"

# Sauvegarder l'état actuel
echo -e "\n${YELLOW}[2/7]${NC} Sauvegarde de sécurité de l'état actuel..."
SAFETY_BACKUP="backups/graphdb/pre_restore_$(date +%Y%m%d_%H%M%S).ttl.gz"
mkdir -p backups/graphdb
curl -s -X GET "${GRAPHDB_URL}/repositories/${REPOSITORY}/statements" \
    -H "Accept: application/x-turtle" | gzip > "${SAFETY_BACKUP}"
echo -e "${GREEN}✓${NC} Backup de sécurité: ${SAFETY_BACKUP}"

# Vider le repository
echo -e "\n${YELLOW}[3/7]${NC} Suppression de toutes les données actuelles..."
curl -s -X DELETE "${GRAPHDB_URL}/repositories/${REPOSITORY}/statements" > /dev/null
echo -e "${GREEN}✓${NC} Repository vidé"

# Décompresser le backup
echo -e "\n${YELLOW}[4/7]${NC} Décompression du backup..."
TEMP_FILE="/tmp/restore_temp_$(date +%s).ttl"
gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
BACKUP_SIZE=$(du -h "${TEMP_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Décompressé: ${BACKUP_SIZE}"

# Compter les triplets dans le backup
echo -e "\n${YELLOW}[5/7]${NC} Analyse du backup..."
ESTIMATED_TRIPLES=$(grep -c "^\s*ex:" "${TEMP_FILE}" || echo "N/A")
echo -e "${GREEN}✓${NC} ~${ESTIMATED_TRIPLES} triplets à restaurer"

# Restauration
echo -e "\n${YELLOW}[6/7]${NC} Restauration des données..."
START_TIME=$(date +%s)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${GRAPHDB_URL}/repositories/${REPOSITORY}/statements" \
    -H "Content-Type: application/x-turtle" \
    --data-binary "@${TEMP_FILE}")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "${HTTP_CODE}" != "204" ] && [ "${HTTP_CODE}" != "200" ]; then
    echo -e "${RED}✗ Échec de la restauration (HTTP ${HTTP_CODE})${NC}"
    echo -e "${YELLOW}Restauration de la sauvegarde de sécurité...${NC}"
    gunzip -c "${SAFETY_BACKUP}" | \
        curl -X POST "${GRAPHDB_URL}/repositories/${REPOSITORY}/statements" \
        -H "Content-Type: application/x-turtle" \
        --data-binary @-
    rm -f "${TEMP_FILE}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Données restaurées (${DURATION}s)"

# Nettoyage
rm -f "${TEMP_FILE}"

# Validation
echo -e "\n${YELLOW}[7/7]${NC} Validation de la restauration..."
FINAL_COUNT=$(curl -s "${GRAPHDB_URL}/repositories/${REPOSITORY}/size")
echo -e "${GREEN}✓${NC} ${FINAL_COUNT} triplets dans le repository"

# Vérifier les types principaux
echo -e "\n${YELLOW}Vérification des types d'entités:${NC}"
QUERY='PREFIX ex: <http://example.com/schema#>
SELECT ?type (COUNT(?s) AS ?count)
WHERE { ?s a ?type }
GROUP BY ?type
ORDER BY DESC(?count)
LIMIT 10'

curl -s -X POST "${GRAPHDB_URL}/repositories/${REPOSITORY}" \
    -H "Content-Type: application/sparql-query" \
    -H "Accept: application/sparql-results+json" \
    -d "${QUERY}" | \
    python3 -c "import sys, json; data=json.load(sys.stdin); [print(f\"  - {b['type']['value'].split('#')[-1]}: {b['count']['value']}\") for b in data['results']['bindings']]" 2>/dev/null || echo "  (vérification manuelle requise)"

# Résumé
echo ""
echo "========================================================================"
echo -e "  ${GREEN}✅ RESTAURATION TERMINÉE AVEC SUCCÈS${NC}"
echo "========================================================================"
echo "  Source:            ${BACKUP_FILE}"
echo "  Triplets restaurés: ${FINAL_COUNT}"
echo "  Durée:             ${DURATION}s"
echo "  Backup de sécurité: ${SAFETY_BACKUP}"
echo "========================================================================"
echo ""
echo "💡 Prochaines étapes recommandées:"
echo "  1. Vérifier l'intégrité via SHACL:"
echo "     python scripts/validate_shacl.py"
echo "  2. Tester les requêtes critiques"
echo "  3. Vérifier les dashboards Grafana"
echo ""

exit 0
