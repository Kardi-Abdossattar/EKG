#!/bin/bash

# ============================================================
# EKG Rollback Script
# Date: 2025-11-27
# Description: Restore GraphDB repository from a snapshot
# Usage: bash rollback_snapshot.sh <snapshot.trig> <repo> <graphdb_url>
# ============================================================

set -euo pipefail

# Arguments
SNAPSHOT_FILE="${1:?Error: snapshot.trig file required}"
REPO="${2:-ekg}"
GRAPHDB_URL="${3:-http://localhost:7200}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}EKG ROLLBACK - RESTORE FROM SNAPSHOT${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "${RED}WARNING: This will DELETE all data in repository and restore from snapshot!${NC}"
echo ""
echo "  Snapshot file: $SNAPSHOT_FILE"
echo "  Repository: $REPO"
echo "  GraphDB URL: $GRAPHDB_URL"
echo ""

# Validate snapshot exists
if [ ! -f "$SNAPSHOT_FILE" ]; then
  echo -e "${RED}[ERROR] Snapshot file not found: $SNAPSHOT_FILE${NC}"
  exit 1
fi

# Parse snapshot ID from filename
SNAPSHOT_ID=$(basename "$SNAPSHOT_FILE" .trig | sed 's/snapshot_//')
echo -e "${BLUE}[INFO] Snapshot ID: $SNAPSHOT_ID${NC}"

# Create backup of current state before rollback
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_ID="pre_rollback_$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/backup_${BACKUP_ID}.trig"

echo ""
echo -e "${YELLOW}[INFO] Creating backup of current state before rollback...${NC}"

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$BACKUP_FILE" \
  -H "Accept: application/x-trig" \
  "${GRAPHDB_URL}/repositories/${REPO}/statements")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo -e "${RED}[ERROR] Failed to create backup (HTTP $HTTP_CODE)${NC}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo 0)
echo -e "${GREEN}[OK] Backup created: $BACKUP_FILE (${BACKUP_SIZE} bytes)${NC}"

# User confirmation (comment out for non-interactive use)
echo ""
echo -e "${RED}=== FINAL CONFIRMATION ===${NC}"
echo -e "${RED}This will DELETE all data in repository '$REPO'${NC}"
echo -e "${YELLOW}Backup saved to: $BACKUP_FILE${NC}"
echo ""
read -p "Type 'YES' to confirm rollback: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo -e "${YELLOW}[INFO] Rollback cancelled by user${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}[INFO] Step 1/3: Clearing repository...${NC}"

# Clear all statements in repository (DELETE all graphs)
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X DELETE \
  "${GRAPHDB_URL}/repositories/${REPO}/statements")

if [ "$HTTP_CODE" -ne 204 ]; then
  echo -e "${RED}[ERROR] Failed to clear repository (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Repository cleared${NC}"

echo ""
echo -e "${YELLOW}[INFO] Step 2/3: Restoring snapshot data...${NC}"

# Load snapshot (TriG format preserves named graphs)
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST \
  -H "Content-Type: application/x-trig" \
  --data-binary "@${SNAPSHOT_FILE}" \
  "${GRAPHDB_URL}/repositories/${REPO}/statements")

if [ "$HTTP_CODE" -ne 204 ]; then
  echo -e "${RED}[ERROR] Failed to restore snapshot (HTTP $HTTP_CODE)${NC}"
  echo -e "${YELLOW}[INFO] Attempting to restore from backup...${NC}"

  # Try to restore from backup
  curl -s -X POST \
    -H "Content-Type: application/x-trig" \
    --data-binary "@${BACKUP_FILE}" \
    "${GRAPHDB_URL}/repositories/${REPO}/statements" || true

  echo -e "${RED}[ERROR] Rollback failed, check backup: $BACKUP_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Snapshot data restored${NC}"

echo ""
echo -e "${YELLOW}[INFO] Step 3/3: Verifying restoration...${NC}"

# Count triples after restoration
TRIPLE_COUNT_QUERY='SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }'

RESPONSE=$(curl -s -X GET \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode "query=${TRIPLE_COUNT_QUERY}" \
  "${GRAPHDB_URL}/repositories/${REPO}")

TRIPLE_COUNT=$(echo "$RESPONSE" | grep -o '"value":"[0-9]*"' | head -1 | grep -o '[0-9]*' || echo 0)

echo -e "${GREEN}[OK] Verification complete${NC}"
echo "  Total triples restored: $TRIPLE_COUNT"

# Create rollback metadata
METADATA_FILE="${BACKUP_DIR}/rollback_${BACKUP_ID}.meta.json"
cat > "$METADATA_FILE" <<EOF
{
  "rollback_id": "$BACKUP_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repository": "$REPO",
  "snapshot_restored": {
    "snapshot_id": "$SNAPSHOT_ID",
    "file": "$SNAPSHOT_FILE"
  },
  "backup_created": {
    "file": "$BACKUP_FILE",
    "size_bytes": $BACKUP_SIZE
  },
  "verification": {
    "triple_count": $TRIPLE_COUNT
  }
}
EOF

echo -e "${GREEN}[OK] Metadata saved: $METADATA_FILE${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ROLLBACK SUCCESSFUL${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Restored snapshot: $SNAPSHOT_ID"
echo "  Source file: $SNAPSHOT_FILE"
echo "  Repository: $REPO"
echo "  Triples restored: $TRIPLE_COUNT"
echo ""
echo "  Backup of previous state:"
echo "    File: $BACKUP_FILE"
echo "    Size: ${BACKUP_SIZE} bytes"
echo ""
echo -e "${BLUE}[INFO] To undo this rollback, restore from backup:${NC}"
echo "    bash rollback_snapshot.sh $BACKUP_FILE $REPO $GRAPHDB_URL"
echo ""

exit 0
