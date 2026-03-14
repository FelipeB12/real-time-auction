import { Product as IProduct } from '@auction/shared';
export declare class Product implements IProduct {
    id: string;
    name: string;
    description?: string;
    current_price: number;
    highest_bidder_id?: string;
    created_at: Date;
    updated_at: Date;
}
