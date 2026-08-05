FROM node:22-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix ./server

COPY . .

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "server/src/index.js"]
