import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Project } from '../models/product.model';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Resolver(() => Project)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => [Project], { name: 'projects' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getProjects(@CurrentUser() user?: any): Promise<Project[]> {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?description ?status ?startDate ?endDate
      WHERE {
        ?id a ex:Project ;
            ex:name ?name .
        OPTIONAL { ?id ex:description ?description }
        OPTIONAL { ?id ex:status ?status }
        OPTIONAL { ?id ex:startDate ?startDate }
        OPTIONAL { ?id ex:endDate ?endDate }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      description: row.description?.value,
      status: row.status?.value,
      startDate: row.startDate?.value,
      endDate: row.endDate?.value,
    }));
  }
}
