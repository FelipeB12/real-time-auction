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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuctionGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const ioredis_1 = __importDefault(require("ioredis"));
let AuctionGateway = AuctionGateway_1 = class AuctionGateway {
    server;
    logger = new common_1.Logger(AuctionGateway_1.name);
    redisSubscriber;
    constructor() {
        this.redisSubscriber = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        });
    }
    afterInit() {
        this.logger.log('Auction WebSocket Gateway initialized.');
        this.redisSubscriber.subscribe('auction:bid.accepted', (err, count) => {
            if (err) {
                this.logger.error('Failed to subscribe to Redis Pub/Sub:', err.message);
            }
            else {
                this.logger.log(`Subscribed to ${count} Redis channels. Listening for events...`);
            }
        });
        this.redisSubscriber.on('message', (channel, message) => {
            if (channel === 'auction:bid.accepted') {
                this.handleBidAccepted(message);
            }
        });
    }
    handleBidAccepted(message) {
        try {
            const event = JSON.parse(message);
            this.logger.verbose(`Relaying bid update for item ${event.item_id}: ${event.new_price}`);
            this.server.emit('bid_update', event);
        }
        catch (error) {
            this.logger.error('Failed to parse or relay bid event:', error.message);
        }
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
};
exports.AuctionGateway = AuctionGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AuctionGateway.prototype, "server", void 0);
exports.AuctionGateway = AuctionGateway = AuctionGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: 'auction',
    }),
    __metadata("design:paramtypes", [])
], AuctionGateway);
//# sourceMappingURL=auction.gateway.js.map