<p align="center">
  <img src="branding/logo-icon-128.png" alt="dmarcRadar logo" width="96" />
</p>

<h1 align="center">dmarcRadar</h1>

<p align="center">Email authentication, scanned continuously.</p>

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
   (`openssl rand -hex 32` for both).
2. Start Postgres: `docker compose up -d postgres`
3. Install deps: `npm install`
4. Run migrations: `npm run prisma:migrate`
5. Seed the first admin user: `npm run seed`
6. Start the app: `npm run dev`
7. In a separate terminal, start the ingestion worker (only needed to poll IMAP mailboxes):
   `npm run worker`

Sign in with the seeded admin credentials from `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Container images

Every push to `main` builds and publishes two images to GitHub Container Registry via
[`.github/workflows/docker-build.yml`](.github/workflows/docker-build.yml):

- `ghcr.io/cloudlative/dmarcradar` — the app
- `ghcr.io/cloudlative/dmarcradar-worker` — the ingestion worker

Version tags (`vX.Y.Z`) also get semver-tagged builds; every build is additionally tagged
with its short commit SHA.

**One-time setup**: this repo is private, and GitHub Container Registry packages inherit
their parent repo's visibility. The `GITHUB_TOKEN` the workflow runs with cannot change a
package's visibility — that requires either the web UI or a personal access token with
package scopes. After the first successful workflow run, make each package public once:

```bash
# Requires a token with read:packages/write:packages/delete:packages scopes:
#   gh auth refresh -h github.com -s read:packages,write:packages,delete:packages
gh api -X PATCH /orgs/cloudlative/packages/container/dmarcradar/visibility -f visibility=public
gh api -X PATCH /orgs/cloudlative/packages/container/dmarcradar-worker/visibility -f visibility=public
```

Or via the UI: the repo's **Packages** sidebar → package → **Package settings** → **Change visibility** → **Public**.
This only needs to be done once — it persists across future builds.

## Docker Compose (full stack)

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

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
- `logo-wordmark-{light,dark}.svg` — icon + wordmark lockup for light/dark backgrounds,
  rasterized at 1x/2x/3x for use in docs, social previews, or a repo card

Regenerate the PNGs after editing an SVG source with:

```bash
npm install --no-save sharp
node scripts/generate-logo-assets.mjs
```
