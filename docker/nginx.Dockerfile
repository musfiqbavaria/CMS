# Stage 1: build React SPA
FROM node:20-alpine AS frontend-build
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: nginx serving SPA + proxying API/WS
FROM nginx:1.27-alpine
COPY --from=frontend-build /fe/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/prod.conf /etc/nginx/conf.d/default.conf
