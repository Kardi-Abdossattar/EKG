#!/bin/bash
# Neo4j Auto-Sync Setup Script
# This script should be run after Neo4j starts to configure automatic sync

set -euo pipefail

NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASS="${NEO4J_PASS:-password}"

echo "Waiting for Neo4j to be ready..."
until docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" "RETURN 1" &>/dev/null; do
    sleep 2
done
echo "Neo4j is ready!"

echo "Checking if n10s is configured..."
GRAPHCONFIG_EXISTS=$(docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
    "MATCH (n:_GraphConfig) RETURN count(n) as count" --format plain | tail -1)

if [ "$GRAPHCONFIG_EXISTS" = "0" ]; then
    echo "Initializing n10s for the first time..."

    # Create constraint
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE;"

    # Initialize n10s
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CALL n10s.graphconfig.init({handleVocabUris: 'SHORTEN', handleMultival: 'ARRAY', handleRDFTypes: 'LABELS', multivalPropList: ['http://example.com/schema#role', 'http://example.com/schema#label']});"

    # Add namespaces
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CALL n10s.nsprefixes.add('ex', 'http://example.com/schema#');"
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CALL n10s.nsprefixes.add('prov', 'http://www.w3.org/ns/prov#');"
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CALL n10s.nsprefixes.add('xsd', 'http://www.w3.org/2001/XMLSchema#');"

    # Create indexes
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CREATE INDEX person_email IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__email);"
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CREATE INDEX person_fullname IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__fullName);"
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CREATE INDEX orgunit_name IF NOT EXISTS FOR (p:ex__OrgUnit) ON (p.ex__name);"

    # Create metadata node
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "MERGE (meta:SyncMetadata {id: 'graphdb_sync'}) SET meta.lastSync = datetime(), meta.lastTripleCount = 0;"

    echo "n10s configured successfully!"
fi

echo "Checking if auto-sync job exists..."
JOB_EXISTS=$(docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
    "CALL apoc.periodic.list() YIELD name WHERE name = 'graphdb-autosync' RETURN count(*) as count" --format plain | tail -1)

if [ "$JOB_EXISTS" = "0" ]; then
    echo "Setting up auto-sync job (every 30 seconds)..."
    docker exec ekg-neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASS" \
        "CALL apoc.periodic.repeat('graphdb-autosync', 'MATCH (n) WHERE NOT n:_GraphConfig AND NOT n:_NsPrefDef AND NOT n:SyncMetadata DETACH DELETE n WITH 1 as dummy CALL n10s.rdf.import.fetch(\"http://graphdb:7200/repositories/ekg/statements?context=%3Chttp://example.com/data%3E\", \"N-Triples\", { headerParams: { Accept: \"application/n-triples\" }, commitSize: 5000 }) YIELD triplesLoaded RETURN triplesLoaded', 30);"
    echo "Auto-sync job created!"
else
    echo "Auto-sync job already running!"
fi

echo ""
echo "=========================================="
echo "Neo4j Auto-Sync is ACTIVE!"
echo "=========================================="
echo "Sync interval: Every 30 seconds"
echo "Data source: http://graphdb:7200 (graph: http://example.com/data)"
echo ""
echo "To check sync status:"
echo "  docker exec ekg-neo4j cypher-shell -u neo4j -p password 'CALL apoc.periodic.list()'"
echo ""
