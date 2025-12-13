import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({
    summary: 'Prometheus metrics endpoint',
    description: 'Expose API Gateway metrics in Prometheus format',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus text format',
    content: {
      'text/plain': {
        example: `# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total{method="GET",path="/health",status="200"} 42`,
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
