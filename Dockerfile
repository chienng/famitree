# FamiTree - build and run for production.
# To persist the SQLite DB, run with: docker run -p 3000:3000 -v famitree-data:/app/data <image>
# Build: docker build -t famitree .
# Run:   docker run -p 3000:3000 famitree
#
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Only production deps needed to run server
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

# Persistent SQLite DB (create at runtime if needed)
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
