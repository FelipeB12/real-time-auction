/**
 * @fileoverview REST Controller exposing the Auction state endpoint.
 *
 * Provides the GET /auction/:itemId/state route — the authoritative "catch-up"
 * endpoint for the High-Frequency Auction Platform. It is intentionally separate
 * from the Products CRUD controller to clearly communicate architectural intent:
 *
 *   - ProductsController  → Manages auction item lifecycle (create/read/update/delete)
 *   - AuctionController   → Manages the live, real-time auction experience (state queries)
 */

import { Controller, Get, Param } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { AuctionStateDto } from './dto/auction-state.dto';

@Controller('auction')
export class AuctionController {
  /**
   * @param auctionService Injected service containing the auction state logic.
   */
  constructor(private readonly auctionService: AuctionService) {}

  /**
   * Handler for: GET /auction/:itemId/state
   *
   * The catch-up endpoint. Called by the frontend in two specific scenarios:
   *   1. **Initial Load:** Immediately on page mount before any WebSocket events
   *      arrive, ensuring the UI never shows a blank/stale price.
   *   2. **Reconnect:** After a WebSocket disconnection, to reconcile the local
   *      client state with what the server holds as ground truth.
   *
   * @param itemId The UUID of the target auction product, extracted from the URL path.
   * @returns A snapshot of the auction's current price and highest bidder as an `AuctionStateDto`.
   */
  @Get(':itemId/state')
  getState(@Param('itemId') itemId: string): Promise<AuctionStateDto> {
    return this.auctionService.getAuctionState(itemId);
  }
}
