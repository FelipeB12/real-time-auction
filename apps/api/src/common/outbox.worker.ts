/**
 * @fileoverview Background worker that ensures reliable delivery of auction events.
 *
 * ARCHITECTURAL ROLE:
 * This worker implements the "Message Relay" half of the Transactional Outbox pattern.
 * It polls the `outbox` table for unprocessed events, publishes them to Redis Pub/Sub,
 * and marks them as processed—all within a controlled environment to ensure
 * that no event is lost, even if the primary API process crashes.
 *
 * HIGH-FREQUENCY CONSIDERATIONS:
 * - **Polling Interval:** Runs every 1 second (configurable).
 * - **Batching:** Processes multiple events in a single tick to handle spikes.
 * - **Self-Correction:** If publishing to Redis fails, the event remains
 *   `processed = false` and will be retried in the next tick.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outbox } from './entities/outbox.entity';
import Redis from 'ioredis';

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly redis: Redis;

  /**
   * @param outboxRepository TypeORM repository for reading and updating Outbox entries.
   */
  constructor(
    @InjectRepository(Outbox)
    private readonly outboxRepository: Repository<Outbox>,
  ) {
    // Initialize a dedicated Redis client for publishing events.
    // In a production environment, this would be injected via a configuration service.
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });

    this.logger.log('Outbox Worker initialized and connecting to Redis...');
  }

  /**
   * The core loop of the worker. Runs every second.
   *
   * 1. Finds all events where `processed = false`.
   * 2. Iterates through them and publishes to Redis Pub/Sub.
   * 3. Marks them as `processed = true` and updates `processed_at`.
   */
  @Cron(CronExpression.EVERY_SECOND)
  async processOutbox() {
    // Fetch a batch of unprocessed events.
    const unprocessedEvents = await this.outboxRepository.find({
      where: { processed: false },
      order: { created_at: 'ASC' },
      take: 50, // Process in batches of 50 to avoid blocking the event loop.
    });

    if (unprocessedEvents.length === 0) {
      return;
    }

    this.logger.debug(
      `Found ${unprocessedEvents.length} unprocessed events. Relaying to Redis...`,
    );

    for (const event of unprocessedEvents) {
      try {
        // Publish the event to a Redis channel named after the event type.
        // The WebSocket gateway will subscribe to these channels later.
        const channel = `auction:${event.type}`;
        await this.redis.publish(channel, JSON.stringify(event.payload));

        // Mark as processed only after successful publication.
        await this.outboxRepository.update(event.id, {
          processed: true,
          processed_at: new Date(),
        });

        this.logger.verbose(
          `Successfully relayed event ${event.id} to channel ${channel}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to relay event ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // We do NOT mark it as processed, so it will be retried in the next tick.
      }
    }
  }
}
