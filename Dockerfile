# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web

COPY . .

RUN npm run build:all


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive
ENV APP_HOST=0.0.0.0
ENV APP_PORT=4070
ENV APP_DATA_DIR=/app/data
ENV EXO_POWERSHELL_BIN=pwsh

WORKDIR /app

# Install PowerShell from Microsoft's official Debian repository.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       wget \
       gnupg \
    && . /etc/os-release \
    && wget -q \
       "https://packages.microsoft.com/config/debian/${VERSION_ID}/packages-microsoft-prod.deb" \
       -O /tmp/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends powershell \
    && rm -rf /var/lib/apt/lists/*

# Install a version compatible with PowerShell 7.6.
RUN pwsh -NoLogo -NoProfile -NonInteractive -Command \
    "Set-PSRepository -Name PSGallery -InstallationPolicy Trusted; \
     Install-Module -Name ExchangeOnlineManagement \
       -RequiredVersion 3.10.1 \
       -Scope AllUsers \
       -Force \
       -AllowClobber"

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/data ./data
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /app/data /app/certs \
    && chown -R node:node /app

USER node

EXPOSE 4070

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4070/api/config/tags').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.js"]
