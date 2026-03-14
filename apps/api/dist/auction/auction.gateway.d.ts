import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class AuctionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    private readonly redisSubscriber;
    constructor();
    afterInit(): void;
    private handleBidAccepted;
    emitBidRejected(event: any): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
}
