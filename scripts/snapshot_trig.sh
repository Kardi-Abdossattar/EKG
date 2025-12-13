#!/bin/bash

# ============================================================
# EKG Snapshot Script (TriG format)
# Date: 2025-11-27
# Description: Create immutable snapshots of GraphDB repository
# Usage: bash snapshot_trig.sh <repo> <graphdb_url> <output_dir> [snapshot_id]
# ============================================================

set -euo pipefail

# Arguments
REPO="${1:-ekg}"
GRAPHDB_URL="${2:-http://localhost:7200}"
OUTPUT_DIR="${3:-snapshots}"
SNAPSHOT_ID="${4:-$(date +%Y%m%d_%H%M%S)}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[INFO] Starting snapshot creation...${NC}"
echo "  Repository: $REPO"
echo "  GraphDB URL: $GRAPHDB_URL"
echo "  Output dir: $OUTPUT_DIR"
echo "  Snapshot ID: $SNAPSHOT_ID"
echo ""

# Create output directory if not exists
mkdir -p "$OUTPUT_DIR"

# Output file
OUTPUT_FILE="${OUTPUT_DIR}/snapshot_${SNAPSHOT_ID}.trig"

echo -e "${YELLOW}[INFO] Exporting repository to TriG format...${NC}"

# Export entire repository as TriG (preserves named graphs)
# GraphDB REST API: GET /repositories/{repo}/statements (Accept: application/x-trig)
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT_FILE" \
  -H "Accept: application/x-trig" \
  "${GRAPHDB_URL}/repositories/${REPO}/statements")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo -e "${RED}[ERROR] Failed to export repository (HTTP $HTTP_CODE)${NC}"
  rm -f "$OUTPUT_FILE"
  exit 1
fi

# Check file size
FILE_SIZE=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null || echo 0)

if [ "$FILE_SIZE" -eq 0 ]; then
  echo -e "${RED}[ERROR] Exported file is empty${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Snapshot created: $OUTPUT_FILE (${FILE_SIZE} bytes)${NC}"

# Create metadata file
METADATA_FILE="${OUTPUT_DIR}/snapshot_${SNAPSHOT_ID}.meta.json"
TRIPLE_COUNT=$(grep -c "^\s*<\|^\s*_:" "$OUTPUT_FILE" || echo 0)

cat > "$METADATA_FILE" <<EOF
{
  "snapshot_id": "$SNAPSHOT_ID",
  "repository": "$REPO",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "graphdb_url": "$GRAPHDB_URL",
  "file": "$OUTPUT_FILE",
  "file_size_bytes": $FILE_SIZE,
  "estimated_triples": $TRIPLE_COUNT,
  "format": "application/x-trig"
}
EOF

echo -e "${GREEN}[OK] Metadata created: $METADATA_FILE${NC}"

# Optional: create compressed archive
ARCHIVE_FILE="${OUTPUT_DIR}/snapshot_${SNAPSHOT_ID}.trig.gz"
gzip -c "$OUTPUT_FILE" > "$ARCHIVE_FILE"
ARCHIVE_SIZE=$(stat -c%s "$ARCHIVE_FILE" 2>/dev/null || stat -f%z "$ARCHIVE_FILE" 2>/dev/null || echo 0)

echo -e "${GREEN}[OK] Compressed archive: $ARCHIVE_FILE (${ARCHIVE_SIZE} bytes)${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Snapshot creation SUCCESSFUL${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Snapshot ID: $SNAPSHOT_ID"
echo "  TriG file: $OUTPUT_FILE (${FILE_SIZE} bytes)"
echo "  Compressed: $ARCHIVE_FILE (${ARCHIVE_SIZE} bytes)"
echo "  Metadata: $METADATA_FILE"
echo "  Estimated triples: $TRIPLE_COUNT"
echo ""

# Optional: list recent snapshots
echo -e "${YELLOW}Recent snapshots in $OUTPUT_DIR:${NC}"
ls -lht "$OUTPUT_DIR"/snapshot_*.trig 2>/dev/null | head -5 || echo "  (none)"
echo ""

exit 0
