---
title: Local Development
summary: Set up Taskcore for local development
---

Run Taskcore locally with zero external dependencies.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev Server

```sh
pnpm install
pnpm dev
```

This starts:

- **API server** at `http://localhost:3100`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. Taskcore uses embedded PostgreSQL automatically.

## One-Command Bootstrap

For a first-time install:

```sh
pnpm taskcore run
```

This does:

1. Auto-onboards if config is missing
2. Runs `taskcore doctor` with repair enabled
3. Starts the server when checks pass

## Bind Presets In Dev

Default `pnpm dev` stays in `local_trusted` with loopback-only binding.

To open Taskcore to a private network with login enabled:

```sh
pnpm dev --bind lan
```

For Tailscale-only binding on a detected tailnet address:

```sh
pnpm dev --bind tailnet
```

Legacy aliases still work and map to the older broad private-network behavior:

```sh
pnpm dev --tailscale-auth
pnpm dev --authenticated-private
```

Allow additional private hostnames:

```sh
pnpm taskcore allowed-hostname dotta-macbook-pro
```

For full setup and troubleshooting, see [Tailscale Private Access](/deploy/tailscale-private-access).

## Health Checks

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## Reset Dev Data

To wipe local data and start fresh:

```sh
rm -rf ~/.taskcore/instances/default/db
pnpm dev
```

## Data Locations

| Data        | Path                                               |
| ----------- | -------------------------------------------------- |
| Config      | `~/.taskcore/instances/default/config.json`        |
| Database    | `~/.taskcore/instances/default/db`                 |
| Storage     | `~/.taskcore/instances/default/data/storage`       |
| Secrets key | `~/.taskcore/instances/default/secrets/master.key` |
| Logs        | `~/.taskcore/instances/default/logs`               |

Override with environment variables:

```sh
TASKCORE_HOME=/custom/path TASKCORE_INSTANCE_ID=dev pnpm taskcore run
```
