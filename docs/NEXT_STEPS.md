# Next Steps

1. Run database migrations (pnpm --filter @vanth/services prisma migrate dev) to materialize recent schema updates.
2. Wire the SolanaHolderSync scaffold to a real indexer provider and implement role application rules.
3. Implement automated quest settlement (progress tracking and completion) using the quest service.
4. Add scheduler jobs for periodic X ingestion, quest settlement, and Solana holder sync.
5. Expand automated test coverage for configuration, multipliers, quests, and admin command surfaces.
6. Document operational runbooks (command registration, job scheduling, env secrets) ahead of deployment.
