import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * @fileoverview TypeORM Entity mapping user bids mapped to the `bids`
 * database table. It acts as an append-only historical record of all
 * auction attempts.
 */

/**
 * Represents a single monetary bid placed by a user on a specific product.
 */
@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  item_id: string;

  /**
   * The identifier of the user who placed this bid.
   * Stored as plain text (not uuid) to support both UUID-format identifiers
   * and human-readable VU ids such as "vu-user-007" used by load tests.
   */
  @Column()
  user_id: string;

  @Column('int', { default: 0 })
  accepted_count: number;

  @Column('int', { default: 0 })
  rejected_count: number;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn()
  created_at: Date;
}
