import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { AuctionStateDto } from './dto/auction-state.dto';
export declare class AuctionService {
    private readonly productRepository;
    constructor(productRepository: Repository<Product>);
    getAuctionState(itemId: string): Promise<AuctionStateDto>;
}
