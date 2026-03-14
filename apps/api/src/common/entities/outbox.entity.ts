/**
 * @fileoverview TypeORM Entity for the Transactional Outbox pattern.
 *
 * ARCHITECTURAL PURPOSE:
 * In a high-frequency system, we must update the Database (ground truth) 
 * and notify the WebSockets (real-time stream). Doing both is a "dual-write" 
 * problem. If we update the DB but Redis/WebSockets fail, the UI becomes stale.
 *
 * The Transactional Outbox solves this by saving the "Notification Event" into 
 * the SAME database transaction as the business logic.
 *
 * 1. Start Transaction.
 * 2. Update Product Price.
 * 3. Save "BidPlaced" event to this Outbox table.
 * 4. Commit Transaction.
 *
 * Now, even if the server crashes exactly after the commit, the event is 
 * durable in the DB. A background worker (Step 2) will reliably pick it up 
 * and push it to Redis later.
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('outbox')
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifies the type of event (e.g., 'bid.accepted').
   * Allows the background worker to decide how to process/route the payload.
   */
  @Column()
  type: string;

  /**
   * The actual event data stored as JSON.
   * For bids, this includes item_id, new_price, bidder_id, and timestamp.
   */
  @Column('jsonb')
  payload: any;

  /**
   * Indicates if this event has been successfully published to the message broker (Redis).
   * Defaults to false. The worker will set this to true after publishing.
   */
  @Column({ default: false })
  processed: boolean;

  /**
   * Timestamp of when the event was generated within the bid transaction.
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Timestamp of when the background worker successfully processed this event.
   * Null until `processed` becomes true.
   */
  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;
}
