import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { SecurityClearanceGuard, SecurityClearance } from '../auth/security-clearance.guard';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { SparqlService } from '../sparql/sparql.service';

@ApiTags('EKG - Enterprise Knowledge Graph')
@ApiBearerAuth()
@Controller('ekg')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(AuditInterceptor)
export class EkgController {
  private readonly logger = new Logger(EkgController.name);

  constructor(private readonly sparqlService: SparqlService) {}

  @Get('persons')
  @UseGuards(RolesGuard)
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all persons (filtered by security clearance)' })
  @ApiResponse({ status: 200, description: 'Persons list returned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPersons(
    @Request() req,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    const user = req.user;
    this.logger.log(`User ${user.username} (roles: ${user.roles}) requesting persons list`);

    const query = this.sparqlService.buildPersonQuery({ limit, offset });
    const results = await this.sparqlService.query(query, {
      userClearances: user.securityClearance,
      filterByLabel: true,
    });

    return {
      data: results.results.bindings,
      meta: {
        total: results.results.bindings.length,
        limit,
        offset,
        user: {
          username: user.username,
          roles: user.roles,
          clearance: user.securityClearance,
        },
      },
    };
  }

  @Get('orgunits')
  @UseGuards(RolesGuard)
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'List all organizational units' })
  @ApiResponse({ status: 200, description: 'OrgUnits list returned' })
  async getOrgUnits(
    @Request() req,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    const user = req.user;
    this.logger.log(`User ${user.username} requesting orgunits list`);

    const query = this.sparqlService.buildOrgUnitQuery({ limit, offset });
    const results = await this.sparqlService.query(query);

    return {
      data: results.results.bindings,
      meta: {
        total: results.results.bindings.length,
        limit,
        offset,
        user: {
          username: user.username,
          roles: user.roles,
        },
      },
    };
  }

  @Get('quarantine')
  @UseGuards(RolesGuard, SecurityClearanceGuard)
  @Roles('curator', 'steward', 'admin')
  @SecurityClearance('Confidential')
  @ApiOperation({ summary: 'List quarantined entities (curator+ only)' })
  @ApiResponse({ status: 200, description: 'Quarantine list returned' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires curator role and Confidential clearance' })
  async getQuarantine(@Request() req) {
    const user = req.user;
    this.logger.log(`User ${user.username} (curator) requesting quarantine list`);

    const query = this.sparqlService.buildQuarantineQuery();
    const results = await this.sparqlService.query(query, {
      filterByLabel: false,
    });

    return {
      data: results.results.bindings,
      meta: {
        total: results.results.bindings.length,
        user: {
          username: user.username,
          roles: user.roles,
        },
      },
    };
  }

  @Post('sparql/query')
  @UseGuards(RolesGuard)
  @Roles('viewer', 'curator', 'steward', 'admin')
  @ApiOperation({ summary: 'Execute custom SPARQL query (filtered by security clearance)' })
  @ApiResponse({ status: 200, description: 'Query results returned' })
  @ApiResponse({ status: 400, description: 'Invalid SPARQL query' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async executeSparqlQuery(
    @Request() req,
    @Body() body: { query: string; filterByLabel?: boolean },
  ) {
    const user = req.user;
    this.logger.log(`User ${user.username} executing custom SPARQL query`);

    const { query, filterByLabel = true } = body;

    if (!query || query.trim().length === 0) {
      return { error: 'Query cannot be empty' };
    }

    const results = await this.sparqlService.query(query, {
      userClearances: user.securityClearance,
      filterByLabel,
    });

    return {
      data: results,
      meta: {
        user: {
          username: user.username,
          roles: user.roles,
          clearance: user.securityClearance,
        },
      },
    };
  }

  @Post('sparql/update')
  @UseGuards(RolesGuard, SecurityClearanceGuard)
  @Roles('steward', 'admin')
  @SecurityClearance('Secret')
  @ApiOperation({ summary: 'Execute SPARQL update (steward/admin only, requires Secret clearance)' })
  @ApiResponse({ status: 200, description: 'Update executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid SPARQL update' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires steward/admin role and Secret clearance' })
  async executeSparqlUpdate(@Request() req, @Body() body: { update: string }) {
    const user = req.user;
    this.logger.log(`User ${user.username} (steward/admin) executing SPARQL update`);

    const { update } = body;

    if (!update || update.trim().length === 0) {
      return { error: 'Update cannot be empty' };
    }

    await this.sparqlService.update(update);

    return {
      message: 'Update executed successfully',
      meta: {
        user: {
          username: user.username,
          roles: user.roles,
        },
      },
    };
  }

  @Post('quarantine/approve')
  @UseGuards(RolesGuard, SecurityClearanceGuard)
  @Roles('curator', 'steward', 'admin')
  @SecurityClearance('Confidential')
  @ApiOperation({ summary: 'Approve quarantined entity (move to production graph)' })
  @ApiResponse({ status: 200, description: 'Entity approved and moved to production' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires curator+ role and Confidential clearance' })
  async approveQuarantineEntity(@Request() req, @Body() body: { entityUri: string }) {
    const user = req.user;
    const { entityUri } = body;

    this.logger.log(`User ${user.username} (curator) approving quarantine entity: ${entityUri}`);

    const moveQuery = `
      PREFIX ex: <http://example.com/schema#>

      DELETE {
        GRAPH <http://example.com/quarantine> {
          <${entityUri}> ?p ?o .
        }
      }
      INSERT {
        GRAPH <http://example.com/data> {
          <${entityUri}> ?p ?o .
        }
      }
      WHERE {
        GRAPH <http://example.com/quarantine> {
          <${entityUri}> ?p ?o .
        }
      }
    `;

    await this.sparqlService.update(moveQuery);

    return {
      message: `Entity ${entityUri} approved and moved to production graph`,
      meta: {
        approvedBy: user.username,
        approvedAt: new Date().toISOString(),
      },
    };
  }
}
