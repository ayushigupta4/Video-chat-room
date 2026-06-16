# ─── Stage 1: Build the React frontend ───────────────────────────────────────
# This stage exists only at build time. Its node_modules never end up in the
# final image, which keeps the image lean.
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy dependency files first so Docker can cache this layer.
# If package.json hasn't changed, Docker reuses the cached npm install.
COPY client/package*.json ./
RUN npm install

# Now copy the source and build. No REACT_APP_WS_URL env var here,
# so the dynamic window.location.host fallback is baked in.
COPY client/ ./
RUN npm run build


# ─── Stage 2: Production server ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies (no devDependencies)
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy the server code
COPY server/ ./

# Copy the React build output from Stage 1 into ./public
# server.js serves this directory as static files
COPY --from=client-builder /app/client/build ./public

# Render (and most platforms) set a PORT env var. Our server reads it.
EXPOSE 3001

CMD ["node", "server.js"]
