/**
 * @fileoverview Service implementing Redis-backed idempotency for the bid placement endpoint.
 *
 * PROBLEM — Why Idempotency Matters in Auctions:
 * A client fires POST /bids/place-bid. The bid is processed and accepted by the server,
 * but the network drops before the HTTP response reaches the client. The client, not
 * knowing whether the bid succeeded, retries the exact same request. Without idempotency,
 * the server would process the bid a second time — potentially accepting a duplicate at
 * a higher price in a later auction state. This is unacceptable in any financial system.
 *
 * SOLUTION — The Idempotency Key Pattern:
 * Clients attach a unique `Idempotency-Key` header (e.g., a UUID v4) to every bid request.
 * This service:
 *   1. Before processing: checks Redis for a cached result keyed by the client's Idempotency-Key.
 *   2. Cache HIT → Return the cached BidResult immediately. The request is NOT re-processed.
 *   3. Cache MISS → Allow the bid to be processed normally, then cache the result in Redis.
 *
 * The Redis TTL (default 30 seconds) defines the window in which retries are deduplicated.
 * After the TTL expires, the key is evicted and a retry would be treated as a new request —
 * a deliberate trade-off: network retries happen within seconds, not minutes.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { BidResult } from '@auction/shared';

/** Redis TTL in seconds. Must be long enough to cover any realistic retry window. */
const IDEMPOTENCY_TTL_SECONDS = 30;

/** Namespace prefix to avoid key collisions with other cache entries. */
const IDEMPOTENCY_PREFIX = 'idempotency:bid:';

@Injectable()
export class IdempotencyService {
  /**
   * @param cacheManager The NestJS Cache Manager wired to the Redis store.
   *                     Injected via the CACHE_MANAGER token from @nestjs/cache-manager.
   */
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Looks up a previously processed result for the given idempotency key.
   *
   * Called BEFORE executing bid logic. If a result is found, the caller
   * should return it directly without re-processing the request.
   *
   * @param key The raw Idempotency-Key string provided by the client in the request header.
   * @returns The cached BidResult if a previous result exists, otherwise undefined.
   */
  async getCachedResult(key: string): Promise<BidResult | undefined> {
    // Prefix the key to namespace it safely within Redis
    const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
    return this.cacheManager.get<BidResult>(redisKey);
  }

  /**
   * Stores the result of a successfully processed bid under the client's key.
   *
   * Called AFTER a bid is processed (win or loss). The result is cached in Redis
   * with a TTL so that any retries within the window receive the identical response.
   *
   * @param key The raw Idempotency-Key string from the request header.
   * @param result The BidResult returned by BidsService.placeBid() to be cached.
   */
  async cacheResult(key: string, result: BidResult): Promise<void> {
    const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
    // Store with a TTL so Redis auto-evicts stale keys without manual cleanup
    await this.cacheManager.set(
      redisKey,
      result,
      IDEMPOTENCY_TTL_SECONDS * 1000,
    );
  }
}
