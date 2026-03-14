export declare enum AuctionErrorCode {
    STALE_BID = "STALE_BID",
    ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
    MISSING_IDEMPOTENCY_KEY = "MISSING_IDEMPOTENCY_KEY"
}
export interface AuctionErrorResponse {
    statusCode: number;
    error_code: AuctionErrorCode;
    message: string;
    timestamp: string;
    path: string;
}
