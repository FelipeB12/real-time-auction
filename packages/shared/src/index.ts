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
  accepted_count: number;
  rejected_count: number;
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
  bidder_id?: string;
  accepted_count: number;
  rejected_count: number;
  timestamp: string;
}

/**
 * Event emitted directly from BidsService when a bid is rejected
 * (e.g., STALE_BID — another bid won the race).
 * Allows the UI to display ALL rejections including those from VUs.
 */
export interface BidRejectedEvent {
  item_id: string;
  bidder_id: string;
  attempted_amount: number;
  reason: string;
  accepted_count: number;
  rejected_count: number;
  timestamp: string;
}
