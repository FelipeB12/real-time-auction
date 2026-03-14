/**
 * @fileoverview Application entry point.
 *
 * Bootstraps the NestJS application and registers global infrastructure:
 *   - AuctionExceptionFilter: Catches all HttpExceptions and returns a
 *     standardized error envelope with machine-readable error_code values.
 *     Registered globally here so every controller benefits automatically.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuctionExceptionFilter } from './common/auction-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register the global exception filter.
  // All thrown HttpExceptions across the entire API will now produce a
  // consistent { statusCode, error_code, message, timestamp, path } shape.
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AuctionExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
