import { Repository, DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult } from '@auction/shared';
export declare class BidsService {
    private readonly productRepository;
    private readonly bidRepository;
    private readonly dataSource;
    constructor(productRepository: Repository<Product>, bidRepository: Repository<Bid>, dataSource: DataSource);
    placeBid(placeBidDto: PlaceBidDto): Promise<BidResult>;
}
