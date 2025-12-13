"""
EKG Ingestion DAG - SIMPLIFIED VERSION
Automated pipeline for extracting, transforming, validating, and monitoring RDF data

Pipeline Steps (MANUAL GRAPHDB IMPORT REQUIRED):
1. Extract CSV from seed/ directory
2. Transform CSV to RDF using csv_to_rdf.py script
3. SHACL validation on generated RDF files
4. Sanity checks via SPARQL queries
5. Quality monitoring and metrics collection

NOTE: GraphDB import must be done manually via UI (no automated scripts)

Author: EKG Team
Date: 2025-12-12 (Simplified)
"""
from datetime import datetime, timedelta
from pathlib import Path
import logging
import json

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.exceptions import AirflowException
from airflow.models import Variable

# Configuration
GRAPHDB_URL = Variable.get("GRAPHDB_URL", default_var="http://graphdb:7200")
REPO_ID = Variable.get("GRAPHDB_REPO", default_var="ekg")
SEED_DIR = "/opt/airflow/seed"
OUTPUT_DIR = "/opt/airflow/data/generated"  # Generated RDF files (for manual import)
SCRIPTS_DIR = "/opt/airflow/scripts"

MAIN_GRAPH = "http://example.com/data"
ONTOLOGY_GRAPH = "http://example.com/ontology"

logger = logging.getLogger(__name__)

# Default DAG arguments
default_args = {
    'owner': 'ekg-team',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=1),
    'execution_timeout': timedelta(minutes=30),
}

# DAG definition
dag = DAG(
    'ekg_ingest_pipeline',
    default_args=default_args,
    description='EKG automated data transformation and validation pipeline (manual import to GraphDB)',
    schedule_interval='@daily',
    start_date=datetime(2025, 12, 12),
    catchup=False,
    tags=['ekg', 'rdf', 'shacl'],
)


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
        logger.warning(f"Missing files: {missing_files}")

    # Push metadata to XCom
    context['task_instance'].xcom_push(key='csv_files', value=found_files)
    context['task_instance'].xcom_push(key='file_count', value=len(found_files))

    logger.info(f"CSV extraction complete: {len(found_files)} files found")
    return {"status": "success", "files": len(found_files)}


def task_transform_csv_to_rdf(**context):
    """
    Task 2: Transform CSV to RDF using csv_to_rdf.py
    Generates TTL files in output directory (MUST be manually imported to GraphDB)
    """
    import subprocess

    logger.info("Starting CSV to RDF transformation")

    run_id = context['dag_run'].run_id
    job_id = f"airflow_{run_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    # Clear output directory
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

    # Count generated TTL files
    ttl_files = list(output_path.glob("*.ttl"))
    logger.info(f"Generated {len(ttl_files)} TTL files in {OUTPUT_DIR}")

    logger.warning("=" * 80)
    logger.warning("MANUAL ACTION REQUIRED:")
    logger.warning(f"Please import the generated TTL files from {OUTPUT_DIR}")
    logger.warning("to GraphDB repository 'ekg' using the GraphDB UI (http://localhost:7200)")
    logger.warning("=" * 80)

    context['task_instance'].xcom_push(key='ttl_files', value=[str(f) for f in ttl_files])
    context['task_instance'].xcom_push(key='job_id', value=job_id)

    return {"status": "success", "files": len(ttl_files), "output_dir": OUTPUT_DIR}


def task_validate_shacl(**context):
    """
    Task 3: Run SHACL validation on GraphDB repository
    Validates that data conforms to SHACL shapes
    """
    import subprocess

    logger.info("Starting SHACL validation")

    cmd = [
        "python3",
        f"{SCRIPTS_DIR}/validate_shacl.py",
        "--repo", REPO_ID,
        "--url", GRAPHDB_URL,
        "-v"
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    logger.info(f"SHACL validation output:\n{result.stdout}")

    if result.returncode != 0:
        logger.error(f"SHACL validation FAILED:\n{result.stderr}")
        raise AirflowException(f"SHACL validation failed: {result.stderr}")

    logger.info("SHACL validation PASSED")

    return {"status": "success", "violations": 0}


def task_sanity_checks(**context):
    """
    Task 4: Run sanity checks (SPARQL queries)
    Validates data integrity and consistency
    """
    import subprocess

    logger.info("Starting sanity checks")

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
    Task 5: Collect pipeline metrics
    Gathers statistics about the ingestion run
    """
    logger.info("Collecting pipeline metrics")

    # Get upstream task data
    ti = context['task_instance']
    csv_count = ti.xcom_pull(task_ids='extract_csv', key='file_count') or 0
    ttl_files = ti.xcom_pull(task_ids='transform_csv_to_rdf', key='ttl_files') or []
    job_id = ti.xcom_pull(task_ids='transform_csv_to_rdf', key='job_id') or 'unknown'

    metrics = {
        "job_id": job_id,
        "run_id": context['dag_run'].run_id,
        "csv_files_processed": csv_count,
        "ttl_files_generated": len(ttl_files),
        "shacl_validation": "PASSED",
        "sanity_checks": "PASSED",
        "timestamp": datetime.utcnow().isoformat()
    }

    logger.info(f"Pipeline Metrics: {json.dumps(metrics, indent=2)}")

    context['task_instance'].xcom_push(key='metrics', value=metrics)

    return metrics


def task_quality_monitor(**context):
    """
    Task 6: Quality monitoring
    Runs quality checks and pushes metrics to Prometheus
    """
    import subprocess

    logger.info("Starting quality monitoring")

    cmd = [
        "python3",
        f"{SCRIPTS_DIR}/quality_monitor.py",
        "--url", GRAPHDB_URL,
        "--repo", REPO_ID,
        "--graph", MAIN_GRAPH,
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
            logger.info(f"  SHACL Violations: {quality_report.get('metrics', {}).get('shacl_violations', 'N/A')}")

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

validate_task = PythonOperator(
    task_id='shacl_validation',
    python_callable=task_validate_shacl,
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

# Task dependencies (simplified pipeline flow)
# NOTE: Manual GraphDB import required between transform_task and validate_task
extract_task >> transform_task >> validate_task >> sanity_task >> metrics_task >> quality_monitor_task
