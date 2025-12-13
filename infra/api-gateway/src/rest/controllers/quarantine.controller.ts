import { Controller, Get, Post, Param, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SparqlService } from '../../sparql/sparql.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('quarantine')
@ApiBearerAuth()
@Controller('api/v1/quarantine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuarantineController {
  constructor(private readonly sparqlService: SparqlService) {}

  @Get()
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all quarantined entities' })
  @ApiResponse({ status: 200, description: 'List of quarantined entities' })
  async getQuarantineEntities(@CurrentUser() user?: any) {
    const query = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX sh: <http://www.w3.org/ns/shacl#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT DISTINCT ?id ?type ?label ?email ?fullName ?source ?generatedAt
      FROM <http://example.com/quarantine>
      WHERE {
        ?id a ?type .
        OPTIONAL { ?id ex:label ?label }
        OPTIONAL { ?id ex:email ?email }
        OPTIONAL { ?id ex:fullName ?fullName }
        OPTIONAL { ?id prov:wasDerivedFrom ?source }
        OPTIONAL { ?id prov:generatedAtTime ?generatedAt }
      }
      ORDER BY ?generatedAt
      LIMIT 100
    `;

    const results = await this.sparqlService.executeQueryRaw(query);

    const violationQuery = `
      PREFIX sh: <http://www.w3.org/ns/shacl#>

      SELECT ?focusNode ?message ?severity ?path
      FROM <http://example.com/quarantine>
      WHERE {
        ?report a sh:ValidationReport ;
                sh:result ?result .
        ?result sh:focusNode ?focusNode ;
                sh:resultMessage ?message ;
                sh:resultSeverity ?severity .
        OPTIONAL { ?result sh:resultPath ?path }
      }
    `;

    const violations = await this.sparqlService.executeQueryRaw(violationQuery);
    const violationMap = new Map();
    violations.forEach((v: any) => {
      const focusNode = v.focusNode.value;
      if (!violationMap.has(focusNode)) {
        violationMap.set(focusNode, []);
      }
      violationMap.get(focusNode).push({
        message: v.message.value,
        severity: v.severity?.value.split('#').pop(),
        path: v.path?.value,
      });
    });

    return {
      data: results.map((row: any) => ({
        id: row.id.value,
        type: row.type.value.split('#').pop() || row.type.value,
        label: row.label?.value,
        email: row.email?.value,
        fullName: row.fullName?.value,
        source: row.source?.value,
        generatedAt: row.generatedAt?.value,
        violations: violationMap.get(row.id.value) || [{ message: 'SHACL validation failed', severity: 'Violation' }],
      })),
      count: results.length,
    };
  }

  @Get(':id')
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Get quarantined entity details' })
  @ApiResponse({ status: 200, description: 'Quarantined entity details' })
  async getQuarantineEntity(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const query = `
      PREFIX ex: <http://example.com/schema#>

      SELECT ?p ?o
      FROM <http://example.com/quarantine>
      WHERE {
        <${decodedId}> ?p ?o .
      }
    `;

    const results = await this.sparqlService.executeQueryRaw(query);
    return {
      id: decodedId,
      triples: results.map((row: any) => ({
        predicate: row.p.value,
        object: row.o.value,
        objectType: row.o.type,
      })),
    };
  }

  @Post(':id/approve')
  @Roles('steward', 'admin')
  @ApiOperation({ summary: 'Approve and move entity from quarantine to production' })
  @ApiResponse({ status: 200, description: 'Entity approved and moved' })
  async approveQuarantineEntity(
    @Param('id') id: string,
    @Body() body: { overrideSHACL?: boolean },
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);
    const timestamp = new Date().toISOString();

    const copyQuery = `
      PREFIX ex: <http://example.com/schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      INSERT {
        GRAPH <http://example.com/data> {
          ?s ?p ?o .
          <${decodedId}> prov:wasApprovedBy "${user?.username || 'system'}" ;
                         prov:approvedAt "${timestamp}"^^xsd:dateTime .
        }
      }
      WHERE {
        GRAPH <http://example.com/quarantine> {
          ?s ?p ?o .
          FILTER(?s = <${decodedId}>)
        }
      }
    `;

    const deleteQuery = `
      DELETE {
        GRAPH <http://example.com/quarantine> {
          <${decodedId}> ?p ?o .
        }
      }
      WHERE {
        GRAPH <http://example.com/quarantine> {
          <${decodedId}> ?p ?o .
        }
      }
    `;

    await this.sparqlService.executeUpdate(copyQuery, user);
    await this.sparqlService.executeUpdate(deleteQuery, user);

    return {
      id: decodedId,
      message: 'Entity approved and moved to production',
      approvedBy: user?.username || 'system',
      approvedAt: timestamp,
      overriddenSHACL: body.overrideSHACL || false,
    };
  }

  @Post(':id/reject')
  @Roles('curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Reject and delete entity from quarantine' })
  @ApiResponse({ status: 200, description: 'Entity rejected and deleted' })
  async rejectQuarantineEntity(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const decodedId = decodeURIComponent(id);

    const deleteQuery = `
      DELETE {
        GRAPH <http://example.com/quarantine> {
          <${decodedId}> ?p ?o .
        }
      }
      WHERE {
        GRAPH <http://example.com/quarantine> {
          <${decodedId}> ?p ?o .
        }
      }
    `;

    await this.sparqlService.executeUpdate(deleteQuery, user);

    return {
      id: decodedId,
      message: 'Entity rejected and deleted from quarantine',
      rejectedBy: user?.username || 'system',
      rejectedAt: new Date().toISOString(),
    };
  }
}
