import { SlashCommandBuilder } from 'discord.js';

import { BotSlashCommand } from './command.js';

const windows = [
  { name: '24 hours', value: '24h' },
  { name: '7 days', value: '7d' },
  { name: 'All time', value: 'all' },
];

export const leaderboardCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top point holders in the server.')
    .addStringOption((option) =>
      option
        .setName('window')
        .setDescription('Time window to filter the leaderboard')
        .setChoices(...windows)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of entries to show')
        .setMinValue(1)
        .setMaxValue(50),
    ),
  async execute(interaction) {
    const windowChoice = interaction.options.getString('window') ?? '7d';
    const limit = interaction.options.getInteger('limit') ?? 10;

    await interaction.reply({
      content: `Leaderboard for ${windowChoice} (showing ${limit}) is not ready yet. Coming soon!`,
      ephemeral: true,
    });
  },
};
