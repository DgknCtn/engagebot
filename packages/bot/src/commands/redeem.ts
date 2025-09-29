import { ValidationError } from '@vanth/shared';
import { SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
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
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const rewardId = interaction.options.getString('reward_id', true);
    const context = getBotContext();

    try {
      const result = await context.pointsService.redeemReward({
        guildId,
        guildName: interaction.guild?.name,
        userId: interaction.user.id,
        rewardId,
      });

      let message = `Redeemed reward **${result.reward.id}** for ${result.reward.cost} points. You have ${result.remainingPoints} points left.`;
      if (result.reward.type === 'role' && result.reward.roleId) {
        message += ` Remember to assign role <@&${result.reward.roleId}> if automation is not yet connected.`;
      }

      await interaction.reply({
        content: message,
        ephemeral: true,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply({
          content: error.message,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: 'Redeeming that reward failed. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
