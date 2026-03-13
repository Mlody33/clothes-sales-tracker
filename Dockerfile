# Single-stage build (avoids multi-stage copy issues on older Docker engines)
FROM oven/bun:1-alpine
WORKDIR /app

# Build client
COPY client/package.json client/bun.lock* ./client/
RUN cd client && bun install --frozen-lockfile
COPY client/ ./client/
RUN cd client && bun run build

# Server
COPY server/package.json ./server/
COPY server/index.ts ./server/
RUN mv client/dist server/public && rm -rf client

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/server
CMD ["bun", "run", "index.ts"]
