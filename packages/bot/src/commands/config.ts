import { ActionType } from '@vanth/shared';
import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const actionChoices: Array<{ name: string; value: ActionType }> = [
  { name: 'X Like', value: 'x_like' },
  { name: 'X Retweet', value: 'x_retweet' },
  { name: 'X Reply', value: 'x_reply' },
  { name: 'Discord Reaction', value: 'discord_reaction' },
  { name: 'Quest Completion', value: 'quest' },
];

const requiresAdmin = (interaction: Parameters<BotSlashCommand['execute']>[0]): boolean => {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
};

export const configCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure point rules for the server.')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set the point value for an action.')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Action to configure')
            .setChoices(...actionChoices)
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('value')
            .setDescription('Points awarded for the action')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(10_000),
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Optional channel override')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('View configured point values.')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Filter for a specific channel override')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice),
        ),
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
        content: 'You must be a server administrator to manage configuration.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context = getBotContext();

    if (subcommand === 'set') {
      const action = interaction.options.getString('action', true) as ActionType;
      const value = interaction.options.getInteger('value', true);
      const channel = interaction.options.getChannel('channel');

      const result = await context.pointsService.setActionPointValue({
        guildId,
        guildName: interaction.guild?.name,
        actionType: action,
        value,
        channelId: channel?.id,
      });

      const scope = result.channelId ? `<#${result.channelId}>` : 'all channels';
      await interaction.reply({
        content: `Configured ${result.actionType} to award **${result.value}** points for ${scope}.`,
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const configs = await context.pointsService.getActionPointConfig({
      guildId,
      channelId: channel?.id ?? undefined,
    });

    if (configs.length === 0) {
      await interaction.reply({
        content: 'No custom point configuration found.',
        ephemeral: true,
      });
      return;
    }

    const lines = configs.map((config) => {
      const scope = config.channelId ? `<#${config.channelId}>` : 'All channels';
      return `${scope}: ${config.actionType} › ${config.value} pts`;
    });

    await interaction.reply({
      content: `Configured point values\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};
