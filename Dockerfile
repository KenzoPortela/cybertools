# syntax=docker/dockerfile:1

# cybertools — image de production.
#
#   1. build  : clone CyberChef et IT-Tools à la révision de vendor.lock.json,
#               construit le moteur CyberChef (webpack) puis l'application (Vite) ;
#   2. runtime : nginx sans privilèges sert les fichiers statiques sur le port 8080.
#
# Tous les traitements ont lieu dans le navigateur : le serveur ne fait que
# servir des fichiers.

# --- 1. Construction -------------------------------------------------------

# Le résultat est un site statique, identique quelle que soit l'architecture :
# cette étape tourne toujours sur celle de la machine qui construit (pas
# d'émulation) ; seule l'image finale est déclinée en amd64 et arm64.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Webpack sur les ~500 opérations de CyberChef dépasse la mémoire par défaut de Node.
ENV NODE_OPTIONS=--max-old-space-size=4096 \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

# Sources amont : cette couche ne se reconstruit que si vendor.lock.json ou le
# script de préparation changent.
COPY vendor.lock.json package.json ./
COPY build/scripts/setup-vendor.mjs build/scripts/
RUN node build/scripts/setup-vendor.mjs

# Dépendances de l'application.
COPY package-lock.json ./
RUN npm ci

# Sources, puis construction. La vérification des types relève du
# développement (npm run build) ; l'image ne fait que construire.
COPY . .
RUN npm run cyberchef:build \
 && npx vite build

# --- 2. Service ------------------------------------------------------------

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

LABEL org.opencontainers.image.title="cybertools" \
      org.opencontainers.image.source="https://github.com/KenzoPortela/cybertools" \
      org.opencontainers.image.authors="Kenzo Portela" \
      org.opencontainers.image.description="Unified toolbox: CyberChef and IT-Tools in a single interface" \
      org.opencontainers.image.licenses="GPL-3.0-only"

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
