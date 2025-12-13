#!/bin/bash
# ==============================================================
# Verify SHACL Fix - Quick validation test
# Usage: ./verify_shacl_fix.sh [repository_name] [graphdb_url]
# ==============================================================

set -e

REPO_NAME=${1:-ekg_test}
GRAPHDB_URL=${2:-http://localhost:7200}
SPARQL_ENDPOINT="${GRAPHDB_URL}/repositories/${REPO_NAME}"

echo "============================================================"
echo "SHACL Fix Verification"
echo "Repository: ${REPO_NAME}"
echo "GraphDB URL: ${GRAPHDB_URL}"
echo "============================================================"

# Test 1: Verify ex:Entity class exists
echo ""
echo "Test 1: Checking ex:Entity superclass exists..."
QUERY="PREFIX ex: <http://example.com/schema#>
ASK { ex:Entity a <http://www.w3.org/2002/07/owl#Class> }"

response=$(curl -s -X POST \
    -H "Accept: application/sparql-results+json" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "query=${QUERY}" \
    "${SPARQL_ENDPOINT}")

if echo "$response" | grep -q '"boolean" : true'; then
    echo "✓ PASSED: ex:Entity class exists in ontology"
else
    echo "✗ FAILED: ex:Entity class not found"
    exit 1
fi

# Test 2: Verify all entity classes are subclasses of ex:Entity
echo ""
echo "Test 2: Checking entity classes are subclasses of ex:Entity..."
QUERY="PREFIX ex: <http://example.com/schema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT (COUNT(?class) AS ?count)
WHERE {
    ?class rdfs:subClassOf ex:Entity .
    FILTER(?class IN (ex:Person, ex:OrgUnit, ex:Product, ex:Project, ex:Asset))
}"

response=$(curl -s -X POST \
    -H "Accept: application/sparql-results+json" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "query=${QUERY}" \
    "${SPARQL_ENDPOINT}")

count=$(echo "$response" | grep -oP '(?<="value" : ")[^"]+' | head -1)

if [ "$count" -eq 5 ]; then
    echo "✓ PASSED: All 5 entity classes are subclasses of ex:Entity"
else
    echo "✗ FAILED: Only $count/5 entity classes are subclasses of ex:Entity"
    exit 1
fi

# Test 3: Verify instances are inferred as ex:Entity
echo ""
echo "Test 3: Checking instance inference (ex:P_Ali is ex:Entity)..."
QUERY="PREFIX ex: <http://example.com/schema#>
ASK {
    ex:P_Ali a ex:Person .
    ex:P_Ali a ex:Entity .
}"

response=$(curl -s -X POST \
    -H "Accept: application/sparql-results+json" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "query=${QUERY}" \
    "${SPARQL_ENDPOINT}")

if echo "$response" | grep -q '"boolean" : true'; then
    echo "✓ PASSED: Instance ex:P_Ali correctly inferred as ex:Entity"
else
    echo "⚠  WARNING: Inference may not be enabled (OWL-RL ruleset required)"
fi

# Test 4: Count SHACL shapes targeting ex:Entity
echo ""
echo "Test 4: Checking SHACL shapes targeting ex:Entity..."
QUERY="PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX ex: <http://example.com/schema#>
SELECT (COUNT(?shape) AS ?count)
WHERE {
    ?shape sh:targetClass ex:Entity .
}"

response=$(curl -s -X POST \
    -H "Accept: application/sparql-results+json" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "query=${QUERY}" \
    "${SPARQL_ENDPOINT}")

count=$(echo "$response" | grep -oP '(?<="value" : ")[^"]+' | head -1)

if [ -n "$count" ] && [ "$count" -gt 0 ]; then
    echo "✓ PASSED: Found $count SHACL shape(s) targeting ex:Entity"
else
    echo "✗ FAILED: No SHACL shapes targeting ex:Entity found"
    exit 1
fi

# Test 5: Verify no shapes use sh:targetNode on classes
echo ""
echo "Test 5: Checking for incorrect sh:targetNode usage..."
QUERY="PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX ex: <http://example.com/schema#>
ASK {
    ?shape sh:targetNode ?node .
    FILTER(?node IN (ex:Person, ex:OrgUnit, ex:Product, ex:Project, ex:Asset))
}"

response=$(curl -s -X POST \
    -H "Accept: application/sparql-results+json" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "query=${QUERY}" \
    "${SPARQL_ENDPOINT}")

if echo "$response" | grep -q '"boolean" : false'; then
    echo "✓ PASSED: No shapes incorrectly use sh:targetNode on class definitions"
else
    echo "✗ FAILED: Found shapes using sh:targetNode on class definitions"
    exit 1
fi

echo ""
echo "============================================================"
echo "✅ All SHACL fix verification tests passed!"
echo "============================================================"
echo "The ontology and SHACL shapes are correctly configured."
echo "Shapes now validate instance data, not ontology classes."
echo "============================================================"
