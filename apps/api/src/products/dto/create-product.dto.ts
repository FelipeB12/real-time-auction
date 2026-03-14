/**
 * @fileoverview Data Transfer Object (DTO) for creating a new product.
 * This file defines the exact payload shape expected from the client
 * when establishing a new auction item in the system.
 */

export class CreateProductDto {
  /**
   * The human-readable title or name of the auction product.
   * Required field.
   */
  name: string;

  /**
   * Optional long-form description of the product detailing its condition or history.
   */
  description?: string;

  /**
   * The starting price of the auction. If not provided, the database
   * will default this to 0. It is defined as an optional number to
   * allow flexibility during creation.
   */
  current_price?: number;
}
