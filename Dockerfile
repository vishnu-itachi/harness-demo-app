# Harness demo app image (used by real Harness CI/CD; local simulator skips docker)
FROM node:20-alpine

WORKDIR /app

# Copy the manifest first so the dependency layer is cached between builds.
COPY package.json ./
RUN npm install --omit=dev || npm install

COPY server.js ./server.js

# Run as a non-root user. The STO config scan checks for this.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
ENV APP_VERSION=1.0.0

# Container-level health check, separate from the K8s probes.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
