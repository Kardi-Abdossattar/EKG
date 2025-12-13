import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Service de cache Redis pour optimiser les requêtes SPARQL
 * TEP-08_HARDEN_SCALE
 *
 * Stratégies:
 * - Cache LRU (Least Recently Used) avec TTL
 * - Invalidation automatique sur mutations
 * - Compression pour grandes réponses
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType;
  private isConnected = false;

  // Configuration TTL par défaut (5 minutes)
  private readonly DEFAULT_TTL = 300;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => MetricsService))
    private metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://redis:6379');

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis: Max reconnect attempts reached');
            return new Error('Max reconnect attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          this.logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis: Connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.logger.log('Redis: Ready to accept commands');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis: Reconnecting...');
      this.isConnected = false;
    });

    try {
      await this.client.connect();
      this.logger.log('Redis cache service initialized');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, cache miss');
      this.metricsService.recordCacheMiss();
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
        this.metricsService.recordCacheHit();
        return JSON.parse(value) as T;
      }
      this.logger.debug(`Cache MISS: ${key}`);
      this.metricsService.recordCacheMiss();
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.metricsService.recordCacheMiss();
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache avec TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds || this.DEFAULT_TTL;
      await this.client.setEx(key, ttl, serialized);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Supprime une clé du cache
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache del error for key ${key}:`, error);
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   * Utilisé pour invalidation après mutation
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      this.logger.log(`Cache invalidated: ${keys.length} keys matching "${pattern}"`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Cache delPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Vide tout le cache
   */
  async flush(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.flushDb();
      this.logger.log('Cache flushed');
    } catch (error) {
      this.logger.error('Cache flush error:', error);
    }
  }

  /**
   * Récupère les statistiques du cache
   */
  async getStats(): Promise<any> {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbSize();

      // Parse les stats Redis
      const stats: any = { connected: true, dbSize };
      info.split('\n').forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key.trim()] = value.trim();
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { connected: true, error: error.message };
    }
  }

  /**
   * Génère une clé de cache basée sur la requête SPARQL
   */
  generateKey(prefix: string, query: string, params?: any): string {
    const hash = this.simpleHash(query + JSON.stringify(params || {}));
    return `${prefix}:${hash}`;
  }

  /**
   * Hash simple pour générer des clés
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Vérifie si le cache est connecté
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
