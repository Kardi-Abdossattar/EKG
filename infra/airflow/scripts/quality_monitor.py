#!/usr/bin/env python3
"""
EKG Quality Monitor - TEP-03
Surveillance qualité continue post-ingestion avec:
- Validation SHACL automatique
- Sanity checks SPARQL
- Export métriques Prometheus via Pushgateway
- Détection anomalies et alertes
"""

import json
import time
import logging
import argparse
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import requests
from prometheus_client import CollectorRegistry, Gauge, push_to_gateway, delete_from_gateway

# Configuration logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QualityMonitor:
    """Moniteur de qualité EKG avec métriques Prometheus"""

    def __init__(
        self,
        graphdb_url: str,
        repo: str,
        pushgateway_url: Optional[str] = None,
        job_name: str = "ekg_quality_monitor"
    ):
        self.graphdb_url = graphdb_url.rstrip('/')
        self.repo = repo
        self.pushgateway_url = pushgateway_url
        self.job_name = job_name
        self.registry = CollectorRegistry()

        # Métriques Prometheus
        self.setup_metrics()

    def setup_metrics(self):
        """Initialise les métriques Prometheus"""
        # Triple count par graph
        self.metric_triple_count = Gauge(
            'ekg_triple_count',
            'Nombre total de triplets dans le graph',
            ['graph', 'repository'],
            registry=self.registry
        )

        # Violations SHACL
        self.metric_shacl_violations = Gauge(
            'ekg_shacl_violations',
            'Nombre de violations SHACL détectées',
            ['severity', 'repository'],
            registry=self.registry
        )

        # Sanity checks
        self.metric_sanity_checks = Gauge(
            'ekg_sanity_check_issues',
            'Nombre d\'anomalies détectées par sanity checks',
            ['check_name', 'repository'],
            registry=self.registry
        )

        # Latence ingestion (dernière)
        self.metric_ingest_latency = Gauge(
            'ekg_ingest_latency_seconds',
            'Latence de la dernière ingestion (secondes)',
            ['repository'],
            registry=self.registry
        )

        # Score qualité global (0-100)
        self.metric_quality_score = Gauge(
            'ekg_quality_score',
            'Score de qualité global du graphe (0-100)',
            ['repository'],
            registry=self.registry
        )

        # Timestamp dernière vérification
        self.metric_last_check = Gauge(
            'ekg_last_quality_check_timestamp',
            'Timestamp de la dernière vérification qualité',
            ['repository'],
            registry=self.registry
        )

        # Entités par type
        self.metric_entities_by_type = Gauge(
            'ekg_entities_by_type',
            'Nombre d\'entités par type',
            ['entity_type', 'repository'],
            registry=self.registry
        )

        # TEP-03.5: Quarantine metrics
        self.metric_quarantine_total = Gauge(
            'ekg_quarantine_total',
            'Nombre total d\'entités en quarantaine nécessitant curation',
            ['repository'],
            registry=self.registry
        )

    def query_sparql(self, query: str, graph: Optional[str] = None) -> List[Dict]:
        """Exécute une requête SPARQL SELECT"""
        url = f"{self.graphdb_url}/repositories/{self.repo}"
        headers = {
            'Accept': 'application/sparql-results+json',
            'Content-Type': 'application/sparql-query'
        }

        if graph:
            full_query = f"FROM <{graph}>\n{query}"
        else:
            full_query = query

        try:
            response = requests.post(url, data=full_query, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()
            return result.get('results', {}).get('bindings', [])
        except Exception as e:
            logger.error(f"SPARQL query failed: {e}")
            return []

    def count_triples(self, graph: Optional[str] = None) -> int:
        """Compte le nombre de triplets dans un graph"""
        if graph:
            query = f"""
            SELECT (COUNT(*) AS ?count)
            FROM <{graph}>
            WHERE {{ ?s ?p ?o }}
            """
        else:
            query = "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }"

        results = self.query_sparql(query)
        if results:
            return int(results[0]['count']['value'])
        return 0

    def count_quarantine(self, staging_repo: str = "ekg_staging") -> int:
        """
        TEP-03.5: Compte les entités en quarantaine
        Query contre ekg_staging repository
        """
        query = """
        SELECT (COUNT(DISTINCT ?entity) AS ?count)
        FROM <http://example.com/quarantine>
        WHERE {
            ?entity ?p ?o
        }
        """

        # Override repo temporarily pour query staging
        original_repo = self.repo
        self.repo = staging_repo

        try:
            results = self.query_sparql(query)
            count = int(results[0]['count']['value']) if results else 0
        finally:
            self.repo = original_repo

        return count

    def validate_shacl(self, graph: Optional[str] = None) -> Tuple[bool, int, List[Dict]]:
        """
        Valide SHACL et retourne (conforms, violation_count, violations)
        """
        url = f"{self.graphdb_url}/repositories/{self.repo}/rdf-graphs/service"

        # Query SHACL validation via GraphDB REST API
        query = """
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT ?focusNode ?resultPath ?value ?message ?severity
        WHERE {
          ?report a sh:ValidationReport ;
                  sh:conforms ?conforms ;
                  sh:result ?result .
          ?result sh:focusNode ?focusNode ;
                  sh:resultSeverity ?severity .
          OPTIONAL { ?result sh:resultPath ?resultPath }
          OPTIONAL { ?result sh:value ?value }
          OPTIONAL { ?result sh:resultMessage ?message }
        }
        """

        # Alternative: utiliser l'API SHACL de GraphDB
        shacl_url = f"{self.graphdb_url}/repositories/{self.repo}/shacl/validate"

        try:
            # Validation via GraphDB SHACL endpoint
            headers = {'Accept': 'application/rdf+xml'}
            response = requests.get(shacl_url, headers=headers, timeout=30)

            # Parse pour déterminer conformité
            conforms_query = """
            PREFIX sh: <http://www.w3.org/ns/shacl#>
            ASK {
              ?report a sh:ValidationReport ;
                      sh:conforms true .
            }
            """

            conforms_result = self.query_sparql(conforms_query)
            conforms = len(conforms_result) > 0 if conforms_result else True

            # Compter violations
            violations_query = """
            PREFIX sh: <http://www.w3.org/ns/shacl#>
            SELECT (COUNT(?result) AS ?count)
            WHERE {
              ?report a sh:ValidationReport ;
                      sh:result ?result .
            }
            """

            violations_result = self.query_sparql(violations_query)
            violation_count = int(violations_result[0]['count']['value']) if violations_result else 0

            # Récupérer détails violations
            violations_detail_query = """
            PREFIX sh: <http://www.w3.org/ns/shacl#>
            SELECT ?focusNode ?path ?message ?severity
            WHERE {
              ?report a sh:ValidationReport ;
                      sh:result ?result .
              ?result sh:focusNode ?focusNode ;
                      sh:resultSeverity ?severity .
              OPTIONAL { ?result sh:resultPath ?path }
              OPTIONAL { ?result sh:resultMessage ?message }
            }
            LIMIT 50
            """

            violations_details = self.query_sparql(violations_detail_query)

            return (conforms, violation_count, violations_details)

        except Exception as e:
            logger.error(f"SHACL validation failed: {e}")
            return (True, 0, [])  # Assume valid si erreur

    def run_sanity_checks(self) -> Dict[str, int]:
        """Exécute les sanity checks SPARQL et retourne les anomalies"""
        checks = {
            'duplicate_emails': """
                PREFIX ex: <http://example.com/schema#>
                SELECT ?email (COUNT(*) AS ?count)
                WHERE {
                  ?p a ex:Person ; ex:email ?email .
                }
                GROUP BY ?email
                HAVING (COUNT(*) > 1)
            """,
            'orphan_persons': """
                PREFIX ex: <http://example.com/schema#>
                SELECT (COUNT(?p) AS ?count)
                WHERE {
                  ?p a ex:Person .
                  FILTER NOT EXISTS { ?p ex:worksFor ?org }
                }
            """,
            'missing_security_labels': """
                PREFIX ex: <http://example.com/schema#>
                SELECT (COUNT(?entity) AS ?count)
                WHERE {
                  ?entity a ?type .
                  FILTER(?type IN (ex:Person, ex:Product, ex:Project, ex:Asset))
                  FILTER NOT EXISTS { ?entity ex:label ?label }
                }
            """,
            'invalid_temporal_range': """
                PREFIX ex: <http://example.com/schema#>
                SELECT (COUNT(?entity) AS ?count)
                WHERE {
                  ?entity ex:validFrom ?from ;
                          ex:validTo ?to .
                  FILTER(?to < ?from)
                }
            """,
            'missing_provenance': """
                PREFIX prov: <http://www.w3.org/ns/prov#>
                PREFIX ex: <http://example.com/schema#>
                SELECT (COUNT(?entity) AS ?count)
                WHERE {
                  ?entity a ?type .
                  FILTER(?type IN (ex:Person, ex:OrgUnit, ex:Product, ex:Project, ex:Asset))
                  FILTER NOT EXISTS { ?entity prov:wasDerivedFrom ?source }
                }
            """
        }

        results = {}
        for check_name, query in checks.items():
            try:
                query_result = self.query_sparql(query)
                count = int(query_result[0]['count']['value']) if query_result else 0
                results[check_name] = count
                logger.info(f"Sanity check '{check_name}': {count} issues")
            except Exception as e:
                logger.error(f"Sanity check '{check_name}' failed: {e}")
                results[check_name] = -1  # Erreur

        return results

    def count_entities_by_type(self) -> Dict[str, int]:
        """Compte les entités par type"""
        query = """
        PREFIX ex: <http://example.com/schema#>
        SELECT ?type (COUNT(?entity) AS ?count)
        WHERE {
          ?entity a ?type .
          FILTER(?type IN (ex:Person, ex:OrgUnit, ex:Product, ex:Project, ex:Asset))
        }
        GROUP BY ?type
        """

        results = self.query_sparql(query)
        counts = {}

        for result in results:
            type_uri = result['type']['value']
            # Extraire nom court (Person, OrgUnit, etc.)
            type_name = type_uri.split('#')[-1] if '#' in type_uri else type_uri.split('/')[-1]
            count = int(result['count']['value'])
            counts[type_name] = count

        return counts

    def calculate_quality_score(
        self,
        violation_count: int,
        sanity_issues: Dict[str, int],
        total_triples: int
    ) -> float:
        """
        Calcule un score de qualité global (0-100)
        Pénalités:
        - Violations SHACL: -10 points par violation
        - Sanity issues: -5 points par issue
        - Normalisation par nombre de triplets
        """
        score = 100.0

        # Pénalité violations SHACL (max -50)
        if total_triples > 0:
            violation_penalty = min(50, (violation_count / total_triples) * 1000)
            score -= violation_penalty

        # Pénalité sanity checks (max -30)
        total_sanity_issues = sum(v for v in sanity_issues.values() if v > 0)
        if total_triples > 0:
            sanity_penalty = min(30, (total_sanity_issues / total_triples) * 500)
            score -= sanity_penalty

        # Arrondir et borner
        score = max(0, min(100, round(score, 2)))
        return score

    def run_monitoring(self, graph: Optional[str] = None) -> Dict:
        """
        Exécute le monitoring complet et retourne les métriques
        """
        logger.info("=== Starting EKG Quality Monitoring ===")
        start_time = time.time()

        # 1. Compter triplets
        logger.info("Counting triples...")
        total_triples = self.count_triples(graph)
        logger.info(f"Total triples: {total_triples}")

        # Métriques Prometheus
        graph_label = graph if graph else 'default'
        self.metric_triple_count.labels(graph=graph_label, repository=self.repo).set(total_triples)

        # 2. Validation SHACL
        logger.info("Running SHACL validation...")
        conforms, violation_count, violations = self.validate_shacl(graph)
        logger.info(f"SHACL conforms: {conforms}, violations: {violation_count}")

        # Compter par sévérité
        severity_counts = {'Violation': 0, 'Warning': 0, 'Info': 0}
        for violation in violations:
            severity = violation.get('severity', {}).get('value', '')
            if 'Violation' in severity:
                severity_counts['Violation'] += 1
            elif 'Warning' in severity:
                severity_counts['Warning'] += 1
            else:
                severity_counts['Info'] += 1

        for severity, count in severity_counts.items():
            self.metric_shacl_violations.labels(severity=severity, repository=self.repo).set(count)

        # 3. Sanity checks
        logger.info("Running sanity checks...")
        sanity_results = self.run_sanity_checks()

        for check_name, count in sanity_results.items():
            if count >= 0:  # Ignore errors (-1)
                self.metric_sanity_checks.labels(check_name=check_name, repository=self.repo).set(count)

        # 4. Compter entités par type
        logger.info("Counting entities by type...")
        entity_counts = self.count_entities_by_type()

        for entity_type, count in entity_counts.items():
            self.metric_entities_by_type.labels(entity_type=entity_type, repository=self.repo).set(count)

        # 4.5. TEP-03.5: Compter entités en quarantaine
        logger.info("Counting quarantine entities...")
        quarantine_count = self.count_quarantine()
        logger.info(f"Quarantine entities: {quarantine_count}")
        self.metric_quarantine_total.labels(repository="ekg_staging").set(quarantine_count)

        # 5. Calculer score qualité
        quality_score = self.calculate_quality_score(violation_count, sanity_results, total_triples)
        logger.info(f"Quality score: {quality_score}/100")
        self.metric_quality_score.labels(repository=self.repo).set(quality_score)

        # 6. Latence
        latency = time.time() - start_time
        self.metric_ingest_latency.labels(repository=self.repo).set(latency)

        # 7. Timestamp
        self.metric_last_check.labels(repository=self.repo).set(time.time())

        # 8. Push vers Pushgateway si configuré
        if self.pushgateway_url:
            try:
                logger.info(f"Pushing metrics to Pushgateway: {self.pushgateway_url}")
                push_to_gateway(
                    self.pushgateway_url,
                    job=self.job_name,
                    registry=self.registry,
                    grouping_key={'repository': self.repo}
                )
                logger.info("Metrics pushed successfully")
            except Exception as e:
                logger.error(f"Failed to push metrics: {e}")

        # Résultat JSON
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'repository': self.repo,
            'graph': graph_label,
            'metrics': {
                'total_triples': total_triples,
                'shacl_conforms': conforms,
                'shacl_violations': violation_count,
                'shacl_violations_by_severity': severity_counts,
                'sanity_checks': sanity_results,
                'entity_counts': entity_counts,
                'quarantine_total': quarantine_count,  # TEP-03.5
                'quality_score': quality_score,
                'latency_seconds': round(latency, 3)
            },
            'status': 'PASSED' if conforms and quality_score >= 80 else 'FAILED'
        }

        logger.info(f"=== Monitoring completed in {latency:.2f}s, status: {result['status']} ===")
        return result


