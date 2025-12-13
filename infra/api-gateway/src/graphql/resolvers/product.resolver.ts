import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Product } from '../models/product.model';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Resolver(() => Product)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => [Product], { name: 'products' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getProducts(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @CurrentUser() user?: any,
  ): Promise<Product[]> {
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
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      description: row.description?.value,
      price: row.price ? parseFloat(row.price.value) : null,
      category: row.category?.value,
      label: row.label?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
    }));
  }

  @Query(() => Product, { name: 'product', nullable: true })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getProduct(
    @Args('id') id: string,
    @CurrentUser() user?: any,
  ): Promise<Product | null> {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?name ?description ?price ?category ?label ?trustScore
      WHERE {
        <${id}> a ex:Product ;
                ex:name ?name .
        OPTIONAL { <${id}> ex:description ?description }
        OPTIONAL { <${id}> ex:price ?price }
        OPTIONAL { <${id}> ex:category ?category }
        OPTIONAL { <${id}> ex:label ?label }
        OPTIONAL { <${id}> ex:trustScore ?trustScore }
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id,
      name: row.name.value,
      description: row.description?.value,
      price: row.price ? parseFloat(row.price.value) : null,
      category: row.category?.value,
      label: row.label?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
    };
  }
}
