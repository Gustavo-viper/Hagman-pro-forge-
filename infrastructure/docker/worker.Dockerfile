# fandom-worker — BullMQ background jobs. Build context: repository root.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@fandom/worker...
RUN pnpm --filter @fandom/worker --prod deploy --legacy /out/worker

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/worker /app/worker
USER node
EXPOSE 3100
STOPSIGNAL SIGTERM
CMD ["node", "/app/worker/dist/main.js"]
