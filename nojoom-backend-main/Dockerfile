FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333
ENV DB_HOST=mysql.railway.internal
ENV DB_PORT=3306
ENV DB_USER=root
ENV DB_NAME=railway
ENV MYSQLHOST=mysql.railway.internal
ENV MYSQLPORT=3306
ENV MYSQLUSER=root
ENV MYSQLDATABASE=railway
ENV REDIS_HOST=redis.railway.internal
ENV REDISHOST=redis.railway.internal
ENV REDIS_PORT=6379
ENV REDISPORT=6379
ENV STORAGE_PROVIDER=supabase
ENV SUPABASE_PROJECT_ID=yootsrzrcjhzwdygwidp
ENV SUPABASE_URL=https://yootsrzrcjhzwdygwidp.supabase.co
ENV SUPABASE_STORAGE_BUCKET=nojoom-media

# Install system dependencies (tini for PID 1 process management, ffmpeg for video processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads/videos uploads/videos/thumbnails uploads/avatars uploads/audio uploads/stories uploads/groups temp logs public

EXPOSE 3333 8080 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
