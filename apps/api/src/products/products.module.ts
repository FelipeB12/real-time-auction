/**
 * @fileoverview Module encapsulating the Product domain layer.
 * 
 * Registers the TypeORM `Product` entity allowing `@InjectRepository` access
 * within the encapsulated services. Exports the ProductsService so other modules
 * (like Bids or WebSockets) can query products if required later.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';

@Module({
  imports: [
    // Registers the database mapped table explicitly locally within this module.
    TypeOrmModule.forFeature([Product])
  ],
  controllers: [
    // Exposes the API REST endpoints
    ProductsController
  ],
  providers: [
    // Internal encapsulated logic provider
    ProductsService
  ],
  exports: [
    // Ensures other external modules have permission to inject the ProductsService
    ProductsService
  ],
})
export class ProductsModule {}
