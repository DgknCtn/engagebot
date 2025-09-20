import { REST, Routes } from 'discord.js';

import { commands } from './commands/index.js';

export const registerSlashCommands = async (): Promise<void> => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error('Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = commands.map((command) => command.data.toJSON());

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
};
