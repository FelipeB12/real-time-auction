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
exports.BidsController = void 0;
const common_1 = require("@nestjs/common");
const bids_service_1 = require("./bids.service");
const idempotency_service_1 = require("../common/idempotency.service");
const place_bid_dto_1 = require("./dto/place-bid.dto");
const errors_types_1 = require("../common/errors.types");
let BidsController = class BidsController {
    bidsService;
    idempotencyService;
    constructor(bidsService, idempotencyService) {
        this.bidsService = bidsService;
        this.idempotencyService = idempotencyService;
    }
    async placeBid(idempotencyKey, placeBidDto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException({
                error_code: errors_types_1.AuctionErrorCode.MISSING_IDEMPOTENCY_KEY,
                message: 'Missing required header: Idempotency-Key. Provide a unique UUID for every bid request.',
            });
        }
        const cachedResult = await this.idempotencyService.getCachedResult(idempotencyKey);
        if (cachedResult) {
            return cachedResult;
        }
        const result = await this.bidsService.placeBid(placeBidDto);
        await this.idempotencyService.cacheResult(idempotencyKey, result);
        return result;
    }
    async getHistory(itemId) {
        return this.bidsService.getHistory(itemId);
    }
};
exports.BidsController = BidsController;
__decorate([
    (0, common_1.Post)('place-bid'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Headers)('idempotency-key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, place_bid_dto_1.PlaceBidDto]),
    __metadata("design:returntype", Promise)
], BidsController.prototype, "placeBid", null);
__decorate([
    (0, common_1.Get)(':itemId/history'),
    __param(0, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BidsController.prototype, "getHistory", null);
exports.BidsController = BidsController = __decorate([
    (0, common_1.Controller)('bids'),
    __metadata("design:paramtypes", [bids_service_1.BidsService,
        idempotency_service_1.IdempotencyService])
], BidsController);
//# sourceMappingURL=bids.controller.js.map