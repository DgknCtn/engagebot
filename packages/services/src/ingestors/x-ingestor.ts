import { AwardPointsPayload } from '@vanth/shared';

import { PointsEngine } from '../points/points-engine.js';

export interface XInteraction {
  tweetId: string;
  type: 'like' | 'retweet' | 'reply';
  occurredAt: Date;
}

export interface XIngestor {
  ingest(userId: string, guildId: string): Promise<void>;
}

export class StubXIngestor implements XIngestor {
  constructor(private readonly pointsEngine: PointsEngine) {}

  async ingest(userId: string, guildId: string): Promise<void> {
    const interactions = await this.fetchInteractions(userId);
    for (const interaction of interactions) {
      const payload: AwardPointsPayload = {
        userId,
        guildId,
        actionType: this.mapActionType(interaction.type),
        referenceId: interaction.tweetId,
        basePoints: this.resolveBasePoints(interaction.type),
      };

      await this.pointsEngine.awardPoints(payload);
    }
  }

  private async fetchInteractions(userId: string): Promise<XInteraction[]> {
    void userId;
    // TODO: call Twitter API with stored OAuth credentials
    return [];
  }

  private mapActionType(type: XInteraction['type']): AwardPointsPayload['actionType'] {
    switch (type) {
      case 'like':
        return 'x_like';
      case 'retweet':
        return 'x_retweet';
      case 'reply':
        return 'x_reply';
      default:
        return 'x_like';
    }
  }

  private resolveBasePoints(type: XInteraction['type']): number {
    switch (type) {
      case 'retweet':
        return 8;
      case 'reply':
        return 10;
      case 'like':
      default:
        return 5;
    }
  }
}
