import { Resolver, Query, Args, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
class TrustScoreStats {
  @Field(() => Float)
  average: number;

  @Field(() => Float)
  min: number;

  @Field(() => Float)
  max: number;

  @Field()
  count: number;

  @Field()
  lowConfidenceCount: number;
}

@ObjectType()
class QuarantineEntity {
  @Field()
  id: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  label?: string;

  @Field()
  violationMessage: string;
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrustScoreResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => TrustScoreStats, { name: 'trustScoreStats' })
  @Roles('curator', 'steward', 'admin')
  async getTrustScoreStats(@CurrentUser() user?: any): Promise<TrustScoreStats> {
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

    const results = await this.sparqlService.executeQuery(query, user);
    const lowConfResults = await this.sparqlService.executeQuery(lowConfidenceQuery, user);

    const row = results[0];
    return {
      average: row?.avg ? parseFloat(row.avg.value) : 0,
      min: row?.min ? parseFloat(row.min.value) : 0,
      max: row?.max ? parseFloat(row.max.value) : 0,
      count: row?.count ? parseInt(row.count.value) : 0,
      lowConfidenceCount: lowConfResults[0]?.count ? parseInt(lowConfResults[0].count.value) : 0,
    };
  }

  @Query(() => [QuarantineEntity], { name: 'quarantineEntities' })
  @Roles('curator', 'steward', 'admin')
  async getQuarantineEntities(@CurrentUser() user?: any): Promise<QuarantineEntity[]> {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX sh: <http://www.w3.org/ns/shacl#>

      SELECT DISTINCT ?id ?type ?label ?violationMessage
      FROM <http://example.com/quarantine>
      WHERE {
        ?id a ?type .
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL {
          ?validationReport sh:result ?result .
          ?result sh:focusNode ?id ;
                  sh:resultMessage ?violationMessage .
        }
      }
      LIMIT 50
    `;

    const results = await this.sparqlService.executeQueryRaw(query);
    return results.map((row: any) => ({
      id: row.id.value,
      type: row.type.value.split('#').pop() || row.type.value,
      label: row.label?.value,
      violationMessage: row.violationMessage?.value || 'SHACL validation failed',
    }));
  }
}
