import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PersonResolver } from './resolvers/person.resolver';
import { OrgUnitResolver } from './resolvers/orgunit.resolver';
import { ProductResolver } from './resolvers/product.resolver';
import { ProjectResolver } from './resolvers/project.resolver';
import { AssetResolver } from './resolvers/asset.resolver';
import { TrustScoreResolver } from './resolvers/trustscore.resolver';
import { SparqlModule } from '../sparql/sparql.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req }) => ({ req }),
    }),
    SparqlModule,
    AuthModule,
  ],
  providers: [
    PersonResolver,
    OrgUnitResolver,
    ProductResolver,
    ProjectResolver,
    AssetResolver,
    TrustScoreResolver,
  ],
})
export class EkgGraphQLModule {}
