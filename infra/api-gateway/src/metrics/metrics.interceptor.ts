import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Intercepteur global pour capturer les métriques HTTP
 * TEP-08_HARDEN_SCALE
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000; // en secondes
          const statusCode = response.statusCode;

          // Enregistrer les métriques
          this.metricsService.recordRequest(method, url, statusCode);
          this.metricsService.recordRequestDuration(method, url, duration);
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error.status || 500;

          // Enregistrer même en cas d'erreur
          this.metricsService.recordRequest(method, url, statusCode);
          this.metricsService.recordRequestDuration(method, url, duration);
        },
      }),
    );
  }
}
