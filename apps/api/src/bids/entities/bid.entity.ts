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

  @Column('uuid')
  user_id: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn()
  created_at: Date;
}
