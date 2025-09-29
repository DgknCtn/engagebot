import { PrismaClient } from '@prisma/client';
import { AwardPointsPayload } from '@vanth/shared';

import { PointsEngine } from '../points/points-engine.js';
import { getPrismaClient } from '../prisma/client.js';

export interface XInteraction {
  tweetId: string;
  type: 'like' | 'retweet' | 'reply';
  occurredAt: Date;
}

export interface XIngestor {
  ingest(userId: string, guildId: string): Promise<void>;
}

const mapActionType = (type: XInteraction['type']): AwardPointsPayload['actionType'] => {
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
};

const resolveBasePoints = (type: XInteraction['type']): number => {
  switch (type) {
    case 'retweet':
      return 8;
    case 'reply':
      return 10;
    case 'like':
    default:
      return 5;
  }
};

export class StubXIngestor implements XIngestor {
  constructor(private readonly pointsEngine: PointsEngine) {}

  async ingest(userId: string, guildId: string): Promise<void> {
    const interactions = await this.fetchInteractions(userId);
    for (const interaction of interactions) {
      const payload: AwardPointsPayload = {
        userId,
        guildId,
        actionType: mapActionType(interaction.type),
        referenceId: interaction.tweetId,
        basePoints: resolveBasePoints(interaction.type),
      };

      await this.pointsEngine.awardPoints(payload);
    }
  }

  private async fetchInteractions(userId: string): Promise<XInteraction[]> {
    void userId;
    return [];
  }
}

export interface TwitterInteractionFetcherArgs {
  accessToken: string;
  twitterUserId?: string | null;
  lookbackSince?: Date;
}

export interface TwitterInteractionFetcher {
  fetchInteractions(args: TwitterInteractionFetcherArgs): Promise<{
    interactions: XInteraction[];
    twitterUserId: string;
  }>;
}

const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export class TwitterRestInteractionFetcher implements TwitterInteractionFetcher {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchInteractions(args: TwitterInteractionFetcherArgs): Promise<{
    interactions: XInteraction[];
    twitterUserId: string;
  }> {
    const lookback = args.lookbackSince ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS);

    const twitterUserId = args.twitterUserId ?? (await this.fetchCurrentUserId(args.accessToken));

    const [likes, timeline] = await Promise.all([
      this.fetchLikes({ accessToken: args.accessToken, twitterUserId, lookback }),
      this.fetchTimeline({ accessToken: args.accessToken, twitterUserId, lookback }),
    ]);

    const seen = new Set<string>();
    const deduped: XInteraction[] = [];
    for (const interaction of [...likes, ...timeline]) {
      if (seen.has(interaction.type + interaction.tweetId)) {
        continue;
      }
      seen.add(interaction.type + interaction.tweetId);
      deduped.push(interaction);
    }

    return { interactions: deduped, twitterUserId };
  }

  private async fetchCurrentUserId(accessToken: string): Promise<string> {
    const response = await this.fetchImpl('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unable to resolve Twitter user id (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as { data?: { id: string } };
    const id = payload.data?.id;
    if (!id) {
      throw new Error('Twitter API response missing user id');
    }

    return id;
  }

  private async fetchLikes(args: { accessToken: string; twitterUserId: string; lookback: Date }): Promise<XInteraction[]> {
    const url = new URL(`https://api.twitter.com/2/users/${args.twitterUserId}/liked_tweets`);
    url.searchParams.set('max_results', '100');
    url.searchParams.set('tweet.fields', 'created_at');

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch liked tweets (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ id: string; created_at?: string }>;
    };

    if (!payload.data) {
      return [];
    }

    return payload.data
      .map((tweet) => ({
        tweetId: tweet.id,
        type: 'like' as const,
        occurredAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      }))
      .filter((interaction) => interaction.occurredAt >= args.lookback);
  }

  private async fetchTimeline(args: { accessToken: string; twitterUserId: string; lookback: Date }): Promise<XInteraction[]> {
    const url = new URL(`https://api.twitter.com/2/users/${args.twitterUserId}/tweets`);
    url.searchParams.set('max_results', '100');
    url.searchParams.set('tweet.fields', 'created_at,referenced_tweets');

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch timeline tweets (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ id: string; created_at?: string; referenced_tweets?: Array<{ id: string; type: string }> }>;
    };

    if (!payload.data) {
      return [];
    }

    const interactions: XInteraction[] = [];
    for (const tweet of payload.data) {
      if (!tweet.referenced_tweets || tweet.referenced_tweets.length === 0) {
        continue;
      }

      const occurredAt = tweet.created_at ? new Date(tweet.created_at) : new Date();
      if (occurredAt < args.lookback) {
        continue;
      }

      for (const ref of tweet.referenced_tweets) {
        if (ref.type === 'retweeted') {
          interactions.push({
            tweetId: tweet.id,
            type: 'retweet',
            occurredAt,
          });
        }

        if (ref.type === 'replied_to') {
          interactions.push({
            tweetId: tweet.id,
            type: 'reply',
            occurredAt,
          });
        }
      }
    }

    return interactions;
  }
}

export interface PrismaXIngestorOptions {
  prisma?: PrismaClient;
  fetcher?: TwitterInteractionFetcher;
  pointsEngine: PointsEngine;
  lookbackSince?: Date;
}

export class PrismaXIngestor implements XIngestor {
  private readonly prisma: PrismaClient;
  private readonly fetcher: TwitterInteractionFetcher;
  private readonly pointsEngine: PointsEngine;
  private readonly lookbackSince?: Date;

  constructor(options: PrismaXIngestorOptions) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.fetcher = options.fetcher ?? new TwitterRestInteractionFetcher();
    this.pointsEngine = options.pointsEngine;
    this.lookbackSince = options.lookbackSince;
  }

  async ingest(userId: string, guildId: string): Promise<void> {
    const guildMember = await this.prisma.guildMember.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      include: {
        twitterLink: true,
      },
    });

    if (!guildMember || !guildMember.twitterLink?.accessToken) {
      throw new Error('Twitter account is not linked for this server.');
    }

    if (guildMember.twitterLink.expiresAt && guildMember.twitterLink.expiresAt.getTime() <= Date.now()) {
      throw new Error('Stored Twitter access token is expired. Ask the user to relink their account.');
    }

    const { interactions, twitterUserId } = await this.fetcher.fetchInteractions({
      accessToken: guildMember.twitterLink.accessToken,
      twitterUserId: guildMember.twitterLink.twitterUserId,
      lookbackSince: this.lookbackSince,
    });

    if (!guildMember.twitterLink.twitterUserId && twitterUserId) {
      await this.prisma.twitterLink.update({
        where: { guildMemberId: guildMember.id },
        data: {
          twitterUserId,
        },
      });
    }

    for (const interaction of interactions) {
      const payload: AwardPointsPayload = {
        userId,
        guildId,
        actionType: mapActionType(interaction.type),
        referenceId: `${interaction.type}:${interaction.tweetId}`,
        basePoints: resolveBasePoints(interaction.type),
        metadata: {
          tweetId: interaction.tweetId,
          interactionType: interaction.type,
        },
      };

      await this.pointsEngine.awardPoints(payload);
    }
  }
}

