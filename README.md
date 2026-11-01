# API Flow

> A modern, web-based API testing platform — like Postman, but built for the edge.

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo + pnpm |
| **Web App** | Next.js 15 (App Router, Tailwind CSS, TanStack Query, Zustand) |
| **API Server** | Hono (Cloudflare Workers) |
| **Database** | Cloudflare D1 (SQLite at Edge) |
| **ORM** | Drizzle ORM |
| **Auth** | Better Auth (Google, Apple, Email + Verification) |
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

## Deployment & Setup Guide (Cloudflare Workers & Pages)

### 1. Deploying the Backend REST API (`apps/api`)

#### A. Set Secrets & Environment Variables on Cloudflare Workers

For production secrets (such as Better Auth secrets and OAuth keys), set them using `wrangler secret`:

```bash
cd apps/api

# Better Auth Secret
npx wrangler secret put BETTER_AUTH_SECRET

# Better Auth Base URL
npx wrangler secret put BETTER_AUTH_URL

# Web app origin (used for CORS + trusted origins). Extra origins: ALLOWED_ORIGINS (comma-separated)
npx wrangler secret put NEXT_PUBLIC_APP_URL

# Google OAuth
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Apple OAuth
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_CLIENT_SECRET
```

#### B. Deploy the API Worker to Cloudflare

```bash
# From root directory
pnpm --filter @api-flow/api deploy
```

Once deployed, Cloudflare will provide your worker URL (e.g. `https://api-flow-api.<your-subdomain>.workers.dev`).

---

### 2. Deploying the Frontend Web App (`apps/web`)

You can deploy the Next.js frontend to **Cloudflare Pages** or **Vercel**.

#### Deploying via Wrangler CLI:
```bash
# From root directory
pnpm --filter @api-flow/web deploy
```

#### Deploying via Cloudflare Dashboard (Git Integration):

1. **Push your code to GitHub / GitLab**.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select the `api-flow` repository and configure build settings:
   - **Framework preset**: `None` (or `Next.js`)
   - **Root directory**: `apps/web`
   - **Build command**: `pnpm run pages:build`
   - **Deploy command**: `pnpm run pages:deploy`
4. Add Environment Variables in Cloudflare Pages Settings:
   - `NEXT_PUBLIC_API_URL`: `https://api-flow-api.<your-subdomain>.workers.dev`
   - `NEXT_PUBLIC_APP_URL`: `https://<your-pages-app>.pages.dev`
5. Click **Save and Deploy**.

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
