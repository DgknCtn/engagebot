export type IngestSource = 'discord' | 'x' | 'solana';

export type ActionType =
  | 'x_like'
  | 'x_retweet'
  | 'x_reply'
  | 'discord_reaction'
  | 'quest'
  | 'redeem'
  | 'solana_role';

export interface PointsTransaction {
  id: string;
  userId: string;
  guildId: string;
  source: IngestSource;
  actionType: ActionType;
  referenceId: string;
  basePoints: number;
  multiplierApplied: number;
  totalPoints: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PointsBalanceSnapshot {
  userId: string;
  guildId: string;
  total: number;
  updatedAt: Date;
}

export interface AwardPointsPayload {
  userId: string;
  guildId: string;
  actionType: ActionType;
  referenceId: string;
  basePoints: number;
  metadata?: Record<string, unknown>;
}

export interface IdempotencyKey {
  userId: string;
  guildId: string;
  actionType: ActionType;
  referenceId: string;
}

export interface LeaderboardEntry {
  userId: string;
  guildId: string;
  totalPoints: number;
  rank: number;
}

export interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

export interface PointsConfig {
  baseValues: Record<ActionType, number>;
  channelOverrides: Record<string, Partial<Record<ActionType, number>>>;
}


