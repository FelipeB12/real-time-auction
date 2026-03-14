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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OutboxWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const outbox_entity_1 = require("./entities/outbox.entity");
const ioredis_1 = __importDefault(require("ioredis"));
let OutboxWorker = OutboxWorker_1 = class OutboxWorker {
    outboxRepository;
    logger = new common_1.Logger(OutboxWorker_1.name);
    redis;
    constructor(outboxRepository) {
        this.outboxRepository = outboxRepository;
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        });
        this.logger.log('Outbox Worker initialized and connecting to Redis...');
    }
    async processOutbox() {
        const unprocessedEvents = await this.outboxRepository.find({
            where: { processed: false },
            order: { created_at: 'ASC' },
            take: 50,
        });
        if (unprocessedEvents.length === 0) {
            return;
        }
        this.logger.debug(`Found ${unprocessedEvents.length} unprocessed events. Relaying to Redis...`);
        for (const event of unprocessedEvents) {
            try {
                const channel = `auction:${event.type}`;
                await this.redis.publish(channel, JSON.stringify(event.payload));
                await this.outboxRepository.update(event.id, {
                    processed: true,
                    processed_at: new Date(),
                });
                this.logger.verbose(`Successfully relayed event ${event.id} to channel ${channel}`);
            }
            catch (error) {
                this.logger.error(`Failed to relay event ${event.id}: ${error.message}`);
            }
        }
    }
};
exports.OutboxWorker = OutboxWorker;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_SECOND),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OutboxWorker.prototype, "processOutbox", null);
exports.OutboxWorker = OutboxWorker = OutboxWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(outbox_entity_1.Outbox)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], OutboxWorker);
//# sourceMappingURL=outbox.worker.js.map