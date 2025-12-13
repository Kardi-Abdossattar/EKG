/**
 * Script de test de charge K6 pour l'EKG
 * TEP-08_HARDEN_SCALE
 *
 * Ce script teste:
 * - Requêtes SPARQL SELECT avec pagination
 * - GraphQL queries
 * - REST API endpoints
 * - Performance du cache Redis
 *
 * Utilisation:
 *   k6 run --vus 10 --duration 30s k6-load-test.js
 *   k6 run --vus 50 --duration 5m k6-load-test.js  (test volumétrique)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Métriques personnalisées
const errorRate = new Rate('errors');
const sparqlDuration = new Trend('sparql_duration');
const graphqlDuration = new Trend('graphql_duration');
const restDuration = new Trend('rest_duration');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

// Configuration des seuils SLO (p95 < 800ms)
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<800'], // SLO: 95% des requêtes < 800ms
    http_req_failed: ['rate<0.01'],   // Moins de 1% d'erreurs
    errors: ['rate<0.05'],            // Moins de 5% d'erreurs applicatives
    sparql_duration: ['p(95)<800'],
    graphql_duration: ['p(95)<500'],
    rest_duration: ['p(95)<300'],
  },
  stages: [
    { duration: '30s', target: 10 },  // Warm-up: 10 VUs pendant 30s
    { duration: '1m', target: 50 },   // Montée: 50 VUs pendant 1min
    { duration: '3m', target: 50 },   // Plateau: 50 VUs pendant 3min
    { duration: '30s', target: 100 }, // Spike: 100 VUs pendant 30s
    { duration: '1m', target: 0 },    // Cool-down
  ],
};

// Configuration des endpoints
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const GRAPHDB_URL = __ENV.GRAPHDB_URL || 'http://localhost:7200';
const REPOSITORY = __ENV.REPOSITORY || 'ekg';

// Requêtes SPARQL de test
const SPARQL_QUERIES = [
  {
    name: 'list_persons',
    query: `
PREFIX ex: <http://example.com/schema#>
SELECT ?person ?fullName ?email ?role
WHERE {
  ?person a ex:Person ;
          ex:fullName ?fullName ;
          ex:email ?email ;
          ex:role ?role .
}
ORDER BY ?fullName
LIMIT 50
    `,
  },
  {
    name: 'org_hierarchy',
    query: `
PREFIX ex: <http://example.com/schema#>
SELECT ?orgUnit ?name ?parentName
WHERE {
  ?orgUnit a ex:OrgUnit ;
           ex:name ?name .
  OPTIONAL {
    ?orgUnit ex:parentUnit ?parent .
    ?parent ex:name ?parentName .
  }
}
ORDER BY ?name
LIMIT 50
    `,
  },
  {
    name: 'persons_with_org',
    query: `
PREFIX ex: <http://example.com/schema#>
SELECT ?person ?fullName ?email ?orgName
WHERE {
  ?person a ex:Person ;
          ex:fullName ?fullName ;
          ex:email ?email ;
          ex:worksFor ?org .
  ?org ex:name ?orgName .
}
ORDER BY ?fullName
LIMIT 50
    `,
  },
  {
    name: 'trust_scores',
    query: `
PREFIX ex: <http://example.com/schema#>
SELECT ?entity ?type ?trustScore
WHERE {
  ?entity a ?type ;
          ex:trustScore ?trustScore .
  FILTER(?trustScore < 0.5)
}
ORDER BY ?trustScore
LIMIT 50
    `,
  },
];

// GraphQL queries de test
const GRAPHQL_QUERIES = [
  {
    name: 'get_persons',
    query: `
query GetPersons {
  persons(limit: 50) {
    uri
    fullName
    email
    role
    orgUnit {
      name
    }
  }
}
    `,
  },
  {
    name: 'get_org_units',
    query: `
query GetOrgUnits {
  orgUnits(limit: 50) {
    uri
    name
    parentUnit {
      name
    }
  }
}
    `,
  },
];

/**
 * Fonction principale du test
 */
