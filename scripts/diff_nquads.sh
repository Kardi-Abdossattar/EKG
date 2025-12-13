#!/bin/bash

# ============================================================
# EKG Diff Script (N-Quads format)
# Date: 2025-11-27
# Description: Compute diff between two GraphDB snapshots
# Usage: bash diff_nquads.sh <snapshot1.trig> <snapshot2.trig> <output_dir>
# ============================================================

set -euo pipefail

# Arguments
SNAPSHOT1="${1:?Error: snapshot1.trig required}"
SNAPSHOT2="${2:?Error: snapshot2.trig required}"
OUTPUT_DIR="${3:-diffs}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}[INFO] Computing diff between snapshots...${NC}"
echo "  Snapshot 1 (OLD): $SNAPSHOT1"
echo "  Snapshot 2 (NEW): $SNAPSHOT2"
echo "  Output dir: $OUTPUT_DIR"
echo ""

# Validate inputs
if [ ! -f "$SNAPSHOT1" ]; then
  echo -e "${RED}[ERROR] Snapshot 1 not found: $SNAPSHOT1${NC}"
  exit 1
fi

if [ ! -f "$SNAPSHOT2" ]; then
  echo -e "${RED}[ERROR] Snapshot 2 not found: $SNAPSHOT2${NC}"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Extract snapshot IDs from filenames
SNAPSHOT1_ID=$(basename "$SNAPSHOT1" .trig | sed 's/snapshot_//')
SNAPSHOT2_ID=$(basename "$SNAPSHOT2" .trig | sed 's/snapshot_//')

DIFF_ID="${SNAPSHOT1_ID}_to_${SNAPSHOT2_ID}"

echo -e "${YELLOW}[INFO] Converting TriG to N-Quads for comparison...${NC}"

# Convert TriG to N-Quads (sorted for diff)
# Note: rapper is from raptor2-utils package
# Alternative: use riot from Apache Jena

# Check if rapper is available
if command -v rapper &> /dev/null; then
  NQ1="${OUTPUT_DIR}/snapshot1_${SNAPSHOT1_ID}.nq"
  NQ2="${OUTPUT_DIR}/snapshot2_${SNAPSHOT2_ID}.nq"

  rapper -i trig -o nquads "$SNAPSHOT1" 2>/dev/null | sort > "$NQ1"
  rapper -i trig -o nquads "$SNAPSHOT2" 2>/dev/null | sort > "$NQ2"

  echo -e "${GREEN}[OK] Converted to N-Quads (using rapper)${NC}"

elif command -v riot &> /dev/null; then
  NQ1="${OUTPUT_DIR}/snapshot1_${SNAPSHOT1_ID}.nq"
  NQ2="${OUTPUT_DIR}/snapshot2_${SNAPSHOT2_ID}.nq"

  riot --output=nquads "$SNAPSHOT1" 2>/dev/null | sort > "$NQ1"
  riot --output=nquads "$SNAPSHOT2" 2>/dev/null | sort > "$NQ2"

  echo -e "${GREEN}[OK] Converted to N-Quads (using riot)${NC}"

else
  # Fallback: simple text-based diff on TriG (less accurate but works without tools)
  echo -e "${YELLOW}[WARN] rapper/riot not found, using text-based diff (less accurate)${NC}"
  NQ1="$SNAPSHOT1"
  NQ2="$SNAPSHOT2"
fi

echo -e "${YELLOW}[INFO] Computing additions and deletions...${NC}"

# Compute diff
ADDED_FILE="${OUTPUT_DIR}/diff_${DIFF_ID}_added.nq"
DELETED_FILE="${OUTPUT_DIR}/diff_${DIFF_ID}_deleted.nq"
CHANGED_FILE="${OUTPUT_DIR}/diff_${DIFF_ID}_changed.txt"

# Additions: lines in snapshot2 not in snapshot1
comm -13 <(sort "$NQ1") <(sort "$NQ2") > "$ADDED_FILE"

