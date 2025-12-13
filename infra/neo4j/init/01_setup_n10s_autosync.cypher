// ============================================================
// Neo4j Auto-Sync Initialization Script
// This script runs ONCE when Neo4j first starts
// Sets up automatic SMART sync from GraphDB every 30 seconds
// ============================================================

// Step 1: Create unique constraint for n10s
CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE;

// Step 2: Initialize n10s configuration
CALL n10s.graphconfig.init({
  handleVocabUris: 'SHORTEN',
  handleMultival: 'ARRAY',
  handleRDFTypes: 'LABELS',
  multivalPropList: ['http://example.com/schema#role', 'http://example.com/schema#label']
});

// Step 3: Add namespace prefixes
CALL n10s.nsprefixes.add('ex', 'http://example.com/schema#');
CALL n10s.nsprefixes.add('prov', 'http://www.w3.org/ns/prov#');
CALL n10s.nsprefixes.add('xsd', 'http://www.w3.org/2001/XMLSchema#');

// Step 4: Create indexes for performance
CREATE INDEX person_email IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__email);
CREATE INDEX person_fullname IF NOT EXISTS FOR (p:ex__Person) ON (p.ex__fullName);
CREATE INDEX orgunit_name IF NOT EXISTS FOR (p:ex__OrgUnit) ON (p.ex__name);
CREATE INDEX product_name IF NOT EXISTS FOR (p:ex__Product) ON (p.ex__name);
CREATE INDEX security_label IF NOT EXISTS FOR (n:Resource) ON (n.ex__label);

// Step 5: Create a metadata node to track last sync
MERGE (meta:SyncMetadata {id: 'graphdb_sync'})
SET meta.lastSync = datetime(),
    meta.lastTripleCount = 0;

// Step 6: Schedule SMART automatic sync from GraphDB every 30 seconds
// This checks if data changed before doing a full reload
CALL apoc.periodic.repeat(
  'graphdb-autosync',
  '
  CALL {
    // Get current triple count from GraphDB
    WITH apoc.load.json("http://graphdb:7200/repositories/ekg/size?context=%3Chttp://example.com/data%3E") AS sizeResponse
    WITH sizeResponse[0] AS graphdbCount

    // Get last known count from metadata
    MATCH (meta:SyncMetadata {id: "graphdb_sync"})
    WITH meta, graphdbCount

    // Only sync if count changed (data was added/removed in GraphDB)
    WHERE meta.lastTripleCount <> graphdbCount

    // Clear all existing data (except metadata)
    CALL {
      MATCH (n) WHERE NOT n:SyncMetadata
      DETACH DELETE n
    } IN TRANSACTIONS

    // Import fresh data from GraphDB data graph
    CALL n10s.rdf.import.fetch(
      "http://graphdb:7200/repositories/ekg/statements?context=%3Chttp://example.com/data%3E",
      "N-Triples",
      {
        headerParams: { Accept: "application/n-triples" },
        commitSize: 5000,
        nodeCacheSize: 10000
      }
    ) YIELD triplesLoaded

    // Update metadata with new count and sync time
    SET meta.lastSync = datetime(),
        meta.lastTripleCount = graphdbCount

    RETURN triplesLoaded, graphdbCount;
  }
  ',
  30  // Check every 30 seconds
);
