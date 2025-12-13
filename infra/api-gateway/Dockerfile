FROM node:20-alpine AS base

# =============================================================================
# EKG API Gateway - Dockerfile (squelette NestJS)
# =============================================================================

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Run application
CMD ["node", "dist/main.js"]
