import {
  InMemoryIdempotencyStore,
  InMemoryRoleMultiplierService,
  PointsEngine,
  PrismaPointsService,
  PrismaWalletService,
  StubXIngestor,
  StubXOauthHandler,
} from '@vanth/services';

const idempotencyStore = new InMemoryIdempotencyStore();
const multiplierService = new InMemoryRoleMultiplierService();
const pointsEngine = new PointsEngine({
  idempotencyStore,
  multiplierService,
});
const xOauthHandler = new StubXOauthHandler();
const xIngestor = new StubXIngestor(pointsEngine);
const walletService = new PrismaWalletService();
const pointsService = new PrismaPointsService();

export interface BotContext {
  pointsEngine: PointsEngine;
  pointsService: PrismaPointsService;
  xOauthHandler: StubXOauthHandler;
  xIngestor: StubXIngestor;
  walletService: PrismaWalletService;
}

let cachedContext: BotContext | null = null;

export const getBotContext = (): BotContext => {
  if (!cachedContext) {
    cachedContext = {
      pointsEngine,
      pointsService,
      xOauthHandler,
      xIngestor,
      walletService,
    };
  }

  return cachedContext;
};
