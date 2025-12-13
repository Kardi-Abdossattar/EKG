/**
 * Script de test de charge K6 - TEP-08_HARDEN_SCALE
 *
 * Teste les performances de l'EKG avec des charges croissantes
 * Objectif SLO: p95 < 800ms
 *
 * Lancer: k6 run tests/load/k6_load_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Métriques personnalisées
const errorRate = new Rate('errors');
const sparqlQueryDuration = new Trend('sparql_query_duration');
const graphqlQueryDuration = new Trend('graphql_query_duration');
const cacheHitRate = new Rate('cache_hits');
const requestCount = new Counter('total_requests');

// Configuration des étapes de charge
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Warm-up: 10 VUs
    { duration: '3m', target: 50 },  // Charge normale: 50 VUs
    { duration: '2m', target: 100 }, // Pic: 100 VUs
    { duration: '2m', target: 50 },  // Descente
    { duration: '1m', target: 0 },   // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800'], // SLO principal: p95 < 800ms
    'http_req_duration{name:sparql}': ['p(95)<800'],
    'http_req_duration{name:graphql}': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],   // < 1% d'erreurs
    'errors': ['rate<0.01'],
  },
};

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const GRAPHDB_URL = __ENV.GRAPHDB_URL || 'http://localhost:7200';
const REPOSITORY = 'ekg';

// Requêtes SPARQL de test
const SPARQL_QUERIES = {
  listPersons: `
    PREFIX ex: <http://example.com/schema#>
    SELECT ?person ?name ?email
    WHERE {
      ?person a ex:Person ;
              ex:fullName ?name ;
              ex:email ?email .
    }
    LIMIT 100
  `,

  personsWithOrg: `
    PREFIX ex: <http://example.com/schema#>
    SELECT ?person ?name ?orgName
    WHERE {
      ?person a ex:Person ;
              ex:fullName ?name ;
              ex:worksFor ?org .
      ?org ex:name ?orgName .
    }
    LIMIT 50
  `,

  orgHierarchy: `
    PREFIX ex: <http://example.com/schema#>
    SELECT ?org ?orgName ?parent ?parentName
    WHERE {
      ?org a ex:OrgUnit ;
           ex:name ?orgName .
      OPTIONAL {
        ?org ex:parentUnit ?parent .
        ?parent ex:name ?parentName .
      }
    }
    LIMIT 50
  `,

  lowTrustScores: `
    PREFIX ex: <http://example.com/schema#>
    SELECT ?entity ?score
    WHERE {
      ?entity ex:trustScore ?score .
      FILTER(?score < 0.5)
    }
    ORDER BY ?score
    LIMIT 20
  `,

  temporalQuery: `
    PREFIX ex: <http://example.com/schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    SELECT ?entity ?validFrom
    WHERE {
      ?entity ex:validFrom ?validFrom .
      FILTER(?validFrom > "2025-01-01T00:00:00Z"^^xsd:dateTime)
    }
    LIMIT 50
  `,
};

// Requêtes GraphQL de test
const GRAPHQL_QUERIES = {
  listPersons: `
    query {
      persons(limit: 50) {
        id
        fullName
        email
        trustScore
      }
    }
  `,

  personWithOrg: `
    query {
      persons(limit: 20) {
        id
        fullName
        orgUnit {
          id
          name
        }
      }
    }
  `,
};

/**
 * Test direct SPARQL endpoint (GraphDB)
 */
