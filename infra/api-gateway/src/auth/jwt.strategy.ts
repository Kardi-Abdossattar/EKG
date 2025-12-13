import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  roles: string[];
  security_clearance: string[];
  exp: number;
  iat: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  async validate(req: any): Promise<any> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);
    
    try {
      // Decode JWT without verification (DEV MODE ONLY)
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Invalid token format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token payload - missing sub');
      }

      const roles = payload.realm_access?.roles || payload.roles || [];
      const securityClearance = [];

      if (roles.includes('admin') || roles.includes('steward')) {
        securityClearance.push('Public', 'Internal', 'Confidential', 'Secret');
      } else if (roles.includes('curator')) {
        securityClearance.push('Public', 'Internal', 'Confidential');
      } else if (roles.includes('viewer')) {
        securityClearance.push('Public', 'Internal');
      }

      return {
        userId: payload.sub,
        username: payload.preferred_username || payload.username || 'unknown',
        email: payload.email || 'unknown@example.com',
        roles: roles.filter((r: string) => ['viewer', 'curator', 'steward', 'admin'].includes(r)),
        securityClearance: securityClearance.length > 0 ? securityClearance : ['Public'],
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token: ' + error.message);
    }
  }
}
