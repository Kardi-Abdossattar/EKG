import { Module } from '@nestjs/common';
import { SparqlService } from './sparql.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [SparqlService],
  exports: [SparqlService],
})
export class SparqlModule {}
