# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Build argument - Railway injects this
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
# Note: standard nginx image keeps the master process as root so it can bind
# port 80 (required by the DNS config), but worker processes automatically
# drop to the 'nginx' user. Accepted risk for CM-FE-003.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
