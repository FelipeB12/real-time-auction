/**
 * @fileoverview Unit tests validating the core functionality of the ProductsService.
 * Uses Jest and NestJS's TestingModule to isolate the service and mock the 
 * underlying TypeORM PostgreSQL repository for fast, deterministic testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: Repository<Product>;

  /**
   * Mock implementation of the TypeORM repository.
   * Prevents tests from actually hitting an external database.
   * Simulates successful database persistence by instantly returning
   * the payload stitched with a fake UUID.
   */
  const mockProductRepository = {
    create: jest.fn().mockImplementation(dto => dto),
    save: jest.fn().mockImplementation(product => Promise.resolve({ id: 'uuid-1', ...product })),
    find: jest.fn().mockResolvedValue([{ id: 'uuid-1', name: 'Test Product' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'uuid-1', name: 'Test Product' }),
    merge: jest.fn().mockImplementation((entity, dto) => ({ ...entity, ...dto })),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  /**
   * Runs before every individual `it` block. 
   * Recompiles a fresh dependency injection module mapping the mock 
   * repository to the actual ProductsService constructor.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  /**
   * Minimal sanity check validating that the TestingModule successfully
   * instantiated the service class.
   */
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Validates that when a valid product payload is dispatched to `.create()`,
   * it is successfully saved and the generated UUID is mapped back dynamically.
   */
  it('should create a product', async () => {
    const dto = { name: 'New Item', current_price: 100 };
    expect(await service.create(dto)).toEqual({
      id: 'uuid-1',
      name: 'New Item',
      current_price: 100,
    });
  });

  /**
   * Validates that standard aggregation returns an array of structured entities.
   */
  it('should find all products', async () => {
    expect(await service.findAll()).toEqual([{ id: 'uuid-1', name: 'Test Product' }]);
  });
});
