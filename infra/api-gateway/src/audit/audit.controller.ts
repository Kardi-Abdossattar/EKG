import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit Trail')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('admin', 'steward')
  @ApiOperation({ summary: 'Query audit logs (admin/steward only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of logs to return (default: 100)' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'username', required: false, type: String, description: 'Filter by username (partial match)' })
  @ApiQuery({ name: 'method', required: false, type: String, description: 'Filter by HTTP method (GET, POST, etc.)' })
  @ApiQuery({ name: 'status', required: false, enum: ['SUCCESS', 'FAILED'], description: 'Filter by status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires admin or steward role' })
  async getAuditLogs(
    @Request() req,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('username') username?: string,
    @Query('method') method?: string,
    @Query('status') status?: 'SUCCESS' | 'FAILED',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = req.user;
    this.logger.log(`User ${user.username} (${user.roles.join(',')}) querying audit logs`);

    const logs = await this.auditService.queryAuditLogs({
      userId,
      username,
      method,
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(String(limit), 10) : 100,
    });

    return {
      data: logs,
      meta: {
        total: logs.length,
        filters: {
          userId,
          username,
          method,
          status,
          startDate,
          endDate,
          limit: limit || 100,
        },
        queriedBy: {
          username: user.username,
          roles: user.roles,
        },
      },
    };
  }

  @Get('stats')
  @Roles('admin', 'steward')
  @ApiOperation({ summary: 'Get audit statistics (admin/steward only)' })
  @ApiResponse({ status: 200, description: 'Audit statistics returned' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires admin or steward role' })
  async getAuditStats(@Request() req) {
    const user = req.user;
    this.logger.log(`User ${user.username} requesting audit stats`);

    const allLogs = await this.auditService.queryAuditLogs({ limit: 10000 });

    const stats = {
      totalActions: allLogs.length,
      successCount: allLogs.filter((l) => l.status === 'SUCCESS').length,
      failedCount: allLogs.filter((l) => l.status === 'FAILED').length,
      byUser: {} as Record<string, number>,
      byMethod: {} as Record<string, number>,
      byUrl: {} as Record<string, number>,
      recentFailures: allLogs
        .filter((l) => l.status === 'FAILED')
        .slice(0, 10)
        .map((l) => ({
          timestamp: l.timestamp,
          username: l.username,
          method: l.method,
          url: l.url,
          error: l.error,
        })),
    };

    allLogs.forEach((log) => {
      stats.byUser[log.username] = (stats.byUser[log.username] || 0) + 1;
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
      stats.byUrl[log.url] = (stats.byUrl[log.url] || 0) + 1;
    });

    return {
      data: stats,
      meta: {
        queriedBy: {
          username: user.username,
          roles: user.roles,
        },
      },
    };
  }
}
