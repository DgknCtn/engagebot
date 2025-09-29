import { SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const formatTransaction = ({
  actionType,
  totalPoints,
  occurredAt,
}: {
  actionType: string;
  totalPoints: number;
  occurredAt: Date;
}): string => {
  const date = occurredAt.toISOString();
  const points = totalPoints >= 0 ? `+${totalPoints}` : `${totalPoints}`;
  return `• ${points} (${actionType}) at ${date}`;
};

export const pointsCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Check your current points and recent transactions.'),
  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const context = getBotContext();

    const summary = await context.pointsService.getSummary({
      guildId,
      guildName: interaction.guild?.name,
      userId: interaction.user.id,
    });

    const transactions = summary.recentTransactions.length
      ? summary.recentTransactions.map((transaction) =>
          formatTransaction({
            actionType: transaction.actionType,
            totalPoints: transaction.totalPoints,
            occurredAt: transaction.occurredAt,
          }),
        )
      : ['No transactions recorded yet.'];

    await interaction.reply({
      content: `You have **${summary.totalPoints}** points.\n${transactions.join('\n')}`,
      ephemeral: true,
    });
  },
};
