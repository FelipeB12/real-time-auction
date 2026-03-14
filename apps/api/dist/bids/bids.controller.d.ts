import { BidsService } from './bids.service';
import { IdempotencyService } from '../common/idempotency.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult } from '@auction/shared';
export declare class BidsController {
    private readonly bidsService;
    private readonly idempotencyService;
    constructor(bidsService: BidsService, idempotencyService: IdempotencyService);
    placeBid(idempotencyKey: string, placeBidDto: PlaceBidDto): Promise<BidResult>;
}
