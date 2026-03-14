/**
 * @fileoverview Structured error response types for the Auction API.
 *
 * PROBLEM — Why Custom Error Schemas Matter:
 * NestJS's default exception response is simple but imprecise from a client's perspective:
 *   { "statusCode": 400, "message": "Some message", "error": "Bad Request" }
 *
 * In a financial auction system, the client needs machine-readable `error_code` values
 * to make smart decisions automatically:
 *
 *   - `STALE_BID`         → User was outbid at the last millisecond. Show "Outbid! Current price is $X"
 *   - `ITEM_NOT_FOUND`    → Show "This auction has ended or was removed."
 *   - `IDEMPOTENT_REPLAY` → Inform the UI this is a replay, not a new result.
 *   - `MISSING_KEY`       → SDK integration error: remind developer to add the header.
 *
 * These codes are stable string identifiers that clients can switch on, independent
 * of the human-readable `message` text which may change across versions.
 */

/**
 * Enumeration of all well-defined auction error codes.
 * Clients should switch on these codes to present context-aware UI messages.
 */
export enum AuctionErrorCode {
  /**
   * The submitted bid amount was not strictly higher than the current price
   * at the moment of database evaluation. This is the expected "you were outbid"
   * outcome in a concurrent high-frequency system.
   */
  STALE_BID = 'STALE_BID',

  /**
   * The target auction item does not exist in the database.
   * Either it was never created or has been removed.
   */
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',

  /**
   * The Idempotency-Key header was missing from the request.
   * All bid requests must include this header to prevent duplicate processing.
   */
  MISSING_IDEMPOTENCY_KEY = 'MISSING_IDEMPOTENCY_KEY',
}

/**
 * The standardized error response envelope returned by the API for all
 * 4xx errors related to the bidding domain.
 *
 * All fields are guaranteed to be present on every error response, so clients
 * can safely destructure without checking for undefined.
 */
export interface AuctionErrorResponse {
  /** HTTP status code (mirrors the HTTP response status). */
  statusCode: number;

  /** Machine-readable error code. Clients should switch on this value. */
  error_code: AuctionErrorCode;

  /**
   * Human-readable description intended for developers and logs.
   * DO NOT rely on this string in client logic — it may change between versions.
   */
  message: string;

  /** ISO 8601 timestamp of when the error occurred on the server. */
  timestamp: string;

  /** The request path that produced the error, for debug tracing. */
  path: string;
}
