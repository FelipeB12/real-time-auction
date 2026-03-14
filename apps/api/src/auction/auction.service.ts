/**
 * @fileoverview Service layer for the Auction module.
 *
 * Handles domain logic specific to the live auction state, deliberately separated
 * from the ProductsService to maintain the Single Responsibility Principle.
 * While ProductsService manages CRUD lifecycle, AuctionService answers
 * the question: "What is happening RIGHT NOW in this auction?"
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { AuctionStateDto } from './dto/auction-state.dto';

@Injectable()
export class AuctionService {
  /**
   * @param productRepository Injected TypeORM repository to query live product state.
   */
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Retrieves the current, authoritative state of a live auction item.
   *
   * This is the critical "catch-up" method, called when:
   * - A new client initially connects to the auction page and needs the current price immediately.
   * - A client WebSocket disconnects and reconnects, needing to reconcile any missed bid events.
   *
   * It reads the current database state directly, guaranteeing the freshest snapshot
   * of `current_price` and `highest_bidder_id` by bypassing any caching layers.
   *
   * @param itemId The UUID string of the auction product being queried.
   * @returns A structured `AuctionStateDto` containing the live price, bidder, and timestamp.
   * @throws NotFoundException if no product matching the given `itemId` exists.
   */
  async getAuctionState(itemId: string): Promise<AuctionStateDto> {
    // Query the database directly to guarantee the freshest possible snapshot.
    // This intentionally skips any caching to ensure accuracy over speed.
    const product = await this.productRepository.findOne({
      where: { id: itemId },
    });

    // Guard against a client requesting state for a product that was
    // deleted or never created. Return a 404 with a descriptive message.
    if (!product) {
      throw new NotFoundException(
        `Auction item with ID "${itemId}" not found. It may have been removed.`,
      );
    }

    // Map the raw database Product entity to a clean, well-defined response DTO.
    // This decouples the internal DB schema from what is exposed to clients.
    const state: AuctionStateDto = {
      item_id: product.id,
      name: product.name,
      current_price: product.current_price,
      highest_bidder_id: product.highest_bidder_id,
      // Capture the exact server-side timestamp at the moment of snapshot generation
      snapshot_at: new Date().toISOString(),
      accepted_count: product.accepted_count,
      rejected_count: product.rejected_count,
    };

    return state;
  }
}
