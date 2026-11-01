# API Flow

> A modern, web-based API testing platform — like Postman, but built for the edge.

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo + pnpm |
| **Web App** | Next.js 15 (App Router, static export on Cloudflare Pages, Tailwind CSS, TanStack Query, Zustand) |
| **API Server** | Hono (Cloudflare Workers) |
| **Database** | Cloudflare D1 (SQLite at Edge) |
| **ORM** | Drizzle ORM |
| **Auth** | Better Auth (Email + verification, Google; Apple optional) · Resend email |
| **Background Jobs** | Cloudflare Durable Objects + Alarms |
| **Styling** | Tailwind CSS + shadcn/ui design patterns |

---

## Project Structure

```
api-flow/
├── apps/
│   ├── web/          # Next.js 15 — Frontend Web App
│   ├── api/          # Hono — REST API & Proxy Server (Cloudflare Worker)
│   └── mobile/       # (Future) Flutter Mobile App
├── packages/
│   ├── db/           # Drizzle Schema + Migrations
│   └── shared/       # Shared Types, Zod Validators, Constants, Utils
```

---

## Features

- **Test any API without an account** — GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS, headers, query params, bodies, Bearer/Basic/API-key auth, timing breakdown.
- **Multiple request tabs** — open as many requests as you like (guests too); tabs are kept in the browser across reloads and sign-in.
- **Resizable workspace** — drag to resize the sidebar and the request/response split, switch stacked ↔ side-by-side, hide the sidebar (`Ctrl+B`) or response panel (`Ctrl+J`).
- **Response viewer** — Pretty (syntax-highlighted), Raw and Preview (collapsible JSON/XML tree, sandboxed HTML render) with JSON / XML / HTML / JavaScript / CSS / Plain Text formats, wrap, copy and download.
- **Themes** — System, Dark, Light and Ocean (deep-teal IDE style).
- **Save requests** (account required — guests are asked to sign in / sign up) — auth credentials are only stored if you opt in when saving.
- **Import & backup** — import Postman Collection v2.0/v2.1, Postman environments, Postman data exports and API Flow backups; download a full JSON backup of collections, requests, environments and monitors.
- **Endpoint monitors** (`/monitors`, account required) — add many endpoints (single or bulk paste), give each its own check interval (10 s – 24 h), expected status and timeout, then run heartbeat checks for all of them from one screen. View uptime, response times and a log table; download logs as CSV/JSON or clear them.
  Checks are scheduled by the browser while the Monitors page is open and executed in parallel by the API.

## Security Model

| Area | Protection |
|---|---|
| Guests | Can use `/proxy/execute` only; rate-limited per IP (30/min). Nothing is stored. |
| Signed-in users | Every resource query is scoped to the session user (incl. environment variables, folders, monitors). |
| Proxy / monitors | SSRF guard: http(s) only, blocks localhost, private/link-local/metadata IPs, re-validates every redirect, 5 MB response cap. |
| CORS / CSRF | Exact origin allowlist (`NEXT_PUBLIC_APP_URL` + `ALLOWED_ORIGINS`), shared with Better Auth trusted origins. |
| Auth | Email verification required, sign-in/sign-up rate limits, secure cookies in production. |
| Headers | Strict CSP + security headers on the web app; `secureHeaders` + 2 MB body limit on the API. Production errors never leak stack traces. |

> In production the web app (`*.pages.dev`) and API (`*.workers.dev`) are different sites, so the session
> cookie is `SameSite=None; Secure; Partitioned`. For the most reliable login across browsers, serve both
> from one domain (e.g. `app.example.com` + `api.example.com`).

---

## Quickstart (Local Development)

### 1. Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **Cloudflare Wrangler CLI**: (included as devDependency in workspace)

### 2. Installation & Setup

```bash
# Clone the repository and install dependencies
pnpm install

# Copy environment variables templates
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars   # API secrets for `wrangler dev`
```

> Wrangler reads Worker secrets from `apps/api/.dev.vars`, not the root `.env`.
> Set `BETTER_AUTH_SECRET` there to a random string of 32+ characters.

### 3. Generate and Apply Local Database Migrations

```bash
# Generate SQL migration from Drizzle schema definitions
pnpm db:generate

# Apply migrations to the API's local Cloudflare D1 database (apps/api/.wrangler)
pnpm db:migrate
```

### 4. Run Development Servers

```bash
# Run both Frontend (http://localhost:3100) and API Worker (http://localhost:8787)
pnpm dev
```

