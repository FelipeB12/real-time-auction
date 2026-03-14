export interface Product {
    id: string;
    name: string;
    description?: string;
    current_price: number;
    highest_bidder_id?: string;
    created_at: Date;
    updated_at: Date;
}
export interface BidPlacedPayload {
    item_id: string;
    user_id: string;
    amount: number;
}
export interface BidResult {
    success: boolean;
    message: string;
    new_price?: number;
}
export interface BidEvent {
    item_id: string;
    new_price: number;
    bidder_id: string;
    timestamp: string;
}
