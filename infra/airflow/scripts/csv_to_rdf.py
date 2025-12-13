#!/usr/bin/env python3
"""
CSV to RDF Converter for EKG Schema
Converts seed CSV files to Turtle (TTL) RDF format
"""

import csv
import sys
from pathlib import Path
from datetime import datetime

# Namespaces
EX = "http://example.com/schema#"
PROV = "http://www.w3.org/ns/prov#"
XSD = "http://www.w3.org/2001/XMLSchema#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"

# Security label mapping (FIXED: added < >)
LABEL_MAP = {
    "Public": f"<{EX}Public>",
    "Internal": f"<{EX}Internal>",
    "Confidential": f"<{EX}Confidential>",
    "Secret": f"<{EX}Secret>",
}

# Role mapping (FIXED: added < >)
ROLE_MAP = {
    "Viewer": f"<{EX}Viewer>",
    "Curator": f"<{EX}Curator>",
    "Steward": f"<{EX}Steward>",
    "Admin": f"<{EX}Admin>",
}

def escape_turtle_string(s: str) -> str:
    """Escape special characters for Turtle strings"""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

def write_header(f):
    """Write Turtle file header with namespace declarations"""
    f.write("@prefix ex: <http://example.com/schema#> .\n")
    f.write("@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n")
    f.write("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n")
    f.write("@prefix prov: <http://www.w3.org/ns/prov#> .\n\n")

def convert_orgunits(csv_path: Path, ttl_path: Path, job_id: str):
    """Convert orgunits.csv to TTL"""
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         open(ttl_path, 'w', encoding='utf-8') as ttlfile:

        write_header(ttlfile)
        ttlfile.write("# Generated from orgunits.csv\n")
        ttlfile.write(f"# Job ID: {job_id}\n")
        ttlfile.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        reader = csv.DictReader(csvfile)
        for row in reader:
            org_id = row['id']
            name = escape_turtle_string(row['name'])
            parent_id = row.get('parentId', '').strip()

            # FIX: ensure label is <IRI>
            label = LABEL_MAP.get(row['label'], f"<{EX}Internal>")

            valid_from = row['validFrom']

            ttlfile.write(f"ex:{org_id} a ex:OrgUnit ;\n")
            ttlfile.write(f'    ex:name "{name}" ;\n')
            ttlfile.write(f"    ex:label {label} ;\n")
            ttlfile.write(f'    ex:validFrom "{valid_from}"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:wasDerivedFrom "seed/orgunits.csv" ;\n')
            ttlfile.write(f'    ex:classifiedAt "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime')
            

            if parent_id:
                ttlfile.write(f" ;\n    ex:parentUnit ex:{parent_id}")

            ttlfile.write(" .\n\n")

def convert_persons(csv_path: Path, ttl_path: Path, job_id: str):
    """Convert persons.csv to TTL"""
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         open(ttl_path, 'w', encoding='utf-8') as ttlfile:

        write_header(ttlfile)
        ttlfile.write("# Generated from persons.csv\n")
        ttlfile.write(f"# Job ID: {job_id}\n")
        ttlfile.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        reader = csv.DictReader(csvfile)
        for row in reader:
            person_id = row['id']
            full_name = escape_turtle_string(row['fullName'])
            email = row['email'].strip()
            org_unit_id = row['orgUnitId']
            role_literal = escape_turtle_string(row.get('role', ''))

            # FIX: ensure label is <IRI>
            label = LABEL_MAP.get(row['label'], f"<{EX}Internal>")

            # FIX: ensure hasRole is <IRI>
            has_role = ROLE_MAP.get(row.get('hasRole', 'Viewer'), f"<{EX}Viewer>")

            valid_from = row['validFrom']

            ttlfile.write(f"ex:{person_id} a ex:Person ;\n")
            ttlfile.write(f'    ex:fullName "{full_name}" ;\n')
            ttlfile.write(f'    ex:email "{email}" ;\n')
            ttlfile.write(f"    ex:worksFor ex:{org_unit_id} ;\n")

            if role_literal:
                ttlfile.write(f'    ex:role "{role_literal}" ;\n')

            ttlfile.write(f"    ex:hasRole {has_role} ;\n")
            ttlfile.write(f"    ex:label {label} ;\n")
            ttlfile.write(f'    ex:validFrom "{valid_from}"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:wasDerivedFrom "seed/persons.csv" ;\n')
            ttlfile.write(f'    ex:classifiedAt "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime .\n\n')

def convert_products(csv_path: Path, ttl_path: Path, job_id: str):
    """Convert products.csv to TTL"""
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         open(ttl_path, 'w', encoding='utf-8') as ttlfile:

        write_header(ttlfile)
        ttlfile.write("# Generated from products.csv\n")
        ttlfile.write(f"# Job ID: {job_id}\n")
        ttlfile.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        reader = csv.DictReader(csvfile)
        for row in reader:
            product_id = row['id']
            name = escape_turtle_string(row['name'])
            description = escape_turtle_string(row.get('description', ''))
            status = row.get('status', 'active')
            owned_by_id = row.get('ownedById', '').strip()

            # FIX: ensure label is <IRI>
            label = LABEL_MAP.get(row['label'], f"<{EX}Internal>")

            valid_from = row['validFrom']

            ttlfile.write(f"ex:{product_id} a ex:Product ;\n")
            ttlfile.write(f'    ex:name "{name}" ;\n')

            if description:
                ttlfile.write(f'    ex:description "{description}" ;\n')

            ttlfile.write(f'    ex:status "{status}" ;\n')

            if owned_by_id:
                ttlfile.write(f"    ex:ownedBy ex:{owned_by_id} ;\n")

            ttlfile.write(f"    ex:label {label} ;\n")
            ttlfile.write(f'    ex:validFrom "{valid_from}"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:wasDerivedFrom "seed/products.csv" ;\n')
            ttlfile.write(f'    ex:classifiedAt "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime .\n\n')
            
