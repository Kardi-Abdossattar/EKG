#!/usr/bin/env python3
"""
TEP-07: Incremental sync from GraphDB to Neo4j using n10s
Syncs only changed entities based on prov:generatedAtTime
"""

import argparse
import requests
from neo4j import GraphDatabase
from datetime import datetime
import json
import sys

def query_graphdb(graphdb_url, repo, query):
    """Execute SPARQL query on GraphDB"""
    endpoint = f"{graphdb_url}/repositories/{repo}"
    headers = {'Accept': 'application/sparql-results+json'}
    response = requests.post(endpoint, data={'query': query}, headers=headers)
    response.raise_for_status()
    return response.json()['results']['bindings']

def get_last_sync_timestamp(neo4j_driver):
    """Get last sync timestamp from Neo4j metadata"""
    with neo4j_driver.session() as session:
        result = session.run("""
            MATCH (m:SyncMetadata)
            RETURN m.lastSyncTimestamp AS ts
            ORDER BY m.lastSyncTimestamp DESC
            LIMIT 1
        """)
        record = result.single()
        return record['ts'] if record else None

def update_sync_metadata(neo4j_driver, timestamp, count):
    """Update sync metadata in Neo4j"""
    with neo4j_driver.session() as session:
        session.run("""
            CREATE (m:SyncMetadata {
                lastSyncTimestamp: $timestamp,
                syncedAt: datetime(),
                entityCount: $count
            })
        """, timestamp=timestamp, count=count)

def sync_incremental(graphdb_url, graphdb_repo, neo4j_driver, last_sync):
    """Sync entities changed since last_sync timestamp"""

    # Query for changed entities
    filter_clause = f'FILTER(?generatedAt > "{last_sync}"^^xsd:dateTime)' if last_sync else ''

    query = f"""
        PREFIX ex: <http://example.com/schema#>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        SELECT ?entity ?generatedAt
        WHERE {{
            ?entity prov:generatedAtTime ?generatedAt .
            {filter_clause}
        }}
        ORDER BY ?generatedAt
    """

    results = query_graphdb(graphdb_url, graphdb_repo, query)

    if not results:
        print("[INFO] No new entities to sync")
        return 0

    print(f"[INFO] Found {len(results)} entities to sync")

    # Export changed entities as RDF
    entity_uris = [r['entity']['value'] for r in results]
    latest_timestamp = results[-1]['generatedAt']['value']

    # Construct SPARQL query for entity triples
    construct_query = f"""
        PREFIX ex: <http://example.com/schema#>

        CONSTRUCT {{ ?s ?p ?o }}
        WHERE {{
            VALUES ?s {{ {' '.join(f'<{uri}>' for uri in entity_uris)} }}
            ?s ?p ?o .
        }}
    """

    # Get RDF data
    endpoint = f"{graphdb_url}/repositories/{graphdb_repo}"
    headers = {'Accept': 'text/turtle'}
    response = requests.post(endpoint, data={'query': construct_query}, headers=headers)
    response.raise_for_status()
    rdf_data = response.text

    # Save to temp file
    temp_file = f'/tmp/neo4j_sync_{int(datetime.now().timestamp())}.ttl'
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.write(rdf_data)

    print(f"[INFO] Exported {len(entity_uris)} entities to {temp_file}")

    # Import to Neo4j using n10s
    with neo4j_driver.session() as session:
        result = session.run(f"""
            CALL n10s.rdf.import.fetch('file://{temp_file}', 'Turtle', {{
                commitSize: 1000
            }})
        """)
        stats = result.single()
        print(f"[INFO] Neo4j import stats: {dict(stats)}")

    # Update sync metadata
    update_sync_metadata(neo4j_driver, latest_timestamp, len(entity_uris))

    return len(entity_uris)

def main():
    parser = argparse.ArgumentParser(description='Incremental sync GraphDB → Neo4j')
    parser.add_argument('--graphdb-url', default='http://localhost:7200', help='GraphDB URL')
    parser.add_argument('--graphdb-repo', default='ekg', help='GraphDB repository')
    parser.add_argument('--neo4j-url', default='bolt://localhost:7687', help='Neo4j bolt URL')
    parser.add_argument('--neo4j-user', default='neo4j', help='Neo4j username')
    parser.add_argument('--neo4j-pass', default='password', help='Neo4j password')
    parser.add_argument('--full-sync', action='store_true', help='Force full sync (ignore last sync timestamp)')

    args = parser.parse_args()

    print("[1/3] Connecting to Neo4j...")
    neo4j_driver = GraphDatabase.driver(
        args.neo4j_url,
        auth=(args.neo4j_user, args.neo4j_pass)
    )

    try:
        neo4j_driver.verify_connectivity()
        print("[OK] Neo4j connected")
    except Exception as e:
        print(f"[ERROR] Cannot connect to Neo4j: {e}")
        sys.exit(1)

    print("[2/3] Checking last sync timestamp...")
    last_sync = None if args.full_sync else get_last_sync_timestamp(neo4j_driver)

    if last_sync:
        print(f"[INFO] Last sync: {last_sync}")
    else:
        print("[INFO] Full sync (no previous sync found)")

    print("[3/3] Syncing entities...")
    count = sync_incremental(args.graphdb_url, args.graphdb_repo, neo4j_driver, last_sync)

    neo4j_driver.close()

    print(f"[SUCCESS] Synced {count} entities")
    return 0

if __name__ == '__main__':
    sys.exit(main())
