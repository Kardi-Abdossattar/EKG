import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const CLEARANCE_KEY = 'security_clearance';
export const SecurityClearance = (level: string) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(CLEARANCE_KEY, level, descriptor ? descriptor.value : target);
    return descriptor;
  };
};

const CLEARANCE_HIERARCHY = {
  Public: 0,
  Internal: 1,
  Confidential: 2,
  Secret: 3,
};

@Injectable()
export class SecurityClearanceGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredClearance = this.reflector.getAllAndOverride<string>(CLEARANCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredClearance) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.securityClearance || user.securityClearance.length === 0) {
      throw new ForbiddenException('Access denied: No security clearance found');
    }

    const requiredLevel = CLEARANCE_HIERARCHY[requiredClearance];
    if (requiredLevel === undefined) {
      throw new ForbiddenException(`Invalid security clearance level: ${requiredClearance}`);
    }

    const userMaxLevel = Math.max(
      ...user.securityClearance.map((c: string) => CLEARANCE_HIERARCHY[c] || 0),
    );

    if (userMaxLevel < requiredLevel) {
      throw new ForbiddenException(
        `Access denied: Requires clearance level '${requiredClearance}' (${requiredLevel}), user max level is ${userMaxLevel}`,
      );
    }

    return true;
  }
}

export function getClearanceLevel(clearance: string): number {
  return CLEARANCE_HIERARCHY[clearance] || 0;
}

export function hasAccess(userClearances: string[], requiredClearance: string): boolean {
  const requiredLevel = CLEARANCE_HIERARCHY[requiredClearance];
  if (requiredLevel === undefined) return false;

  const userMaxLevel = Math.max(...userClearances.map((c) => CLEARANCE_HIERARCHY[c] || 0));
  return userMaxLevel >= requiredLevel;
}
