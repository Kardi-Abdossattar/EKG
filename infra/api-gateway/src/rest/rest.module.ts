import { Module } from '@nestjs/common';
import { PersonController } from './controllers/person.controller';
import { OrgUnitController } from './controllers/orgunit.controller';
import { ProductController } from './controllers/product.controller';
import { QuarantineController } from './controllers/quarantine.controller';
import { TrustScoreController } from './controllers/trustscore.controller';
import { SparqlModule } from '../sparql/sparql.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SparqlModule, AuthModule],
  controllers: [
    PersonController,
    OrgUnitController,
    ProductController,
    QuarantineController,
    TrustScoreController,
  ],
})
export class RestApiModule {}
