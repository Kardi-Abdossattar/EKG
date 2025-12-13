import { Resolver, Query, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrgUnit, OrgUnitConnection } from '../models/orgunit.model';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Resolver(() => OrgUnit)
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgUnitResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => OrgUnitConnection, { name: 'orgUnits' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getOrgUnits(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @CurrentUser() user?: any,
  ): Promise<OrgUnitConnection> {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?id ?name ?parentUnitId ?label ?validFrom ?validTo ?source
      WHERE {
        ?id a ex:OrgUnit ;
            ex:name ?name .
        OPTIONAL { ?id ex:parentUnit ?parentUnitId }
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:validFrom ?validFrom }
        OPTIONAL { ?id ex:validTo ?validTo }
        OPTIONAL { ?id prov:wasDerivedFrom ?source }
      }
      ORDER BY ?name
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const results = await this.sparqlService.executeQuery(query, user);

    const orgUnits: OrgUnit[] = results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      parentUnit: row.parentUnitId ? { id: row.parentUnitId.value } as any : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      source: row.source?.value,
    }));

    const countQuery = `
      PREFIX ex: <http://example.com/schema#>
      SELECT (COUNT(?id) AS ?count)
      WHERE { ?id a ex:OrgUnit . }
    `;
    const countResults = await this.sparqlService.executeQuery(countQuery, user);
    const totalCount = parseInt(countResults[0]?.count?.value || '0');

    return {
      nodes: orgUnits,
      totalCount,
    };
  }

  @Query(() => OrgUnit, { name: 'orgUnit', nullable: true })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getOrgUnit(
    @Args('id') id: string,
    @CurrentUser() user?: any,
  ): Promise<OrgUnit | null> {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?name ?parentUnitId ?label ?validFrom ?validTo ?source
      WHERE {
        <${id}> a ex:OrgUnit ;
                ex:name ?name .
        OPTIONAL { <${id}> ex:parentUnit ?parentUnitId }
        OPTIONAL { <${id}> ex:label ?label }
        OPTIONAL { <${id}> ex:validFrom ?validFrom }
        OPTIONAL { <${id}> ex:validTo ?validTo }
        OPTIONAL { <${id}> prov:wasDerivedFrom ?source }
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id,
      name: row.name.value,
      parentUnit: row.parentUnitId ? { id: row.parentUnitId.value } as any : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      source: row.source?.value,
    };
  }

  @ResolveField('parentUnit', () => OrgUnit, { nullable: true })
  async getParentUnit(
    @Parent() orgUnit: OrgUnit,
    @CurrentUser() user?: any,
  ): Promise<OrgUnit | null> {
    if (!orgUnit.parentUnit?.id) return null;

    return this.getOrgUnit(orgUnit.parentUnit.id, user);
  }

  @ResolveField('childUnits', () => [OrgUnit])
  async getChildUnits(
    @Parent() orgUnit: OrgUnit,
    @CurrentUser() user?: any,
  ): Promise<OrgUnit[]> {
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?label
      WHERE {
        ?id a ex:OrgUnit ;
            ex:name ?name ;
            ex:parentUnit <${orgUnit.id}> .
        OPTIONAL { ?id ex:label ?label }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      label: row.label?.value,
    }));
  }

  @Query(() => [OrgUnit], { name: 'orgUnitHierarchy' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getOrgUnitHierarchy(
    @Args('rootId', { nullable: true }) rootId?: string,
    @CurrentUser() user?: any,
  ): Promise<OrgUnit[]> {
    const query = rootId
      ? `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?parentUnitId ?label
      WHERE {
        <${rootId}> ex:parentUnit* ?id .
        ?id a ex:OrgUnit ;
            ex:name ?name .
        OPTIONAL { ?id ex:parentUnit ?parentUnitId }
        OPTIONAL { ?id ex:label ?label }
      }
      ORDER BY ?name
    `
      : `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?id ?name ?parentUnitId ?label
      WHERE {
        ?id a ex:OrgUnit ;
            ex:name ?name .
        OPTIONAL { ?id ex:parentUnit ?parentUnitId }
        OPTIONAL { ?id ex:label ?label }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return results.map((row: any) => ({
      id: row.id.value,
      name: row.name.value,
      parentUnit: row.parentUnitId ? { id: row.parentUnitId.value } as any : null,
      label: row.label?.value,
    }));
  }
}
