import { Repository } from 'typeorm';
import { Outbox } from './entities/outbox.entity';
export declare class OutboxWorker {
    private readonly outboxRepository;
    private readonly logger;
    private readonly redis;
    constructor(outboxRepository: Repository<Outbox>);
    processOutbox(): Promise<void>;
}
