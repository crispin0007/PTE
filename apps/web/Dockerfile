# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/
COPY packages/scoring/package.json packages/scoring/
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_API_URL=""
ARG OPENPTE_INCLUDE_UNREVIEWED="0"
ARG VITE_CONTACT_EMAIL=""
ENV VITE_API_URL=$VITE_API_URL OPENPTE_INCLUDE_UNREVIEWED=$OPENPTE_INCLUDE_UNREVIEWED \
  VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL
RUN npm run build -w @openpte/web

FROM nginx:1.29-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
