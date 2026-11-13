FROM node:20-alpine AS build

WORKDIR /app

# Build arguments for Vite with default production domain
ARG VITE_API_URL=https://nojoom-production.up.railway.app/api
ARG VITE_SOCKET_URL=https://nojoom-production.up.railway.app
ARG VITE_SUPABASE_PROJECT_ID=yootsrzrcjhzwdygwidp
ARG VITE_SUPABASE_URL=https://yootsrzrcjhzwdygwidp.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_q8V-PGOSXkXaZkVbiEsZJA_x0ilbkcA
ARG VITE_SUPABASE_STORAGE_BUCKET=nojoom-media

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_STORAGE_BUCKET=$VITE_SUPABASE_STORAGE_BUCKET

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["/bin/sh", "-c", "sed -i \"s/listen 80;/listen ${PORT:-80};/g\" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
