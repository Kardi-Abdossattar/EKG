import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SecurityClearanceGuard } from '../../auth/security-clearance.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { CreatePersonDto, UpdatePersonDto } from '../dto/person.dto';

@ApiTags('persons')
@ApiBearerAuth()
@Controller('api/v1/persons')
@UseGuards(JwtAuthGuard, RolesGuard, SecurityClearanceGuard)
export class PersonController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Get()
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all persons with pagination and search' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of persons retrieved successfully' })
  async getPersons(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
    @Query('search') searchTerm?: string,
    @CurrentUser() user?: any,
  ) {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?id ?fullName ?email ?role ?orgUnitId ?orgUnitName ?label ?validFrom ?validTo
             ?trustScore ?source ?generatedAt
      WHERE {
        ?id a ex:Person ;
            ex:fullName ?fullName ;
            ex:email ?email .
        OPTIONAL { ?id ex:role ?role }
        OPTIONAL {
          ?id ex:worksFor ?orgUnitId .
          ?orgUnitId ex:name ?orgUnitName .
        }
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

    const persons = results.map((row: any) => ({
      id: row.id.value,
      fullName: row.fullName.value,
      email: row.email.value,
      role: row.role?.value,
      orgUnit: row.orgUnitId ? {
        id: row.orgUnitId.value,
        name: row.orgUnitName?.value,
      } : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
      provenance: {
        source: row.source?.value,
        generatedAt: row.generatedAt?.value,
      },
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
      data: persons,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    };
  }

  @Get(':id')
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get person by ID' })
  @ApiResponse({ status: 200, description: 'Person retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async getPerson(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?fullName ?email ?role ?orgUnitId ?orgUnitName ?label ?validFrom ?validTo
             ?trustScore ?source ?generatedAt
      WHERE {
        <${decodedId}> a ex:Person ;
                       ex:fullName ?fullName ;
                       ex:email ?email .
        OPTIONAL { <${decodedId}> ex:role ?role }
        OPTIONAL {
          <${decodedId}> ex:worksFor ?orgUnitId .
          ?orgUnitId ex:name ?orgUnitName .
        }
        OPTIONAL { <${decodedId}> ex:label ?label }
        OPTIONAL { <${decodedId}> ex:validFrom ?validFrom }
        OPTIONAL { <${decodedId}> ex:validTo ?validTo }
        OPTIONAL { <${decodedId}> ex:trustScore ?trustScore }
        OPTIONAL { <${decodedId}> prov:wasDerivedFrom ?source }
        OPTIONAL { <${decodedId}> prov:generatedAtTime ?generatedAt }
      }
    `;

    const results = await this.sparqlService.executeQuery(query, user);
    if (results.length === 0) {
      throw new HttpException('Person not found', HttpStatus.NOT_FOUND);
    }

    const row = results[0];
    return {
      id: decodedId,
      fullName: row.fullName.value,
      email: row.email.value,
      role: row.role?.value,
      orgUnit: row.orgUnitId ? {
        id: row.orgUnitId.value,
        name: row.orgUnitName?.value,
      } : null,
      label: row.label?.value,
      validFrom: row.validFrom?.value,
      validTo: row.validTo?.value,
      trustScore: row.trustScore ? parseFloat(row.trustScore.value) : null,
      provenance: {
        source: row.source?.value,
        generatedAt: row.generatedAt?.value,
      },
    };
  }

  @Post()
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Create a new person' })
  @ApiResponse({ status: 201, description: 'Person created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createPerson(
    @Body() createPersonDto: CreatePersonDto,
    @CurrentUser() user?: any,
  ) {
    const personId = `http://example.com/data#P_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const insertQuery = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      INSERT DATA {
        GRAPH <http://example.com/data> {
          <${personId}> a ex:Person ;
                        ex:fullName "${createPersonDto.fullName}" ;
                        ex:email "${createPersonDto.email}" ;
                        ${createPersonDto.role ? `ex:role "${createPersonDto.role}" ;` : ''}
                        ${createPersonDto.orgUnitId ? `ex:worksFor <${createPersonDto.orgUnitId}> ;` : ''}
                        ${createPersonDto.label ? `ex:label ex:${createPersonDto.label} ;` : 'ex:label ex:Interne ;'}
                        ex:validFrom "${timestamp}"^^xsd:dateTime ;
                        prov:wasDerivedFrom "REST API" ;
                        prov:generatedAtTime "${timestamp}"^^xsd:dateTime ;
                        prov:wasAttributedTo "${user?.username || 'system'}" .
        }
      }
    `;

    await this.sparqlService.executeUpdate(insertQuery, user);

    return {
      id: personId,
      message: 'Person created successfully',
      createdAt: timestamp,
    };
  }

  @Put(':id')
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Update person by ID' })
  @ApiResponse({ status: 200, description: 'Person updated successfully' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async updatePerson(
    @Param('id') id: string,
    @Body() updatePersonDto: UpdatePersonDto,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const timestamp = new Date().toISOString();

    const updateQuery = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      DELETE {
        GRAPH <http://example.com/data> {
          <${decodedId}> ${updatePersonDto.fullName ? 'ex:fullName ?oldFullName .' : ''}
          <${decodedId}> ${updatePersonDto.email ? 'ex:email ?oldEmail .' : ''}
          <${decodedId}> ${updatePersonDto.role ? 'ex:role ?oldRole .' : ''}
          <${decodedId}> ${updatePersonDto.orgUnitId ? 'ex:worksFor ?oldOrgUnit .' : ''}
        }
      }
      INSERT {
        GRAPH <http://example.com/data> {
          ${updatePersonDto.fullName ? `<${decodedId}> ex:fullName "${updatePersonDto.fullName}" .` : ''}
          ${updatePersonDto.email ? `<${decodedId}> ex:email "${updatePersonDto.email}" .` : ''}
          ${updatePersonDto.role ? `<${decodedId}> ex:role "${updatePersonDto.role}" .` : ''}
          ${updatePersonDto.orgUnitId ? `<${decodedId}> ex:worksFor <${updatePersonDto.orgUnitId}> .` : ''}
          <${decodedId}> prov:generatedAtTime "${timestamp}"^^xsd:dateTime .
          <${decodedId}> prov:wasAttributedTo "${user?.username || 'system'}" .
        }
      }
      WHERE {
        GRAPH <http://example.com/data> {
          <${decodedId}> a ex:Person .
          ${updatePersonDto.fullName ? 'OPTIONAL { <' + decodedId + '> ex:fullName ?oldFullName }' : ''}
          ${updatePersonDto.email ? 'OPTIONAL { <' + decodedId + '> ex:email ?oldEmail }' : ''}
          ${updatePersonDto.role ? 'OPTIONAL { <' + decodedId + '> ex:role ?oldRole }' : ''}
          ${updatePersonDto.orgUnitId ? 'OPTIONAL { <' + decodedId + '> ex:worksFor ?oldOrgUnit }' : ''}
        }
      }
    `;

    await this.sparqlService.executeUpdate(updateQuery, user);

    return {
      id: decodedId,
      message: 'Person updated successfully',
      updatedAt: timestamp,
    };
  }

  @Delete(':id')
  @Roles('steward', 'admin')
  @ApiOperation({ summary: 'Delete person by ID (soft delete with validTo)' })
  @ApiResponse({ status: 200, description: 'Person deleted successfully' })
  async deletePerson(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const timestamp = new Date().toISOString();

    const deleteQuery = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

      INSERT {
        GRAPH <http://example.com/data> {
          <${decodedId}> ex:validTo "${timestamp}"^^xsd:dateTime .
        }
      }
      WHERE {
        GRAPH <http://example.com/data> {
          <${decodedId}> a ex:Person .
          FILTER NOT EXISTS { <${decodedId}> ex:validTo ?anyValidTo }
        }
      }
    `;

    await this.sparqlService.executeUpdate(deleteQuery, user);

    return {
      id: decodedId,
      message: 'Person soft-deleted successfully (validTo set)',
      deletedAt: timestamp,
    };
  }
}
