import { randomUUID } from 'node:crypto';

import {
  AwardPointsPayload,
  IngestSource,
  logger,
  PointsTransaction,
} from '@vanth/shared';

import { IdempotencyStore } from '../storage/idempotency-store.js';
import { RoleMultiplierService } from './multipliers.js';
import type { PointsService } from './points-service.js';

export interface PointsEngineDependencies {
  idempotencyStore: IdempotencyStore;
  multiplierService: RoleMultiplierService;
  pointsService: Pick<PointsService, 'recordTransaction'>;
}

export class PointsEngine {
  constructor(private readonly deps: PointsEngineDependencies) {}

  async awardPoints(payload: AwardPointsPayload): Promise<PointsTransaction | null> {
    const idempotencyKey = this.deps.idempotencyStore.buildKey(payload);
    const alreadyAwarded = await this.deps.idempotencyStore.wasProcessed(idempotencyKey);
    if (alreadyAwarded) {
      logger.debug('Skipping duplicate award', { payload });
      return null;
    }

    const multiplier = await this.deps.multiplierService.resolveMultiplier(payload.userId, payload.guildId);
    const totalPoints = Math.floor(payload.basePoints * multiplier);

    const transaction: PointsTransaction = {
      id: randomUUID(),
      userId: payload.userId,
      guildId: payload.guildId,
      source: this.resolveSource(payload.actionType),
      actionType: payload.actionType,
      referenceId: payload.referenceId,
      basePoints: payload.basePoints,
      multiplierApplied: multiplier,
      totalPoints,
      occurredAt: new Date(),
      metadata: payload.metadata ?? undefined,
    };

    try {
      await this.deps.pointsService.recordTransaction(transaction);
    } catch (error) {
      logger.error('Failed to persist points transaction', { error, payload, transaction });
      throw error;
    }

    await this.deps.idempotencyStore.markProcessed(idempotencyKey, transaction.id);
    logger.info('Awarded points', { payload, transaction });

    return transaction;
  }
  private resolveSource(actionType: AwardPointsPayload['actionType']): IngestSource {
    if (actionType.startsWith('x_')) {
      return 'x';
    }

    if (actionType === 'solana_role') {
      return 'solana';
    }

    return 'discord';
  }
}







