/**
 * @fileoverview Unit tests for the IdempotencyService.
 *
 * Validates three scenarios:
 *   1. Cache MISS: getCachedResult returns undefined for a key never seen before.
 *   2. Cache HIT: getCachedResult returns the previously cached BidResult.
 *   3. cacheResult stores the result so subsequent lookups return it.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdempotencyService } from './idempotency.service';
import { BidResult } from '@auction/shared';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  /**
   * In-memory map simulating Redis for testing.
   * Avoids any live Redis dependency in the test environment.
   */
  const store = new Map<string, any>();

  const mockCacheManager = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: any) => { store.set(key, value); return Promise.resolve(); }),
  };

  beforeEach(async () => {
    store.clear(); // Reset in-memory store between tests
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  /** A fresh key with no prior history returns undefined (cache miss). */
  it('should return undefined for an unknown idempotency key (cache miss)', async () => {
    const result = await service.getCachedResult('brand-new-key');
    expect(result).toBeUndefined();
  });

  /** After caching a result, looking it up returns the exact same object. */
  it('should return the cached BidResult after storing it (cache hit)', async () => {
    const bidResult: BidResult = { success: true, message: 'Bid accepted.', new_price: 150 };

    await service.cacheResult('my-idempotency-key', bidResult);
    const cached = await service.getCachedResult('my-idempotency-key');

    expect(cached).toEqual(bidResult);
  });

  /** Two different keys never cross-contaminate each other's cached data. */
  it('should not return a result for a different idempotency key', async () => {
    const bidResult: BidResult = { success: true, message: 'Bid accepted.', new_price: 200 };

    await service.cacheResult('key-A', bidResult);
    const resultForKeyB = await service.getCachedResult('key-B');

    expect(resultForKeyB).toBeUndefined();
  });
});
