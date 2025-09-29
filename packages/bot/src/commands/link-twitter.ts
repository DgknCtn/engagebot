// packages/bot/src/commands/link-twitter.ts
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { getBotContext } from '../context.js';
import { BotSlashCommand } from './command.js';

export const linkTwitterCommand: BotSlashCommand = {
  data: new SlashCommandBuilder()
    .setName('link-twitter')
    .setDescription('Link your X (Twitter) account to start earning points.'),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const context = getBotContext();
    const authorizeUrl = await context.xOauthHandler.getAuthorizationUrl(
      interaction.user.id,
      interaction.guildId ?? 'unknown',
    );

    await interaction.editReply({
      content: `Authenticate with X here: ${authorizeUrl}`,
    });
  },
};
