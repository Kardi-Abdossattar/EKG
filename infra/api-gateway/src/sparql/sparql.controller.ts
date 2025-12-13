import { Controller, Post, Body, Query, UseInterceptors, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SparqlService } from './sparql.service';
import { CacheInterceptor } from '../cache/cache.interceptor';

class SparqlQueryDto {
  query: string;
  reasoning?: boolean;
  limit?: number;
  offset?: number;
}

@ApiTags('SPARQL')
@Controller('sparql')
export class SparqlController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Post('query')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Exécuter une requête SPARQL SELECT avec cache et pagination' })
  @ApiResponse({ status: 200, description: 'Résultats de la requête' })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 500, description: 'Erreur serveur' })
  async query(@Body() dto: SparqlQueryDto) {
    // Ajouter pagination si non présente
    let query = dto.query;
    const limit = dto.limit || 100;
    const offset = dto.offset || 0;

    // Injecter LIMIT/OFFSET si absent
    if (!query.toLowerCase().includes('limit')) {
      query = `${query.trim()} LIMIT ${limit}`;
    }
    if (offset > 0 && !query.toLowerCase().includes('offset')) {
      query = `${query.trim()} OFFSET ${offset}`;
    }

    return this.sparqlService.executeQuery(query, dto.reasoning);
  }

  @Post('update')
  @ApiOperation({ summary: 'Exécuter une requête SPARQL UPDATE (INSERT/DELETE)' })
  @ApiResponse({ status: 200, description: 'Mise à jour réussie' })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  async update(@Body() dto: { query: string }) {
    return this.sparqlService.executeUpdate(dto.query);
  }

  @Get('health')
  @ApiOperation({ summary: 'Vérifier la santé du endpoint SPARQL' })
  async health() {
    return this.sparqlService.checkHealth();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques de requêtes' })
  async stats() {
    return this.sparqlService.getStats();
  }
}
