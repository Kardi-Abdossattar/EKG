#!/usr/bin/env python3
"""
Générateur de dataset volumétrique pour tests de charge
TEP-08_HARDEN_SCALE

Multiplie les données seed par un facteur N pour créer un dataset de test.
Usage: python scripts/generate_load_dataset.py --multiplier 100 --output data/load_test.ttl
"""

import argparse
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Préfixes
PREFIXES = """@prefix ex: <http://example.com/schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

"""

# Données de référence
FIRST_NAMES = [
    "Ali", "Sara", "Mohamed", "Fatima", "Omar", "Leila", "Ahmed", "Nadia",
    "Karim", "Amina", "Youssef", "Malika", "Hassan", "Rachida", "Mehdi",
    "Samira", "Bilal", "Khadija", "Amine", "Zineb", "Hamza", "Imane"
]

LAST_NAMES = [
    "Alami", "Benali", "Chakir", "Drissi", "Elidrissi", "Fassi", "Guerraoui",
    "Hammoudi", "Idrissi", "Jamal", "Karimi", "Lazrak", "Mansouri", "Naciri",
    "Ouazzani", "Qassemi", "Rami", "Sbai", "Tazi", "Wahbi", "Ziani"
]

ROLES = [
    "Engineer", "Senior Engineer", "Staff Engineer", "Principal Engineer",
    "Manager", "Senior Manager", "Director", "VP",
    "HR Specialist", "Recruiter", "HR Manager",
    "Product Manager", "Program Manager", "Project Manager",
    "Designer", "Senior Designer", "UX Researcher",
    "Data Scientist", "ML Engineer", "Data Analyst"
]

ORG_UNITS = [
    "Engineering", "Product", "Design", "Data", "HR", "Finance",
    "Marketing", "Sales", "Legal", "Operations", "Security", "IT"
]

CONFIDENTIALITY_LABELS = [
    "ex:Public", "ex:Interne", "ex:Confidentiel", "ex:Secret"
]

PRODUCT_CATEGORIES = [
    "SaaS", "Infrastructure", "Analytics", "Security", "Collaboration",
    "DevTools", "AI/ML", "Mobile", "IoT", "Cloud"
]


def generate_person(person_id: int, org_units: list, base_date: datetime) -> str:
    """Génère un triplet Person."""
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    full_name = f"{first_name} {last_name}"
    email = f"{first_name.lower()}.{last_name.lower()}.{person_id}@example.com"
    role = random.choice(ROLES)
    org_unit = random.choice(org_units)
    label = random.choice(CONFIDENTIALITY_LABELS)

    # Trust score: 70% entre 0.7-1.0, 25% entre 0.5-0.7, 5% < 0.5
    rand = random.random()
    if rand < 0.70:
        trust_score = round(random.uniform(0.7, 1.0), 3)
    elif rand < 0.95:
        trust_score = round(random.uniform(0.5, 0.7), 3)
    else:
        trust_score = round(random.uniform(0.1, 0.5), 3)

    valid_from = base_date - timedelta(days=random.randint(0, 365))

    ttl = f"""
ex:P_{person_id} a ex:Person ;
  ex:fullName "{full_name}" ;
  ex:email "{email}" ;
  ex:worksFor ex:OU_{org_unit} ;
  ex:role "{role}" ;
  ex:label {label} ;
  ex:trustScore {trust_score} ;
  ex:validFrom "{valid_from.isoformat()}Z"^^xsd:dateTime ;
  prov:wasDerivedFrom "generated/load_test" ;
  prov:generatedAtTime "{datetime.utcnow().isoformat()}Z"^^xsd:dateTime .
"""
    return ttl


def generate_orgunit(org_name: str) -> str:
    """Génère un triplet OrgUnit."""
    ttl = f"""
ex:OU_{org_name} a ex:OrgUnit ;
  ex:name "{org_name}" ;
  ex:label ex:Interne ;
  rdfs:label "{org_name} Department" .
"""
    return ttl


def generate_product(product_id: int, base_date: datetime) -> str:
    """Génère un triplet Product."""
    category = random.choice(PRODUCT_CATEGORIES)
    name = f"{category} Product {product_id}"
    label = random.choice(["ex:Public", "ex:Interne", "ex:Confidentiel"])

    trust_score = round(random.uniform(0.6, 1.0), 3)
    valid_from = base_date - timedelta(days=random.randint(0, 730))

    ttl = f"""
ex:PROD_{product_id} a ex:Product ;
  ex:name "{name}" ;
  ex:category "{category}" ;
  ex:label {label} ;
  ex:trustScore {trust_score} ;
  ex:validFrom "{valid_from.isoformat()}Z"^^xsd:dateTime .
"""
    return ttl


