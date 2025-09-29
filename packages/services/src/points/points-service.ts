import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import { ActionType, LeaderboardWindow, PointsTransaction, ValidationError } from '@vanth/shared';

import { getPrismaClient } from '../prisma/client.js';

const WINDOW_ORDER: Record<Exclude<LeaderboardWindow, 'all'>, Prisma.SortOrder> = {
  '24h': 'desc',
  '7d': 'desc',
};

export interface SetActionPointValueParams {
  guildId: string;
  guildName?: string | null;
  actionType: ActionType;
  value: number;
  channelId?: string | null;
}

export interface ActionPointConfigResult {
  actionType: ActionType;
  value: number;
  channelId?: string | null;
}

export interface ListRoleMultiplierResult {
  roleId: string;
  multiplier: number;
}

export interface SetRoleMultiplierParams {
  guildId: string;
  guildName?: string | null;
  roleId: string;
  multiplier: number;
}

export interface CreateRoleRewardParams {
  guildId: string;
  guildName?: string | null;
  roleId: string;
  cost: number;
}

export interface RewardRecord {
  id: string;
  type: string;
  roleId?: string | null;
  cost: number;
  createdAt: Date;
}
export interface PointsSummaryOptions {
  guildId: string;
  guildName?: string | null;
  userId: string;
  limit?: number;
}

export interface PointsTransactionSummary {
  id: string;
  referenceId: string;
  actionType: string;
  source: string;
  totalPoints: number;
  occurredAt: Date;
}

export interface PointsSummaryResult {
  totalPoints: number;
  recentTransactions: PointsTransactionSummary[];
}

export interface LeaderboardEntryResult {
  userId: string;
  points: number;
  rank: number;
}

export interface LeaderboardOptions {
  guildId: string;
  guildName?: string | null;
  window: LeaderboardWindow;
  limit: number;
}

export interface RedeemRewardParams {
  guildId: string;
  guildName?: string | null;
  userId: string;
  rewardId: string;
}

export interface RedeemRewardResult {
  remainingPoints: number;
  reward: {
    id: string;
    type: string;
    roleId?: string | null;
    cost: number;
  };
}

export interface PointsService {
  getSummary(options: PointsSummaryOptions): Promise<PointsSummaryResult>;
  getLeaderboard(options: LeaderboardOptions): Promise<LeaderboardEntryResult[]>;
  redeemReward(params: RedeemRewardParams): Promise<RedeemRewardResult>;
  recordTransaction(transaction: PointsTransaction): Promise<void>;
  setActionPointValue(params: SetActionPointValueParams): Promise<ActionPointConfigResult>;
  getActionPointConfig(params: { guildId: string; channelId?: string | null }): Promise<ActionPointConfigResult[]>;
  setRoleMultiplier(params: SetRoleMultiplierParams): Promise<void>;
  removeRoleMultiplier(params: { guildId: string; roleId: string }): Promise<boolean>;
  getRoleMultipliers(guildId: string): Promise<ListRoleMultiplierResult[]>;
  createRoleReward(params: CreateRoleRewardParams): Promise<RewardRecord>;
  listRewards(guildId: string): Promise<RewardRecord[]>;
  removeReward(params: { guildId: string; rewardId: string }): Promise<boolean>;
}

