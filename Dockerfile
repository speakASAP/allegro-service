FROM node:24-slim

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm install --prefer-offline --no-audit || npm ci

# Copy all source
COPY . .

# Install and build service subdirectory
WORKDIR /app/services/allegro-service
RUN npm install --prefer-offline --no-audit || npm ci || \
    (echo "❌ npm install failed for allegro-service" >&2; exit 1)
RUN npm run build
RUN ls -la dist/
RUN cat dist/main.js | head -5

# Expose port (will be overridden by ConfigMap)
EXPOSE 3000

# Start application from service directory
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
