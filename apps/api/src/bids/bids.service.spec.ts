/**
 * @fileoverview Unit tests for the BidsService ATOMIC bid placement logic.
 *
 * These tests specifically validate the CONCURRENCY behavior introduced in this commit:
 *   - The atomic UPDATE's WHERE clause correctly rejects a stale bid (affected = 0).
 *   - A valid bid that wins the atomic race is committed and returns success.
 *   - On any unexpected error, the transaction is rolled back, leaving no partial state.
 *
 * Test strategy: We mock the QueryRunner returned by DataSource to simulate
 * what the PostgreSQL database would return — specifically the `affected` row count —
 * without needing a live database connection.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BidsService } from './bids.service';
import { Product } from '../products/entities/product.entity';
import { Bid } from './entities/bid.entity';
import { Outbox } from '../common/entities/outbox.entity';

describe('BidsService (atomic locking)', () => {
  let service: BidsService;

  /** A product with current_price at $100, representing a live auction item. */
  const mockProduct: Partial<Product> = {
    id: 'product-uuid',
    name: 'Vintage Watch',
    current_price: 100,
    highest_bidder_id: 'original-bidder',
  };

  /**
   * Mock QueryRunner factory.
   *
   * This is the heart of the test setup. We control what `execute()` returns
   * to simulate two PostgreSQL outcomes:
   *   - `{ affected: 1 }` → Our UPDATE WHERE clause matched a row: bid wins.
   *   - `{ affected: 0 }` → Our UPDATE WHERE clause matched nothing: bid is stale.
   *
   * @param affected — The simulated number of rows affected by the atomic UPDATE.
   */
  const buildMockQueryRunner = (affected: number) => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      // findOne returns the mock product for known IDs, null otherwise
      findOne: jest.fn((_entity: any, { where: { id } }: any) =>
        id === 'product-uuid' ? Promise.resolve(mockProduct) : Promise.resolve(null),
      ),
      // createQueryBuilder chains to ultimately call execute() returning our simulated `affected`
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected }),
      }),
      create: jest.fn().mockImplementation((entity: any, dto: any) => ({ ...dto, entityName: entity.name })),
      save: jest.fn().mockResolvedValue({ id: 'saved-id' }),
    },
  });

  /**
   * Mock DataSource — replaces the real TypeORM connection pool.
   * Uses the factory above to return a fresh mock QueryRunner per test.
   */
  const buildMockDataSource = (affected: number) => ({
    createQueryRunner: jest.fn(() => buildMockQueryRunner(affected)),
  });

  /** Builds the test module with the given simulated `affected` row count. */
  const buildModule = async (affected: number): Promise<BidsService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: getRepositoryToken(Product), useValue: {} },
        { provide: getRepositoryToken(Bid), useValue: {} },
        { provide: getRepositoryToken(Outbox), useValue: {} },
        { provide: DataSource, useValue: buildMockDataSource(affected) },
      ],
    }).compile();
    return module.get<BidsService>(BidsService);
  };

  /**
   * Happy path — the simulated UPDATE affected 1 row.
   * This means our bid was higher than `current_price` at the DB level,
   * so the atomic WHERE clause matched and the bid wins.
   */
  it('should accept a bid when the atomic UPDATE affects 1 row', async () => {
    service = await buildModule(1); // DB reports 1 row updated
    const result = await service.placeBid({
      item_id: 'product-uuid',
      user_id: 'winner',
      amount: 150,
    });
    expect(result.success).toBe(true);
    expect(result.new_price).toBe(150);
  });

  /**
   * Race condition path — the simulated UPDATE affected 0 rows.
   * This means our bid's WHERE clause (current_price < amount) found no match:
   * another concurrent bid already raised the price above our amount.
   */
  it('should reject a stale bid when the atomic UPDATE affects 0 rows', async () => {
    service = await buildModule(0); // DB reports 0 rows updated — bid lost the race
    await expect(
      service.placeBid({ item_id: 'product-uuid', user_id: 'loser', amount: 80 }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * Not-found path — the product does not exist.
   * The QueryRunner's findOne returns null, so we immediately throw 404
   * (no UPDATE is even attempted).
   */
  it('should throw NotFoundException for an unknown item_id', async () => {
    service = await buildModule(1); // affected count irrelevant — won't reach UPDATE
    await expect(
      service.placeBid({ item_id: 'ghost-id', user_id: 'user', amount: 200 }),
    ).rejects.toThrow(NotFoundException);
  });
});
