/**
 * @fileoverview Service handling the core bid placement business logic.
 *
 * Architecture note — WHY this is a separate service from ProductsService:
 * The act of placing a bid is a write operation that spans TWO tables
 * (products + bids) within a single transaction. The ProductsService only
 * manages the Product lifecycle; BidsService owns the cross-table
 * transactional logic, keeping each service focused on a single responsibility.
 *
 * Phases of this service:
 *   - Commit 7 (current): Baseline — simple sequential read-then-write. 
 *                         No concurrency protection yet. Intentional first step.
 *   - Commit 8 (next):    Atomic SQL update with optimistic locking to prevent 
 *                         race conditions at high-frequency bid volumes.
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult } from '@auction/shared';

@Injectable()
export class BidsService {
  /**
   * @param productRepository TypeORM repository for reading and updating Products.
   * @param bidRepository TypeORM repository for inserting new Bid records.
   * @param dataSource TypeORM DataSource, used for explicit transaction management.
   */
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,

    // DataSource is injected for manual QueryRunner transactions.
    // This is the foundation that will power our atomic update in the next commit.
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Baseline bid placement handler (no concurrency control).
   *
   * IMPORTANT: This is an intentional baseline implementation designed to establish
   * correctness before introducing atomic locking. The next commit will replace the
   * sequential read-then-write pattern here with a single atomic SQL UPDATE to make
   * this race-condition-proof under high-frequency concurrent load.
   *
   * Current flow:
   *   1. Validate the target product exists.
   *   2. Check the incoming bid amount is strictly greater than the current price.
   *   3. Update the product's current_price and highest_bidder_id.
   *   4. Insert an immutable Bid record into the bids table.
   *   5. Return a structured BidResult confirming success.
   *
   * @param placeBidDto The incoming bid payload: item_id, user_id, amount.
   * @returns A BidResult indicating success with the new accepted price.
   * @throws NotFoundException if the product does not exist.
   * @throws BadRequestException if the bid amount is not higher than the current price.
   */
  async placeBid(placeBidDto: PlaceBidDto): Promise<BidResult> {
    const { item_id, user_id, amount } = placeBidDto;

    // — Step 1: Confirm the product exists. Return 404 if not found.
    const product = await this.productRepository.findOne({
      where: { id: item_id },
    });

    if (!product) {
      throw new NotFoundException(
        `Auction item "${item_id}" does not exist. Cannot place bid.`,
      );
    }

    // — Step 2: Business rule — a bid must strictly exceed the current price.
    // NOTE: This check is intentionally a simple in-memory comparison at baseline.
    // In the next commit, this check will move into the SQL WHERE clause itself,
    // making it atomic and race-condition-proof at the database level.
    if (amount <= product.current_price) {
      throw new BadRequestException(
        `Bid amount $${amount} must be greater than the current price of $${product.current_price}.`,
      );
    }

    // — Step 3: Update the product to reflect the new winning bid price and bidder.
    await this.productRepository.update(item_id, {
      current_price: amount,
      highest_bidder_id: user_id,
    });

    // — Step 4: Append an immutable record to the bids table for audit history.
    const bid = this.bidRepository.create({ item_id, user_id, amount });
    await this.bidRepository.save(bid);

    // — Step 5: Return the standardized result following the shared BidResult interface.
    return {
      success: true,
      message: 'Bid accepted successfully.',
      new_price: amount,
    };
  }
}
