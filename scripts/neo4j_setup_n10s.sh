#!/bin/bash
# Neo4j n10s (neosemantics) Auto-Sync Script
# Automatically syncs Neo4j with GraphDB data graph: http://example.com/data

set -euo pipefail

CONTAINER_NAME="${NEO4J_CONTAINER:-ekg-neo4j}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASS="${NEO4J_PASS:-password}"
GRAPHDB_URL="${GRAPHDB_URL:-http://graphdb:7200}"
GRAPHDB_REPO="${GRAPHDB_REPO:-ekg}"
DATA_GRAPH="http://example.com/data"

echo "=========================================="
echo "Neo4j Auto-Sync from GraphDB"
echo "=========================================="
echo ""

# Step 1: Check GraphDB is accessible (use localhost URL from host)
echo "[1/6] Checking GraphDB connection..."
GRAPHDB_HOST_URL="http://localhost:7200"
if ! curl -sf "$GRAPHDB_HOST_URL/repositories/$GRAPHDB_REPO" > /dev/null 2>&1; then
    echo "[ERROR] Cannot connect to GraphDB at $GRAPHDB_HOST_URL"
    echo "Please ensure GraphDB is running and repository '$GRAPHDB_REPO' exists"
    echo "  Check with: docker ps | grep graphdb"
    exit 1
fi
echo "[OK] GraphDB connected"

# Step 2: Check data graph has triples (use localhost URL from host)
echo "[2/6] Checking data graph: $DATA_GRAPH..."
GRAPHDB_EXPORT_URL="$GRAPHDB_URL/repositories/$GRAPHDB_REPO/statements?context=%3Chttp://example.com/data%3E"
GRAPHDB_HOST_EXPORT_URL="$GRAPHDB_HOST_URL/repositories/$GRAPHDB_REPO/statements?context=%3Chttp://example.com/data%3E"
TRIPLE_COUNT=$(curl -sf "$GRAPHDB_HOST_EXPORT_URL" -H 'Accept: application/n-triples' 2>/dev/null | wc -l || echo "0")

if [ "$TRIPLE_COUNT" = "0" ]; then
    echo "[ERROR] No data found in graph: $DATA_GRAPH"
    echo "Please import data to GraphDB first"
    exit 1
fi
echo "[OK] Found $TRIPLE_COUNT triples in data graph"

# Step 3: Check Neo4j is running
echo "[3/6] Checking Neo4j connection..."
if ! docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" "RETURN 1" &>/dev/null; then
    echo "[ERROR] Cannot connect to Neo4j container: $CONTAINER_NAME"
    echo "Please ensure Neo4j container is running:"
    echo "  docker ps | grep neo4j"
    exit 1
fi

# Get current node count
OLD_COUNT=$(docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" --format plain \
    "MATCH (n) RETURN count(n) as count" 2>/dev/null | tail -1 || echo "0")
echo "[OK] Neo4j connected (current nodes: $OLD_COUNT)"

# Step 4: Clear and reset Neo4j
echo "[4/6] Clearing Neo4j and resetting n10s..."
docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" "MATCH (n) DETACH DELETE n" 2>/dev/null || true
docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" "CALL n10s.graphconfig.drop()" 2>/dev/null || true

docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" <<'EOF'
CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE;

CALL n10s.graphconfig.init({
  handleVocabUris: 'SHORTEN',
  handleMultival: 'ARRAY',
  handleRDFTypes: 'LABELS',
  multivalPropList: ['http://example.com/schema#role', 'http://example.com/schema#label']
});

CALL n10s.nsprefixes.add('ex', 'http://example.com/schema#');
CALL n10s.nsprefixes.add('prov', 'http://www.w3.org/ns/prov#');
CALL n10s.nsprefixes.add('xsd', 'http://www.w3.org/2001/XMLSchema#');
EOF
echo "[OK] Neo4j cleared and n10s configured"

# Step 5: Import RDF from GraphDB data graph
echo "[5/6] Importing RDF from GraphDB ($DATA_GRAPH)..."

IMPORT_RESULT=$(docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" --format plain <<EOF
CALL n10s.rdf.import.fetch(
  '$GRAPHDB_EXPORT_URL',
  'N-Triples',
  {
    headerParams: { Accept: "application/n-triples" },
    commitSize: 5000,
    nodeCacheSize: 10000
  }
) YIELD triplesLoaded
RETURN triplesLoaded;
EOF
)

TRIPLES_LOADED=$(echo "$IMPORT_RESULT" | tail -1)
echo "[OK] Imported $TRIPLES_LOADED triples from GraphDB"

# Step 6: Create indexes
echo "[6/6] Creating indexes for performance..."
docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" <<'EOF'
CREATE INDEX person_email IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__email);
CREATE INDEX person_fullname IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__fullName);
CREATE INDEX orgunit_name IF NOT EXISTS FOR (o:ex__OrgUnit) ON (o.ex__name);
CREATE INDEX product_name IF NOT EXISTS FOR (p:ex__Product) ON (p.ex__name);
CREATE INDEX security_label IF NOT EXISTS FOR (n:Resource) ON (n.ex__label);
EOF
echo "[OK] Indexes created"

# Get final node count
NEW_COUNT=$(docker exec "$CONTAINER_NAME" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" --format plain \
    "MATCH (n) RETURN count(n) as count" | tail -1)

echo ""
echo "=========================================="
echo "[SUCCESS] Neo4j synced with GraphDB!"
echo "=========================================="
echo ""
echo "GraphDB data graph: $DATA_GRAPH"
echo "Triples in GraphDB: $TRIPLE_COUNT"
echo "Triples imported:   $TRIPLES_LOADED"
echo "Nodes in Neo4j:     $NEW_COUNT (was: $OLD_COUNT)"
echo ""
echo "Neo4j Browser: http://localhost:7474"
echo "Username: neo4j / Password: password"
echo ""
echo "Example queries:"
echo "  MATCH (p:ex__Person) RETURN p LIMIT 10"
echo "  MATCH (p:ex__Person)-[r:ex__worksFor]->(o:ex__OrgUnit) RETURN p, r, o LIMIT 10"
echo ""
