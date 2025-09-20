import { SlashCommandBuilder } from 'discord.js';

import { BotSlashCommand } from './command.js';

export const pointsCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Check your current points and recent transactions.'),
  async execute(interaction) {
    await interaction.reply({
      content:
        'Points tracking is not yet connected to the database. You currently have 0 points (stub).',
      ephemeral: true,
    });
  },
};
