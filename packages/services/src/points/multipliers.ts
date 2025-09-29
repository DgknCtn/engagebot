import { PrismaClient } from '@prisma/client';
import { RoleMultiplier } from '@vanth/shared';

import { getPrismaClient } from '../prisma/client.js';

export interface RoleMultiplierService {
  resolveMultiplier(userId: string, guildId: string): Promise<number>;
  setMultipliers?(guildId: string, multipliers: RoleMultiplier[]): Promise<void>;
}

export class InMemoryRoleMultiplierService implements RoleMultiplierService {
  private readonly multipliers = new Map<string, RoleMultiplier[]>();

  async resolveMultiplier(_userId: string, guildId: string): Promise<number> {
    const guildMultipliers = this.multipliers.get(guildId) ?? [];
    if (guildMultipliers.length === 0) {
      return 1;
    }

    // MVP: pick the highest multiplier only (per PRD guard rails)
    const highest = guildMultipliers.reduce((acc, current) => {
      return current.multiplier > acc ? current.multiplier : acc;
    }, 1);

    return highest;
  }

  async setMultipliers(guildId: string, multipliers: RoleMultiplier[]): Promise<void> {
    this.multipliers.set(guildId, multipliers);
  }

}

export class PrismaRoleMultiplierService implements RoleMultiplierService {
  private readonly prisma: PrismaClient;

  private readonly cache = new Map<string, RoleMultiplier[]>();

  constructor(prisma: PrismaClient = getPrismaClient()) {
    this.prisma = prisma;
  }

  async hydrate(): Promise<void> {
    const multipliers = await this.prisma.roleMultiplier.findMany();

    this.cache.clear();

    for (const entry of multipliers) {
      const guildMultipliers = this.cache.get(entry.guildId) ?? [];
      guildMultipliers.push({ roleId: entry.roleId, multiplier: entry.multiplier });
      this.cache.set(entry.guildId, guildMultipliers);
    }
  }

  async resolveMultiplier(_userId: string, guildId: string): Promise<number> {
    const multipliers = await this.getMultipliersForGuild(guildId);

    if (multipliers.length === 0) {
      return 1;
    }

    const highest = multipliers.reduce((acc, current) => {
      return current.multiplier > acc ? current.multiplier : acc;
    }, 1);

    return highest;
  }

  async setMultipliers(guildId: string, multipliers: RoleMultiplier[]): Promise<void> {
    this.cache.set(guildId, multipliers);
  }

  async refreshGuild(guildId: string): Promise<void> {
    const multipliers = await this.prisma.roleMultiplier.findMany({
      where: { guildId },
    });

    this.cache.set(
      guildId,
      multipliers.map((entry) => ({ roleId: entry.roleId, multiplier: entry.multiplier })),
    );
  }

  private async getMultipliersForGuild(guildId: string): Promise<RoleMultiplier[]> {
    const cached = this.cache.get(guildId);
    if (cached) {
      return cached;
    }

    const multipliers = await this.prisma.roleMultiplier.findMany({
      where: { guildId },
    });

    const formatted = multipliers.map((entry) => ({ roleId: entry.roleId, multiplier: entry.multiplier }));
    this.cache.set(guildId, formatted);
    return formatted;
  }
}