def convert_projects(csv_path: Path, ttl_path: Path, job_id: str):
    """Convert projects.csv to TTL"""
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         open(ttl_path, 'w', encoding='utf-8') as ttlfile:

        write_header(ttlfile)
        ttlfile.write("# Generated from projects.csv\n")
        ttlfile.write(f"# Job ID: {job_id}\n")
        ttlfile.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        reader = csv.DictReader(csvfile)
        for row in reader:
            project_id = row['id']
            name = escape_turtle_string(row['name'])
            description = escape_turtle_string(row.get('description', ''))
            start_date = row['startDate']
            end_date = row.get('endDate', '').strip()
            managed_by_id = row.get('managedById', '').strip()

            # FIX: ensure label is <IRI>
            label = LABEL_MAP.get(row['label'], f"<{EX}Internal>")

            valid_from = row['validFrom']

            ttlfile.write(f"ex:{project_id} a ex:Project ;\n")
            ttlfile.write(f'    ex:name "{name}" ;\n')

            if description:
                ttlfile.write(f'    ex:description "{description}" ;\n')

            ttlfile.write(f'    ex:startDate "{start_date}"^^xsd:date ;\n')

            if end_date:
                ttlfile.write(f'    ex:endDate "{end_date}"^^xsd:date ;\n')

            if managed_by_id:
                ttlfile.write(f"    ex:managedBy ex:{managed_by_id} ;\n")

            ttlfile.write(f"    ex:label {label} ;\n")
            ttlfile.write(f'    ex:validFrom "{valid_from}"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:wasDerivedFrom "seed/projects.csv" ;\n')
            ttlfile.write(f'    ex:classifiedAt "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime .\n\n')
            

def convert_assets(csv_path: Path, ttl_path: Path, job_id: str):
    """Convert assets.csv to TTL"""
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         open(ttl_path, 'w', encoding='utf-8') as ttlfile:

        write_header(ttlfile)
        ttlfile.write("# Generated from assets.csv\n")
        ttlfile.write(f"# Job ID: {job_id}\n")
        ttlfile.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        reader = csv.DictReader(csvfile)
        for row in reader:
            asset_id = row['id']
            name = escape_turtle_string(row['name'])
            asset_type = row['assetType']
            location = escape_turtle_string(row.get('location', ''))
            owned_by_id = row.get('ownedById', '').strip()

            # FIX: ensure label is <IRI>
            label = LABEL_MAP.get(row['label'], f"<{EX}Internal>")

            valid_from = row['validFrom']

            ttlfile.write(f"ex:{asset_id} a ex:Asset ;\n")
            ttlfile.write(f'    ex:name "{name}" ;\n')
            ttlfile.write(f'    ex:assetType "{asset_type}" ;\n')

            if location:
                ttlfile.write(f'    ex:location "{location}" ;\n')

            if owned_by_id:
                ttlfile.write(f"    ex:ownedBy ex:{owned_by_id} ;\n")

            ttlfile.write(f"    ex:label {label} ;\n")
            ttlfile.write(f'    ex:validFrom "{valid_from}"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:wasDerivedFrom "seed/assets.csv" ;\n')
            ttlfile.write(f'    ex:classifiedAt "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime ;\n')
            ttlfile.write(f'    prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime .\n\n')
            
def main():
    """Main entry point for CSV to RDF conversion"""
    if len(sys.argv) < 3:
        print("Usage: python csv_to_rdf.py <seed_dir> <output_dir> [job_id]")
        sys.exit(1)

    seed_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    job_id = sys.argv[3] if len(sys.argv) > 3 else f"manual_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Converting CSV files from {seed_dir} to {output_dir}")
    print(f"Job ID: {job_id}\n")

    conversions = [
        ("orgunits.csv", "orgunits.ttl", convert_orgunits),
        ("persons.csv", "persons.ttl", convert_persons),
        ("products.csv", "products.ttl", convert_products),
        ("projects.csv", "projects.ttl", convert_projects),
        ("assets.csv", "assets.ttl", convert_assets),
    ]

    for csv_file, ttl_file, converter_func in conversions:
        csv_path = seed_dir / csv_file
        ttl_path = output_dir / ttl_file

        if not csv_path.exists():
            print(f"Warning: {csv_path} not found, skipping...")
            continue

        print(f"Converting {csv_file} -> {ttl_file}...")
        converter_func(csv_path, ttl_path, job_id)
        print(f"  [OK] Generated {ttl_path}")

    print(f"\n[SUCCESS] Conversion complete! RDF files saved to {output_dir}")

if __name__ == "__main__":
    main()
