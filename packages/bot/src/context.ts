import './env.js';
import {
  InMemoryIdempotencyStore,
  InMemoryRoleMultiplierService,
  PointsEngine,
  PrismaPointsService,
  PrismaRoleMultiplierService,
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


const multiplierService = await (async () => {
  try {
    const service = new PrismaRoleMultiplierService();
    await service.hydrate();
    return service;
  } catch (error) {
    logger.warn('Falling back to in-memory role multiplier service', { error });
    return new InMemoryRoleMultiplierService();
  }
})();

const pointsService = new PrismaPointsService({ roleMultiplierService: multiplierService });
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