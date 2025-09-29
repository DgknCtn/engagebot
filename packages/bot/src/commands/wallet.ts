import { SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const isValidSolAddress = (address: string): boolean => {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

export const walletCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Manage your linked Solana wallet.')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Link your Solana wallet address.')
        .addStringOption((option) =>
          option
            .setName('address')
            .setDescription('Your Solana wallet address')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('show').setDescription('Show your currently linked wallet address.'),
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context = getBotContext();

    if (subcommand === 'set') {
      const address = interaction.options.getString('address', true);
      if (!isValidSolAddress(address)) {
        await interaction.reply({
          content: 'That does not look like a valid Solana address. Please try again.',
          ephemeral: true,
        });
        return;
      }

      await context.walletService.linkWallet({
        guildId,
        guildName: interaction.guild?.name,
        userId: interaction.user.id,
        address,
      });

      await interaction.reply({
        content: `Linked wallet ${address}. Changes take effect within 24 hours per sync schedule.`,
        ephemeral: true,
      });
      return;
    }

    const address = await context.walletService.getWallet({
      guildId,
      userId: interaction.user.id,
    });

    if (!address) {
      await interaction.reply({
        content: 'You have not linked a wallet yet. Use /wallet set to link one.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Your linked wallet is ${address}.`,
      ephemeral: true,
    });
  },
};
