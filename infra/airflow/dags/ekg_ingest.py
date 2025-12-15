"""
EKG Ingestion DAG - Official Production Pipeline
Automated pipeline for extracting, transforming, and loading RDF data into GraphDB

Pipeline Order (CRITICAL - dependencies enforced):
1. Extract CSV from seed/ directory
2. Transform CSV to RDF
3. Verify GraphDB endpoint connectivity
4. Ensure EKG repository exists
5. Upload ontologies (ordered: core -> temporal -> provenance -> relations -> security)
6. Upload SHACL shapes to special SHACL graph
7. Upload generated data (ordered: orgunits -> persons -> products -> projects -> assets)
8. Run sanity checks via SPARQL queries
9. Collect pipeline metrics
10. Quality monitoring and metrics push to Prometheus

Graph Separation:
- Ontology: http://example.com/ontology
- Data: http://example.com/data
- SHACL: http://rdf4j.org/schema/rdf4j#SHACLShapeGraph (special graph, no querying)

Author: EKG Team
Date: 2025-12-15 (Production)
"""
from datetime import datetime, timedelta
from pathlib import Path
import logging
import json
import requests
from urllib.parse import quote

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.exceptions import AirflowException
from airflow.models import Variable

# Configuration - Using internal Docker network
GRAPHDB_URL = Variable.get("GRAPHDB_URL", default_var="http://graphdb:7200")
REPO_ID = Variable.get("GRAPHDB_REPO", default_var="ekg")
SEED_DIR = "/opt/airflow/seed"
OUTPUT_DIR = "/opt/airflow/data/generated"
SCRIPTS_DIR = "/opt/airflow/scripts"
ONTOLOGY_DIR = "/opt/airflow/ontology"
SHACL_DIR = "/opt/airflow/shacl"

# Graph URIs
DATA_GRAPH = "http://example.com/data"
ONTOLOGY_GRAPH = "http://example.com/ontology"
SHACL_GRAPH = "http://rdf4j.org/schema/rdf4j#SHACLShapeGraph"

# Ordered file lists (dependencies matter!)
ONTOLOGY_FILES = ["core.ttl", "temporal.ttl", "provenance.ttl", "relations.ttl", "security.ttl"]
SHACL_FILES = ["shapes_core.ttl", "shapes_temporal.ttl", "shapes_provenance.ttl", "shapes_security_fixed.ttl"]
DATA_FILES = ["orgunits.ttl", "persons.ttl", "products.ttl", "projects.ttl", "assets.ttl"]

logger = logging.getLogger(__name__)

# Default DAG arguments
default_args = {
    'owner': 'ekg-team',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
    'execution_timeout': timedelta(minutes=45),
}

# DAG definition
dag = DAG(
    'ekg_ingest_pipeline',
    default_args=default_args,
    description='EKG official production data ingestion pipeline',
    schedule_interval='@daily',
    start_date=datetime(2025, 12, 15),
    catchup=False,
    tags=['ekg', 'rdf', 'production'],
)


def encode_graph_uri(uri: str) -> str:
    """URL-encode graph URI for GraphDB REST API (# -> %23)"""
    return quote(uri, safe='')


def upload_to_graph(file_path: str, graph_uri: str, context_label: str):
    """
    Upload RDF file to specific named graph in GraphDB
    Uses internal Docker network URL (graphdb:7200)
    """
    encoded_graph = encode_graph_uri(graph_uri)
    url = f"{GRAPHDB_URL}/repositories/{REPO_ID}/rdf-graphs/service?graph={encoded_graph}"

    logger.info(f"Uploading {file_path} to graph {graph_uri}")
    logger.info(f"URL: {url}")

    with open(file_path, 'rb') as f:
        headers = {'Content-Type': 'text/turtle'}
        response = requests.post(url, data=f, headers=headers)

    if response.status_code not in [200, 201, 204]:
        raise AirflowException(
            f"Failed to upload {context_label}: {response.status_code} - {response.text}"
        )

    logger.info(f"Successfully uploaded {context_label}")


def task_extract_csv(**context):
    """
    Task 1: Extract and validate CSV source files
    Checks that all required CSV files exist and are readable
    """
    logger.info("Starting CSV extraction and validation")

    seed_path = Path(SEED_DIR)
    if not seed_path.exists():
        raise AirflowException(f"Seed directory not found: {SEED_DIR}")

    required_files = [
        "orgunits.csv",
        "persons.csv",
        "products.csv",
        "projects.csv",
        "assets.csv"
    ]

    found_files = []
    missing_files = []

    for csv_file in required_files:
        csv_path = seed_path / csv_file
        if csv_path.exists():
            row_count = sum(1 for _ in open(csv_path)) - 1  # Exclude header
            logger.info(f"Found {csv_file}: {row_count} rows")
            found_files.append({"file": csv_file, "rows": row_count})
        else:
            logger.warning(f"Missing {csv_file}")
            missing_files.append(csv_file)

    if missing_files:
        raise AirflowException(f"Missing required CSV files: {missing_files}")

    # Push metadata to XCom
    context['task_instance'].xcom_push(key='csv_files', value=found_files)
    context['task_instance'].xcom_push(key='file_count', value=len(found_files))

    logger.info(f"CSV extraction complete: {len(found_files)} files found")
    return {"status": "success", "files": len(found_files)}


