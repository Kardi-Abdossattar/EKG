import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (request?.user) {
      return request.user;
    }

    const httpRequest = context.switchToHttp().getRequest();
    return httpRequest?.user;
  },
);
