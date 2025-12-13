import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import axios from 'axios';

/**
 * Health check controller
 * Vérifie la disponibilité de l'API et des dépendances critiques
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        graphdb: await this.checkGraphDB(),
        keycloak: await this.checkKeycloak(),
      },
    };

    const allHealthy = Object.values(health.dependencies).every(
      (dep: any) => dep.status === 'up',
    );

    return {
      ...health,
      status: allHealthy ? 'ok' : 'degraded',
    };
  }

  /**
   * Vérifie la disponibilité de GraphDB
   */
  private async checkGraphDB(): Promise<{ status: string; message?: string }> {
    try {
      const graphdbUrl = process.env.GRAPHDB_URL || 'http://graphdb:7200';
      const response = await axios.get(`${graphdbUrl}/rest/repositories`, {
        timeout: 5000,
      });

      return {
        status: response.status === 200 ? 'up' : 'down',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  /**
   * Vérifie la disponibilité de Keycloak
   * Note: En mode dev (start-dev), test sur le port HTTP standard 8080
   * En production avec management port, utiliser le port 9000
   */
  private async checkKeycloak(): Promise<{ status: string; message?: string }> {
    try {
      const healthUrl =
        process.env.KEYCLOAK_HEALTH_URL || 'http://keycloak:9000/health';

      const response = await axios.get(healthUrl, {
        timeout: 5000,
      });

      if (response.status === 200 && response.data.status === 'UP') {
        return { status: 'up' };
      }

      return { status: 'down', message: 'Unexpected response from Keycloak' };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

}
