import { AwardPointsPayload, IdempotencyKey } from '@vanth/shared';

export interface IdempotencyStore {
  buildKey(payload: AwardPointsPayload): IdempotencyKey;
  wasProcessed(key: IdempotencyKey): Promise<boolean>;
  markProcessed(key: IdempotencyKey, transactionId: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, string>();

  buildKey(payload: AwardPointsPayload): IdempotencyKey {
    return {
      userId: payload.userId,
      guildId: payload.guildId,
      actionType: payload.actionType,
      referenceId: payload.referenceId,
    };
  }

  async wasProcessed(key: IdempotencyKey): Promise<boolean> {
    return this.processed.has(this.serialize(key));
  }

  async markProcessed(key: IdempotencyKey, transactionId: string): Promise<void> {
    this.processed.set(this.serialize(key), transactionId);
  }

  private serialize(key: IdempotencyKey): string {
    return `${key.guildId}:${key.userId}:${key.actionType}:${key.referenceId}`;
  }
}
