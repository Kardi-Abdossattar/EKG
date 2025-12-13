import { Module } from '@nestjs/common';
import { EkgController } from './ekg.controller';
import { SparqlModule } from '../sparql/sparql.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SparqlModule, AuditModule, AuthModule],
  controllers: [EkgController],
})
export class EkgModule {}
