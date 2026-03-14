/**
 * @fileoverview Shared TypeScript types defining the core data structures
 * for the High-Frequency Auction Platform. These interfaces ensure
 * complete type safety across both the NestJS API and the React Vite UI.
 */
/**
 * Represents an auctionable item within the platform.
 */
export interface Product {
    id: string;
    name: string;
    description?: string;
    current_price: number;
    highest_bidder_id?: string;
    created_at: Date;
    updated_at: Date;
}
/**
 * Payload expected from clients when attempting to place a new bid.
 */
export interface BidPlacedPayload {
    item_id: string;
    user_id: string;
    amount: number;
}
/**
 * Standardized response returned by the API after processing a bid attempt.
 */
export interface BidResult {
    success: boolean;
    message: string;
    new_price?: number;
}
/**
 * Event structure broadcasted over WebSockets via Redis Pub/Sub
 * to immediately notify connected clients of a new leading bid.
 */
export interface BidEvent {
    item_id: string;
    new_price: number;
    bidder_id: string;
    timestamp: string;
}