def generate_project(project_id: int, persons: list, base_date: datetime) -> str:
    """Génère un triplet Project avec assignations."""
    name = f"Project Alpha-{project_id}"
    label = random.choice(CONFIDENTIALITY_LABELS)

    # Assigner 2-5 personnes au projet
    team_size = random.randint(2, 5)
    team_members = random.sample(persons, min(team_size, len(persons)))

    valid_from = base_date - timedelta(days=random.randint(0, 180))
    trust_score = round(random.uniform(0.5, 0.95), 3)

    ttl = f"""
ex:PROJ_{project_id} a ex:Project ;
  ex:name "{name}" ;
  ex:label {label} ;
  ex:trustScore {trust_score} ;
  ex:validFrom "{valid_from.isoformat()}Z"^^xsd:dateTime """

    for member_id in team_members:
        ttl += f";\n  ex:assignedTo ex:P_{member_id} "

    ttl += ".\n"
    return ttl


def main():
    parser = argparse.ArgumentParser(
        description='Génère un dataset volumétrique pour tests de charge'
    )
    parser.add_argument(
        '--multiplier',
        type=int,
        default=100,
        help='Facteur de multiplication des entités (défaut: 100)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='data/load_test.ttl',
        help='Fichier de sortie TTL (défaut: data/load_test.ttl)'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=42,
        help='Seed pour reproductibilité (défaut: 42)'
    )

    args = parser.parse_args()

    random.seed(args.seed)
    base_date = datetime.utcnow()

    print("=" * 70)
    print("  GÉNÉRATEUR DE DATASET VOLUMÉTRIQUE - TEP-08_HARDEN_SCALE")
    print("=" * 70)
    print(f"  Multiplier:      {args.multiplier}")
    print(f"  Output:          {args.output}")
    print(f"  Seed:            {args.seed}")
    print("=" * 70)

    # Créer répertoire de sortie
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        # Écrire les préfixes
        f.write(PREFIXES)
        f.write("# Generated dataset for load testing\n")
        f.write(f"# Multiplier: {args.multiplier}\n")
        f.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n\n")

        # Générer OrgUnits (fixe)
        print("\n🏢 Generating OrgUnits...")
        for org in ORG_UNITS:
            f.write(generate_orgunit(org))
        print(f"  ✓ {len(ORG_UNITS)} OrgUnits created")

        # Générer Persons
        print("\n👤 Generating Persons...")
        num_persons = args.multiplier * 10  # 10 persons par multiplier
        person_ids = list(range(1, num_persons + 1))

        for i, person_id in enumerate(person_ids, 1):
            f.write(generate_person(person_id, ORG_UNITS, base_date))

            if i % 1000 == 0:
                print(f"  ... {i}/{num_persons} persons")

        print(f"  ✓ {num_persons} Persons created")

        # Générer Products
        print("\n📦 Generating Products...")
        num_products = args.multiplier * 5  # 5 products par multiplier

        for product_id in range(1, num_products + 1):
            f.write(generate_product(product_id, base_date))

        print(f"  ✓ {num_products} Products created")

        # Générer Projects (avec team assignments)
        print("\n🚀 Generating Projects...")
        num_projects = args.multiplier * 3  # 3 projects par multiplier

        for project_id in range(1, num_projects + 1):
            f.write(generate_project(project_id, person_ids, base_date))

        print(f"  ✓ {num_projects} Projects created")

    # Statistiques finales
    total_entities = len(ORG_UNITS) + num_persons + num_products + num_projects
    file_size_mb = output_path.stat().st_size / (1024 * 1024)

    print("\n" + "=" * 70)
    print("  ✅ DATASET GÉNÉRÉ AVEC SUCCÈS")
    print("=" * 70)
    print(f"  Total entités:   {total_entities:,}")
    print(f"  - OrgUnits:      {len(ORG_UNITS):,}")
    print(f"  - Persons:       {num_persons:,}")
    print(f"  - Products:      {num_products:,}")
    print(f"  - Projects:      {num_projects:,}")
    print(f"  Taille fichier:  {file_size_mb:.2f} MB")
    print(f"  Fichier:         {output_path}")
    print("=" * 70)
    print("\n💡 Prochaines étapes:")
    print(f"  1. Charger dans GraphDB:")
    print(f"     curl -X POST http://localhost:7200/repositories/ekg/statements \\")
    print(f"       -H 'Content-Type: application/x-turtle' \\")
    print(f"       --data-binary @{output_path}")
    print(f"  2. Lancer les tests de charge:")
    print(f"     k6 run tests/load/k6_load_test.js")
    print()


if __name__ == "__main__":
    main()
