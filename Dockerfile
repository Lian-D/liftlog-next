# syntax=docker/dockerfile:1

# ---- deps: install node_modules ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
# better-sqlite3 ships prebuilt binaries (Alpine included), but npm still tries to compile it
# with node-gyp unless install scripts are skipped. No other package here has an install script.
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi
# Fail the build now if the SQLite driver can't load. As a last resort, compile it from source.
RUN node -e "new (require('better-sqlite3'))(':memory:')" \
 || (apk add --no-cache python3 make g++ \
     && rm -rf node_modules/better-sqlite3/prebuilds \
     && npm rebuild better-sqlite3 \
     && node -e "new (require('better-sqlite3'))(':memory:')")

# ---- dev: used by the `dev` compose service (hot reload) ----
FROM node:22-alpine AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# ---- build: compile the production bundle ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: small image with only the standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/data/liftlog.db \
    TZ=America/Vancouver
RUN apk add --no-cache tzdata \
 && addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs \
 && mkdir -p /data && chown nextjs:nodejs /data
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# The whole native module, so every platform's prebuilt binary is present
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# Password reset for when nobody can sign in: docker compose exec web node scripts/reset-password.mjs
COPY --from=build --chown=nextjs:nodejs /app/scripts/reset-password.mjs ./scripts/reset-password.mjs
USER nextjs
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
