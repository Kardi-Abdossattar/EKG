import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('trust-score')
@ApiBearerAuth()
@Controller('api/v1/trust-score')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrustScoreController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Get('stats')
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get trust score statistics' })
  @ApiResponse({ status: 200, description: 'Trust score statistics' })
  async getTrustScoreStats(@CurrentUser() user?: any) {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT (AVG(?score) AS ?avg) (MIN(?score) AS ?min) (MAX(?score) AS ?max) (COUNT(?score) AS ?count)
      WHERE {
        ?entity ex:trustScore ?score .
      }
    `;

    const lowConfidenceQuery = `
      PREFIX ex: <http://example.com/schema#>

      SELECT (COUNT(?entity) AS ?count)
      WHERE {
        ?entity ex:trustScore ?score .
        FILTER(?score < 0.3)
      }
    `;

    const highConfidenceQuery = `
      PREFIX ex: <http://example.com/schema#>

      SELECT (COUNT(?entity) AS ?count)
      WHERE {
        ?entity ex:trustScore ?score .
        FILTER(?score >= 0.8)
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    const lowConfResults = await this.sparqlService.executeQuery(lowConfidenceQuery, user);
    const highConfResults = await this.sparqlService.executeQuery(highConfidenceQuery, user);

    const row = results[0];
    return {
      average: row?.avg ? parseFloat(row.avg.value) : 0,
      min: row?.min ? parseFloat(row.min.value) : 0,
      max: row?.max ? parseFloat(row.max.value) : 0,
      totalCount: row?.count ? parseInt(row.count.value) : 0,
      lowConfidenceCount: lowConfResults[0]?.count ? parseInt(lowConfResults[0].count.value) : 0,
      highConfidenceCount: highConfResults[0]?.count ? parseInt(highConfResults[0].count.value) : 0,
    };
  }

  @Get('low-confidence')
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get entities with low trust score (< 0.3)' })
  @ApiResponse({ status: 200, description: 'List of low-confidence entities' })
  async getLowConfidenceEntities(@CurrentUser() user?: any) {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?type ?label ?trustScore ?email ?fullName ?name
      WHERE {
        ?id ex:trustScore ?trustScore .
        ?id a ?type .
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:email ?email }
        OPTIONAL { ?id ex:fullName ?fullName }
        OPTIONAL { ?id ex:name ?name }
        FILTER(?trustScore < 0.3)
      }
      ORDER BY ?trustScore
      LIMIT 50
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return {
      data: results.map((row: any) => ({
        id: row.id.value,
        type: row.type.value.split('#').pop() || row.type.value,
        label: row.label?.value,
        trustScore: parseFloat(row.trustScore.value),
        email: row.email?.value,
        fullName: row.fullName?.value,
        name: row.name?.value,
      })),
      count: results.length,
    };
  }
}
