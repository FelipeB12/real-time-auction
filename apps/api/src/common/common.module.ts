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
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { IdempotencyService } from './idempotency.service';
import { Outbox } from './entities/outbox.entity';
import { OutboxWorker } from './outbox.worker';

@Module({
  imports: [
    // Registers the Outbox entity so the OutboxWorker can query it.
    TypeOrmModule.forFeature([Outbox]),
    // CacheModule registers the in-memory (or Redis-backed via store) cache.
    CacheModule.register(),
  ],
  providers: [IdempotencyService, OutboxWorker],
  exports: [IdempotencyService],
})
export class CommonModule {}
