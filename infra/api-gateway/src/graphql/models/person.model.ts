import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { OrgUnit } from './orgunit.model';

@ObjectType()
export class Person {
  @Field(() => ID)
  id: string;

  @Field()
  fullName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  role?: string;

  @Field(() => OrgUnit, { nullable: true })
  worksFor?: OrgUnit;

  @Field({ nullable: true })
  label?: string;

  @Field({ nullable: true })
  validFrom?: string;

  @Field({ nullable: true })
  validTo?: string;

  @Field(() => Float, { nullable: true })
  trustScore?: number;

  @Field({ nullable: true })
  source?: string;

  @Field({ nullable: true })
  generatedAt?: string;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class PersonConnection {
  @Field(() => [Person])
  nodes: Person[];

  @Field()
  totalCount: number;

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
