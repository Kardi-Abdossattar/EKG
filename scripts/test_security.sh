#!/bin/bash
# TEP-05 Security Testing Script

echo "=== TEP-05 SECURITY TESTS ==="

# Get tokens
echo "[1/7] Getting authentication tokens..."
VIEWER_TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" -H "Content-Type: application/x-www-form-urlencoded" -d "client_id=postman&username=alice.viewer&password=viewer123&grant_type=password" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

CURATOR_TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" -H "Content-Type: application/x-www-form-urlencoded" -d "client_id=postman&username=bob.curator&password=curator123&grant_type=password" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

STEWARD_TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" -H "Content-Type: application/x-www-form-urlencoded" -d "client_id=postman&username=carol.steward&password=steward123&grant_type=password" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

ADMIN_TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ekg/protocol/openid-connect/token" -H "Content-Type: application/x-www-form-urlencoded" -d "client_id=postman&username=dave.admin&password=admin123&grant_type=password" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

echo "[OK] Viewer token length: ${#VIEWER_TOKEN}"
echo "[OK] Curator token length: ${#CURATOR_TOKEN}"
echo "[OK] Steward token length: ${#STEWARD_TOKEN}"
echo "[OK] Admin token length: ${#ADMIN_TOKEN}"

# Test 1: Viewer can read persons (SUCCESS expected)
echo ""
echo "[2/7] Test: alice.viewer GET /ekg/persons (expect 200)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $VIEWER_TOKEN" http://localhost:3000/ekg/persons)
if [ "$RESULT" == "200" ]; then
    echo "[OK] alice.viewer can read persons (HTTP $RESULT)"
else
    echo "[FAIL] alice.viewer GET persons failed (HTTP $RESULT)"
fi

# Test 2: Viewer cannot access quarantine (403 expected)
echo ""
echo "[3/7] Test: alice.viewer GET /ekg/quarantine (expect 403)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $VIEWER_TOKEN" http://localhost:3000/ekg/quarantine)
if [ "$RESULT" == "403" ]; then
    echo "[OK] alice.viewer correctly denied quarantine access (HTTP $RESULT)"
else
    echo "[FAIL] Expected 403, got HTTP $RESULT"
fi

# Test 3: Curator can access quarantine (200 expected)
echo ""
echo "[4/7] Test: bob.curator GET /ekg/quarantine (expect 200)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CURATOR_TOKEN" http://localhost:3000/ekg/quarantine)
if [ "$RESULT" == "200" ]; then
    echo "[OK] bob.curator can access quarantine (HTTP $RESULT)"
else
    echo "[FAIL] bob.curator GET quarantine failed (HTTP $RESULT)"
fi

# Test 4: Curator cannot execute SPARQL updates (403 expected)
echo ""
echo "[5/7] Test: bob.curator POST /ekg/sparql/update (expect 403)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CURATOR_TOKEN" -H "Content-Type: application/json" -d '{"update":"PREFIX ex: <http://example.com/schema#> INSERT DATA { GRAPH <http://example.com/data> { ex:TEST a ex:Person } }"}' http://localhost:3000/ekg/sparql/update)
if [ "$RESULT" == "403" ]; then
    echo "[OK] bob.curator correctly denied SPARQL updates (HTTP $RESULT)"
else
    echo "[FAIL] Expected 403, got HTTP $RESULT"
fi

# Test 5: Steward can execute SPARQL updates (200 expected)
echo ""
echo "[6/7] Test: carol.steward POST /ekg/sparql/update (expect 200)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $STEWARD_TOKEN" -H "Content-Type: application/json" -d '{"update":"PREFIX ex: <http://example.com/schema#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> INSERT DATA { GRAPH <http://example.com/data> { ex:TEST_ENTITY a ex:Person ; rdfs:label \"Test by steward\" } }"}' http://localhost:3000/ekg/sparql/update)
if [ "$RESULT" == "200" ]; then
    echo "[OK] carol.steward can execute SPARQL updates (HTTP $RESULT)"
else
    echo "[FAIL] carol.steward POST update failed (HTTP $RESULT)"
fi

# Test 6: Admin has full access (200 expected)
echo ""
echo "[7/7] Test: dave.admin POST /ekg/sparql/update (expect 200)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"update":"PREFIX ex: <http://example.com/schema#> DELETE WHERE { GRAPH <http://example.com/data> { ex:TEST_ENTITY ?p ?o } }"}' http://localhost:3000/ekg/sparql/update)
if [ "$RESULT" == "200" ]; then
    echo "[OK] dave.admin can execute SPARQL updates (HTTP $RESULT)"
else
    echo "[FAIL] dave.admin POST update failed (HTTP $RESULT)"
fi

echo ""
echo "=== SECURITY TESTS COMPLETED ==="
