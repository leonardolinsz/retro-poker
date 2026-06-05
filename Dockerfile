FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY prisma/ prisma/

# Generate Prisma client
RUN cd apps/server && npx prisma generate

# Entrypoint: applies the DB schema at runtime, then starts the server
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

# Render injects PORT at runtime. Schema is synced on boot by the entrypoint.
CMD ["/app/docker-entrypoint.sh"]
