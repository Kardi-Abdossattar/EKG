FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir requests neo4j

# Copy sync script
COPY sync.py /app/sync.py

CMD ["python", "-u", "/app/sync.py"]
