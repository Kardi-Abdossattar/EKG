import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly requestCounter: Counter<string>;
  private readonly requestDuration: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly graphdbStatus: Gauge<string>;
  private readonly keycloakStatus: Gauge<string>;

  // Métriques cache Redis (TEP-08)
  private readonly cacheHits: Counter<string>;
  private readonly cacheMisses: Counter<string>;
  private readonly redisMemoryUsed: Gauge<string>;
  private readonly redisMemoryMax: Gauge<string>;

  constructor() {
    // Enable default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ prefix: 'api_gateway_' });

    // HTTP request counter (compatible dashboard Grafana)
    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'endpoint', 'status', 'job'],
      registers: [register],
    });

    // Request duration histogram (compatible dashboard Grafana)
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'endpoint', 'job'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [register],
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'api_active_connections',
      help: 'Number of active connections',
    });

    // GraphDB health status
    this.graphdbStatus = new Gauge({
      name: 'api_dependency_graphdb_status',
      help: 'GraphDB availability (1=up, 0=down)',
    });

    // Keycloak health status
    this.keycloakStatus = new Gauge({
      name: 'api_dependency_keycloak_status',
      help: 'Keycloak availability (1=up, 0=down)',
    });

    // Cache metrics (TEP-08)
    this.cacheHits = new Counter({
      name: 'redis_cache_hits_total',
      help: 'Total number of cache hits',
      registers: [register],
    });

    this.cacheMisses = new Counter({
      name: 'redis_cache_misses_total',
      help: 'Total number of cache misses',
      registers: [register],
    });

    this.redisMemoryUsed = new Gauge({
      name: 'redis_memory_used_bytes',
      help: 'Redis memory used in bytes',
      registers: [register],
    });

    this.redisMemoryMax = new Gauge({
      name: 'redis_memory_max_bytes',
      help: 'Redis max memory in bytes',
      registers: [register],
    });

    // Initialiser Redis max memory (512MB par défaut)
    this.redisMemoryMax.set(536870912); // 512MB en bytes
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  recordRequest(method: string, path: string, statusCode: number): void {
    this.requestCounter.inc({
      method,
      endpoint: path,
      status: statusCode.toString(),
      job: 'api-gateway',
    });
  }

  recordRequestDuration(
    method: string,
    path: string,
    durationSeconds: number,
  ): void {
    this.requestDuration.observe(
      { method, endpoint: path, job: 'api-gateway' },
      durationSeconds,
    );
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  setGraphDBStatus(isUp: boolean): void {
    this.graphdbStatus.set(isUp ? 1 : 0);
  }

  setKeycloakStatus(isUp: boolean): void {
    this.keycloakStatus.set(isUp ? 1 : 0);
  }

  // Méthodes cache (TEP-08)
  recordCacheHit(): void {
    this.cacheHits.inc();
  }

  recordCacheMiss(): void {
    this.cacheMisses.inc();
  }

  setRedisMemoryUsed(bytes: number): void {
    this.redisMemoryUsed.set(bytes);
  }

  setRedisMemoryMax(bytes: number): void {
    this.redisMemoryMax.set(bytes);
  }
}
