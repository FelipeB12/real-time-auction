/**
 * @fileoverview NestJS Module encapsulating the live Auction domain.
 *
 * This module is intentionally separate from the ProductsModule.
 * It imports the Product entity's TypeORM feature registration so the
 * AuctionService can query `current_price` directly without coupling itself 
 * to the Products domain service — keeping responsibilities distinct.
 *
 * Relates to other modules:
 *   - ProductsModule → Manages the lifecycle of auction items.
 *   - BidsModule (Phase 2) → Will import AuctionModule to update product price 
 *     atomically upon a winning bid.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { AuctionGateway } from './auction.gateway';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [
    // Grant this module direct TypeORM access to the products table for read-only state queries.
    TypeOrmModule.forFeature([Product]),
  ],
  controllers: [
    // Exposes GET /auction/:itemId/state to external HTTP clients
    AuctionController,
  ],
  providers: [
    // Holds the domain logic for computing and returning live auction state
    AuctionService,
    // Real-time Gateway that pushes updates via WebSockets (Subscribes to Redis Pub/Sub)
    AuctionGateway,
  ],
  exports: [
    // Exported so future modules (e.g., Bids, WebSocket Gateway) can read auction state
    AuctionService,
  ],
})
export class AuctionModule {}
