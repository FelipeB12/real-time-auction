/**
 * @fileoverview Unit tests for AuctionService.
 *
 * Validates the correctness of the `getAuctionState()` method covering:
 *   - Successful state retrieval for a valid auction item.
 *   - Proper NotFoundException thrown for non-existent items.
 *   - Correct DTO shape mapping from raw Product entity to AuctionStateDto.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { Product } from '../products/entities/product.entity';

describe('AuctionService', () => {
  let service: AuctionService;

  /** Mocked product representing a live auction item with an active bid. */
  const mockProduct: Partial<Product> = {
    id: 'item-uuid-123',
    name: 'Vintage Guitar',
    current_price: 250.0,
    highest_bidder_id: 'user-uuid-456',
  };

  /**
   * Mock repository with two scenarios:
   *  - findOne with a valid UUID → returns the mockProduct
   *  - findOne with an unknown UUID → returns null (simulating no DB match)
   */
  const mockProductRepository = {
    findOne: jest.fn(({ where: { id } }) => {
      if (id === 'item-uuid-123') return Promise.resolve(mockProduct);
      return Promise.resolve(null);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
  });

  /** Sanity check: service was instantiated via DI correctly. */
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Happy path: valid itemId returns a correctly shaped AuctionStateDto
   * with all required fields populated from the product entity.
   */
  it('should return auction state for a valid item ID', async () => {
    const state = await service.getAuctionState('item-uuid-123');

    expect(state.item_id).toBe('item-uuid-123');
    expect(state.name).toBe('Vintage Guitar');
    expect(state.current_price).toBe(250.0);
    expect(state.highest_bidder_id).toBe('user-uuid-456');
    // The snapshot_at should be a valid ISO date string
    expect(new Date(state.snapshot_at).toISOString()).toBe(state.snapshot_at);
  });

  /**
   * Failure path: an unknown itemId should throw NotFoundException immediately.
   * This prevents clients from silently consuming empty state.
   */
  it('should throw NotFoundException for an unknown item ID', async () => {
    await expect(service.getAuctionState('unknown-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