# Deletions: lines in snapshot1 not in snapshot2
comm -23 <(sort "$NQ1") <(sort "$NQ2") > "$DELETED_FILE"

# Count changes
ADDED_COUNT=$(wc -l < "$ADDED_FILE" | tr -d ' ')
DELETED_COUNT=$(wc -l < "$DELETED_FILE" | tr -d ' ')

echo -e "${GREEN}[OK] Diff computed${NC}"
echo "  Added triples: $ADDED_COUNT"
echo "  Deleted triples: $DELETED_COUNT"

# Create unified change report
cat > "$CHANGED_FILE" <<EOF
========================================
DIFF REPORT
========================================
Snapshot 1 (OLD): $SNAPSHOT1
Snapshot 2 (NEW): $SNAPSHOT2
Diff ID: $DIFF_ID
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)

SUMMARY:
  Added triples: $ADDED_COUNT
  Deleted triples: $DELETED_COUNT
  Total changes: $((ADDED_COUNT + DELETED_COUNT))

FILES:
  Additions: $ADDED_FILE
  Deletions: $DELETED_FILE

========================================
DELETED TRIPLES (first 50):
========================================
EOF

head -50 "$DELETED_FILE" >> "$CHANGED_FILE" || echo "(none)" >> "$CHANGED_FILE"

cat >> "$CHANGED_FILE" <<EOF

========================================
ADDED TRIPLES (first 50):
========================================
EOF

head -50 "$ADDED_FILE" >> "$CHANGED_FILE" || echo "(none)" >> "$CHANGED_FILE"

echo -e "${GREEN}[OK] Change report created: $CHANGED_FILE${NC}"

# Create JSON metadata
METADATA_FILE="${OUTPUT_DIR}/diff_${DIFF_ID}.meta.json"
cat > "$METADATA_FILE" <<EOF
{
  "diff_id": "$DIFF_ID",
  "snapshot1": {
    "id": "$SNAPSHOT1_ID",
    "file": "$SNAPSHOT1"
  },
  "snapshot2": {
    "id": "$SNAPSHOT2_ID",
    "file": "$SNAPSHOT2"
  },
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "changes": {
    "added_triples": $ADDED_COUNT,
    "deleted_triples": $DELETED_COUNT,
    "total_changes": $((ADDED_COUNT + DELETED_COUNT))
  },
  "files": {
    "added": "$ADDED_FILE",
    "deleted": "$DELETED_FILE",
    "report": "$CHANGED_FILE"
  }
}
EOF

echo -e "${GREEN}[OK] Metadata created: $METADATA_FILE${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Diff computation SUCCESSFUL${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Diff ID: $DIFF_ID"
echo "  Added: $ADDED_COUNT triples"
echo "  Deleted: $DELETED_COUNT triples"
echo "  Total changes: $((ADDED_COUNT + DELETED_COUNT))"
echo ""
echo "  Output files:"
echo "    - Additions: $ADDED_FILE"
echo "    - Deletions: $DELETED_FILE"
echo "    - Report: $CHANGED_FILE"
echo "    - Metadata: $METADATA_FILE"
echo ""

# Highlight summary statistics
if [ $((ADDED_COUNT + DELETED_COUNT)) -eq 0 ]; then
  echo -e "${BLUE}[INFO] No changes detected between snapshots${NC}"
elif [ $DELETED_COUNT -gt $ADDED_COUNT ]; then
  echo -e "${YELLOW}[INFO] Net deletion: $((DELETED_COUNT - ADDED_COUNT)) triples removed${NC}"
elif [ $ADDED_COUNT -gt $DELETED_COUNT ]; then
  echo -e "${BLUE}[INFO] Net addition: $((ADDED_COUNT - DELETED_COUNT)) triples added${NC}"
else
  echo -e "${YELLOW}[INFO] Balanced change: equal additions and deletions${NC}"
fi

echo ""

exit 0
