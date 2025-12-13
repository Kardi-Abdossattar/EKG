#!/usr/bin/env python3
"""
Générateur de dataset volumétrique pour tests de charge
TEP-08_HARDEN_SCALE

Multiplie les données seed existantes par un facteur N
Génère des données cohérentes avec variations réalistes
"""

import sys
import random
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
SEED_DIR = Path("seed")
OUTPUT_DIR = Path("tests/load/data")

# Listes de noms/prénoms pour variation
FIRST_NAMES = [
    "Ali", "Sara", "Ahmed", "Fatima", "Youssef", "Amina", "Omar", "Leila",
    "Karim", "Nadia", "Hassan", "Samira", "Rachid", "Khadija", "Said", "Malika",
    "Mehdi", "Zineb", "Adil", "Hanane", "Bilal", "Imane", "Tarek", "Salma",
    "Ilyas", "Meriem", "Anas", "Hiba", "Rayan", "Lina", "Adam", "Sofia"
]

LAST_NAMES = [
    "Karim", "Batta", "El Amrani", "Benali", "Alaoui", "Bouazza", "Chahid",
    "Darif", "El Fassi", "Ghali", "Hamdi", "Idrissi", "Jamal", "Kettani",
    "Lahlou", "Mansouri", "Naciri", "Ouazzani", "Qadiri", "Rami", "Slaoui",
    "Tazi", "Wahbi", "Yazidi", "Zaki", "Benjelloun", "Cherkaoui", "Dekkak"
]

ROLES = [
    "Engineer", "Senior Engineer", "Lead Engineer", "Architect",
    "Manager", "Director", "VP", "C-Level",
    "HR Specialist", "HR Manager", "Recruiter",
    "Financial Analyst", "Accountant", "Controller",
    "Product Manager", "Project Manager", "Scrum Master",
    "Designer", "UX Researcher", "Data Scientist", "DevOps Engineer"
]

SECURITY_LABELS = ["Public", "Interne", "Confidentiel", "Secret"]

DEPT_NAMES = [
    "Engineering", "Human Resources", "Finance", "Marketing",
    "Sales", "Operations", "Legal", "IT",
    "Product", "Design", "Data Science", "Security",
    "Customer Success", "Support", "QA", "DevOps"
]


def generate_email(first_name, last_name, domain="example.com"):
    """Génère un email unique."""
    return f"{first_name.lower()}.{last_name.lower()}@{domain}"


