/**
 * @fileoverview REST Controller exposing the POST /place-bid endpoint.
 *
 * This controller is the single entry point for all bid placement requests.
 * It delegates all business logic to BidsService, keeping this layer
 * intentionally thin — validate route, call service, return result.
 *
 * Route: POST /bids/place-bid
 */

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult } from '@auction/shared';

@Controller('bids')
export class BidsController {
  /**
   * @param bidsService The injected domain service handling bid placement logic.
   */
  constructor(private readonly bidsService: BidsService) {}

  /**
   * Handler for: POST /bids/place-bid
   *
   * Receives a bid payload and attempts to register it as the new highest bid
   * for the specified auction item. The service will reject bids that are equal
   * to or lower than the current price.
   *
   * Returns HTTP 200 on accepted bids (not 201, because this is an action,
   * not a resource creation).
   *
   * @param placeBidDto The validated bid payload from the request body.
   * @returns A BidResult confirming success and the new accepted price.
   */
  @Post('place-bid')
  @HttpCode(HttpStatus.OK)
  placeBid(@Body() placeBidDto: PlaceBidDto): Promise<BidResult> {
    return this.bidsService.placeBid(placeBidDto);
  }
}
