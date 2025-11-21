FROM node:lts-slim

# Install OpenSSL for Prisma and curl for health checks
RUN apt-get update -y && apt-get install -y openssl libssl-dev curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY shared/package.json shared/package-lock.json* ./shared/
COPY services/product-service/package.json ./services/product-service/

# Install root dependencies (includes @prisma/client)
RUN npm install

# Copy source code
COPY shared ./shared
COPY services/product-service ./services/product-service
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma Client in root node_modules (where @prisma/client is installed)
RUN npx prisma generate --schema=./prisma/schema.prisma
# Verify Prisma client was generated in root
RUN test -d node_modules/.prisma && echo "Prisma client generated in root" || (echo "ERROR: Prisma client not found in root" && exit 1)

# Install shared module dependencies
WORKDIR /app/shared
RUN npm install --legacy-peer-deps

# Copy generated Prisma Client to shared node_modules so shared module can use it
WORKDIR /app
RUN mkdir -p shared/node_modules/.prisma && \
    cp -r node_modules/.prisma/* shared/node_modules/.prisma/ && \
    mkdir -p shared/node_modules/@prisma && \
    cp -r node_modules/@prisma/* shared/node_modules/@prisma/ && \
    echo "Prisma client copied to shared/node_modules"

# Build shared module
WORKDIR /app/shared
RUN npm run build

# Build service
WORKDIR /app/services/product-service
RUN npm install --include=dev
RUN npm run build
# Copy compiled shared module to service dist
RUN cp -r ../../shared/dist ./dist/shared || true

# Expose port
EXPOSE 3402

# Set NODE_PATH to include shared node_modules for runtime module resolution
ENV NODE_PATH=/app/shared/node_modules:/app/node_modules

# Start service
CMD ["node", "dist/main.js"]

