# fandom-web — React SPA + hardened static server. Build context: repository root.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Vite inlines these PUBLIC values at build time. Railway passes service variables as build args.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_APP_ENV=production
ENV VITE_API_URL=$VITE_API_URL VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY VITE_APP_ENV=$VITE_APP_ENV
COPY . .
RUN pnpm install --frozen-lockfile
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build arg is required" && exit 1)
RUN pnpm turbo run build --filter=@fandom/web...
RUN pnpm --filter @fandom/web --prod deploy --legacy /out/web && cp -r apps/web/dist /out/web/dist

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/web/dist /app/web/dist
COPY --from=build --chown=node:node /out/web/server.mjs /app/web/server.mjs
COPY --from=build --chown=node:node /out/web/package.json /app/web/package.json
COPY --from=build --chown=node:node /out/web/node_modules /app/web/node_modules
USER node
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["node", "/app/web/server.mjs"]
