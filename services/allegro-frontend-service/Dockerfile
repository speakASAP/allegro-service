# Multi-stage build for Frontend Service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy frontend service files
COPY services/allegro-frontend-service/package*.json ./
COPY services/allegro-frontend-service/tsconfig*.json ./
COPY services/allegro-frontend-service/vite.config.ts ./
COPY services/allegro-frontend-service/tailwind.config.js ./
COPY services/allegro-frontend-service/postcss.config.js ./
COPY services/allegro-frontend-service/src ./src
COPY services/allegro-frontend-service/index.html ./
COPY services/allegro-frontend-service/public ./public

# Install dependencies and build
# Set production API URL as build-time environment variable
ARG VITE_API_URL=https://allegro.statex.cz/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm ci && npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built frontend files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY services/allegro-frontend-service/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3410

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3410/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

