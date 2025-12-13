#!/bin/bash
# ==============================================================
# Run SPARQL sanity checks against GraphDB repository
# Usage: ./run_sanity_checks.sh [repository_name] [graphdb_url]
# ==============================================================

set -e

REPO_NAME=${1:-ekg}
GRAPHDB_URL=${2:-http://localhost:7200}
SPARQL_ENDPOINT="${GRAPHDB_URL}/repositories/${REPO_NAME}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANITY_DIR="${PROJECT_ROOT}/tests/sanity"

echo "============================================================"
echo "EKG Sanity Checks"
echo "Repository: ${REPO_NAME}"
echo "GraphDB URL: ${GRAPHDB_URL}"
echo "============================================================"

# Check if GraphDB is accessible
echo -n "Checking GraphDB connection... "
if ! curl -s -f "${GRAPHDB_URL}/rest/repositories" > /dev/null; then
    echo "FAILED"
    echo "Error: Cannot connect to GraphDB at ${GRAPHDB_URL}"
    exit 1
fi
echo "OK"

# Check if repository exists
echo -n "Checking repository '${REPO_NAME}'... "
if ! curl -s -f "${GRAPHDB_URL}/rest/repositories/${REPO_NAME}" > /dev/null; then
    echo "NOT FOUND"
    echo "Error: Repository '${REPO_NAME}' does not exist."
    exit 1
fi
echo "OK"

echo ""
echo "Running sanity checks..."
echo "============================================================"

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to run a SPARQL query and check results
run_sanity_check() {
    local query_file=$1
    local query_name=$(basename "$query_file" .rq)

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo ""
    echo "[$TOTAL_CHECKS] ${query_name}"
    echo "------------------------------------------------------------"

    # Read query from file
    local query=$(<"$query_file")

    # Execute SPARQL query
    local response=$(curl -s -X POST \
        -H "Accept: application/sparql-results+json" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "query=${query}" \
        "${SPARQL_ENDPOINT}")

    # Check if response contains results
    local result_count=$(echo "$response" | grep -oP '(?<="bindings" : \[ )\S' | wc -l)

    if [ -z "$result_count" ]; then
        result_count=0
    fi

    # Parse number of bindings (results)
    local bindings=$(echo "$response" | grep -oP '(?<="bindings" : \[)[^\]]*' | wc -c)

    if [ "$bindings" -le 2 ]; then
        # Empty result set (expected for most sanity checks)
        echo "✓ PASSED (0 violations)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        # Non-empty result set (potential issue detected)
        echo "✗ FAILED (violations detected)"
        echo ""
        echo "Results:"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        echo ""
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# Run all sanity check queries
if [ ! -d "$SANITY_DIR" ]; then
    echo "Error: Sanity checks directory not found: ${SANITY_DIR}"
    exit 1
fi

for query_file in "${SANITY_DIR}"/*.rq; do
    if [ -f "$query_file" ]; then
        run_sanity_check "$query_file"
    fi
done

# Summary
echo ""
echo "============================================================"
echo "Sanity Check Summary"
echo "============================================================"
echo "Total checks:  ${TOTAL_CHECKS}"
echo "Passed:        ${PASSED_CHECKS}"
echo "Failed:        ${FAILED_CHECKS}"
echo "============================================================"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo "✅ All sanity checks passed!"
    exit 0
else
    echo "❌ ${FAILED_CHECKS} sanity check(s) failed. Please review violations above."
    exit 1
fi
