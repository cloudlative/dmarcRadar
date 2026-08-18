FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# One image, two roles: the `app` service runs `npm start` (the default CMD); the `worker`
# service overrides the command to run `npx tsx worker/poller.ts` instead (see
# docker-compose.yml). Both need the full node_modules (including devDependencies like tsx),
# so this doesn't use Next's "standalone" output — that trims devDependencies specifically to
# shrink the app-only image, which only pays off if the worker isn't sharing it.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/worker ./worker
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "start"]
