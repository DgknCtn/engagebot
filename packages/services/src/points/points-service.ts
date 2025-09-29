import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import { ActionType, LeaderboardWindow, PointsTransaction, RoleMultiplier, ValidationError } from '@vanth/shared';

import { getPrismaClient } from '../prisma/client.js';
import { RoleMultiplierService } from './multipliers.js';

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

@@ -94,55 +95,63 @@ export interface RedeemRewardParams {
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

interface PrismaPointsServiceOptions {
  prisma?: PrismaClient;
  roleMultiplierService?: RoleMultiplierService | null;
}

export class PrismaPointsService implements PointsService {
  private readonly prisma: PrismaClient;
  private readonly roleMultiplierService?: RoleMultiplierService | null;


  constructor(options: PrismaPointsServiceOptions = {}) {
    const { prisma = getPrismaClient(), roleMultiplierService = null } = options;
    this.prisma = prisma;
    this.roleMultiplierService = roleMultiplierService;
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
@@ -327,62 +336,65 @@ export class PrismaPointsService implements PointsService {
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

    await this.refreshRoleMultiplierCache(guildId);
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
      await this.refreshRoleMultiplierCache(guildId);
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
@@ -400,50 +412,68 @@ export class PrismaPointsService implements PointsService {

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

  private async refreshRoleMultiplierCache(guildId: string): Promise<void> {
    if (!this.roleMultiplierService?.setMultipliers) {
      return;
    }

    const multipliers = await this.prisma.roleMultiplier.findMany({
      where: { guildId },
      orderBy: { multiplier: 'desc' },
    });

    const formatted: RoleMultiplier[] = multipliers.map((entry) => ({
      roleId: entry.roleId,
      multiplier: entry.multiplier,
    }));

    await this.roleMultiplierService.setMultipliers(guildId, formatted);
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