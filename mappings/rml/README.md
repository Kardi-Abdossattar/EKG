# RML Mappings - EKG Schema

**RML (R2RML Mapping Language)** - Mappings déclaratifs CSV → RDF

Ces fichiers définissent comment transformer les données CSV en triplets RDF conformes à l'ontologie EKG.

---

## 📁 Fichiers

| Fichier | Source CSV | Classe RDF | Triplets |
|---------|------------|------------|----------|
| [orgunits.rml.ttl](orgunits.rml.ttl) | `seed/orgunits.csv` | `ex:OrgUnit` | ~6 entités |
| [persons.rml.ttl](persons.rml.ttl) | `seed/persons.csv` | `ex:Person` | ~8 entités |
| [products.rml.ttl](products.rml.ttl) | `seed/products.csv` | `ex:Product` | ~4 entités |
| [projects.rml.ttl](projects.rml.ttl) | `seed/projects.csv` | `ex:Project` | ~3 entités |
| [assets.rml.ttl](assets.rml.ttl) | `seed/assets.csv` | `ex:Asset` | ~4 entités |

---

## 🔧 Format RML

Chaque mapping définit:

1. **Logical Source** (`rml:logicalSource`)
   - Fichier CSV source
   - Format de référence (CSV)

2. **Subject Map** (`rr:subjectMap`)
   - Template IRI (ex: `http://example.com/schema#{id}`)
   - Classe RDF (ex: `ex:Person`)

3. **Predicate-Object Maps** (`rr:predicateObjectMap`)
   - Propriétés RDF (ex: `ex:fullName`)
   - Colonnes CSV (ex: `fullName`)
   - Datatypes (ex: `xsd:string`, `xsd:dateTime`)
   - IRI templates pour relations (ex: `ex:worksFor`)

---

## 📖 Exemple: persons.rml.ttl

```turtle
@prefix rr: <http://www.w3.org/ns/r2rml#> .
@prefix rml: <http://semweb.mmlab.be/ns/rml#> .
@prefix ql: <http://semweb.mmlab.be/ns/ql#> .
@prefix ex: <http://example.com/schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#PersonMapping>
  rml:logicalSource [
    rml:source "seed/persons.csv" ;
    rml:referenceFormulation ql:CSV
  ] ;

  rr:subjectMap [
    rr:template "http://example.com/schema#{id}" ;
    rr:class ex:Person
  ] ;

  rr:predicateObjectMap [
    rr:predicate ex:fullName ;
    rr:objectMap [ rml:reference "fullName" ; rr:datatype xsd:string ]
  ] ;

  rr:predicateObjectMap [
    rr:predicate ex:email ;
    rr:objectMap [ rml:reference "email" ; rr:datatype xsd:string ]
  ] ;

  rr:predicateObjectMap [
    rr:predicate ex:worksFor ;
    rr:objectMap [ rr:template "http://example.com/schema#{orgUnitId}" ; rr:termType rr:IRI ]
  ] ;

  rr:predicateObjectMap [
    rr:predicate ex:label ;
    rr:objectMap [ rr:template "http://example.com/schema#{label}" ; rr:termType rr:IRI ]
  ] ;

  rr:predicateObjectMap [
    rr:predicate ex:validFrom ;
    rr:objectMap [ rml:reference "validFrom" ; rr:datatype xsd:dateTime ]
  ] .
```

---

## 🎯 Mappings Clés

### OrgUnits
- `ex:name` ← `name` (string)
- `ex:parentUnit` ← `parentId` (IRI)
- `ex:label` ← `label` (IRI: Public/Internal/Confidential/Secret)
- `ex:validFrom` ← `validFrom` (dateTime)

### Persons
- `ex:fullName` ← `fullName` (string)
- `ex:email` ← `email` (string)
- `ex:worksFor` ← `orgUnitId` (IRI)
- `ex:role` ← `role` (string)
- `ex:hasRole` ← `hasRole` (IRI: Viewer/Curator/Steward/Admin)
- `ex:label` ← `label` (IRI)
- `ex:validFrom` ← `validFrom` (dateTime)

### Products
- `ex:name` ← `name` (string)
- `ex:description` ← `description` (string)
- `ex:status` ← `status` (string)
- `ex:ownedBy` ← `ownedById` (IRI)
- `ex:label` ← `label` (IRI)
- `ex:validFrom` ← `validFrom` (dateTime)

### Projects
- `ex:name` ← `name` (string)
- `ex:description` ← `description` (string)
- `ex:startDate` ← `startDate` (date)
- `ex:endDate` ← `endDate` (date)
- `ex:managedBy` ← `managedById` (IRI)
- `ex:label` ← `label` (IRI)
- `ex:validFrom` ← `validFrom` (dateTime)

### Assets
- `ex:name` ← `name` (string)
- `ex:assetType` ← `assetType` (string)
- `ex:location` ← `location` (string)
- `ex:ownedBy` ← `ownedById` (IRI)
- `ex:label` ← `label` (IRI)
- `ex:validFrom` ← `validFrom` (dateTime)

---

## 💡 Utilisation

### MVP (TEP-02)
Les mappings RML servent de **documentation** des transformations.

Le pipeline actuel utilise **`scripts/csv_to_rdf.py`** (Python) pour la transformation effective, car:
- Plus flexible pour logique métier complexe
- Ajout provenance (prov:wasDerivedFrom, prov:generatedAtTime, job_id)
- Gestion erreurs détaillée
- Pas besoin d'installer RML processor (RMLMapper, Ontop, etc.)

### Production (Future)
Pour utiliser les mappings RML avec un processor standard:

```bash
# Option 1: RMLMapper (Java)
java -jar rmlmapper.jar -m mappings/rml/persons.rml.ttl -o output.ttl

# Option 2: Ontop (SPARQL endpoint virtuel)
ontop materialize -m mappings/rml/*.rml.ttl -o output.ttl

# Option 3: Morph-KGC (Python)
morph-kgc mappings/rml/persons.rml.ttl -o output.ttl
```

---

## 🔍 Validation

Les mappings RML respectent:

1. **Ontologie EKG** (core.ttl, relations.ttl, security.ttl, temporal.ttl)
2. **SHACL Shapes** (shapes_core.ttl, shapes_security.ttl, etc.)
3. **Namespaces standards:**
   - `ex:` = `http://example.com/schema#`
   - `prov:` = `http://www.w3.org/ns/prov#`
   - `xsd:` = `http://www.w3.org/2001/XMLSchema#`

---

## 📚 Références

- **RML Spec:** https://rml.io/specs/rml/
- **R2RML Spec:** https://www.w3.org/TR/r2rml/
- **RMLMapper:** https://github.com/RMLio/rmlmapper-java
- **Ontop:** https://ontop-vkg.org/
- **Morph-KGC:** https://github.com/morph-kgc/morph-kgc

---

**Note:** Ces mappings sont maintenus en sync avec:
- `seed/*.csv` (structure CSV)
- `ontology/*.ttl` (ontologie)
- `shacl/shapes_*.ttl` (contraintes SHACL)
- `scripts/csv_to_rdf.py` (implémentation Python)

Toute modification de structure CSV ou ontologie doit être répercutée dans tous ces fichiers.
