import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class OrgUnit {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => OrgUnit, { nullable: true })
  parentUnit?: OrgUnit;

  @Field(() => [OrgUnit], { nullable: true })
  childUnits?: OrgUnit[];

  @Field({ nullable: true })
  label?: string;

  @Field({ nullable: true })
  validFrom?: string;

  @Field({ nullable: true })
  validTo?: string;

  @Field({ nullable: true })
  source?: string;
}

@ObjectType()
export class OrgUnitConnection {
  @Field(() => [OrgUnit])
  nodes: OrgUnit[];

  @Field()
  totalCount: number;
}
