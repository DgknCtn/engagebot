import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const requiresAdmin = (interaction: Parameters<BotSlashCommand['execute']>[0]): boolean => {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
};

export const multipliersCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('multipliers')
    .setDescription('Configure role-based point multipliers.')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a multiplier for a role.')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to configure').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('percent')
            .setDescription('Additional percentage boost (e.g. 20 = +20%)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove the multiplier for a role.')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to update').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List configured multipliers.'),
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
        content: 'You must be a server administrator to manage multipliers.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context = getBotContext();

    if (subcommand === 'set') {
      const role = interaction.options.getRole('role', true);
      const percent = interaction.options.getInteger('percent', true);
      const multiplier = 1 + percent / 100;

      await context.pointsService.setRoleMultiplier({
        guildId,
        guildName: interaction.guild?.name,
        roleId: role.id,
        multiplier,
      });

      await interaction.reply({
        content: `Role ${role} now awards a ${percent}% bonus on top of base points.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remove') {
      const role = interaction.options.getRole('role', true);
      const removed = await context.pointsService.removeRoleMultiplier({
        guildId,
        roleId: role.id,
      });

      if (!removed) {
        await interaction.reply({
          content: `No multiplier configured for ${role}.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `Removed multiplier for ${role}.`,
        ephemeral: true,
      });
      return;
    }

    const multipliers = await context.pointsService.getRoleMultipliers(guildId);
    if (multipliers.length === 0) {
      await interaction.reply({
        content: 'No role multipliers configured yet.',
        ephemeral: true,
      });
      return;
    }

    const lines = multipliers.map((entry) => {
      const percent = Math.round((entry.multiplier - 1) * 100);
      return `<@&${entry.roleId}> › +${percent}%`;
    });

    await interaction.reply({
      content: `Configured multipliers\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};
