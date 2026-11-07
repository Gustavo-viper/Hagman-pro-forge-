# fandom-api — NestJS REST API. Build context: repository root.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@fandom/api...
RUN pnpm --filter @fandom/api --prod deploy --legacy /out/api \
 && pnpm --filter @fandom/database --prod deploy --legacy /out/database

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api /app/api
# Migration runner + SQL, used by Railway's pre-deploy command.
COPY --from=build --chown=node:node /out/database /app/database
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "/app/api/dist/main.js"]