function testSparqlDirect() {
  const queryKey = Object.keys(SPARQL_QUERIES)[
    Math.floor(Math.random() * Object.keys(SPARQL_QUERIES).length)
  ];
  const query = SPARQL_QUERIES[queryKey];

  const response = http.post(
    `${GRAPHDB_URL}/repositories/${REPOSITORY}`,
    query,
    {
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      tags: { name: 'sparql' },
    }
  );

  const success = check(response, {
    'SPARQL status is 200': (r) => r.status === 200,
    'SPARQL has results': (r) => {
      try {
        return JSON.parse(r.body).results.bindings.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  sparqlQueryDuration.add(response.timings.duration);
  requestCount.add(1);
}

/**
 * Test via API Gateway (avec cache)
 */
function testSparqlViaAPI() {
  const queryKey = Object.keys(SPARQL_QUERIES)[
    Math.floor(Math.random() * Object.keys(SPARQL_QUERIES).length)
  ];
  const query = SPARQL_QUERIES[queryKey];

  const response = http.post(
    `${BASE_URL}/api/sparql/query`,
    JSON.stringify({ query }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'sparql_api' },
    }
  );

  const success = check(response, {
    'API SPARQL status is 200': (r) => r.status === 200,
    'API SPARQL has data': (r) => {
      try {
        return JSON.parse(r.body).data !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Détection de cache hit via header personnalisé
  const cached = response.headers['X-Cache-Hit'] === 'true';
  cacheHitRate.add(cached);

  errorRate.add(!success);
  requestCount.add(1);
}

/**
 * Test GraphQL endpoint
 */
function testGraphQL() {
  const queryKey = Object.keys(GRAPHQL_QUERIES)[
    Math.floor(Math.random() * Object.keys(GRAPHQL_QUERIES).length)
  ];
  const query = GRAPHQL_QUERIES[queryKey];

  const response = http.post(
    `${BASE_URL}/graphql`,
    JSON.stringify({ query }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'graphql' },
    }
  );

  const success = check(response, {
    'GraphQL status is 200': (r) => r.status === 200,
    'GraphQL no errors': (r) => {
      try {
        return !JSON.parse(r.body).errors;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  graphqlQueryDuration.add(response.timings.duration);
  requestCount.add(1);
}

/**
 * Test REST endpoint avec pagination
 */
function testRESTEndpoints() {
  const endpoints = [
    '/api/rest/persons?limit=50&offset=0',
    '/api/rest/orgunits?limit=50&offset=0',
    '/api/rest/products?limit=20&offset=0',
    '/api/rest/trustscores/low?threshold=0.5',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const response = http.get(`${BASE_URL}${endpoint}`, {
    tags: { name: 'rest' },
  });

  const success = check(response, {
    'REST status is 200': (r) => r.status === 200,
    'REST has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  requestCount.add(1);
}

/**
 * Scénario principal de test
 */
export default function () {
  // Mix de requêtes pour simuler un usage réel
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% SPARQL direct
    testSparqlDirect();
  } else if (scenario < 0.5) {
    // 20% SPARQL via API (avec cache)
    testSparqlViaAPI();
  } else if (scenario < 0.7) {
    // 20% GraphQL
    testGraphQL();
  } else {
    // 30% REST
    testRESTEndpoints();
  }

  // Think time (pause entre requêtes)
  sleep(Math.random() * 2 + 1); // 1-3 secondes
}

/**
 * Rapport de fin de test
 */
export function handleSummary(data) {
  const slo_p95 = data.metrics.http_req_duration.values['p(95)'];
  const errorRate = data.metrics.errors ? data.metrics.errors.values.rate : 0;
  const cacheHitRate = data.metrics.cache_hits ? data.metrics.cache_hits.values.rate : 0;

  const passed = slo_p95 < 800 && errorRate < 0.01;

  console.log('\n' + '='.repeat(70));
  console.log('  TEP-08_HARDEN_SCALE - Résultats du test de charge');
  console.log('='.repeat(70));
  console.log(`  SLO p95 < 800ms:     ${slo_p95.toFixed(2)}ms ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Taux d'erreur:       ${(errorRate * 100).toFixed(2)}% ${errorRate < 0.01 ? '✅' : '❌'}`);
  console.log(`  Cache hit rate:      ${(cacheHitRate * 100).toFixed(2)}%`);
  console.log(`  Total requêtes:      ${data.metrics.total_requests.values.count}`);
  console.log('='.repeat(70));

  return {
    'summary.json': JSON.stringify(data, null, 2),
    'stdout': '',
  };
}
