import { Resolver, Query, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Person, PersonConnection } from '../models/person.model';
import { OrgUnit } from '../models/orgunit.model';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SecurityClearanceGuard } from '../../auth/security-clearance.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Resolver(() => Person)
@UseGuards(JwtAuthGuard, RolesGuard, SecurityClearanceGuard)
export class PersonResolver {
  constructor(private readonly sparqlService: SparqlService) {}

  @Query(() => PersonConnection, { name: 'persons' })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getPersons(
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @Args('searchTerm', { nullable: true }) searchTerm?: string,
    @CurrentUser() user?: any,
  ): Promise<PersonConnection> {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?id ?fullName ?email ?role ?orgUnitId ?label ?validFrom ?validTo
             ?trustScore ?source ?generatedAt
      WHERE {
        ?id a ex:Person ;
            ex:fullName ?fullName ;
            ex:email ?email .
        OPTIONAL { ?id ex:role ?role }
        OPTIONAL { ?id ex:worksFor ?orgUnitId }
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:validFrom ?validFrom }
        OPTIONAL { ?id ex:validTo ?validTo }
        OPTIONAL { ?id ex:trustScore ?trustScore }
        OPTIONAL { ?id prov:wasDerivedFrom ?source }
        OPTIONAL { ?id prov:generatedAtTime ?generatedAt }
        ${searchTerm ? `FILTER(CONTAINS(LCASE(?fullName), LCASE("${searchTerm}")) || CONTAINS(LCASE(?email), LCASE("${searchTerm}")))` : ''}
      }
      ORDER BY ?fullName
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const results = await this.sparqlService.executeQuery(query, user);

    const persons: Person[] = results.map((row: any) => ({
      id: row.id.value,
      fullName: row.fullName.value,
      email: row.email.value,
      role: row.role?.value,
      worksFor: row.orgUnitId ? { id: row.orgUnitId.value } as any : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
      source: row.source?.value,
      generatedAt: row.generatedAt?.value,
    }));

    const countQuery = `
      PREFIX ex: <http://example.com/schema#>
      SELECT (COUNT(?id) AS ?count)
      WHERE {
        ?id a ex:Person .
        ${searchTerm ? `?id ex:fullName ?fullName . FILTER(CONTAINS(LCASE(?fullName), LCASE("${searchTerm}")))` : ''}
      }
    `;
    const countResults = await this.sparqlService.executeQuery(countQuery, user);
    const totalCount = parseInt(countResults[0]?.count?.value || '0');

    return {
      nodes: persons,
      totalCount,
      pageInfo: {
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
        startCursor: offset.toString(),
        endCursor: (offset + persons.length).toString(),
      },
    };
  }

  @Query(() => Person, { name: 'person', nullable: true })
  @Roles('viewer', 'curator', 'steward', 'admin')
  async getPerson(
    @Args('id') id: string,
    @CurrentUser() user?: any,
  ): Promise<Person | null> {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?fullName ?email ?role ?orgUnitId ?label ?validFrom ?validTo
             ?trustScore ?source ?generatedAt
      WHERE {
        <${id}> a ex:Person ;
                ex:fullName ?fullName ;
                ex:email ?email .
        OPTIONAL { <${id}> ex:role ?role }
        OPTIONAL { <${id}> ex:worksFor ?orgUnitId }
        OPTIONAL { <${id}> ex:label ?label }
        OPTIONAL { <${id}> ex:validFrom ?validFrom }
        OPTIONAL { <${id}> ex:validTo ?validTo }
        OPTIONAL { <${id}> ex:trustScore ?trustScore }
        OPTIONAL { <${id}> prov:wasDerivedFrom ?source }
        OPTIONAL { <${id}> prov:generatedAtTime ?generatedAt }
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id,
      fullName: row.fullName.value,
      email: row.email.value,
      role: row.role?.value,
      worksFor: row.orgUnitId ? { id: row.orgUnitId.value } as any : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
      source: row.source?.value,
      generatedAt: row.generatedAt?.value,
    };
  }

  @ResolveField('worksFor', () => OrgUnit, { nullable: true })
  async getWorksFor(
    @Parent() person: Person,
    @CurrentUser() user?: any,
  ): Promise<OrgUnit | null> {
    if (!person.worksFor?.id) return null;

    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?name ?parentUnitId ?label
      WHERE {
        <${person.worksFor.id}> a ex:OrgUnit ;
                                 ex:name ?name .
        OPTIONAL { <${person.worksFor.id}> ex:parentUnit ?parentUnitId }
        OPTIONAL { <${person.worksFor.id}> ex:label ?label }
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: person.worksFor.id,
      name: row.name.value,
      parentUnit: row.parentUnitId ? { id: row.parentUnitId.value } as any : null,
      label: row.label?.value,
    };
  }
}
