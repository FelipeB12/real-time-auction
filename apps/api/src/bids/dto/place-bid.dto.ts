import { IsUUID, IsString, IsNumber, IsPositive } from 'class-validator';

/**
 * @fileoverview Data Transfer Object for the POST /place-bid endpoint.
 *
 * Defines the exact JSON payload shape a client must send to attempt placing
 * a bid. Uses class-validator to enforce strict type safety and data integrity,
 * preventing invalid UUIDs or amounts from reaching the business logic.
 */
export class PlaceBidDto {
  /**
   * The UUID of the product (auction item) the user is bidding on.
   */
  @IsUUID('4', { message: 'item_id must be a valid UUID v4' })
  item_id: string;

  /**
   * The ID of the authenticated user placing the bid.
   * Note: In a production system, this would be a UUID.
   */
  @IsString()
  user_id: string;

  /**
   * The monetary amount the user is willing to pay.
   * Must be a positive number.
   */
  @IsNumber()
  @IsPositive()
  amount: number;
}