def generate_date(base_date, days_range=365):
    """Génère une date aléatoire autour de base_date."""
    offset = random.randint(-days_range // 2, days_range // 2)
    return (base_date + timedelta(days=offset)).strftime("%Y-%m-%dT%H:%M:%SZ")


def generate_trust_score():
    """Génère un trustScore réaliste (majorité > 0.7)."""
    if random.random() < 0.85:  # 85% de scores élevés
        return round(random.uniform(0.7, 1.0), 3)
    else:  # 15% de scores suspects
        return round(random.uniform(0.2, 0.69), 3)


def generate_persons_csv(count, output_file):
    """Génère un fichier CSV de personnes."""
    print(f"  Génération de {count} personnes...")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("id,fullName,email,orgUnitId,role,label,validFrom,trustScore\n")

        base_date = datetime(2025, 1, 1)

        for i in range(1, count + 1):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"
            email = generate_email(first, last)
            email = f"{email.split('@')[0]}{i}@example.com"  # Assurer unicité

            org_id = f"OU_{random.randint(1, max(1, count // 50))}"
            role = random.choice(ROLES)
            label = random.choice(SECURITY_LABELS)
            valid_from = generate_date(base_date)
            trust_score = generate_trust_score()

            f.write(f"P_{i},{full_name},{email},{org_id},{role},{label},{valid_from},{trust_score}\n")

    print(f"  ✓ {output_file}")


def generate_orgunits_csv(count, output_file):
    """Génère un fichier CSV d'unités organisationnelles."""
    print(f"  Génération de {count} unités organisationnelles...")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("id,name,parentId\n")

        # Racine
        root_count = max(1, count // 10)
        for i in range(1, root_count + 1):
            dept = random.choice(DEPT_NAMES)
            f.write(f"OU_{i},{dept} {i},\n")

        # Sous-unités
        for i in range(root_count + 1, count + 1):
            parent_id = f"OU_{random.randint(1, root_count)}"
            dept = random.choice(DEPT_NAMES)
            team = random.choice(["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"])
            f.write(f"OU_{i},{dept} - {team},{parent_id}\n")

    print(f"  ✓ {output_file}")


def generate_products_csv(count, output_file):
    """Génère un fichier CSV de produits."""
    print(f"  Génération de {count} produits...")

    product_prefixes = ["Widget", "Gadget", "Service", "Platform", "Solution", "Tool"]
    product_suffixes = ["Pro", "Plus", "Enterprise", "Cloud", "360", "X"]

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("id,name,description,label,validFrom,trustScore\n")

        base_date = datetime(2024, 1, 1)

        for i in range(1, count + 1):
            prefix = random.choice(product_prefixes)
            suffix = random.choice(product_suffixes)
            name = f"{prefix} {suffix} {i}"

            description = f"Enterprise-grade {prefix.lower()} solution"
            label = random.choice(SECURITY_LABELS)
            valid_from = generate_date(base_date, days_range=730)
            trust_score = generate_trust_score()

            f.write(f"PROD_{i},{name},{description},{label},{valid_from},{trust_score}\n")

    print(f"  ✓ {output_file}")


def generate_projects_csv(count, output_file):
    """Génère un fichier CSV de projets."""
    print(f"  Génération de {count} projets...")

    project_types = ["Migration", "Integration", "Development", "Optimization", "Research"]

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("id,name,status,label,validFrom,trustScore\n")

        base_date = datetime(2024, 6, 1)

        for i in range(1, count + 1):
            project_type = random.choice(project_types)
            name = f"{project_type} Project {i}"

            status = random.choice(["active", "completed", "planned", "on-hold"])
            label = random.choice(SECURITY_LABELS)
            valid_from = generate_date(base_date, days_range=365)
            trust_score = generate_trust_score()

            f.write(f"PROJ_{i},{name},{status},{label},{valid_from},{trust_score}\n")

    print(f"  ✓ {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Générateur de dataset volumétrique pour tests de charge"
    )
    parser.add_argument(
        '--multiplier',
        type=int,
        default=100,
        help="Facteur de multiplication des données seed (défaut: 100)"
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=OUTPUT_DIR,
        help="Répertoire de sortie (défaut: tests/load/data)"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("  GÉNÉRATION DE DATASET VOLUMÉTRIQUE - TEP-08_HARDEN_SCALE")
    print("=" * 70)
    print(f"\nMultiplier: {args.multiplier}x")
    print(f"Output: {args.output_dir}")
    print()

    # Créer le répertoire de sortie
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Générer les fichiers
    generate_persons_csv(
        args.multiplier * 100,
        args.output_dir / "persons_large.csv"
    )

    generate_orgunits_csv(
        args.multiplier * 10,
        args.output_dir / "orgunits_large.csv"
    )

    generate_products_csv(
        args.multiplier * 50,
        args.output_dir / "products_large.csv"
    )

    generate_projects_csv(
        args.multiplier * 20,
        args.output_dir / "projects_large.csv"
    )

    print("\n" + "=" * 70)
    print("  ✅ DATASET GÉNÉRÉ")
    print("=" * 70)

    total_entities = (
        args.multiplier * 100 +  # persons
        args.multiplier * 10 +   # orgunits
        args.multiplier * 50 +   # products
        args.multiplier * 20     # projects
    )

    print(f"\nEntités totales: {total_entities:,}")
    print(f"  - Personnes: {args.multiplier * 100:,}")
    print(f"  - Unités org: {args.multiplier * 10:,}")
    print(f"  - Produits: {args.multiplier * 50:,}")
    print(f"  - Projets: {args.multiplier * 20:,}")
    print()
    print("💡 Prochaine étape:")
    print(f"   python scripts/csv_to_rdf.py {args.output_dir}/*.csv")
    print()


if __name__ == "__main__":
    main()
