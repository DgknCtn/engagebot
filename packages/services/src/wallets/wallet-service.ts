import { getPrismaClient } from '../prisma/client.js';

export interface LinkWalletParams {
  guildId: string;
  guildName?: string | null;
  userId: string;
  address: string;
}

export interface WalletService {
  linkWallet(params: LinkWalletParams): Promise<void>;
  getWallet(params: { guildId: string; userId: string }): Promise<string | null>;
}

export class PrismaWalletService implements WalletService {
  private readonly prisma = getPrismaClient();

  async linkWallet({ guildId, guildName, userId, address }: LinkWalletParams): Promise<void> {
    await this.prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, name: guildName ?? null },
      update: { name: guildName ?? null },
    });

    const guildMember = await this.prisma.guildMember.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        guildId,
        userId,
        walletAddress: address,
        walletLinkedAt: new Date(),
      },
      update: {
        walletAddress: address,
        walletLinkedAt: new Date(),
        walletCooldownEnd: null,
      },
      select: { id: true },
    });

    await this.prisma.walletLink.upsert({
      where: { guildMemberId: guildMember.id },
      create: {
        guildMemberId: guildMember.id,
        address,
      },
      update: {
        address,
        linkedAt: new Date(),
        cooldownEndsAt: null,
      },
    });
  }

  async getWallet({ guildId, userId }: { guildId: string; userId: string }): Promise<string | null> {
    const member = await this.prisma.guildMember.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      select: { walletAddress: true },
    });

    return member?.walletAddress ?? null;
  }
}
