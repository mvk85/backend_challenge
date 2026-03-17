import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOriginsRaw =
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,https://mvk85.github.io';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  const swaggerPath = process.env.SWAGGER_PATH ?? 'docs';
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FirstAI Backend API')
    .setDescription('HTTP API for MCP providers and file downloads')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  const port = Number(process.env.PORT ?? 5001);
  await app.listen(port);
}

void bootstrap();
