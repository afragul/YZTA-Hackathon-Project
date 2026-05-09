FROM node:20-bookworm-slim

ENV NODE_ENV=development \
    CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
