import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product as IProduct } from '@auction/shared';

/**
 * @fileoverview TypeORM Entity mapping the `Product` domain model to the `products`
 * database table. This class strictly implements the shared `IProduct` interface to
 * maintain parity between the database layer and client-side typings.
 */

/**
 * Real-world object available for bidding within the auction system.
 */
@Entity('products')
export class Product implements IProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  current_price: number;

  @Column({ nullable: true })
  highest_bidder_id?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
