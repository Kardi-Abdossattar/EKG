#!/bin/bash
#
# Script de backup automatisé GraphDB - TEP-08_HARDEN_SCALE
# Usage: ./scripts/backup_graphdb.sh
#

set -euo pipefail

# Configuration
GRAPHDB_URL="${GRAPHDB_URL:-http://localhost:7200}"
REPOSITORY="${REPOSITORY:-ekg}"
BACKUP_DIR="./backups/graphdb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ekg_backup_${TIMESTAMP}.ttl"
RETENTION_DAYS=7

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================================================"
echo "  BACKUP GRAPHDB - TEP-08_HARDEN_SCALE"
echo "========================================================================"
echo "  Repository:  ${REPOSITORY}"
echo "  Backup dir:  ${BACKUP_DIR}"
echo "  Timestamp:   ${TIMESTAMP}"
echo "========================================================================"

# Créer le répertoire de backup
mkdir -p "${BACKUP_DIR}"

# Vérifier que GraphDB est accessible
echo -e "\n${YELLOW}[1/5]${NC} Vérification de GraphDB..."
if ! curl -sf "${GRAPHDB_URL}/rest/repositories" > /dev/null; then
    echo -e "${RED}✗ GraphDB inaccessible à ${GRAPHDB_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} GraphDB accessible"

# Vérifier que le repository existe
echo -e "\n${YELLOW}[2/5]${NC} Vérification du repository '${REPOSITORY}'..."
if ! curl -sf "${GRAPHDB_URL}/rest/repositories/${REPOSITORY}" > /dev/null; then
    echo -e "${RED}✗ Repository '${REPOSITORY}' n'existe pas${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Repository trouvé"

# Compter les triplets avant backup
echo -e "\n${YELLOW}[3/5]${NC} Comptage des triplets..."
TRIPLE_COUNT=$(curl -s -X GET "${GRAPHDB_URL}/repositories/${REPOSITORY}/size")
echo -e "${GREEN}✓${NC} ${TRIPLE_COUNT} triplets à sauvegarder"

# Export des données
echo -e "\n${YELLOW}[4/5]${NC} Export des données (format Turtle)..."
START_TIME=$(date +%s)

curl -X GET "${GRAPHDB_URL}/repositories/${REPOSITORY}/statements" \
    -H "Accept: application/x-turtle" \
    -o "${BACKUP_FILE}" \
    --progress-bar

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}✗ Échec de la création du backup${NC}"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Backup créé: ${BACKUP_SIZE} (${DURATION}s)"

# Compression
echo -e "\n${YELLOW}[5/5]${NC} Compression du backup..."
gzip -f "${BACKUP_FILE}"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
COMPRESSED_SIZE=$(du -h "${COMPRESSED_FILE}" | cut -f1)
echo -e "${GREEN}✓${NC} Compressé: ${COMPRESSED_SIZE}"

# Nettoyage des anciens backups
echo -e "\n${YELLOW}[6/6]${NC} Nettoyage des backups > ${RETENTION_DAYS} jours..."
find "${BACKUP_DIR}" -name "ekg_backup_*.ttl.gz" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(find "${BACKUP_DIR}" -name "ekg_backup_*.ttl.gz" | wc -l)
echo -e "${GREEN}✓${NC} ${REMAINING_BACKUPS} backups conservés"

# Résumé final
echo ""
echo "========================================================================"
echo -e "  ${GREEN}✅ BACKUP TERMINÉ AVEC SUCCÈS${NC}"
echo "========================================================================"
echo "  Fichier:         ${COMPRESSED_FILE}"
echo "  Taille:          ${COMPRESSED_SIZE}"
echo "  Triplets:        ${TRIPLE_COUNT}"
echo "  Durée:           ${DURATION}s"
echo "  Rétention:       ${RETENTION_DAYS} jours"
echo "  Backups totaux:  ${REMAINING_BACKUPS}"
echo "========================================================================"

# Écrire les métadonnées
cat > "${COMPRESSED_FILE}.meta" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "repository": "${REPOSITORY}",
  "triple_count": ${TRIPLE_COUNT},
  "file_size": "${COMPRESSED_SIZE}",
  "duration_seconds": ${DURATION},
  "graphdb_version": "10.8.1",
  "format": "turtle+gzip"
}
EOF

echo -e "\n💡 Pour restaurer ce backup:"
echo "  gunzip ${COMPRESSED_FILE}"
echo "  curl -X POST ${GRAPHDB_URL}/repositories/${REPOSITORY}/statements \\"
echo "    -H 'Content-Type: application/x-turtle' \\"
echo "    --data-binary @${BACKUP_FILE}"
echo ""

exit 0
