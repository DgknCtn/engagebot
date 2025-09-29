import './env.js';

import { logger } from '@vanth/shared';
import { Client, Events, GatewayIntentBits } from 'discord.js';

import { commandMap } from './commands/index.js';
import { getBotContext } from './context.js';
import { registerSlashCommands } from './register-commands.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
getBotContext();

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);

  if (process.env.REGISTER_COMMANDS === 'true') {
    try {
      await registerSlashCommands();
      logger.info('Slash commands registered');
    } catch (error) {
      logger.error('Failed to register slash commands', { error });
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error('Command execution failed', { error, command: interaction.commandName });
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Something went wrong executing that command.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Something went wrong executing that command.',
        ephemeral: true,
      });
    }
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error('DISCORD_BOT_TOKEN is not defined in environment');
}

void client.login(token);
