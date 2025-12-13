import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { AuthModule } from './auth/auth.module';
import { SparqlModule } from './sparql/sparql.module';
import { AuditModule } from './audit/audit.module';
import { EkgModule } from './ekg/ekg.module';
import { EkgGraphQLModule } from './graphql/graphql.module';
import { RestApiModule } from './rest/rest.module';
import { CacheModule } from './cache/cache.module';

/**
 * EKG API Gateway - Module principal
 * Configure les modules de base (health, config, metrics, auth, sparql, audit, ekg)
 * TEP-07: Ajout GraphQL et REST API modules
 * TEP-08: Ajout CacheModule et MetricsInterceptor global
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    CacheModule,
    MetricsModule,
    AuthModule,
    SparqlModule,
    AuditModule,
    EkgModule,
    EkgGraphQLModule,
    RestApiModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
