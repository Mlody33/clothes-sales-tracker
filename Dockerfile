# Single-stage build (avoids multi-stage copy issues on older Docker engines)
FROM node:22-alpine
WORKDIR /app

# Build client
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Server + serve built client
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./
RUN mv client/dist public && rm -rf client

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "index.js"]
