import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Asset } from '../models/product.model';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Resolver(() => Asset)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => [Asset], { name: 'assets' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getAssets(@CurrentUser() user?: any): Promise<Asset[]> {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?assetType ?location ?label
      WHERE {
        ?id a ex:Asset ;
            ex:name ?name .
        OPTIONAL { ?id ex:assetType ?assetType }
        OPTIONAL { ?id ex:location ?location }
        OPTIONAL { ?id ex:label ?label }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      assetType: row.assetType?.value,
      location: row.location?.value,
      label: row.label?.value,
    }));
  }
}
