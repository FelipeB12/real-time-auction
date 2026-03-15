/**
 * @fileoverview NestJS Module encapsulating the Bids domain.
 *
 * Wires together the BidsController, BidsService, IdempotencyService, and the
 * two TypeORM entity repositories required for bid placement.
 *
 * Module relationships:
 *   - Imports Product and Bid entities for atomic cross-table writes.
 *   - Imports IdempotencyService from CommonModule for retry deduplication.
 *   - Imports AuctionModule to get the AuctionGateway for emitting bid_rejected events.
 *   - Exports BidsService for potential future use by WebSocket or Outbox modules.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidsService } from './bids.service';
import { BidsController } from './bids.controller';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { Outbox } from '../common/entities/outbox.entity';
import { CommonModule } from '../common/common.module';
import { AuctionModule } from '../auction/auction.module';

@Module({
  imports: [
    // Entities needed: Product (price updates), Bid (audit), Outbox (events)
    TypeOrmModule.forFeature([Product, Bid, Outbox]),
    // Provides IdempotencyService (Redis-backed) for injection into BidsController
    CommonModule,
    // Provides AuctionGateway so BidsService can emit bid_rejected events to the UI
    AuctionModule,
  ],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
