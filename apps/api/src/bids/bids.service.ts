/**
 * @fileoverview Service handling the core bid placement business logic.
 *
 * Architecture note — WHY this is a separate service from ProductsService:
 * The act of placing a bid is a write operation that spans TWO tables
 * (products + bids) within a single transaction. The ProductsService only
 * manages the Product lifecycle; BidsService owns the cross-table
 * transactional logic, keeping each service focused on a single responsibility.
 *
 * CONCURRENCY STRATEGY — Optimistic Locking via Atomic SQL:
 * In a high-frequency auction, multiple clients can submit bids within
 * the same millisecond. The naive approach (read price → compare → write)
 * creates a classic TOCTOU (Time-of-Check-Time-of-Use) race condition:
 *
 *   Client A reads price = $100 ✓ (passes check)
 *   Client B reads price = $100 ✓ (passes check simultaneously)
 *   Client A writes new price = $150
 *   Client B writes new price = $120 ← WRONG. Lower bid wins. Auction is now UNFAIR.
 *
 * The fix is to push the comparison INTO the SQL query itself:
 *
 *   UPDATE products
 *   SET current_price = $150, highest_bidder_id = 'user-A'
 *   WHERE id = 'item-uuid'
 *   AND current_price < $150   ← The database evaluates this check atomically.
 *
 * If Client A and Client B hit the DB simultaneously, only one UPDATE will
 * match the WHERE clause (`current_price < amount`) and return `affected = 1`.
 * The other will find `affected = 0` and is safely rejected. No distributed
 * locks required. No additional infrastructure. Pure SQL atomicity.
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuctionErrorCode } from '../common/errors.types';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { Outbox } from '../common/entities/outbox.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidResult, BidEvent } from '@auction/shared';

@Injectable()
export class BidsService {
  /**
   * @param productRepository TypeORM repository for querying product existence.
   * @param bidRepository TypeORM repository for inserting the winning bid record.
   * @param dataSource TypeORM DataSource providing the QueryRunner for raw SQL
   *                   execution within an explicit transaction boundary.
   */
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,

    // DataSource gives us a QueryRunner — the mechanism to issue raw SQL
    // statements within a manually managed transaction. This is required
    // because TypeORM's `.update()` helper does not support WHERE conditions
    // on multiple columns in a single atomic operation.
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Atomic bid placement handler with optimistic locking.
   *
   * Accepts a bid only if the submitted amount is strictly greater than the
   * product's `current_price` at the DATABASE level — not just in memory.
   * This single SQL check eliminates all race conditions at high concurrency.
   *
   * Transaction flow:
   *   1. Begin an explicit database transaction via QueryRunner.
   *   2. Confirm the target product exists (returns 404 if not).
   *   3. Issue an atomic UPDATE ... WHERE current_price < new_amount.
   *      If `affected = 0`, the bid lost the race — reject with 400.
   *   4. Insert an immutable Bid record in the same transaction for audit.
   *   5. Save a BidEvent to the Outbox table for reliable WebSocket notification.
   *   6. Commit the transaction. Both writes succeed or both roll back.
   *   7. Return a structured BidResult confirming the new accepted price.
   *
   * @param placeBidDto The incoming bid payload: item_id, user_id, amount.
   * @returns A BidResult indicating success with the newly accepted price.
   * @throws NotFoundException if no product with the given item_id exists.
   * @throws BadRequestException if another bid was accepted at the same instant
   *         (the atomic UPDATE found nothing to update — bid is stale).
   */
  async placeBid(placeBidDto: PlaceBidDto): Promise<BidResult> {
    const { item_id, user_id, amount } = placeBidDto;

    // — Step 1: Acquire a QueryRunner to manage a manual transaction.
    // Using a QueryRunner instead of the repository directly gives us
    // precise control over COMMIT and ROLLBACK behavior.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // — Step 2: Verify the product exists before issuing the costly UPDATE.
      // This use of the queryRunner's manager ensures this read participates
      // in the same transaction context.
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: item_id },
      });

      if (!product) {
        // Release resources before throwing — no commit or rollback needed
        // for a simple not-found check.
        await queryRunner.release();
        // Throw with a structured body so AuctionExceptionFilter emits the error_code
        throw new NotFoundException({
          error_code: AuctionErrorCode.ITEM_NOT_FOUND,
          message: `Auction item "${item_id}" does not exist. Cannot place bid.`,
        });
      }

      // — Step 3: THE CORE ATOMIC UPDATE.
      // This single SQL statement handles the entire concurrency problem.
      // The WHERE clause `current_price < :amount` is evaluated atomically
      // by PostgreSQL under its row-level locking. Only one concurrent
      // request can win this race — the one that executes first.
      //
      // If this query returns `affected = 0`, it means the bid was stale:
      // either another user submitted a higher bid in the same millisecond,
      // or the submitted amount was not greater than the current price.
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Product)
        .set({
          current_price: amount,
          highest_bidder_id: user_id,
        })
        .where('id = :item_id', { item_id })
        .andWhere('current_price < :amount', { amount })
        .execute();

      // If no rows were affected, this bid lost the atomic race.
      if (updateResult.affected === 0) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        // Throw with a structured body so AuctionExceptionFilter emits STALE_BID
        throw new BadRequestException({
          error_code: AuctionErrorCode.STALE_BID,
          message: `Bid of $${amount} was rejected. The current price has already moved to $${product.current_price} or higher.`,
        });
      }

      // — Step 4: Insert the immutable bid audit record IN THE SAME TRANSACTION.
      // If this insert fails, the entire transaction rolls back —
      // preventing the product price from updating without a corresponding record.
      const bid = queryRunner.manager.create(Bid, { item_id, user_id, amount });
      await queryRunner.manager.save(bid);

      // — Step 5: Save the event to the Transactional OUTBOX.
      // This ensures that even if Redis or the WebSocket gateway is down,
      // the event is captured and will be published eventually.
      const bidEvent: BidEvent = {
        item_id,
        new_price: amount,
        bidder_id: user_id,
        timestamp: new Date().toISOString(),
      };

      const outboxEntry = queryRunner.manager.create(Outbox, {
        type: 'bid.accepted',
        payload: bidEvent,
      });
      await queryRunner.manager.save(outboxEntry);

      // — Step 6: Commit all changes (Product update, Bid record, and Outbox event).
      await queryRunner.commitTransaction();

      // — Step 6: Return the standardized success result.
      return {
        success: true,
        message: 'Bid accepted successfully.',
        new_price: amount,
      };
    } catch (error) {
      // If any unexpected error occurs mid-transaction, roll back BOTH writes
      // to ensure the database is never left in a partially updated state.
      // Re-throw the error so NestJS can return the appropriate HTTP response.
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // ALWAYS release the QueryRunner back to the connection pool,
      // regardless of whether the transaction succeeded or failed.
      // Failing to release causes connection pool exhaustion under load.
      await queryRunner.release();
    }
  }
}
