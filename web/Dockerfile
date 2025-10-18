# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm i; fi

# Copy source and build
COPY . .
# Prod build (adjust if your project name/outputPath differs)
RUN npm run build -- --configuration production

# ---- Run stage ----
FROM nginx:1.27-alpine
# Copy custom nginx config (ensure this file exists in your build context)
COPY nginx.conf /etc/nginx/nginx.conf

# ✅ copy from the build stage, not the local context
# Angular 17+ default: dist/<project-name>/browser
# If you're not sure about the project folder, use the wildcard line and remove the specific one.
# COPY --from=build /app/dist/flashcards/browser /usr/share/nginx/html
COPY --from=build /app/dist/*/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]