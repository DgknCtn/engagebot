import { RoleMultiplier } from '@vanth/shared';

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
