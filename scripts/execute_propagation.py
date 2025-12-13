#!/usr/bin/env python3

"""
============================================================
EKG Propagation Execution Script
Date: 2025-11-27
Description: Execute propagation rules from YAML configuration
Usage: python execute_propagation.py --config rules/propagation.yaml --rule PROP-001 --context '{...}'
============================================================
"""

import argparse
import json
import sys
import yaml
import requests
from datetime import datetime
from typing import Dict, Any, List

# ASCII-safe characters for Windows compatibility
OK = "[OK]"
WARN = "[WARN]"
ERROR = "[ERROR]"
INFO = "[INFO]"

class PropagationExecutor:
    def __init__(self, config_path: str, graphdb_url: str, repo: str):
        self.config_path = config_path
        self.graphdb_url = graphdb_url
        self.repo = repo
        self.config = None
        self.load_config()

    def load_config(self):
        """Load propagation rules from YAML"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)
            print(f"{OK} Loaded configuration from {self.config_path}")
            print(f"    Version: {self.config.get('version', 'unknown')}")
            print(f"    Rules: {len(self.config.get('rules', []))}")
        except Exception as e:
            print(f"{ERROR} Failed to load config: {e}", file=sys.stderr)
            sys.exit(1)

    def execute_sparql_update(self, sparql: str, context: Dict[str, Any]) -> bool:
        """Execute SPARQL UPDATE query with context bindings"""
        try:
            # Replace placeholders in SPARQL with context values
            query = sparql
            for key, value in context.items():
                placeholder = f"?{key}"
                # Handle different value types
                if isinstance(value, str):
                    if value.startswith("http://") or value.startswith("https://"):
                        # URI
                        replacement = f"<{value}>"
                    elif "T" in value and "Z" in value:
                        # DateTime
                        replacement = f'"{value}"^^<http://www.w3.org/2001/XMLSchema#dateTime>'
                    else:
                        # String literal
                        replacement = f'"{value}"'
                else:
                    replacement = str(value)

                query = query.replace(placeholder, replacement)

            # Execute SPARQL UPDATE
            endpoint = f"{self.graphdb_url}/repositories/{self.repo}/statements"
            headers = {"Content-Type": "application/sparql-update"}

            response = requests.post(endpoint, data=query, headers=headers, timeout=30)

            if response.status_code in [200, 204]:
                return True
            else:
                print(f"{ERROR} SPARQL UPDATE failed: HTTP {response.status_code}", file=sys.stderr)
                print(f"    Response: {response.text}", file=sys.stderr)
                return False

        except Exception as e:
            print(f"{ERROR} Exception during SPARQL execution: {e}", file=sys.stderr)
            return False

    def execute_rule(self, rule_id: str, context: Dict[str, Any], dry_run: bool = False) -> bool:
        """Execute a single propagation rule"""
        # Find rule by ID
        rule = None
        for r in self.config.get('rules', []):
            if r['id'] == rule_id:
                rule = r
                break

        if not rule:
            print(f"{ERROR} Rule {rule_id} not found", file=sys.stderr)
            return False

        if not rule.get('enabled', True):
            print(f"{WARN} Rule {rule_id} is disabled")
            return False

        print(f"\n{INFO} Executing rule: {rule_id} - {rule['name']}")
        print(f"    Description: {rule['description']}")

        # Execute actions
        for action in rule.get('actions', []):
            action_name = action.get('action')
            print(f"\n  {INFO} Action: {action_name}")
            print(f"      {action.get('description', 'No description')}")

            if dry_run:
                print(f"  {WARN} DRY RUN - SPARQL not executed")
                print(f"      Context: {json.dumps(context, indent=2)}")
                continue

            # Execute SPARQL
            sparql = action.get('sparql_update', '')
            if sparql:
                success = self.execute_sparql_update(sparql, context)
                if success:
                    print(f"  {OK} Action completed successfully")
                else:
                    print(f"  {ERROR} Action failed", file=sys.stderr)
                    if self.config.get('config', {}).get('error_handling') == 'stop_on_error':
                        return False

        return True

    def validate(self) -> bool:
        """Run validation queries after propagation"""
        print(f"\n{INFO} Running validation queries...")

        validations = self.config.get('validation', [])
        all_valid = True

        for validation in validations:
            rule_name = validation['rule']
            expected_count = validation.get('expected_count', 0)
            sparql_query = validation['sparql_query']

            print(f"\n  {INFO} Validation: {rule_name}")
            print(f"      {validation.get('description', '')}")

            # Execute query
            endpoint = f"{self.graphdb_url}/repositories/{self.repo}"
            headers = {"Accept": "application/sparql-results+json"}
            params = {"query": sparql_query}

            try:
                response = requests.get(endpoint, params=params, headers=headers, timeout=30)
                if response.status_code == 200:
                    results = response.json()
                    count = len(results.get('results', {}).get('bindings', []))

                    if count == expected_count:
                        print(f"  {OK} Validation passed (count: {count})")
                    else:
                        print(f"  {ERROR} Validation FAILED (expected: {expected_count}, got: {count})", file=sys.stderr)
                        all_valid = False
                else:
                    print(f"  {ERROR} Query failed: HTTP {response.status_code}", file=sys.stderr)
                    all_valid = False

            except Exception as e:
                print(f"  {ERROR} Validation exception: {e}", file=sys.stderr)
                all_valid = False

        return all_valid

def main():
    parser = argparse.ArgumentParser(description='Execute EKG propagation rules')
    parser.add_argument('--config', default='rules/propagation.yaml', help='Path to propagation config YAML')
    parser.add_argument('--rule', required=True, help='Rule ID to execute (e.g., PROP-001)')
    parser.add_argument('--context', required=True, help='JSON context for rule execution')
    parser.add_argument('--url', default='http://localhost:7200', help='GraphDB URL')
    parser.add_argument('--repo', default='ekg', help='GraphDB repository')
    parser.add_argument('--dry-run', action='store_true', help='Print SPARQL without executing')
    parser.add_argument('--validate', action='store_true', help='Run validation queries after execution')
    parser.add_argument('--output', help='Output JSON report file')

    args = parser.parse_args()

    print("========================================")
    print("EKG PROPAGATION EXECUTOR")
    print("========================================")
    print(f"Config: {args.config}")
    print(f"Rule: {args.rule}")
    print(f"GraphDB: {args.url}/{args.repo}")
    print(f"Dry run: {args.dry_run}")
    print("========================================\n")

    # Parse context
    try:
        context = json.loads(args.context)
    except json.JSONDecodeError as e:
        print(f"{ERROR} Invalid JSON context: {e}", file=sys.stderr)
        sys.exit(1)

    # Execute propagation
    executor = PropagationExecutor(args.config, args.url, args.repo)
    success = executor.execute_rule(args.rule, context, dry_run=args.dry_run)

    # Validate if requested
    if args.validate and not args.dry_run:
        validation_success = executor.validate()
        success = success and validation_success

    # Create report
    report = {
        "rule_id": args.rule,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "context": context,
        "status": "SUCCESS" if success else "FAILED",
        "dry_run": args.dry_run
    }

    # Output report
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        print(f"\n{OK} Report saved to {args.output}")

    # Print summary
    print("\n========================================")
    if success:
        print(f"{OK} PROPAGATION SUCCESSFUL")
    else:
        print(f"{ERROR} PROPAGATION FAILED")
    print("========================================")

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
