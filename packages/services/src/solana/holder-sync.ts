import { PrismaClient } from '@prisma/client';
import { logger } from '@vanth/shared';

import { getPrismaClient } from '../prisma/client.js';

export interface SolanaHolderSyncOptions {
  prisma?: PrismaClient;
  indexerApiKey?: string | null;
}

export class SolanaHolderSync {
  private readonly prisma: PrismaClient;
  private readonly indexerApiKey: string | null;

  constructor(options: SolanaHolderSyncOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.indexerApiKey = options.indexerApiKey ?? process.env.SOLANA_INDEXER_API_KEY ?? null;
  }

  async syncAllGuilds(): Promise<void> {
    const guilds = await this.prisma.guild.findMany({
      select: { id: true },
    });

    for (const guild of guilds) {
      await this.syncGuild(guild.id);
    }
  }

  async syncGuild(guildId: string): Promise<void> {
    const links = await this.prisma.walletLink.findMany({
      where: {
        guildMember: {
          guildId,
        },
      },
      include: {
        guildMember: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (links.length === 0) {
      logger.info('No wallet links found for guild, skipping holder sync', { guildId });
      return;
    }

    logger.info('Starting Solana holder sync', { guildId, linkedCount: links.length });

    for (const link of links) {
      try {
        const holdings = await this.fetchHoldings(link.address);
        await this.applyHolderRules({
          guildId,
          userId: link.guildMember.userId,
          address: link.address,
          holdings,
        });
      } catch (error) {
        logger.warn('Failed to process wallet during holder sync', {
          guildId,
          wallet: link.address,
          error,
        });
      }
    }

    logger.info('Completed Solana holder sync', { guildId });
  }

  // Placeholder for future integration with a Solana indexer provider.
  protected async fetchHoldings(address: string): Promise<unknown> {
    if (!this.indexerApiKey) {
      logger.debug('No Solana indexer API key configured; returning empty holdings');
      return [];
    }

    // TODO: Call Solana indexer API with the configured credentials.
    void address;
    return [];
  }

  // Placeholder for applying guild-specific holder rules.
  protected async applyHolderRules(params: {
    guildId: string;
    userId: string;
    address: string;
    holdings: unknown;
  }): Promise<void> {
    // TODO: Evaluate holdings against configured rules and apply Discord roles.
    void params;
  }
}






