/**
 * @fileoverview NestJS Module encapsulating the Bids domain.
 *
 * Wires together the BidsController, BidsService, IdempotencyService, and the
 * two TypeORM entity repositories required for bid placement.
 *
 * Module relationships:
 *   - Imports Product and Bid entities for atomic cross-table writes.
 *   - Imports IdempotencyService from CommonModule for retry deduplication.
 *   - Exports BidsService for potential future use by WebSocket or Outbox modules.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidsService } from './bids.service';
import { BidsController } from './bids.controller';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    // Both entities are needed: Product (to update price atomically), Bid (to record history)
    TypeOrmModule.forFeature([Product, Bid]),
    // Provides IdempotencyService (Redis-backed) for injection into BidsController
    CommonModule,
  ],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
