# syntax=docker/dockerfile:1

# ==========================================
# Base stage with pnpm + corepack
# ==========================================
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# ==========================================
# Dependencies
# ==========================================
FROM base AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/

RUN pnpm install

# ==========================================
# Builder (production)
# ==========================================
FROM deps AS builder

COPY . .
RUN pnpm build

# ==========================================
# Development
# ==========================================
FROM deps AS development

COPY . .

RUN pnpm --filter @agent-web/core build && pnpm --filter @agent-web/db build
RUN mkdir -p /app/packages/db/data

COPY docker/entrypoint.dev.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=development

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "dev"]

# ==========================================
# Production
# ==========================================
FROM node:22-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install Docker CLI for sandbox support (Docker-in-Docker)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
RUN mkdir -p /app/packages/db/data

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

# ==========================================
# Sandbox (isolated code execution container)
# ==========================================
FROM node:22-slim AS sandbox

# Install Python + common tools alongside Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages \
        requests beautifulsoup4 pandas numpy 2>/dev/null || \
       pip3 install --no-cache-dir \
        requests beautifulsoup4 pandas numpy

# Pre-install tsx for TypeScript execution
RUN npm install -g tsx

WORKDIR /workspace

RUN useradd -m sandbox-user \
    && mkdir -p /workspace \
    && chown -R sandbox-user:sandbox-user /workspace /tmp

USER sandbox-user

CMD ["tail", "-f", "/dev/null"]
