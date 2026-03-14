import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Product } from './products/entities/product.entity';
import { Bid } from './bids/entities/bid.entity';
import { Outbox } from './common/entities/outbox.entity';
import { ProductsModule } from './products/products.module';
import { AuctionModule } from './auction/auction.module';
import { BidsModule } from './bids/bids.module';

/**
 * @fileoverview The root module of the NestJS application. It bootstraps 
 * the underlying frameworks and establishes the primary PostgreSQL connection 
 * mapping the core application entities.
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'auction_db',
      entities: [Product, Bid, Outbox],
      synchronize: true, 
    }),
    ProductsModule,
    AuctionModule,
    BidsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
