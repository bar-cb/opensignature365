TASK:
Repair and normalize the complete Docker setup for OpenSignature365 so
`docker compose up -d --build` succeeds on Ubuntu with host port 4070,
persistent `./data`, a read-only Exchange PFX mount, and PowerShell plus
ExchangeOnlineManagement inside the runtime container.

## Root causes

1. Read-only bind-mount of `/var/projects/opensignature365/data`
   Two Docker engines were installed and running: official apt
   `docker-ce` 29.8.1 (`docker.service`, root `/var/lib/docker`) and Snap
   Docker 29.8.0 (`snap.docker.dockerd.service`, root
   `/var/snap/docker/common/var-lib-docker`). The CLI talked to Snap via
   `/var/run/docker.sock` (replaced 2026-10-06 16:09). Snap confinement
   has the `home` plug only, so `/var/projects` appears read-only. Snap
   logs: `mkdir /var/projects: read-only file system`. The host path is
   ext4 `rw` and existed the whole time.

2. Port 4070 already in use
   Official apt `docker-proxy` (PIDs under `docker.service`) forwarded
   `0.0.0.0:4070` to leftover container `opensignature365` on the apt
   Engine (`ep=opensignature365` at 2026-10-06 16:05:47). The Snap
   Compose container stayed in `Created` because it could not bind 4070.
   Not a host Node process and not an unrelated app.

## Changes

### Repository
- Restored Compose bind mount `./data:/app/data` (removed the
  `/home/dev/opensignature365-data` Snap workaround).
- Mounted `./certs/opensignature365-exchange.pfx` read-only at
  `/app/certs/opensignature365-exchange.pfx`.
- Compose now sets `APP_HOST=0.0.0.0`, `APP_PORT=4070`,
  `APP_DATA_DIR=/app/data`, `APP_PUBLIC_BASE_URL=http://localhost:4070`,
  `EXO_POWERSHELL_BIN=pwsh`,
  `EXO_CERTIFICATE_PATH=/app/certs/opensignature365-exchange.pfx`.
  Tenant/secret/password values in `.env` were not modified.
- Dockerfile: default listen/data/pwsh env, `/app/certs` created,
  PowerShell + ExchangeOnlineManagement 3.10.1, non-root `node` user.
- `.dockerignore`: exclude `.git`, `.env`, `*.pfx`, `*.p12`, `*.key`,
  `node_modules`, `web/node_modules`, `data/reports`; seed templates kept.
- `.gitignore`: add `*.p12`.
- Docs: `docs/docker.md`, README Docker section, troubleshooting for
  port 4070 and Snap confinement, microsoft-setup cert path note,
  `.env.example` Docker comments.

### System (operator-approved sudo)
- Snap Docker disabled (`snap list docker` → `disabled`). Not removed
  and not purged.
- Official `docker.socket` / `docker.service` stopped and started so
  `/run/docker.sock` exists again. CLI now talks to Ubuntu 26.04.1 LTS
  Engine 29.8.1 at `/var/lib/docker`.
- Removed only this project's leftover `opensignature365` container via
  `docker compose down`, then rebuilt and recreated it. recording-viewer
  containers on the official Engine were left running.

## Backup
`/home/dev/opensignature365-backups/data-20261007-081739`

Canonical `data/` was not deleted, emptied, or replaced. A leftover
identical copy remains at `/home/dev/opensignature365-data` from the
earlier Snap workaround; it is not the live mount.

## Final mappings
- Ports: `4070:4070` (`0.0.0.0:4070->4070/tcp`)
- Volumes:
  - `/var/projects/opensignature365/data` → `/app/data` (rw)
  - `/var/projects/opensignature365/certs/opensignature365-exchange.pfx`
    → `/app/certs/opensignature365-exchange.pfx` (ro)

## Validation
- `docker compose config --quiet` — ok
- `docker compose build --no-cache` — image `opensignature365:local` built
- `docker compose up -d` — one container, healthcheck `healthy`
- Logs: listening on `http://0.0.0.0:4070`
- `curl -fsS http://127.0.0.1:4070/` — HTTP 200, OpenSignature365 HTML
- `/proc/net/tcp` inside container: `0.0.0.0:4070` (`00000000:0FE6`)
- Write test in `/app/data` succeeded; test file removed
- Existing signatures, 18 templates, sample users, and prior deployment
  report still present
- `pwsh` 7.6.6
- ExchangeOnlineManagement 3.10.1 at AllUsers module path
- PFX exists and is readable at the container path (contents not shown)
- `docker compose up -d --force-recreate` — healthy; persist marker
  survived; HTTP 200
- Settings page loads; Graph test `ok=true`
- Exchange test `ok=false`: PFX cannot be decrypted with the configured
  password. Docker mount and readability are fine. No transport rule
  was created. `ALLOW_PRODUCTION_DEPLOY=false`, `DEFAULT_DRY_RUN=true`.

## Remaining limitations
- Snap package `docker` is disabled but still installed. Optional later:
  `sudo snap remove docker` (do not use `--purge` if Snap-only volumes
  from other projects must be kept).
- Exchange Online connection still fails until
  `EXO_CERTIFICATE_PASSWORD` matches the PFX (or the PFX is re-exported).
  Do not commit or print that value.
- Leftover unused copy: `/home/dev/opensignature365-data`.
- Untracked junk file `Untitled` was not touched.
- After a host reboot, confirm a single apt Engine and
  `ls -l /run/docker.sock` before `docker compose up -d`.
