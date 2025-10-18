  GNU nano 7.2                                           Dockerfile                                                     # ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json* yarn.lock* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm i; fi

# Copy source and build
COPY . .
# Force prod build (adjust project name if needed)
RUN npm run build -- --configuration production

# ---- Run stage ----
FROM nginx:1.27-alpine
# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf
# Copy Angular dist (update path if your outputPath differs)
COPY dist/flashcards/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]