export default function () {
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% des requêtes: SPARQL via endpoint direct
    testSparqlEndpoint();
  } else if (scenario < 0.7) {
    // 30% des requêtes: GraphQL
    testGraphQL();
  } else {
    // 30% des requêtes: REST API
    testRestAPI();
  }

  // Pause aléatoire entre 0.5s et 2s
  sleep(Math.random() * 1.5 + 0.5);
}

/**
 * Test du endpoint SPARQL direct (GraphDB)
 */
function testSparqlEndpoint() {
  const query = SPARQL_QUERIES[Math.floor(Math.random() * SPARQL_QUERIES.length)];

  const params = {
    headers: {
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
    },
    tags: { type: 'sparql', query: query.name },
  };

  const response = http.post(
    `${GRAPHDB_URL}/repositories/${REPOSITORY}`,
    query.query,
    params
  );

  const success = check(response, {
    'SPARQL status 200': (r) => r.status === 200,
    'SPARQL has results': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.results && data.results.bindings;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  sparqlDuration.add(response.timings.duration);
}

/**
 * Test du endpoint GraphQL
 */
function testGraphQL() {
  const query = GRAPHQL_QUERIES[Math.floor(Math.random() * GRAPHQL_QUERIES.length)];

  const payload = JSON.stringify({
    query: query.query,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'graphql', query: query.name },
  };

  const response = http.post(`${BASE_URL}/graphql`, payload, params);

  const success = check(response, {
    'GraphQL status 200': (r) => r.status === 200,
    'GraphQL no errors': (r) => {
      try {
        const data = JSON.parse(r.body);
        return !data.errors;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  graphqlDuration.add(response.timings.duration);
}

/**
 * Test du REST API
 */
function testRestAPI() {
  const endpoints = [
    '/rest/persons?limit=50',
    '/rest/orgunits?limit=50',
    '/health',
    '/metrics',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const params = {
    tags: { type: 'rest', endpoint: endpoint },
  };

  const response = http.get(`${BASE_URL}${endpoint}`, params);

  const success = check(response, {
    'REST status 200': (r) => r.status === 200,
    'REST valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  restDuration.add(response.timings.duration);

  // Vérifier les statistiques de cache si endpoint /metrics
  if (endpoint === '/metrics' && success) {
    checkCacheStats(response);
  }
}

/**
 * Extrait les statistiques de cache depuis les métriques
 */
function checkCacheStats(response) {
  try {
    const body = response.body;
    if (body.includes('cache_hits')) {
      cacheHits.add(1);
    }
    if (body.includes('cache_misses')) {
      cacheMisses.add(1);
    }
  } catch (e) {
    // Ignore parsing errors
  }
}

/**
 * Teardown: afficher un résumé
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'load-test-report.json': JSON.stringify(data, null, 2),
  };
}

/**
 * Génère un résumé textuel
 */
function textSummary(data) {
  const summary = [
    '',
    '========================================',
    '  RAPPORT DE TEST DE CHARGE - TEP-08',
    '========================================',
    '',
    `Durée totale: ${data.state.testRunDurationMs / 1000}s`,
    `VUs max: ${data.metrics.vus_max.values.max}`,
    `Requêtes totales: ${data.metrics.http_reqs.values.count}`,
    `Taux d'erreur HTTP: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`,
    '',
    'LATENCES (ms):',
    `  p50: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}`,
    `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}`,
    `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}`,
    `  max: ${data.metrics.http_req_duration.values.max.toFixed(2)}`,
    '',
    `SLO (p95 < 800ms): ${data.metrics.http_req_duration.values['p(95)'] < 800 ? '✓ OK' : '✗ ÉCHEC'}`,
    '',
    '========================================',
    '',
  ];

  return summary.join('\n');
}