export class PrismaPointsService implements PointsService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient = getPrismaClient()) {
    this.prisma = prisma;
  }


  async recordTransaction(transaction: PointsTransaction): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.ensureGuild(transaction.guildId, null, tx);

      const guildMember = await tx.guildMember.upsert({
        where: {
          guildId_userId: {
            guildId: transaction.guildId,
            userId: transaction.userId,
          },
        },
        create: {
          guildId: transaction.guildId,
          userId: transaction.userId,
          pointsBalance: 0,
        },
        update: {},
        select: { id: true },
      });

      const data: Prisma.PointsTransactionUncheckedCreateInput = {
        id: transaction.id,
        guildMemberId: guildMember.id,
        actionType: transaction.actionType,
        source: transaction.source,
        referenceId: transaction.referenceId,
        basePoints: transaction.basePoints,
        multiplierApplied: transaction.multiplierApplied,
        totalPoints: transaction.totalPoints,
        occurredAt: transaction.occurredAt,
      };

      if (typeof transaction.metadata !== "undefined") {
        data.metadata = transaction.metadata as Prisma.InputJsonValue;
      }

      await tx.pointsTransaction.create({ data });

      await tx.guildMember.update({
        where: { id: guildMember.id },
        data: {
          pointsBalance: {
            increment: transaction.totalPoints,
          },
        },
      });
    });
  }
  async getSummary({ guildId, guildName, userId, limit = 5 }: PointsSummaryOptions): Promise<PointsSummaryResult> {
    await this.ensureGuild(guildId, guildName);

    const guildMember = await this.prisma.guildMember.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      select: {
        id: true,
        pointsBalance: true,
      },
    });

    if (!guildMember) {
      return {
        totalPoints: 0,
        recentTransactions: [],
      };
    }

    const transactions = await this.prisma.pointsTransaction.findMany({
      where: { guildMemberId: guildMember.id },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        referenceId: true,
        actionType: true,
        source: true,
        totalPoints: true,
        occurredAt: true,
      },
    });

    return {
      totalPoints: guildMember.pointsBalance,
      recentTransactions: transactions,
    };
  }

  async getLeaderboard({ guildId, guildName, window, limit }: LeaderboardOptions): Promise<LeaderboardEntryResult[]> {
    await this.ensureGuild(guildId, guildName);

    if (window === 'all') {
      const members = await this.prisma.guildMember.findMany({
        where: { guildId },
        orderBy: { pointsBalance: 'desc' },
        take: limit,
        select: {
          userId: true,
          pointsBalance: true,
        },
      });

      return members.map((member, index) => ({
        userId: member.userId,
        points: member.pointsBalance,
        rank: index + 1,
      }));
    }

    const since = this.resolveWindowStart(window);

    const aggregates = await this.prisma.pointsTransaction.groupBy({
      by: [Prisma.PointsTransactionScalarFieldEnum.guildMemberId],
      where: {
        occurredAt: { gte: since },
        guildMember: { guildId },
      },
      _sum: { totalPoints: true },
      orderBy: {
        _sum: { totalPoints: WINDOW_ORDER[window] },
      },
      take: limit,
    });

    if (aggregates.length === 0) {
      return [];
    }

    const memberIds = aggregates.map((aggregate) => aggregate.guildMemberId);
    const members = await this.prisma.guildMember.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        userId: true,
      },
    });

    const memberMap = new Map<string, string>(members.map((member) => [member.id, member.userId]));

    return aggregates
      .map((aggregate, index) => ({
        userId: memberMap.get(aggregate.guildMemberId) ?? 'unknown',
        points: aggregate._sum.totalPoints ?? 0,
        rank: index + 1,
      }))
      .filter((entry) => entry.points > 0);
  }

  async setActionPointValue({ guildId, guildName, actionType, value, channelId }: SetActionPointValueParams): Promise<ActionPointConfigResult> {
    if (value < 0) {
      throw new ValidationError('Point value must be zero or greater.');
    }

    await this.ensureGuild(guildId, guildName);

    const normalizedChannelId = channelId ?? '__global__';

    const config = await this.prisma.actionPointConfig.upsert({
      where: {
        guildId_actionType_channelId: {
          guildId,
          actionType,
          channelId: normalizedChannelId,
        },
      },
      create: {
        guildId,
        actionType,
        channelId: normalizedChannelId,
        value,
      },
      update: {
        value,
      },
    });

    return {
      actionType: config.actionType as ActionType,
      value: config.value,
      channelId: config.channelId === '__global__' ? undefined : config.channelId ?? undefined,
    };
  }

  async getActionPointConfig({ guildId, channelId }: { guildId: string; channelId?: string | null }): Promise<ActionPointConfigResult[]> {
    const normalizedChannelId = channelId ?? undefined;

    const configs = await this.prisma.actionPointConfig.findMany({
      where: {
        guildId,
        ...(normalizedChannelId !== undefined
          ? { channelId: normalizedChannelId ?? '__global__' }
          : {}),
      },
      orderBy: [{ channelId: 'asc' }, { actionType: 'asc' }],
    });

    return configs.map((config) => ({
      actionType: config.actionType as ActionType,
      value: config.value,
      channelId: config.channelId === '__global__' ? undefined : config.channelId ?? undefined,
    }));
  }

  async setRoleMultiplier({ guildId, guildName, roleId, multiplier }: SetRoleMultiplierParams): Promise<void> {
    await this.ensureGuild(guildId, guildName);

    await this.prisma.roleMultiplier.upsert({
      where: {
        guildId_roleId: {
          guildId,
          roleId,
        },
      },
      create: {
        guildId,
        roleId,
        multiplier,
      },
      update: {
        multiplier,
      },
    });
  }

  async removeRoleMultiplier({ guildId, roleId }: { guildId: string; roleId: string }): Promise<boolean> {
    try {
      await this.prisma.roleMultiplier.delete({
        where: {
          guildId_roleId: {
            guildId,
            roleId,
          },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  async getRoleMultipliers(guildId: string): Promise<ListRoleMultiplierResult[]> {
    const multipliers = await this.prisma.roleMultiplier.findMany({
      where: { guildId },
      orderBy: { multiplier: 'desc' },
    });

    return multipliers.map((entry) => ({
      roleId: entry.roleId,
      multiplier: entry.multiplier,
    }));
  }

  async createRoleReward({ guildId, guildName, roleId, cost }: CreateRoleRewardParams): Promise<RewardRecord> {
    if (cost <= 0) {
      throw new ValidationError('Reward cost must be greater than zero.');
    }

    await this.ensureGuild(guildId, guildName);

    const reward = await this.prisma.reward.create({
      data: {
        guildId,
        type: 'role',
        roleId,
        cost,
      },
    });

    return {
      id: reward.id,
      type: reward.type,
      roleId: reward.roleId,
      cost: reward.cost,
      createdAt: reward.createdAt,
    };
  }

  async listRewards(guildId: string): Promise<RewardRecord[]> {
    const rewards = await this.prisma.reward.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    return rewards.map((reward) => ({
      id: reward.id,
      type: reward.type,
      roleId: reward.roleId,
      cost: reward.cost,
      createdAt: reward.createdAt,
    }));
  }

  async removeReward({ guildId, rewardId }: { guildId: string; rewardId: string }): Promise<boolean> {
    const result = await this.prisma.reward.deleteMany({
      where: {
        id: rewardId,
        guildId,
      },
    });

    return result.count > 0;
  }

  async redeemReward({ guildId, guildName, userId, rewardId }: RedeemRewardParams): Promise<RedeemRewardResult> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.ensureGuild(guildId, guildName, tx);

      const reward = await tx.reward.findFirst({
        where: {
          id: rewardId,
          guildId,
        },
      });

      if (!reward) {
        throw new ValidationError('Reward not found for this server.');
      }

      let guildMember = await tx.guildMember.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      if (!guildMember) {
        guildMember = await tx.guildMember.create({
          data: {
            guildId,
            userId,
          },
        });
      }

      if (guildMember.pointsBalance < reward.cost) {
        throw new ValidationError('You do not have enough points to redeem that reward.');
      }

      const referenceId = `reward:${reward.id}:${randomUUID()}`;

      await tx.pointsTransaction.create({
        data: {
          guildMemberId: guildMember.id,
          actionType: 'redeem',
          source: 'discord',
          referenceId,
          basePoints: -reward.cost,
          multiplierApplied: 1,
          totalPoints: -reward.cost,
          metadata: {
            rewardId: reward.id,
          },
        },
      });

      await tx.rewardRedemption.create({
        data: {
          rewardId: reward.id,
          guildMemberId: guildMember.id,
        },
      });

      const updatedMember = await tx.guildMember.update({
        where: { id: guildMember.id },
        data: {
          pointsBalance: {
            decrement: reward.cost,
          },
        },
        select: { pointsBalance: true },
      });

      return {
        remainingPoints: updatedMember.pointsBalance,
        reward: {
          id: reward.id,
          type: reward.type,
          roleId: reward.roleId,
          cost: reward.cost,
        },
      };
    });
  }

  private resolveWindowStart(window: Exclude<LeaderboardWindow, 'all'>): Date {
    const now = Date.now();
    if (window === '24h') {
      return new Date(now - 24 * 60 * 60 * 1000);
    }

    return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }

  private async ensureGuild(
    guildId: string,
    guildName?: string | null,
    prisma: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await prisma.guild.upsert({
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
}























