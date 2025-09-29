import './env.js';
import {
  InMemoryIdempotencyStore,
  InMemoryRoleMultiplierService,
  PointsEngine,
  PrismaPointsService,
  PrismaWalletService,
  PrismaXIngestor,
  PrismaXOauthHandler,
  QuestService,
  SolanaHolderSync,
  StubXIngestor,
  StubXOauthHandler,
  XIngestor,
  XOauthHandler,
} from '@vanth/services';
import { logger } from '@vanth/shared';

const idempotencyStore = new InMemoryIdempotencyStore();
const multiplierService = new InMemoryRoleMultiplierService();
const pointsService = new PrismaPointsService();
const pointsEngine = new PointsEngine({
  idempotencyStore,
  multiplierService,
  pointsService,
});
const questService = new QuestService();
const holderSync = new SolanaHolderSync();

const xOauthHandler: XOauthHandler = (() => {
  try {
    return new PrismaXOauthHandler();
  } catch (error) {
    logger.warn('Falling back to stub X OAuth handler', { error });
    return new StubXOauthHandler();
  }
})();

const xIngestor: XIngestor = (() => {
  try {
    return new PrismaXIngestor({ pointsEngine });
  } catch (error) {
    logger.warn('Falling back to stub X ingestor', { error });
    return new StubXIngestor(pointsEngine);
  }
})();

const walletService = new PrismaWalletService();

export interface BotContext {
  pointsEngine: PointsEngine;
  pointsService: PrismaPointsService;
  questService: QuestService;
  holderSync: SolanaHolderSync;
  xOauthHandler: XOauthHandler;
  xIngestor: XIngestor;
  walletService: PrismaWalletService;
}

let cachedContext: BotContext | null = null;

export const getBotContext = (): BotContext => {
  if (!cachedContext) {
    cachedContext = {
      pointsEngine,
      pointsService,
      questService,
      holderSync,
      xOauthHandler,
      xIngestor,
      walletService,
    };
  }

  return cachedContext;
};

