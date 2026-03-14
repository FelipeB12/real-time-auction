/**
 * @fileoverview WebSocket Gateway for real-time auction updates.
 *
 * ARCHITECTURAL ROLE:
 * This gateway serves as the "Broadcast" component of the Transactional Outbox pattern.
 * It does NOT handle bid placement (which is REST-based for idempotency and simplicity).
 * Instead, it subscribes to Redis Pub/Sub events published by the `OutboxWorker`
 * and pushes them to all connected clients via Socket.io.
 *
 * SCALABILITY:
 * By using Redis Pub/Sub as the backbone, we can scale the API to multiple 
 * instances. Every instance will receive the event from Redis and notify its 
 * own subset of connected users.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { BidEvent } from '@auction/shared';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict to your UI domain.
  },
  namespace: 'auction',
})
export class AuctionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  private readonly logger = new Logger(AuctionGateway.name);
  private readonly redisSubscriber: Redis;

  constructor() {
    // Dedicated Redis client for subscription (blocking).
    this.redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  /**
   * Called after the gateway is initialized.
   * Sets up the Redis subscription to listen for auction events.
   */
  afterInit() {
    this.logger.log('Auction WebSocket Gateway initialized.');

    // Subscribe to the bid acceptance channel.
    this.redisSubscriber.subscribe('auction:bid.accepted', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to Redis Pub/Sub:', err.message);
      } else {
        this.logger.log(`Subscribed to ${count} Redis channels. Listening for events...`);
      }
    });

    // Handle incoming messages from Redis.
    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === 'auction:bid.accepted') {
        this.handleBidAccepted(message);
      }
    });
  }

  /**
   * Internal handler for events received from Redis.
   * Broadcasts the payload to all connected clients in the 'auction' namespace.
   *
   * @param message The raw JSON string from Redis.
   */
  private handleBidAccepted(message: string) {
    try {
      const event: BidEvent = JSON.parse(message);
      this.logger.verbose(`Relaying bid update for item ${event.item_id}: ${event.new_price}`);
      
      // Emit the event to all connected clients.
      // Payload: item_id, new_price, bidder_id, timestamp.
      this.server.emit('bid_update', event);
    } catch (error) {
      this.logger.error('Failed to parse or relay bid event:', error.message);
    }
  }

  /**
   * Lifecycle hook for new client connections.
   */
  handleConnection(client: any) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Lifecycle hook for client disconnections.
   */
  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
