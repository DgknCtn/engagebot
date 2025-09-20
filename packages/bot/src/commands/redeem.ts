import { SlashCommandBuilder } from 'discord.js';

import { BotSlashCommand } from './command.js';

export const redeemCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem points for a configured reward.')
    .addStringOption((option) =>
      option
        .setName('reward_id')
        .setDescription('Identifier for the reward you want to redeem')
        .setRequired(true),
    ),
  async execute(interaction) {
    const rewardId = interaction.options.getString('reward_id', true);
    await interaction.reply({
      content: `Redemption flow for reward ${rewardId} is not yet implemented.`,
      ephemeral: true,
    });
  },
};
