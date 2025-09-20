export type LeaderboardWindow = '24h' | '7d' | 'all';

export interface CommandContext {
  guildId: string;
  userId: string;
  channelId?: string;
  locale?: string;
}

export interface SlashCommandResult {
  content?: string;
  embeds?: unknown[];
  ephemeral?: boolean;
}

export interface RewardRedemption {
  rewardId: string;
  userId: string;
  guildId: string;
  redeemedAt: Date;
}
