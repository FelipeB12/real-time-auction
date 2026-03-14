/**
 * @fileoverview NestJS Module encapsulating the Bids domain.
 *
 * Wires together the BidsController, BidsService, and the two TypeORM
 * entity repositories required for bid placement: Product (to read and 
 * update the current price) and Bid (to insert the immutable bid record).
 *
 * Module relationships:
 *   - Imports Product entity so BidsService can query and update pricing.
 *   - Imports Bid entity for inserting historical bid records.
 *   - Exports BidsService so AuctionModule or WebSocket gateway can 
 *     reference bid placement logic in future phases.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidsService } from './bids.service';
import { BidsController } from './bids.controller';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';

@Module({
  imports: [
    // Register both entities so their repositories can be @InjectRepository'd in BidsService
    TypeOrmModule.forFeature([Product, Bid]),
  ],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