The web app runs on port **3100** (to avoid clashing with other apps on 3000). To change it,
edit the `dev` script in `apps/web/package.json` and add the new origin to `ALLOWED_ORIGINS`
(or `NEXT_PUBLIC_APP_URL`) in `apps/api/.dev.vars`.

`pnpm --filter @api-flow/api dev` runs the Worker with `APP_ENV=development`, which allows
`localhost` origins, lets the proxy reach `localhost`/private-network APIs, and logs email
verification links to the console (no email provider is wired up yet).

To run apps individually:
```bash
# Web app only
pnpm --filter @api-flow/web dev

# API Worker only
pnpm --filter @api-flow/api dev
```

---

## Complete Guide: Cloudflare Database (D1), Mapping & Migrations

### Step 1: Login to Cloudflare Wrangler

First, ensure you are logged into your Cloudflare account via Wrangler CLI:

```bash
npx wrangler login
```

### Step 2: Create a Cloudflare D1 Database

Run the following command to create a new D1 database instance in your Cloudflare account:

```bash
npx wrangler d1 create api-flow-db
```

Output will look similar to this:
```text
✅ Created D1 database api-flow-db with ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

[[d1_databases]]
binding = "DB"
database_name = "api-flow-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 3: Map D1 Database to the Application (`wrangler.jsonc`)

Copy the generated `database_id` into `apps/api/wrangler.jsonc`:

```jsonc
// apps/api/wrangler.jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "api-flow-db",
      "database_id": "YOUR_ACTUAL_CLOUDFLARE_D1_DATABASE_ID"
    }
  ]
}
```

### Step 4: Generating Database Migrations

Whenever you modify any schema file in `packages/db/src/schema/*.ts`, generate a new migration file:

```bash
pnpm db:generate
```
This writes new `.sql` migration files into `packages/db/migrations/`.

### Step 5: Executing Database Migrations

#### Local Development Database (Miniflare / Local Wrangler):
```bash
pnpm db:migrate
```
*(Runs `wrangler d1 migrations apply api-flow-db --local` under the hood)*

#### Production Cloudflare D1 Database:
```bash
pnpm --filter @api-flow/db migrate:prod
```
*(Runs `wrangler d1 migrations apply api-flow-db --remote` under the hood)*

---

## Deployment (Cloudflare Workers + Pages)

| Part | Hosted on | Command (run from the repo root) |
|---|---|---|
| Database migrations | Cloudflare D1 | `pnpm db:migrate:prod` |
| API (`apps/api`) | Cloudflare Workers | `pnpm deploy:api` |
| Web app (`apps/web`) | Cloudflare Pages (static files) | `pnpm deploy:web` |
| All three, in order | | `pnpm deploy:all` |

> **Why not `pnpm --filter … deploy`?** `deploy` is a built-in pnpm command (it copies a package to a
> folder), so it shadows the package script and fails with `ERR_PNPM_INVALID_DEPLOY_TARGET`.
> Use the root scripts above, or call the script explicitly: `pnpm --filter @api-flow/api run deploy`.

The web app is a **Next.js static export** (`apps/web/out`). Every page is client-rendered and talks to the
API Worker, so no server runtime (and no `@cloudflare/next-on-pages` / Vercel CLI) is needed — the build
works the same on Windows, macOS, Linux and in CI.

### 0. One-time setup

```bash
# Log in to Cloudflare (opens the browser)
npx wrangler login
```

### 1. Migrate the production database

```bash
pnpm db:migrate:prod
```
Runs `wrangler d1 migrations apply api-flow-db --remote`. Run it whenever `packages/db/migrations` changes.

### 2. Deploy the API Worker (`apps/api`)

#### A. Set the Worker secrets (once, and whenever a value changes)

```bash
cd apps/api

npx wrangler secret put BETTER_AUTH_SECRET     # random string, 32+ chars
npx wrangler secret put BETTER_AUTH_URL        # this Worker's URL, e.g. https://api-flow-api.<you>.workers.dev
npx wrangler secret put NEXT_PUBLIC_APP_URL    # the web app URL, e.g. https://api-flow-web.pages.dev

# Google sign-in
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Email (Resend)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM             # e.g. API Flow <noreply@yourdomain.com>

cd ../..
```

Optional: `ALLOWED_ORIGINS` (extra comma-separated web origins, e.g. a custom domain).
Sign in with Apple is **disabled**; to enable it later set `APPLE_SIGNIN_ENABLED=true` plus
`APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` (see the auth guide below). List what's set with
`npx wrangler secret list` (from `apps/api`).

#### B. Deploy

```bash
pnpm deploy:api
```

Wrangler prints the Worker URL (e.g. `https://api-flow-api.<your-subdomain>.workers.dev`).
Check it: opening `https://<worker-url>/` returns `{"name":"API Flow","status":"ok",…}`.

### 3. Deploy the web app (`apps/web`)

#### A. Point the build at your API (once)

`NEXT_PUBLIC_*` values are baked into the static files at build time:

```bash
# Windows (PowerShell)
Copy-Item apps/web/.env.production.example apps/web/.env.production.local
# macOS / Linux
cp apps/web/.env.production.example apps/web/.env.production.local
```

Edit `apps/web/.env.production.local` (git-ignored):

```bash
NEXT_PUBLIC_API_URL=https://api-flow-api.<your-subdomain>.workers.dev
NEXT_PUBLIC_APP_URL=https://api-flow-web.pages.dev
```

#### B. Deploy

```bash
pnpm deploy:web
```

This runs `next build` → `apps/web/out`, writes `out/_headers` (CSP + security headers, with
`connect-src` set to your API) and uploads with `wrangler pages deploy out --project-name=api-flow-web --branch=main`.
The first run creates the `api-flow-web` Pages project if it doesn't exist. The build stops with a clear
message if `NEXT_PUBLIC_API_URL` is missing or still points at localhost.

> If your Pages project's production branch isn't `main`, change `--branch` in
> `apps/web/package.json` → `pages:deploy`, otherwise the upload lands as a preview deployment.

#### Alternative: Cloudflare Pages Git integration

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
2. Build settings:
   - **Framework preset**: `None`
   - **Root directory**: `apps/web`
   - **Build command**: `pnpm run pages:build`
   - **Build output directory**: `out`
3. **Environment variables** (Production): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` (as above).
4. Save and Deploy. Every push to the production branch redeploys the web app
   (the API still deploys with `pnpm deploy:api`).

### 4. After deploying

- Add the web URL to **Google Cloud → OAuth client → Authorized JavaScript origins**, and
  `https://<worker-url>/auth/callback/google` to **Authorized redirect URIs**.
- Open the web app, register, confirm the verification email arrives, then sign in.
- Changing the API URL or any `NEXT_PUBLIC_*` value requires `pnpm deploy:web` again.

### Troubleshooting deployment

| Symptom | Fix |
|---|---|
| `ERR_PNPM_INVALID_DEPLOY_TARGET  This command requires one parameter` | Use `pnpm deploy:api` / `pnpm deploy:web` (or `pnpm --filter <pkg> run deploy`). |
| `spawn pnpm ENOENT` from `@cloudflare/next-on-pages` | Old build pipeline (not Windows-compatible). Pull the latest code — the web app now builds with plain `next build`. |
| Sign-in works locally but not in production / CORS errors | `NEXT_PUBLIC_APP_URL` secret on the Worker must exactly match the web origin (no trailing slash). Extra domains go in `ALLOWED_ORIGINS`. |
| Web app calls `localhost:8787` in production | `apps/web/.env.production.local` missing or wrong — fix it and run `pnpm deploy:web`. |
| "Provider not found" on social login | That provider's secrets aren't set on the Worker (`npx wrangler secret list`). |

---

## Authentication Setup (Google, Apple, Email & Sessions)

Step-by-step instructions for Google OAuth, Sign in with Apple, transactional email via
[Resend](https://resend.com) and session behaviour are in **[docs/SETUP-AUTH-EMAIL.md](docs/SETUP-AUTH-EMAIL.md)**.

---

## Troubleshooting & Common Fixes

### 1. Error: `ReferenceError: module is not defined in ES module scope`

**Cause**: In `apps/web/package.json`, `"type": "module"` is configured. Configuration files like `tailwind.config.js` or `postcss.config.js` that use CommonJS `module.exports` will throw a `ReferenceError`.

**Fix**:
Use ES module syntax (`export default` and `import`) in configuration files:

```js
// tailwind.config.js
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: { /* ... */ },
  plugins: [typography],
};
```

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 2. PowerShell Script Execution Error on Windows

If running `pnpm` returns `script execution is disabled on this system`, bypass execution policy in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm install"
```

---

## License

MIT
