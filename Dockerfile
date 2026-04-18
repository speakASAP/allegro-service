FROM node:18-alpine

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm install --prefer-offline --no-audit || npm ci

# Copy all source
COPY . .

# Install and build service subdirectory
WORKDIR /app/services/allegro-service
RUN npm install --prefer-offline --no-audit 2>/dev/null || true
RUN npm run build 2>/dev/null || true

# Expose port (will be overridden by ConfigMap)
EXPOSE 3000

# Start application from service directory
ENTRYPOINT []
CMD ["node", "dist/main.js"]