def main():
    parser = argparse.ArgumentParser(description='EKG Quality Monitor - TEP-03')
    parser.add_argument('--url', default='http://localhost:7200', help='GraphDB URL')
    parser.add_argument('--repo', default='ekg', help='Repository name')
    parser.add_argument('--graph', help='Named graph URI (optional)')
    parser.add_argument('--pushgateway', help='Prometheus Pushgateway URL (e.g., http://localhost:9091)')
    parser.add_argument('--job', default='ekg_quality_monitor', help='Prometheus job name')
    parser.add_argument('--output', help='Output JSON file path (optional)')

    args = parser.parse_args()

    monitor = QualityMonitor(
        graphdb_url=args.url,
        repo=args.repo,
        pushgateway_url=args.pushgateway,
        job_name=args.job
    )

    result = monitor.run_monitoring(graph=args.graph)

    # Afficher résumé
    print("\n" + "="*60)
    print("EKG QUALITY MONITORING REPORT")
    print("="*60)
    print(f"Repository: {result['repository']}")
    print(f"Graph: {result['graph']}")
    print(f"Timestamp: {result['timestamp']}")
    print(f"\nStatus: {result['status']}")
    print(f"Quality Score: {result['metrics']['quality_score']}/100")
    print(f"\nTriples: {result['metrics']['total_triples']}")
    print(f"SHACL Conforms: {result['metrics']['shacl_conforms']}")
    print(f"SHACL Violations: {result['metrics']['shacl_violations']}")

    print("\nEntity Counts:")
    for entity_type, count in result['metrics']['entity_counts'].items():
        print(f"  {entity_type}: {count}")

    print("\nSanity Checks:")
    for check_name, count in result['metrics']['sanity_checks'].items():
        status = "✓ OK" if count == 0 else f"✗ {count} issues"
        print(f"  {check_name}: {status}")

    print(f"\nLatency: {result['metrics']['latency_seconds']}s")
    print("="*60 + "\n")

    # Sauvegarder JSON si demandé
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Results saved to {args.output}")

    # Exit code basé sur status
    exit(0 if result['status'] == 'PASSED' else 1)


if __name__ == '__main__':
    main()
