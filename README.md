<p align="center">
  <img src="branding/logo-icon-animated.svg" alt="dmarcRadar logo" width="96" />
</p>

<h1 align="center">dmarcRadar</h1>

<p align="center">DMARC Reporting, scanned continuously.</p>

Enterprise DMARC aggregate report analysis platform — ingest reports via manual upload or
IMAP mailbox polling, store and dedupe them in Postgres, and visualize results across a
dashboard built almost entirely from donut charts.

## Stack

- Next.js 14 (App Router) + TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- NextAuth (credentials, bcrypt, JWT + role claim)
- Recharts for donut charts
- `imapflow` + `mailparser` for IMAP ingestion, run from a standalone worker process
- Zod validation, pino logging, Vitest for parser/stats unit tests

## Local development

1. Copy `.env.example` to `.env` and fill in `NEXTAUTH_SECRET` / `MAILBOX_SECRET`
   (`openssl rand -hex 32` for both). `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and
   `DATABASE_URL` can be left as-is for local use — see the comment above them in
   `.env.example` if you change the DB credentials, since both need to stay in sync.
2. Start Postgres: `docker compose up -d postgres`
3. Install deps: `npm install`
4. Run migrations: `npm run prisma:migrate`
5. Seed the first admin user: `npm run seed`
6. Start the app: `npm run dev`
7. In a separate terminal, start the ingestion worker (only needed to poll IMAP mailboxes):
   `npm run worker`

Sign in with the seeded admin credentials from `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

All secrets — Postgres credentials, NextAuth secret, the mailbox-password encryption key, the
seed admin's credentials — live only in `.env` (gitignored). Nothing is hardcoded in
`docker-compose.yml`, the Dockerfile, or source: the `postgres` service reads its own
credentials from `.env` via `env_file`, and the `app`/`worker` services derive their
containerized `DATABASE_URL` from those same `POSTGRES_*` values (pointed at the `postgres`
service instead of `localhost` — see the comment in `docker-compose.yml`), so there's one
source of truth for the DB password rather than two copies that can drift out of sync.

## Landing page (GitHub Pages)

A static landing page lives in [`docs/`](docs/) and deploys automatically to GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main` that
touches `docs/`. Published at **<https://dmarcradar.cloudlative.com>** (custom domain, HTTPS
enforced) — the underlying `cloudlative.github.io/dmarcRadar/` URL still resolves too, but the
custom domain is canonical. [`docs/CNAME`](docs/CNAME) records the domain so it's tracked in
version control alongside the repo's **Settings → Pages → Custom domain** setting.

## Container images

Every push to `main` builds and publishes one image to GitHub Container Registry via
[`.github/workflows/docker-build.yml`](.github/workflows/docker-build.yml):

- `ghcr.io/cloudlative/dmarcradar:latest` — always the most recent `main` build
- `ghcr.io/cloudlative/dmarcradar:<short-sha>` — every build, pinned to its commit
- `ghcr.io/cloudlative/dmarcradar:vX.Y.Z` — semver-tagged builds from version tags

The same image serves both roles in `docker-compose.yml`, which references it via `image:`
(pulled for `docker compose up`) — the `app` service runs it with the default command
(`npm start`); the `worker` service runs the identical image with its command overridden to
`npx tsx worker/poller.ts`. One image, one build, two roles.

**One-time setup**: GitHub Container Registry packages inherit their parent repo's visibility
*at the time they're first published*, independent of the repo's visibility afterwards. The
`GITHUB_TOKEN` the workflow runs with cannot change a package's visibility — that requires
either the web UI or a personal access token with package scopes:

```bash
# Requires a token with read:packages/write:packages/delete:packages scopes:
#   gh auth refresh -h github.com -s read:packages,write:packages,delete:packages
gh api -X PATCH /orgs/cloudlative/packages/container/dmarcradar/visibility -f visibility=public
```

Or via the UI: the repo's **Packages** sidebar → package → **Package settings** → **Change visibility** → **Public**.
This only needs to be done once — it persists across future builds.

## Docker Compose (full stack)

```bash
docker compose up -d
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

This pulls `ghcr.io/cloudlative/dmarcradar:latest` for the `app` and `worker` services. To
build from local source instead (e.g. testing an unpushed change), use `docker compose up -d --build`.

This starts Postgres, the Next.js app, and the ingestion worker together.

## Tests

```bash
npm run test
```

Covers the DMARC XML/gzip/zip parser and the dashboard stats aggregation logic.

## Roles

- **ADMIN** — full access: upload reports, manage domains, configure mailbox ingestion,
  manage users.
- **VIEWER** — read-only: dashboard and report browsing only.

## Data model

See `prisma/schema.prisma`. Reports are deduped on `(reportId, orgName, domainId)`, so
re-polling the same mailbox or re-uploading the same file is a no-op.

## Branding

Logo source and rasterized assets live in [`branding/`](branding/):

- `logo-icon.svg` — master square mark (used for `src/app/icon.svg`, the in-app `Logo`
  component, and favicons), rasterized to `logo-icon-{16,32,48,64,128,192,256,512}.png`
- `logo-icon-animated.svg` — same mark with the radar sweep animated via SMIL (`<animateTransform>`)
  instead of CSS, so it keeps spinning when embedded standalone (e.g. this README) where the
  app's stylesheet isn't loaded. Used at the top of this file.
- `logo-wordmark-{light,dark}.svg` — icon + wordmark lockup for light/dark backgrounds,
  rasterized at 1x/2x/3x for use in docs, social previews, or a repo card

Regenerate the PNGs after editing an SVG source with:

```bash
npm install --no-save sharp
node scripts/generate-logo-assets.mjs
```

## Author

Built by [Muhammad Asif](https://pk.linkedin.com/in/aasifrafiq).
