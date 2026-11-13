FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333

# Install system dependencies (tini for PID 1 process management, ffmpeg for video processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads/videos uploads/videos/thumbnails uploads/avatars uploads/audio uploads/stories uploads/groups temp logs public

EXPOSE 3333

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
