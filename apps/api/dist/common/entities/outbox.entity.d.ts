export declare class Outbox {
    id: string;
    type: string;
    payload: any;
    processed: boolean;
    created_at: Date;
    processed_at: Date;
}
