/**
 * @fileoverview Unit tests for the BidsService baseline bid placement logic.
 *
 * Tests the two key scenarios of the baseline implementation:
 *   1. SUCCESS — A bid higher than the current price is correctly accepted.
 *   2. REJECTION — A bid equal to or lower than the current price is rejected with BadRequestException.
 *   3. NOT FOUND — A bid for a non-existent product yields NotFoundException.
 *
 * NOTE: These tests validate the BASELINE behavior (sequential read-then-write).
 * Concurrency tests are added in the next commit once atomic locking is in place.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BidsService } from './bids.service';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';

describe('BidsService (baseline)', () => {
  let service: BidsService;

  /** A product with current_price at $100, used as the baseline auction state. */
  const mockProduct: Partial<Product> = {
    id: 'product-uuid',
    name: 'Vintage Watch',
    current_price: 100,
    highest_bidder_id: 'original-bidder',
  };

  /** Mock product repository: findOne returns the mock product or null. */
  const mockProductRepo = {
    findOne: jest.fn(({ where: { id } }) =>
      id === 'product-uuid' ? Promise.resolve(mockProduct) : Promise.resolve(null),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  /** Mock bid repository: simply acknowledges the save without hitting the DB. */
  const mockBidRepo = {
    create: jest.fn().mockImplementation(dto => dto),
    save: jest.fn().mockResolvedValue({ id: 'bid-uuid', ...mockProduct }),
  };

  /** Mock DataSource: no actual transaction management needed at baseline. */
  const mockDataSource = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
  });

  /**
   * Happy path: a bid strictly above the current price of $100 should be accepted.
   */
  it('should accept a valid bid higher than current price', async () => {
    const result = await service.placeBid({
      item_id: 'product-uuid',
      user_id: 'new-bidder',
      amount: 150,
    });

    expect(result.success).toBe(true);
    expect(result.new_price).toBe(150);
  });

  /**
   * Rejection path: a bid equal to the current price must be rejected immediately.
   */
  it('should reject a bid equal to or lower than current price', async () => {
    await expect(
      service.placeBid({ item_id: 'product-uuid', user_id: 'cheater', amount: 50 }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * Safety path: a bid for a non-existent product UUID yields a 404 Not Found.
   */
  it('should throw NotFoundException for unknown item_id', async () => {
    await expect(
      service.placeBid({ item_id: 'ghost-id', user_id: 'user', amount: 999 }),
    ).rejects.toThrow(NotFoundException);
  });
});
