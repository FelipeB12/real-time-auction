/**
 * @fileoverview Exposes REST endpoints for Product CRUD operations.
 * Maps incoming external HTTP requests to internal ProductsService logic.
 */

import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  /**
   * Injects the required standard CRUD domain service into the controller.
   * 
   * @param productsService The deeply-injected business logic provider.
   */
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Handler for: POST /products
   * Receives JSON body from the client mapping exactly to CreateProductDto.
   * 
   * @param createProductDto Pre-validated DTO containing name, desc, etc.
   * @returns The generated Product object including assigned ID and timestamps.
   */
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  /**
   * Handler for: GET /products
   * Returns a complete list of all products in the database.
   * 
   * @returns An array mapping all existing products.
   */
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  /**
   * Handler for: GET /products/:id
   * Resolves a single Product based on requested dynamic `id` path variable.
   * 
   * @param id Extracted dynamically from the HTTP path /products/123 -> id=123
   * @returns The unique Product matching the UUID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * Handler for: PATCH /products/:id
   * Facilitates partial updates modifying existing products.
   * 
   * @param id The exact product UUID path variable.
   * @param updateProductDto Partial body fields representing intended changes.
   * @returns The mutated Product entity reflecting the database standard.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * Handler for: DELETE /products/:id
   * Instructs the database to permanently drop the specified product resource.
   * 
   * @param id The exact product UUID path variable targeted for deletion.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
