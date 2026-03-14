"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const errors_types_1 = require("../common/errors.types");
const product_entity_1 = require("../products/entities/product.entity");
const bid_entity_1 = require("./entities/bid.entity");
const outbox_entity_1 = require("../common/entities/outbox.entity");
let BidsService = class BidsService {
    productRepository;
    bidRepository;
    dataSource;
    constructor(productRepository, bidRepository, dataSource) {
        this.productRepository = productRepository;
        this.bidRepository = bidRepository;
        this.dataSource = dataSource;
    }
    async placeBid(placeBidDto) {
        const { item_id, user_id, amount } = placeBidDto;
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const product = await queryRunner.manager.findOne(product_entity_1.Product, {
                where: { id: item_id },
            });
            if (!product) {
                await queryRunner.release();
                throw new common_1.NotFoundException({
                    error_code: errors_types_1.AuctionErrorCode.ITEM_NOT_FOUND,
                    message: `Auction item "${item_id}" does not exist. Cannot place bid.`,
                });
            }
            const updateResult = await queryRunner.manager
                .createQueryBuilder()
                .update(product_entity_1.Product)
                .set({
                current_price: amount,
                highest_bidder_id: user_id,
            })
                .where('id = :item_id', { item_id })
                .andWhere('current_price < :amount', { amount })
                .execute();
            if (updateResult.affected === 0) {
                await queryRunner.rollbackTransaction();
                await queryRunner.release();
                throw new common_1.BadRequestException({
                    error_code: errors_types_1.AuctionErrorCode.STALE_BID,
                    message: `Bid of $${amount} was rejected. The current price has already moved to $${product.current_price} or higher.`,
                });
            }
            const bid = queryRunner.manager.create(bid_entity_1.Bid, { item_id, user_id, amount });
            await queryRunner.manager.save(bid);
            const bidEvent = {
                item_id,
                new_price: amount,
                bidder_id: user_id,
                timestamp: new Date().toISOString(),
            };
            const outboxEntry = queryRunner.manager.create(outbox_entity_1.Outbox, {
                type: 'bid.accepted',
                payload: bidEvent,
            });
            await queryRunner.manager.save(outboxEntry);
            await queryRunner.commitTransaction();
            return {
                success: true,
                message: 'Bid accepted successfully.',
                new_price: amount,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.BidsService = BidsService;
exports.BidsService = BidsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(1, (0, typeorm_1.InjectRepository)(bid_entity_1.Bid)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], BidsService);
//# sourceMappingURL=bids.service.js.map