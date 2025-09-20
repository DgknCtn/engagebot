import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type SlashCommandDefinition =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export interface BotSlashCommand {
  data: SlashCommandDefinition;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export type CommandMap = Map<string, BotSlashCommand>;
