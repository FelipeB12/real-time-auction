/**
 * @fileoverview Data Transfer Object for the POST /place-bid endpoint.
 *
 * Defines the exact JSON payload shape a client must send to attempt placing
 * a bid. Validates that all three required fields are present.
 *
 * This DTO is intentionally kept simple at this baseline stage.
 * In the next commit, validation decorators (class-validator) will be added
 * to enforce non-empty strings and positive number amounts.
 */

export class PlaceBidDto {
  /**
   * The UUID of the product (auction item) the user is bidding on.
   * Must correspond to an existing product in the database.
   */
  item_id: string;

  /**
   * The UUID of the authenticated user placing the bid.
   * At this baseline stage, it is accepted as-is from the request body.
   * Future commits will derive this from the JWT auth token instead.
   */
  user_id: string;

  /**
   * The monetary amount the user is willing to pay, in the platform's base currency.
   * Must be a positive number. Race condition rejection (amount <= current_price)
   * is handled at the service level, not here.
   */
  amount: number;
}
