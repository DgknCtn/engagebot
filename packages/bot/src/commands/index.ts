import { CommandMap } from './command.js';
import { configCommand } from './config.js';
import { leaderboardCommand } from './leaderboard.js';
import { linkTwitterCommand } from './link-twitter.js';
import { multipliersCommand } from './multipliers.js';
import { pointsCommand } from './points.js';
import { questCommand } from './quest.js';
import { redeemCommand } from './redeem.js';
import { rewardsCommand } from './rewards.js';
import { walletCommand } from './wallet.js';

export const commands = [
  linkTwitterCommand,
  walletCommand,
  pointsCommand,
  leaderboardCommand,
  redeemCommand,
  configCommand,
  multipliersCommand,
  questCommand,
  rewardsCommand,
];

export const commandMap: CommandMap = new Map(commands.map((command) => [command.data.name, command]));


