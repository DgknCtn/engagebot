import {
  InMemoryIdempotencyStore,
  InMemoryRoleMultiplierService,
  PointsEngine,
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

export interface BotContext {
  pointsEngine: PointsEngine;
  xOauthHandler: StubXOauthHandler;
  xIngestor: StubXIngestor;
}

let cachedContext: BotContext | null = null;

export const getBotContext = (): BotContext => {
  if (!cachedContext) {
    cachedContext = {
      pointsEngine,
      xOauthHandler,
      xIngestor,
    };
  }

  return cachedContext;
};
