/**
 * @fileoverview Shared module housing cross-cutting infrastructure services.
 *
 * The CommonModule provides reusable, singleton services that are needed
 * across multiple domain modules without belonging to any single domain.
 *
 * Current providers:
 *   - IdempotencyService → Redis-backed deduplication for bid placement retries.
 *
 * By exporting IdempotencyService, any module that imports CommonModule
 * gains access to the idempotency cache without re-declaring the provider.
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [
    // CacheModule registers the in-memory (or Redis-backed via store) cache.
    // TTL and Redis store are configured at the AppModule level.
    // Here we use the default in-memory store so CommonModule is self-contained for testing.
    CacheModule.register(),
  ],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class CommonModule {}
