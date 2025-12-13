#!/usr/bin/env python3
"""
SHACL Validation Script for GraphDB
Validates RDF data against SHACL shapes via GraphDB REST API
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
import urllib.request
import urllib.parse
import urllib.error


def validate_shacl(graphdb_url: str, repo_name: str, verbose: bool = False):
    """
    Perform SHACL validation via GraphDB REST API

    GraphDB automatically validates using shapes in the SHACL graph.
    We query the validation report to check for violations.
    """
    endpoint = f"{graphdb_url}/repositories/{repo_name}"

    # SHACL validation query to retrieve validation report
    query = """
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?focusNode ?resultPath ?value ?message ?severity
WHERE {
    ?report a sh:ValidationReport ;
            sh:result ?result .

    ?result sh:focusNode ?focusNode ;
            sh:resultMessage ?message ;
            sh:resultSeverity ?severity .

    OPTIONAL { ?result sh:resultPath ?resultPath }
    OPTIONAL { ?result sh:value ?value }
}
ORDER BY ?severity ?focusNode
"""

    headers = {
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = urllib.parse.urlencode({"query": query}).encode("utf-8")

    print(f"Querying SHACL validation report from {endpoint}...")
    print(f"Timestamp: {datetime.utcnow().isoformat()}Z\n")

    try:
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))

        bindings = result.get("results", {}).get("bindings", [])

        if not bindings:
            print("✅ SHACL Validation: PASSED")
            print("No violations found. All data conforms to SHACL shapes.\n")
            return True

        print(f"⚠️  SHACL Validation: VIOLATIONS DETECTED")
        print(f"Found {len(bindings)} violations:\n")
        print("=" * 80)

        violations = []
        warnings = []
        infos = []

        for i, binding in enumerate(bindings, 1):
            focus_node = binding.get("focusNode", {}).get("value", "N/A")
            result_path = binding.get("resultPath", {}).get("value", "N/A")
            value = binding.get("value", {}).get("value", "N/A")
            message = binding.get("message", {}).get("value", "N/A")
            severity = binding.get("severity", {}).get("value", "N/A")

            severity_label = "VIOLATION"
            if "Warning" in severity:
                severity_label = "WARNING"
                warnings.append(binding)
            elif "Info" in severity:
                severity_label = "INFO"
                infos.append(binding)
            else:
                violations.append(binding)

            if verbose or severity_label == "VIOLATION":
                print(f"\n{i}. [{severity_label}]")
                print(f"   Focus Node: {focus_node}")
                print(f"   Path: {result_path}")
                print(f"   Value: {value}")
                print(f"   Message: {message}")
                print(f"   Severity: {severity}")
                print("-" * 80)

        print("\n" + "=" * 80)
        print(f"Summary:")
        print(f"  Violations: {len(violations)}")
        print(f"  Warnings:   {len(warnings)}")
        print(f"  Infos:      {len(infos)}")
        print("=" * 80)

        if violations:
            print("\n❌ SHACL Validation FAILED: Critical violations detected.")
            return False
        else:
            print("\n⚠️  SHACL Validation: Warnings/Infos only (no critical violations).")
            return True

    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error {e.code}: {e.reason}")
        print(f"Response: {e.read().decode('utf-8')}")
        return False
    except urllib.error.URLError as e:
        print(f"❌ URL Error: {e.reason}")
        print(f"Cannot connect to GraphDB at {graphdb_url}")
        print("Ensure GraphDB is running and the repository exists.")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def check_shacl_graph_exists(graphdb_url: str, repo_name: str):
    """Check if SHACL shapes are loaded in the repository"""
    endpoint = f"{graphdb_url}/repositories/{repo_name}"

    query = """
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT (COUNT(?shape) AS ?count)
WHERE {
    ?shape a sh:NodeShape .
}
"""

    headers = {
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = urllib.parse.urlencode({"query": query}).encode("utf-8")

    try:
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))

        count = int(result["results"]["bindings"][0]["count"]["value"])

        print(f"SHACL shapes loaded: {count}")

        if count == 0:
            print("⚠️  Warning: No SHACL shapes found in repository.")
            print("Please import SHACL shapes using import_to_graphdb.sh")
            return False

        return True

    except Exception as e:
        print(f"Error checking SHACL shapes: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Validate RDF data against SHACL shapes in GraphDB"
    )
    parser.add_argument(
        "--repo",
        default="ekg",
        help="GraphDB repository name (default: ekg)"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:7200",
        help="GraphDB URL (default: http://localhost:7200)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show all violations including warnings and infos"
    )

    args = parser.parse_args()

    print("=" * 80)
    print("EKG SHACL Validation")
    print("=" * 80)
    print(f"Repository: {args.repo}")
    print(f"GraphDB URL: {args.url}")
    print("=" * 80 + "\n")

    # Check if SHACL shapes are loaded
    if not check_shacl_graph_exists(args.url, args.repo):
        sys.exit(1)

    # Run validation
    success = validate_shacl(args.url, args.repo, args.verbose)

    if success:
        print("\n✅ Validation completed successfully.")
        sys.exit(0)
    else:
        print("\n❌ Validation failed. Please fix violations and re-import data.")
        sys.exit(1)


if __name__ == "__main__":
    main()
