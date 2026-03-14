import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'socket.io';
export declare class AuctionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    private readonly redisSubscriber;
    constructor();
    afterInit(): void;
    private handleBidAccepted;
    handleConnection(client: any): void;
    handleDisconnect(client: any): void;
}
