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

EXPOSE 3001

CMD ["pnpm", "dev:server"]
