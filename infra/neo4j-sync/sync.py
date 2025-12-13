#!/usr/bin/env python3
"""
Neo4j Auto-Sync Service
Automatically syncs Neo4j with GraphDB every 30 seconds
"""

import time
import requests
from neo4j import GraphDatabase
import sys
import os

# Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASS", "password")
GRAPHDB_URL = os.getenv("GRAPHDB_URL", "http://graphdb:7200")
GRAPHDB_REPO = os.getenv("GRAPHDB_REPO", "ekg")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "30"))
DATA_GRAPH = "http://example.com/data"

print(f"Neo4j Auto-Sync Service Starting...")
print(f"Neo4J: {NEO4J_URI}")
print(f"GraphDB: {GRAPHDB_URL}/repositories/{GRAPHDB_REPO}")
print(f"Sync interval: {SYNC_INTERVAL} seconds")
print(f"Data graph: {DATA_GRAPH}")
print("-" * 60)

# Wait for Neo4j to be ready
print("Waiting for Neo4j to be ready...")
driver = None
while not driver:
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
        driver.verify_connectivity()
        print("✓ Neo4j connected!")
    except Exception as e:
        print(f"Waiting for Neo4j... ({e})")
        time.sleep(5)

# Wait for GraphDB to be ready
print("Waiting for GraphDB to be ready...")
while True:
    try:
        response = requests.get(f"{GRAPHDB_URL}/rest/repositories/{GRAPHDB_REPO}", timeout=5)
        if response.status_code == 200:
            print("✓ GraphDB connected!")
            break
    except Exception as e:
        print(f"Waiting for GraphDB... ({e})")
        time.sleep(5)

# Initialize n10s if needed
def initialize_n10s():
    with driver.session() as session:
        # Check if n10s is initialized
        result = session.run("MATCH (n:_GraphConfig) RETURN count(n) as count")
        if result.single()["count"] == 0:
            print("Initializing n10s for the first time...")

            # Create constraint
            session.run("CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE")

            # Initialize n10s
            session.run("""
                CALL n10s.graphconfig.init({
                    handleVocabUris: 'SHORTEN',
                    handleMultival: 'ARRAY',
                    handleRDFTypes: 'LABELS',
                    multivalPropList: ['http://example.com/schema#role', 'http://example.com/schema#label']
                })
            """)

            # Add namespaces
            session.run("CALL n10s.nsprefixes.add('ex', 'http://example.com/schema#')")
            session.run("CALL n10s.nsprefixes.add('prov', 'http://www.w3.org/ns/prov#')")
            session.run("CALL n10s.nsprefixes.add('xsd', 'http://www.w3.org/2001/XMLSchema#')")

            # Create indexes
            session.run("CREATE INDEX person_email IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__email)")
            session.run("CREATE INDEX person_fullname IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__fullName)")
            session.run("CREATE INDEX orgunit_name IF NOT EXISTS FOR (p:ex__OrgUnit) ON (p.ex__name)")

            print("✓ n10s initialized!")
        else:
            print("✓ n10s already configured")

# Get triple count from GraphDB
def get_graphdb_triple_count():
    try:
        url = f"{GRAPHDB_URL}/repositories/{GRAPHDB_REPO}/statements"
        params = {"context": f"<{DATA_GRAPH}>"}
        headers = {"Accept": "application/n-triples"}
        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            return len(response.text.strip().split("\n")) if response.text.strip() else 0
        return 0
    except Exception as e:
        print(f"Error getting triple count: {e}")
        return 0

# Sync data from GraphDB to Neo4j
def sync_data():
    try:
        graphdb_count = get_graphdb_triple_count()

        if graphdb_count == 0:
            print(f"⚠ No data in GraphDB graph: {DATA_GRAPH}")
            return

        print(f"Syncing {graphdb_count} triples from GraphDB...")

        with driver.session() as session:
            # Clear existing data (except n10s metadata)
            session.run("MATCH (n) WHERE NOT n:_GraphConfig AND NOT n:_NsPrefDef DETACH DELETE n")

            # Import from GraphDB
            graphdb_export_url = f"{GRAPHDB_URL}/repositories/{GRAPHDB_REPO}/statements?context=%3Chttp://example.com/data%3E"
            result = session.run("""
                CALL n10s.rdf.import.fetch(
                    $url,
                    'N-Triples',
                    {
                        headerParams: { Accept: 'application/n-triples' },
                        commitSize: 5000,
                        nodeCacheSize: 10000
                    }
                ) YIELD triplesLoaded
                RETURN triplesLoaded
            """, url=graphdb_export_url)

            triples_loaded = result.single()["triplesLoaded"]

            # Get node count
            result = session.run("MATCH (n) WHERE NOT n:_GraphConfig AND NOT n:_NsPrefDef RETURN count(n) as count")
            node_count = result.single()["count"]

            print(f"✓ Synced! Triples: {triples_loaded}, Nodes: {node_count}")

    except Exception as e:
        print(f"✗ Sync failed: {e}")
        import traceback
        traceback.print_exc()

# Main loop
try:
    initialize_n10s()

    print("\n" + "=" * 60)
    print("Auto-sync is now ACTIVE!")
    print(f"Checking for changes every {SYNC_INTERVAL} seconds...")
    print("=" * 60 + "\n")

    last_count = 0

    while True:
        current_count = get_graphdb_triple_count()

        if current_count != last_count:
            print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Change detected: {last_count} → {current_count} triples")
            sync_data()
            last_count = current_count
        else:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] No changes ({current_count} triples)")

        time.sleep(SYNC_INTERVAL)

except KeyboardInterrupt:
    print("\n\nShutting down...")
finally:
    if driver:
        driver.close()
    print("Goodbye!")
