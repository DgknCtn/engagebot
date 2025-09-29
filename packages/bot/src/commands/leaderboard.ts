import { LeaderboardWindow } from '@vanth/shared';
import { SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
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
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const windowChoice = (interaction.options.getString('window') ?? '7d') as LeaderboardWindow;
    const limit = interaction.options.getInteger('limit') ?? 10;

    const context = getBotContext();
    const entries = await context.pointsService.getLeaderboard({
      guildId,
      guildName: interaction.guild?.name,
      window: windowChoice,
      limit,
    });

    if (entries.length === 0) {
      await interaction.reply({
        content: 'No leaderboard data yet. Start earning points to be featured here!',
        ephemeral: true,
      });
      return;
    }

    const lines = entries.map((entry) => `${entry.rank}. <@${entry.userId}> — ${entry.points} pts`);

    await interaction.reply({
      content: `Leaderboard for ${windowChoice} (showing ${entries.length}):\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};
