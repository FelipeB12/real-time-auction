import { AuctionService } from './auction.service';
import { AuctionStateDto } from './dto/auction-state.dto';
export declare class AuctionController {
    private readonly auctionService;
    constructor(auctionService: AuctionService);
    getState(itemId: string): Promise<AuctionStateDto>;
}
