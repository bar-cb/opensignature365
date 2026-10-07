# Docker setup

OpenSignature365 is intended to run locally with **one** Docker Engine and
**one** Compose project. Persistent application data stays in the repository
`data/` directory.

## Required Docker

Use Docker Engine from Docker's official apt repository on Ubuntu:

- Docker Engine **28+** (this host was validated against Engine 29.x / Compose v5)
- Docker Compose plugin (`docker compose`)
- The `dev` (or your login) user in the `docker` group

Install from https://docs.docker.com/engine/install/ubuntu/ — **not** the Snap
package. Snap Docker is confined and cannot bind-mount `/var/projects`.

Confirm the CLI talks to the official daemon:

```bash
docker context show          # expect: default
docker info --format '{{.OperatingSystem}} {{.DockerRootDir}}'
# expect a normal Ubuntu OS string and /var/lib/docker
# Snap looks like: "Ubuntu Core 24" and /var/snap/docker/common/var-lib-docker
```

If both `docker.service` and `snap.docker.dockerd.service` are running, stop
and disable Snap Docker so only the apt Engine remains. See
[Troubleshooting Snap confinement](#troubleshooting-snap-confinement-and-bind-mounts).

## Build, start, stop, restart

From the repository root, with a filled-in `.env` (copy `.env.example`; never
commit `.env`):

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 opensignature365
docker compose restart
docker compose down          # stops the container; does not delete ./data
```

Recreate without losing data:

```bash
docker compose up -d --force-recreate
```

## Ports

| Place | Address | Role |
| --- | --- | --- |
| Host | `127.0.0.1:4070` (and `0.0.0.0:4070` via Docker proxy) | Browser / `curl` |
| Container | `0.0.0.0:4070` | Express API + built UI |

Compose publishes `4070:4070`. Do not change the container port; only change
the host side if something unrelated already owns `4070`.

## Persistent data

| Role | Path |
| --- | --- |
| Host (canonical) | `/var/projects/opensignature365/data` |
| Container | `/app/data` |

Compose bind-mounts `./data:/app/data`. Rebuilds and `docker compose up --force-recreate`
do **not** replace this directory. Do not mount the whole repository into the
runtime container.

The image may contain seed templates for image-only runs. With the bind mount,
the host `data/` tree is what the process sees.

## Certificate paths

PowerShell inside the container reads `EXO_CERTIFICATE_PATH`. That value must
be the **container** path, not the Ubuntu path.

| Role | Path |
| --- | --- |
| Host file | `./certs/opensignature365-exchange.pfx` |
| Container (read-only mount) | `/app/certs/opensignature365-exchange.pfx` |

Compose mounts only the PFX, read-only. Compose also sets
`EXO_CERTIFICATE_PATH=/app/certs/opensignature365-exchange.pfx` so a host path
in `.env` cannot break container auth.

Never bake the PFX, private key, or `.env` into the image.

## Environment

1. Copy `.env.example` to `.env` and fill tenant, app, and certificate values.
2. Keep `ALLOW_PRODUCTION_DEPLOY=false` and `DEFAULT_DRY_RUN=true` unless you
   are deliberately performing a production Exchange change.
3. Compose `environment:` overrides the Docker-specific host/port/data/cert
   values. Tenant IDs, secrets, thumbprint, and certificate password stay in
   `.env` and are not printed by Compose docs or logs on purpose.

Effective values inside the container:

```env
APP_HOST=0.0.0.0
APP_PORT=4070
APP_DATA_DIR=/app/data
APP_PUBLIC_BASE_URL=http://localhost:4070
EXO_POWERSHELL_BIN=pwsh
EXO_CERTIFICATE_PATH=/app/certs/opensignature365-exchange.pfx
```

## Connection tests

After the container is healthy:

1. Open http://localhost:4070/ and go to **Settings & diagnostics**.
2. Confirm Graph and Exchange status load (this page calls both providers).
3. Or use the API (no production deploy, no transport-rule changes):

```bash
curl -fsS http://127.0.0.1:4070/api/microsoft/status
curl -fsS -X POST http://127.0.0.1:4070/api/microsoft/test-graph
curl -fsS -X POST http://127.0.0.1:4070/api/microsoft/test-exchange
```

CLI equivalents inside the container:

```bash
docker compose exec -T opensignature365 node dist/cli/index.js test-graph
docker compose exec -T opensignature365 node dist/cli/index.js test-exchange
```

## Backup and restore of `data`

Backup (does not modify the live directory):

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/opensignature365-backups"
cp -a ./data "$HOME/opensignature365-backups/data-$TS"
```

Restore (replaces live `data/` from a backup; stop the container first):

```bash
docker compose down
# inspect the backup, then:
cp -a "$HOME/opensignature365-backups/data-YYYYMMDD-HHMMSS/." ./data/
docker compose up -d
```

## Troubleshooting port 4070

Identify the owner before stopping anything:

```bash
ss -ltnp | grep ':4070' || true
docker ps -a --filter publish=4070
systemctl is-active docker snap.docker.dockerd || true
```

| Owner | Action |
| --- | --- |
| This project's `opensignature365` container | `docker compose down` then `docker compose up -d` |
| A leftover OpenSignature365 container on another daemon / Compose project | Stop and remove **that named container only** after inspecting it |
| Snap `dockerd` vs apt `dockerd` both running | Normalize to a single Engine (below). Do not keep killing `docker-proxy` |
| Unrelated process | Leave it running. Either stop it yourself or change only the **host** port in `compose.yaml` (`"HOST:4070"`) |

Do not `lsof -ti:4070 | xargs kill` as a first step.

## Troubleshooting Snap confinement and bind mounts

Symptom:

```text
error while creating mount source path '/var/projects/opensignature365/data':
mkdir /var/projects: read-only file system
```

The host directory exists and is writable. Snap Docker's `home` plug cannot
see `/var/projects`, so the Snap daemon treats that path as read-only.

Do **not** permanently move project data into `$HOME` to hide this. Use the
official apt Docker Engine and keep data at `./data`.

Normalize (requires sudo):

```bash
sudo systemctl stop snap.docker.dockerd.service
sudo systemctl disable snap.docker.dockerd.service
sudo snap disable docker
sudo systemctl stop docker.service
sudo systemctl stop docker.socket
sudo systemctl start docker.socket
sudo systemctl start docker.service
ls -l /run/docker.sock
docker info --format '{{.OperatingSystem}} {{.DockerRootDir}}'

If Snap is already disabled but `/run/docker.sock` is missing while
`docker.service` is still the old process, Snap unlinked the socket. Recreate
it with the stop/start sequence above — do not glue `docker info` onto the
`systemctl` line.
```

After the CLI talks to `/var/lib/docker`, remove the unused Snap package if
you no longer need it:

```bash
sudo snap remove docker
```

Do not pass `--purge` unless you intend to delete Snap's own container data
(other projects such as recording-viewer may have been running there). Bring
those projects up again with the official Engine after the switch.
