import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://redis:6379');

        return {
          store: await redisStore({
            url: redisUrl,
            ttl: 300000, // 5 minutes par défaut
            socket: {
              connectTimeout: 5000,
              reconnectStrategy: (retries: number) => {
                // Reconnexion exponentielle max 5s
                return Math.min(retries * 100, 5000);
              },
            },
          }),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
