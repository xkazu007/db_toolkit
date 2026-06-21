FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS db-check

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libxml2 libstdc++6 libpam0g libaudit1 libcap-ng0 liblzma5 zlib1g libcrypt1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY scripts ./scripts

CMD ["node", "scripts/check-target-db.mjs"]

FROM node:20-bookworm-slim AS app

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libxml2 libstdc++6 libpam0g libaudit1 libcap-ng0 liblzma5 zlib1g libcrypt1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
