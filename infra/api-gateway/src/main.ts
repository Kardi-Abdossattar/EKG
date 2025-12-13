import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

/**
 * EKG API Gateway - Point d'entrée
 * Fournit un endpoint SPARQL sécurisé avec RBAC/ABAC
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS for development
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('EKG Sécurisé - API Gateway')
    .setDescription('Enterprise Knowledge Graph API with RBAC/ABAC security')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('health', 'Health check endpoints')
    .addTag('sparql', 'SPARQL query endpoints (secured)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway listening on port ${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
  logger.log(`❤️  Health check at http://localhost:${port}/health`);
}

bootstrap();
