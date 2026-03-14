/**
 * @fileoverview Data Transfer Object (DTO) for updating an existing product.
 * It extends the base CreateProductDto but makes all fields optional using
 * NestJS's PartialType utility, allowing clients to send partial updates (PATCH).
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * Update payload class. Automatically inherits the JSDoc documented properties
 * from CreateProductDto but wraps them sequentially as optional.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
