import { PrismaClient } from '@prisma/client';
import { ValidationError } from '@vanth/shared';

import { getPrismaClient } from '../prisma/client.js';

export type QuestType = 'daily' | 'server_action' | 'custom';

export interface CreateQuestParams {
  guildId: string;
  guildName?: string | null;
  title: string;
  description?: string | null;
  type: QuestType;
  rewardPoints: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface QuestRecord {
  id: string;
  title: string;
  description?: string | null;
  type: QuestType;
  rewardPoints: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class QuestService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient = getPrismaClient()) {
    this.prisma = prisma;
  }

  async createQuest(params: CreateQuestParams): Promise<QuestRecord> {
    if (params.rewardPoints <= 0) {
      throw new ValidationError('Quest reward must be greater than zero.');
    }

    if (!params.title.trim()) {
      throw new ValidationError('Quest title cannot be empty.');
    }

    await this.ensureGuild(params.guildId, params.guildName);

    const quest = await this.prisma.quest.create({
      data: {
        guildId: params.guildId,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        type: params.type,
        rewardPoints: params.rewardPoints,
        startsAt: params.startsAt ?? null,
        endsAt: params.endsAt ?? null,
      },
    });

    return this.mapQuest(quest);
  }

  async listQuests(guildId: string): Promise<QuestRecord[]> {
    const quests = await this.prisma.quest.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    return quests.map((quest) => this.mapQuest(quest));
  }

  async deleteQuest(guildId: string, questId: string): Promise<boolean> {
    const result = await this.prisma.quest.deleteMany({
      where: {
        id: questId,
        guildId,
      },
    });

    return result.count > 0;
  }

  private async ensureGuild(guildId: string, guildName?: string | null): Promise<void> {
    await this.prisma.guild.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
        name: guildName ?? null,
      },
      update: {
        name: guildName ?? null,
      },
    });
  }

  private mapQuest(quest: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    rewardPoints: number;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): QuestRecord {
    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      type: quest.type as QuestType,
      rewardPoints: quest.rewardPoints,
      startsAt: quest.startsAt ?? undefined,
      endsAt: quest.endsAt ?? undefined,
      createdAt: quest.createdAt,
      updatedAt: quest.updatedAt,
    };
  }
}
