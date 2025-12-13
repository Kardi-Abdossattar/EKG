import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth()
@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Get()
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all products' })
  @ApiResponse({ status: 200, description: 'List of products retrieved successfully' })
  async getProducts(@CurrentUser() user?: any) {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?description ?price ?category ?label ?trustScore
      WHERE {
        ?id a ex:Product ;
            ex:name ?name .
        OPTIONAL { ?id ex:description ?description }
        OPTIONAL { ?id ex:price ?price }
        OPTIONAL { ?id ex:category ?category }
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:trustScore ?trustScore }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return {
      data: results.map((row: any) => ({
        id: row.id.value,
        name: row.name.value,
        description: row.description?.value,
        price: row.price ? parseFloat(row.price.value) : null,
        category: row.category?.value,
        label: row.label?.value,
        trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
      })),
      count: results.length,
    };
  }
}
