FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY index.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kronos -u 1001

# Change ownership
RUN chown -R kronos:nodejs /app
USER kronos

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

CMD ["node", "index.js"]