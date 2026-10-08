# Multi-stage Docker build for Production

# Stage 1: Build client
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy server production artifacts
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY --from=server-builder /app/server/dist ./dist
COPY server/src/db/schema.sql ./dist/db/schema.sql

# Copy built frontend
WORKDIR /app/client
COPY --from=client-builder /app/client/dist ./dist

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
