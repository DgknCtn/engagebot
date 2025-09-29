import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

const requiresAdmin = (interaction: Parameters<BotSlashCommand['execute']>[0]): boolean => {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
};

export const rewardsCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('Manage reward catalog for the server.')
    .addSubcommand((sub) =>
      sub
        .setName('add-role')
        .setDescription('Add a reward that grants a Discord role.')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to grant when redeemed').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('cost')
            .setDescription('Point cost to redeem')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1_000_000),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List configured rewards.'))
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a reward by ID.')
        .addStringOption((option) => option.setName('reward_id').setDescription('Reward identifier').setRequired(true)),
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
        content: 'You must be a server administrator to manage rewards.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context = getBotContext();

    if (subcommand === 'add-role') {
      const role = interaction.options.getRole('role', true);
      const cost = interaction.options.getInteger('cost', true);

      const reward = await context.pointsService.createRoleReward({
        guildId,
        guildName: interaction.guild?.name,
        roleId: role.id,
        cost,
      });

      await interaction.reply({
        content: `Reward **${reward.id}** created: redeeming grants role ${role} for ${reward.cost} points.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remove') {
      const rewardId = interaction.options.getString('reward_id', true);
      const removed = await context.pointsService.removeReward({ guildId, rewardId });
      if (!removed) {
        await interaction.reply({
          content: `Could not find reward with ID ${rewardId}.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `Removed reward **${rewardId}**.`,
        ephemeral: true,
      });
      return;
    }

    const rewards = await context.pointsService.listRewards(guildId);
    if (rewards.length === 0) {
      await interaction.reply({
        content: 'No rewards configured yet.',
        ephemeral: true,
      });
      return;
    }

    const lines = rewards.map((reward) => {
      if (reward.type === 'role' && reward.roleId) {
        return `ID: ${reward.id} › Role <@&${reward.roleId}> for ${reward.cost} pts`;
      }
      return `ID: ${reward.id} › ${reward.type} for ${reward.cost} pts`;
    });

    await interaction.reply({
      content: `Configured rewards\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};

