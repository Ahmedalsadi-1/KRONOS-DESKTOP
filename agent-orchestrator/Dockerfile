FROM node:20-alpine

WORKDIR /app

COPY agent-orchestrator/package.json ./package.json
COPY agent-orchestrator/package-lock.json ./package-lock.json
RUN npm install --production

COPY agent-orchestrator/index.js ./index.js
COPY agent.md ./agent.md

EXPOSE 8080

CMD ["npm", "start"]
