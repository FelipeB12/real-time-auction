import { Repository, DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult, BidEvent } from '@auction/shared';
import { AuctionGateway } from '../auction/auction.gateway';
export declare class BidsService {
    private readonly productRepository;
    private readonly bidRepository;
    private readonly dataSource;
    private readonly auctionGateway;
    constructor(productRepository: Repository<Product>, bidRepository: Repository<Bid>, dataSource: DataSource, auctionGateway: AuctionGateway);
    placeBid(placeBidDto: PlaceBidDto): Promise<BidResult>;
    getHistory(itemId: string, limit?: number): Promise<BidEvent[]>;
}
