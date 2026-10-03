FROM node:22.14.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM nginx:1.27.5-alpine AS web
COPY deploy/local/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22.14.0-alpine AS api
ENV NODE_ENV=production PORT=4178 APP_ENV=local
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-server ./dist-server
COPY shared/data ./dist-server/shared/data
CMD ["node", "dist-server/server/index.js"]
