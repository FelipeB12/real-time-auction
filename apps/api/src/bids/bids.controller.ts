/**
 * @fileoverview REST Controller exposing the POST /place-bid endpoint.
 *
 * This controller is the single entry point for all bid placement requests.
 * It is intentionally thin: it reads the Idempotency-Key header, checks Redis
 * for a cached result, and only forwards the request to BidsService if this
 * is a genuinely new bid — not a client retry.
 *
 * Route: POST /bids/place-bid
 *
 * IDEMPOTENCY FLOW:
 *   Client sends Idempotency-Key: <UUID> header.
 *   ┌── Key found in Redis? ──── YES ──→ Return cached BidResult (no re-processing)
 *   └── Key NOT found?     ──── NO  ──→ Forward to BidsService.placeBid()
 *                                        Then cache the result in Redis with TTL.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { BidsService } from './bids.service';
import { IdempotencyService } from '../common/idempotency.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionErrorCode } from '../common/errors.types';
import { BidResult } from '@auction/shared';

@Controller('bids')
export class BidsController {
  /**
   * @param bidsService Core service handling atomic bid placement logic.
   * @param idempotencyService Redis-backed deduplication service for retry safety.
   */
  constructor(
    private readonly bidsService: BidsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Handler for: POST /bids/place-bid
   *
   * Clients MUST include an `Idempotency-Key` header containing a unique UUID
   * (e.g., UUID v4 generated client-side). This header is the client's promise
   * that the request represents a single intended bid.
   *
   * If the same key is received again within the TTL window (e.g., due to a
   * network retry), the original result is returned directly without re-processing.
   * This guarantees "exactly-once" bid semantics from the client's perspective.
   *
   * Returns HTTP 200 (not 201) because this is an action endpoint, not a
   * resource creation endpoint.
   *
   * @param idempotencyKey The unique `Idempotency-Key` header value from the client.
   * @param placeBidDto The incoming bid payload: item_id, user_id, amount.
   * @returns A BidResult — either freshly computed or replayed from Redis cache.
   * @throws BadRequestException if no Idempotency-Key header is provided at all.
   */
  @Post('place-bid')
  @HttpCode(HttpStatus.OK)
  async placeBid(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() placeBidDto: PlaceBidDto,
  ): Promise<BidResult> {
    // Guard: Require the Idempotency-Key header. Without it, we cannot deduplicate.
    // Clients that omit this header are breaking the contract for financial operations.
    if (!idempotencyKey) {
      throw new BadRequestException({
        error_code: AuctionErrorCode.MISSING_IDEMPOTENCY_KEY,
        message:
          'Missing required header: Idempotency-Key. Provide a unique UUID for every bid request.',
      });
    }

    // — CHECK: Look up whether this key has been processed before in Redis.
    const cachedResult =
      await this.idempotencyService.getCachedResult(idempotencyKey);

    if (cachedResult) {
      // Cache HIT — this is a retry. Return the original result without any DB interaction.
      // The client receives an identical response to what they would have gotten first time.
      return cachedResult;
    }

    // Cache MISS — this is a new, unique bid request. Process it normally.
    const result = await this.bidsService.placeBid(placeBidDto);

    // — STORE: Cache the result under this key so any future retry is handled identically.
    // Even if the bid was rejected (BadRequestException is re-thrown before this point),
    // successful BidResults are stored, preventing a lucky retry from double-winning.
    await this.idempotencyService.cacheResult(idempotencyKey, result);

    return result;
  }
}
