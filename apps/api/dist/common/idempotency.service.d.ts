import type { Cache } from 'cache-manager';
import { BidResult } from '@auction/shared';
export declare class IdempotencyService {
    private readonly cacheManager;
    constructor(cacheManager: Cache);
    getCachedResult(key: string): Promise<BidResult | undefined>;
    cacheResult(key: string, result: BidResult): Promise<void>;
}
