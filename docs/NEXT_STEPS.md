# Next Steps

1. Configure environment variables by copying `.env.example` to `.env` and filling Discord, X, and database credentials.
2. Initialize the database with `pnpm db:migrate` once PostgreSQL is running (see `infra/docker/docker-compose.yml`).
3. Implement persistence layers in `@vanth/services` using Prisma repositories (points engine, wallet linking, Twitter tokens).
4. Wire Discord commands to real services, replacing in-memory placeholders in `packages/bot`.
5. Build out background schedulers for X ingestion, Solana sync, and quest settlement.
6. Add unit tests for the points engine and idempotency flow per project rules.
