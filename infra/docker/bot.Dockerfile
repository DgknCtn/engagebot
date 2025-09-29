FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY pnpm-lock.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

CMD ["node", "packages/bot/dist/index.js"]