def task_transform_csv_to_rdf(**context):
    """
    Task 2: Transform CSV to RDF using csv_to_rdf.py
    Generates TTL files in output directory
    """
    import subprocess

    logger.info("Starting CSV to RDF transformation")

    run_id = context['dag_run'].run_id
    job_id = f"airflow_{run_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    # Clear old TTL files
    for old_file in output_path.glob("*.ttl"):
        old_file.unlink()
        logger.info(f"Removed old output file: {old_file.name}")

    # Run csv_to_rdf.py script
    cmd = [
        "python3",
        f"{SCRIPTS_DIR}/csv_to_rdf.py",
        SEED_DIR,
        OUTPUT_DIR,
        job_id
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.error(f"CSV to RDF conversion failed: {result.stderr}")
        raise AirflowException(f"CSV to RDF conversion failed: {result.stderr}")

    logger.info(f"Conversion output:\n{result.stdout}")

    # Verify generated TTL files
    ttl_files = list(output_path.glob("*.ttl"))
    if len(ttl_files) == 0:
        raise AirflowException("No TTL files were generated")

    logger.info(f"Generated {len(ttl_files)} TTL files in {OUTPUT_DIR}")

    context['task_instance'].xcom_push(key='ttl_files', value=[str(f) for f in ttl_files])
    context['task_instance'].xcom_push(key='job_id', value=job_id)

    return {"status": "success", "files": len(ttl_files), "output_dir": OUTPUT_DIR}


def task_verify_graphdb_endpoint(**context):
    """
    Task 3: Verify GraphDB is accessible and responding
    Tests connection before proceeding with uploads
    """
    logger.info(f"Verifying GraphDB endpoint: {GRAPHDB_URL}")

    try:
        # Test /rest/repositories endpoint
        response = requests.get(f"{GRAPHDB_URL}/rest/repositories", timeout=10)
        if response.status_code != 200:
            raise AirflowException(f"GraphDB returned status {response.status_code}")

        logger.info("GraphDB endpoint is accessible")

        # Verify repository exists
        repos = response.json()
        repo_ids = [r['id'] for r in repos]

        if REPO_ID not in repo_ids:
            logger.warning(f"Repository '{REPO_ID}' not found in: {repo_ids}")
            logger.warning("Will attempt to create repository in next task")
        else:
            logger.info(f"Repository '{REPO_ID}' exists")

        return {"status": "success", "endpoint": GRAPHDB_URL}

    except requests.exceptions.RequestException as e:
        raise AirflowException(f"Cannot reach GraphDB at {GRAPHDB_URL}: {e}")


def task_ensure_repository_exists(**context):
    """
    Task 4: Ensure EKG repository exists in GraphDB
    Creates repository if it doesn't exist
    """
    logger.info(f"Ensuring repository '{REPO_ID}' exists")

    # Check if repository exists
    response = requests.get(f"{GRAPHDB_URL}/rest/repositories")
    repos = response.json()
    repo_ids = [r['id'] for r in repos]

    if REPO_ID in repo_ids:
        logger.info(f"Repository '{REPO_ID}' already exists")
        return {"status": "exists", "repo": REPO_ID}

    # Create repository
    logger.info(f"Creating repository '{REPO_ID}'")

    # Repository configuration (GraphDB-free compatible)
    repo_config = f"""
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
    @prefix rep: <http://www.openrdf.org/config/repository#>.
    @prefix sr: <http://www.openrdf.org/config/repository/sail#>.
    @prefix sail: <http://www.openrdf.org/config/sail#>.
    @prefix graphdb: <http://www.ontotext.com/config/graphdb#>.

    [] a rep:Repository ;
        rep:repositoryID "{REPO_ID}" ;
        rdfs:label "EKG Repository" ;
        rep:repositoryImpl [
            rep:repositoryType "graphdb:FreeSailRepository" ;
            sr:sailImpl [
                sail:sailType "graphdb:FreeSail"
            ]
        ].
    """

    headers = {'Content-Type': 'text/turtle'}
    response = requests.post(
        f"{GRAPHDB_URL}/rest/repositories",
        data=repo_config,
        headers=headers
    )

    if response.status_code not in [200, 201]:
        raise AirflowException(f"Failed to create repository: {response.status_code} - {response.text}")

    logger.info(f"Successfully created repository '{REPO_ID}'")
    return {"status": "created", "repo": REPO_ID}


def task_upload_ontologies(**context):
    """
    Task 5: Upload ontology files to ontology graph
    CRITICAL: Must upload in dependency order!
    Order: core -> temporal -> provenance -> relations -> security
    """
    logger.info("Uploading ontologies to graph: " + ONTOLOGY_GRAPH)

    ontology_path = Path(ONTOLOGY_DIR)
    if not ontology_path.exists():
        raise AirflowException(f"Ontology directory not found: {ONTOLOGY_DIR}")

    uploaded_count = 0

    for onto_file in ONTOLOGY_FILES:
        file_path = ontology_path / onto_file

        if not file_path.exists():
            raise AirflowException(f"Required ontology file missing: {onto_file}")

        logger.info(f"[{uploaded_count + 1}/{len(ONTOLOGY_FILES)}] Uploading {onto_file}")
        upload_to_graph(str(file_path), ONTOLOGY_GRAPH, f"ontology/{onto_file}")
        uploaded_count += 1

    logger.info(f"Successfully uploaded {uploaded_count} ontology files")
    context['task_instance'].xcom_push(key='ontology_count', value=uploaded_count)

    return {"status": "success", "files": uploaded_count}


def task_upload_shacl_shapes(**context):
    """
    Task 6: Upload SHACL shapes to special SHACL graph
    Graph: http://rdf4j.org/schema/rdf4j#SHACLShapeGraph
    Note: This graph cannot be queried - it's used only for validation
    """
    logger.info("Uploading SHACL shapes to: " + SHACL_GRAPH)

    shacl_path = Path(SHACL_DIR)
    if not shacl_path.exists():
        raise AirflowException(f"SHACL directory not found: {SHACL_DIR}")

    uploaded_count = 0

    for shacl_file in SHACL_FILES:
        file_path = shacl_path / shacl_file

        if not file_path.exists():
            logger.warning(f"SHACL file not found (skipping): {shacl_file}")
            continue

        logger.info(f"[{uploaded_count + 1}] Uploading {shacl_file}")
        upload_to_graph(str(file_path), SHACL_GRAPH, f"shacl/{shacl_file}")
        uploaded_count += 1

    logger.info(f"Successfully uploaded {uploaded_count} SHACL shape files")
    context['task_instance'].xcom_push(key='shacl_count', value=uploaded_count)

    return {"status": "success", "files": uploaded_count}


def task_upload_data(**context):
    """
    Task 7: Upload generated data to data graph
    CRITICAL: Must upload in dependency order!
    Order: orgunits -> persons -> products -> projects -> assets
    """
    logger.info("Uploading data to graph: " + DATA_GRAPH)

    data_path = Path(OUTPUT_DIR)
    if not data_path.exists():
        raise AirflowException(f"Data directory not found: {OUTPUT_DIR}")

    uploaded_count = 0

    for data_file in DATA_FILES:
        file_path = data_path / data_file

        if not file_path.exists():
            raise AirflowException(f"Required data file missing: {data_file}")

        logger.info(f"[{uploaded_count + 1}/{len(DATA_FILES)}] Uploading {data_file}")
        upload_to_graph(str(file_path), DATA_GRAPH, f"data/{data_file}")
        uploaded_count += 1

    logger.info(f"Successfully uploaded {uploaded_count} data files")
    context['task_instance'].xcom_push(key='data_count', value=uploaded_count)

    return {"status": "success", "files": uploaded_count}


def task_sanity_checks(**context):
    """
    Task 8: Run sanity checks (SPARQL queries on data graph)
    Note: Cannot query SHACL graph - only data and ontology graphs
    """
    import subprocess

    logger.info("Starting sanity checks on data graph")

    cmd = [
        "bash",
        f"{SCRIPTS_DIR}/run_sanity_checks.sh",
        REPO_ID,
        GRAPHDB_URL
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    logger.info(f"Sanity checks output:\n{result.stdout}")

    if result.returncode != 0:
        logger.error(f"Sanity checks FAILED:\n{result.stderr}")
        raise AirflowException(f"Sanity checks failed: {result.stderr}")

    logger.info("All sanity checks PASSED")

    return {"status": "success"}


def task_collect_metrics(**context):
    """
    Task 9: Collect pipeline metrics
    Gathers statistics about the ingestion run
    """
    logger.info("Collecting pipeline metrics")

    # Get upstream task data
    ti = context['task_instance']
    csv_count = ti.xcom_pull(task_ids='extract_csv', key='file_count') or 0
    ontology_count = ti.xcom_pull(task_ids='upload_ontologies', key='ontology_count') or 0
    shacl_count = ti.xcom_pull(task_ids='upload_shacl_shapes', key='shacl_count') or 0
    data_count = ti.xcom_pull(task_ids='upload_data', key='data_count') or 0
    job_id = ti.xcom_pull(task_ids='transform_csv_to_rdf', key='job_id') or 'unknown'

    metrics = {
        "job_id": job_id,
        "run_id": context['dag_run'].run_id,
        "csv_files_processed": csv_count,
        "ontology_files_uploaded": ontology_count,
        "shacl_files_uploaded": shacl_count,
        "data_files_uploaded": data_count,
        "sanity_checks": "PASSED",
        "timestamp": datetime.utcnow().isoformat(),
        "graphs": {
            "ontology": ONTOLOGY_GRAPH,
            "data": DATA_GRAPH,
            "shacl": SHACL_GRAPH
        }
    }

    logger.info(f"Pipeline Metrics: {json.dumps(metrics, indent=2)}")

    context['task_instance'].xcom_push(key='metrics', value=metrics)

    return metrics


def task_quality_monitor(**context):
    """
    Task 10: Quality monitoring
    Runs quality checks on data graph and pushes metrics to Prometheus
    Note: Cannot include SHACL validation queries (SHACL graph is not queryable)
    """
    import subprocess

    logger.info("Starting quality monitoring")

    cmd = [
        "python3",
        f"{SCRIPTS_DIR}/quality_monitor.py",
        "--url", GRAPHDB_URL,
        "--repo", REPO_ID,
        "--graph", DATA_GRAPH,
        "--pushgateway", "http://pushgateway:9091",
        "--job", "ekg_quality_monitor",
        "--output", f"{OUTPUT_DIR}/quality_report.json"
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    logger.info(f"Quality monitor output:\n{result.stdout}")

    if result.returncode != 0:
        logger.warning(f"Quality monitor returned warnings:\n{result.stderr}")

    # Parse quality report
    try:
        report_path = Path(f"{OUTPUT_DIR}/quality_report.json")
        if report_path.exists():
            with open(report_path, 'r') as f:
                quality_report = json.load(f)

            logger.info(f"Quality Report Summary:")
            logger.info(f"  Quality Score: {quality_report.get('metrics', {}).get('quality_score', 'N/A')}")

            context['task_instance'].xcom_push(key='quality_score', value=quality_report.get('metrics', {}).get('quality_score'))
            context['task_instance'].xcom_push(key='quality_status', value=quality_report.get('status'))

            return quality_report
    except Exception as e:
        logger.warning(f"Could not parse quality report: {e}")

    return {"status": "completed"}


# Task definitions
extract_task = PythonOperator(
    task_id='extract_csv',
    python_callable=task_extract_csv,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_csv_to_rdf',
    python_callable=task_transform_csv_to_rdf,
    dag=dag,
)

verify_endpoint_task = PythonOperator(
    task_id='verify_graphdb_endpoint',
    python_callable=task_verify_graphdb_endpoint,
    dag=dag,
)

ensure_repo_task = PythonOperator(
    task_id='ensure_repository_exists',
    python_callable=task_ensure_repository_exists,
    dag=dag,
)

upload_ontologies_task = PythonOperator(
    task_id='upload_ontologies',
    python_callable=task_upload_ontologies,
    dag=dag,
)

upload_shacl_task = PythonOperator(
    task_id='upload_shacl_shapes',
    python_callable=task_upload_shacl_shapes,
    dag=dag,
)

upload_data_task = PythonOperator(
    task_id='upload_data',
    python_callable=task_upload_data,
    dag=dag,
)

sanity_task = PythonOperator(
    task_id='sanity_checks',
    python_callable=task_sanity_checks,
    dag=dag,
)

metrics_task = PythonOperator(
    task_id='collect_metrics',
    python_callable=task_collect_metrics,
    dag=dag,
)

quality_monitor_task = PythonOperator(
    task_id='quality_monitor',
    python_callable=task_quality_monitor,
    dag=dag,
)

# Task dependencies - CRITICAL ORDER ENFORCED
# 1. Extract CSV
# 2. Transform to RDF
# 3. Verify GraphDB is accessible
# 4. Ensure repository exists
# 5. Upload ontologies (in order)
# 6. Upload SHACL shapes
# 7. Upload data (in order)
# 8. Run sanity checks
# 9. Collect metrics
# 10. Quality monitoring

extract_task >> transform_task >> verify_endpoint_task >> ensure_repo_task >> upload_ontologies_task >> upload_shacl_task >> upload_data_task >> sanity_task >> metrics_task >> quality_monitor_task
