import { CommandMap } from './command.js';
import { leaderboardCommand } from './leaderboard.js';
import { linkTwitterCommand } from './link-twitter.js';
import { pointsCommand } from './points.js';
import { redeemCommand } from './redeem.js';
import { walletCommand } from './wallet.js';

export const commands = [
  linkTwitterCommand,
  walletCommand,
  pointsCommand,
  leaderboardCommand,
  redeemCommand,
];

export const commandMap: CommandMap = new Map(commands.map((command) => [command.data.name, command]));


