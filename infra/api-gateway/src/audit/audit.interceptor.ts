import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const body = request.body;
    const timestamp = new Date().toISOString();

    if (!this.shouldAudit(method, url)) {
      return next.handle();
    }

    const auditEntry = {
      timestamp,
      userId: user?.userId || 'anonymous',
      username: user?.username || 'anonymous',
      email: user?.email || 'unknown',
      roles: user?.roles || [],
      method,
      url,
      body: this.sanitizeBody(body),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.auditService.logAction({
            ...auditEntry,
            status: 'SUCCESS',
            response: this.sanitizeResponse(response),
          });
        },
        error: (error) => {
          this.auditService.logAction({
            ...auditEntry,
            status: 'FAILED',
            error: error.message,
            errorStack: error.stack,
          });
        },
      }),
    );
  }

  private shouldAudit(method: string, url: string): boolean {
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const excludedPaths = ['/health', '/metrics', '/api'];

    if (!mutationMethods.includes(method)) {
      return false;
    }

    return !excludedPaths.some((path) => url.startsWith(path));
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  private sanitizeResponse(response: any): any {
    if (!response) return undefined;

    if (typeof response === 'string' && response.length > 1000) {
      return `${response.substring(0, 1000)}... (truncated)`;
    }

    if (typeof response === 'object' && JSON.stringify(response).length > 5000) {
      return { message: 'Response too large, truncated' };
    }

    return response;
  }
}
