import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => {
  return (
    target: any,
    key?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(
      ROLES_KEY,
      roles,
      descriptor ? descriptor.value : target,
    );
    return descriptor;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1️⃣ Read required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role restrictions
    }

    // 2️⃣ Support GraphQL AND REST
    let user: any = null;

    // Try GraphQL context first
    try {
      const gqlCtx = GqlExecutionContext.create(context);
      const req = gqlCtx.getContext().req;
      user = req?.user;
    } catch {
      /* ignore */
    }

    // Fallback to HTTP context
    if (!user) {
      const httpReq = context.switchToHttp().getRequest();
      user = httpReq?.user;
    }

    // 3️⃣ Validate that user & roles exist
    if (!user || !user.roles) {
      throw new ForbiddenException('Access denied: No user roles found');
    }

    // 4️⃣ Check if user has at least one required role
    const hasRole = requiredRoles.some((role) =>
      user.roles.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Requires one of roles [${requiredRoles.join(
          ', ',
        )}], user has [${user.roles.join(', ')}]`,
      );
    }

    return true;
  }
}
