FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_MAPBOX_TOKEN=pk.placeholder

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
