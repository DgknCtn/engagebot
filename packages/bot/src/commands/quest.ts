import type { QuestType } from '@vanth/services';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const questTypes: Array<{ name: string; value: QuestType }> = [
  { name: 'Daily', value: 'daily' },
  { name: 'Server Action', value: 'server_action' },
  { name: 'Custom', value: 'custom' },
];

const requiresAdmin = (interaction: Parameters<BotSlashCommand['execute']>[0]): boolean => {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
};

export const questCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Manage quests for the server.')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new quest.')
        .addStringOption((option) =>
          option.setName('title').setDescription('Quest title').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('reward_points')
            .setDescription('Points awarded when the quest is completed')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1_000_000),
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Quest category')
            .setChoices(...questTypes)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Details about the quest')
            .setMaxLength(300),
        )
        .addStringOption((option) =>
          option
            .setName('starts_at')
            .setDescription('Start time (ISO 8601)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('ends_at')
            .setDescription('End time (ISO 8601)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List quests configured for this server.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a quest by ID.')
        .addStringOption((option) => option.setName('quest_id').setDescription('Quest identifier').setRequired(true)),
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

    if (!requiresAdmin(interaction)) {
      await interaction.reply({
        content: 'You must be a server administrator to manage quests.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context = getBotContext();

    if (subcommand === 'create') {
      const title = interaction.options.getString('title', true);
      const rewardPoints = interaction.options.getInteger('reward_points', true);
      const type = (interaction.options.getString('type') ?? 'custom') as QuestType;
      const description = interaction.options.getString('description') ?? undefined;
      const startsAtInput = interaction.options.getString('starts_at') ?? undefined;
      const endsAtInput = interaction.options.getString('ends_at') ?? undefined;

      const startsAt = parseIsoDate(startsAtInput);
      if (startsAtInput && !startsAt) {
        await interaction.reply({
          content: 'The provided starts_at value is not a valid ISO 8601 timestamp.',
          ephemeral: true,
        });
        return;
      }

      const endsAt = parseIsoDate(endsAtInput);
      if (endsAtInput && !endsAt) {
        await interaction.reply({
          content: 'The provided ends_at value is not a valid ISO 8601 timestamp.',
          ephemeral: true,
        });
        return;
      }

      if (startsAt && endsAt && startsAt > endsAt) {
        await interaction.reply({
          content: 'The quest end time must be after the start time.',
          ephemeral: true,
        });
        return;
      }

      const quest = await context.questService.createQuest({
        guildId,
        guildName: interaction.guild?.name,
        title,
        description,
        type,
        rewardPoints,
        startsAt,
        endsAt,
      });

      await interaction.reply({
        content: `Created quest **${quest.title}** (ID: ${quest.id}) rewarding ${quest.rewardPoints} points.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'delete') {
      const questId = interaction.options.getString('quest_id', true);
      const removed = await context.questService.deleteQuest(guildId, questId);

      if (!removed) {
        await interaction.reply({
          content: `No quest found with ID ${questId}.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `Deleted quest **${questId}**.`,
        ephemeral: true,
      });
      return;
    }

    const quests = await context.questService.listQuests(guildId);
    if (quests.length === 0) {
      await interaction.reply({
        content: 'No quests configured yet.',
        ephemeral: true,
      });
      return;
    }

    const lines = quests.map((quest) => {
      const timeframe = formatTimeframe(quest.startsAt, quest.endsAt);
      return `ID: ${quest.id} › ${quest.title} (${quest.type}) · ${quest.rewardPoints} pts${timeframe ? ` · ${timeframe}` : ''}`;
    });

    await interaction.reply({
      content: `Configured quests\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};

const parseIsoDate = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatTimeframe = (startsAt?: Date | null, endsAt?: Date | null): string | undefined => {
  const parts: string[] = [];
  if (startsAt) {
    parts.push(`starts ${startsAt.toISOString()}`);
  }
  if (endsAt) {
    parts.push(`ends ${endsAt.toISOString()}`);
  }

  return parts.length ? parts.join(', ') : undefined;
};



