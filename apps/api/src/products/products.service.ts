/**
 * @fileoverview Main Service managing standard CRUD operations for Products.
 * Acts as the centralized domain logic layer separating the REST controller
 * from direct database TypeORM operations.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  /**
   * Initializes the ProductsService with the required database repository.
   *
   * @param productRepository Auto-injected TypeORM repository for the Product entity.
   */
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Creates and persists a new auction product into the database.
   *
   * @param createProductDto Client payload containing product name, description, and starting price.
   * @returns A promise that resolves to the newly saved Product entity complete with database UUID.
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    // 1. Map the pristine DTO into a valid TypeORM Entity instance
    const product = this.productRepository.create(createProductDto);
    // 2. Execute the INSERT SQL transaction and return the result
    return this.productRepository.save(product);
  }

  /**
   * Retrieves all active products currently available in the system.
   *
   * @returns A promise resolving to an array of all Product records.
   */
  async findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  /**
   * Fetches a specific product by its exact database UUID.
   *
   * @param id The unique identifier (UUID) of the product.
   * @returns A promise resolving to the found Product entity.
   * @throws NotFoundException if no product matching the UUID is found in the database.
   */
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });

    // Explicit safety check to prevent returning undefined to the controller
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Updates an existing product using partial payload parameters.
   *
   * @param id The string UUID of the target product.
   * @param updateProductDto The subset of fields the client wishes to safely update.
   * @returns A promise resolving to the newly updated Product state.
   * @throws NotFoundException inherited from the findOne call if the id is invalid.
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    // 1. Establish existence of the entity first. Throws organically if missing.
    const product = await this.findOne(id);
    // 2. Deep merge the existing DB object with the incoming changed fields
    const updated = this.productRepository.merge(product, updateProductDto);
    // 3. Persist the updated state back to PostgreSQL
    return this.productRepository.save(updated);
  }

  /**
   * Completely destroys a product record from the database.
   *
   * @param id The string UUID of the product to delete.
   * @returns A void promise denoting success without a payload.
   * @throws NotFoundException inherited from findOne call if missing.
   */
  async remove(id: string): Promise<void> {
    // 1. Safety check to ensure the item exists before attempting SQL deletion
    const product = await this.findOne(id);
    // 2. Perform the destructive action
    await this.productRepository.remove(product);
  }
}
