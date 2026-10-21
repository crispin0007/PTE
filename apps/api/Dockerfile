# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/
COPY packages/scoring/package.json packages/scoring/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY packages packages
COPY apps/api apps/api
COPY content content
COPY content-assets content-assets
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["npm", "start", "-w", "@openpte/api"]
