# Multi-stage build for Flow Platform Scheduler Engine

# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set up non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development dependencies stage
FROM base AS dev-dependencies
COPY package*.json ./
RUN npm ci

# Development stage
FROM base AS development
COPY --from=dev-dependencies /app/node_modules ./node_modules
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R nestjs:nodejs logs

USER nestjs
EXPOSE 3001 3002 3003

CMD ["dumb-init", "npm", "run", "start:dev"]

# Build stage
FROM base AS build
COPY --from=dev-dependencies /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build && \
    npm prune --production && \
    npm cache clean --force

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/v1/health || exit 1

EXPOSE 3001 3002 3003

CMD ["dumb-init", "node", "dist/main.js"]