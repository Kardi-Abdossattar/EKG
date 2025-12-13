import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('orgunits')
@ApiBearerAuth()
@Controller('api/v1/orgunits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgUnitController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Get()
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all organizational units' })
  @ApiQuery({ name: 'includeHierarchy', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of OrgUnits retrieved successfully' })
  async getOrgUnits(
    @Query('includeHierarchy') includeHierarchy: boolean = false,
    @CurrentUser() user?: any,
  ) {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?id ?name ?parentUnitId ?parentUnitName ?label ?validFrom ?validTo ?source
      WHERE {
        ?id a ex:OrgUnit ;
            ex:name ?name .
        OPTIONAL {
          ?id ex:parentUnit ?parentUnitId .
          ?parentUnitId ex:name ?parentUnitName .
        }
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:validFrom ?validFrom }
        OPTIONAL { ?id ex:validTo ?validTo }
        OPTIONAL { ?id prov:wasDerivedFrom ?source }
      }
      ORDER BY ?name
    `;

    const results = await this.sparqlService.executeQuery(query, user);

    const orgUnitsMap = new Map();
    results.forEach((row: any) => {
      const id = row.id.value;
      if (!orgUnitsMap.has(id)) {
        orgUnitsMap.set(id, {
          id,
          name: row.name.value,
          parentUnit: row.parentUnitId ? {
            id: row.parentUnitId.value,
            name: row.parentUnitName?.value,
          } : null,
          label: row.label?.value,
          validFrom: row.validFrom?.value,
          validTo: row.validTo?.value,
          source: row.source?.value,
          children: [],
        });
      }
    });

    if (includeHierarchy) {
      const hierarchy: any[] = [];
      orgUnitsMap.forEach((orgUnit) => {
        if (orgUnit.parentUnit) {
          const parent = orgUnitsMap.get(orgUnit.parentUnit.id);
          if (parent) {
            parent.children.push(orgUnit);
          }
        } else {
          hierarchy.push(orgUnit);
        }
      });
      return { data: hierarchy, totalCount: orgUnitsMap.size };
    }

    return {
      data: Array.from(orgUnitsMap.values()),
      totalCount: orgUnitsMap.size,
    };
  }

  @Get(':id')
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get OrgUnit by ID with employee count' })
  @ApiResponse({ status: 200, description: 'OrgUnit retrieved successfully' })
  async getOrgUnit(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?name ?parentUnitId ?parentUnitName ?label ?validFrom ?validTo ?source
             (COUNT(DISTINCT ?employee) AS ?employeeCount)
      WHERE {
        <${decodedId}> a ex:OrgUnit ;
                       ex:name ?name .
        OPTIONAL {
          <${decodedId}> ex:parentUnit ?parentUnitId .
          ?parentUnitId ex:name ?parentUnitName .
        }
        OPTIONAL { <${decodedId}> ex:label ?label }
        OPTIONAL { <${decodedId}> ex:validFrom ?validFrom }
        OPTIONAL { <${decodedId}> ex:validTo ?validTo }
        OPTIONAL { <${decodedId}> prov:wasDerivedFrom ?source }
        OPTIONAL { ?employee ex:worksFor <${decodedId}> }
      }
      GROUP BY ?name ?parentUnitId ?parentUnitName ?label ?validFrom ?validTo ?source
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) {
      throw new Error('OrgUnit not found');
    }

    const row = results[0];
    const childQuery = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?childId ?childName
      WHERE {
        ?childId a ex:OrgUnit ;
                 ex:name ?childName ;
                 ex:parentUnit <${decodedId}> .
      }
      ORDER BY ?childName
    `;

    const childResults = await this.sparqlService.executeQuery(childQuery, user);

    return {
      id: decodedId,
      name: row.name.value,
      parentUnit: row.parentUnitId ? {
        id: row.parentUnitId.value,
        name: row.parentUnitName?.value,
      } : null,
      children: childResults.map((child: any) => ({
        id: child.childId.value,
        name: child.childName.value,
      })),
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      employeeCount: parseInt(row.employeeCount?.value || '0'),
      source: row.source?.value,
    };
  }

  @Get(':id/employees')
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get all employees of an OrgUnit' })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  async getOrgUnitEmployees(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?personId ?fullName ?email ?role ?label
      WHERE {
        ?personId a ex:Person ;
                  ex:worksFor <${decodedId}> ;
                  ex:fullName ?fullName ;
                  ex:email ?email .
        OPTIONAL { ?personId ex:role ?role }
        OPTIONAL { ?personId ex:label ?label }
      }
      ORDER BY ?fullName
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    return {
      orgUnitId: decodedId,
      employees: results.map((row: any) => ({
        id: row.personId.value,
        fullName: row.fullName.value,
        email: row.email.value,
        role: row.role?.value,
        label: row.label?.value,
      })),
      count: results.length,
    };
  }
}
