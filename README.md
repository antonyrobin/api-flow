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

## Quickstart (Local Development)

### 1. Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **Cloudflare Wrangler CLI**: (included as devDependency in workspace)

### 2. Installation & Setup

```bash
# Clone the repository and install dependencies
pnpm install

# Copy environment variables template
cp .env.example .env
```

### 3. Generate and Apply Local Database Migrations

```bash
# Generate SQL migration from Drizzle schema definitions
pnpm db:generate

# Apply migrations to your local Cloudflare D1 SQLite database instance
pnpm db:migrate
```

### 4. Run Development Servers

```bash
# Run both Frontend (http://localhost:3000) and API Worker (http://localhost:8787)
pnpm dev
```

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

## Authentication Setup (Google, Apple & Email Verification)

### Google OAuth Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized JavaScript origins**: `http://localhost:3000`, `https://<your-app>.pages.dev`.
4. Set **Authorized redirect URIs**: `http://localhost:8787/auth/callback/google`, `https://<api-worker>.workers.dev/auth/callback/google`.
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your environment variables / Cloudflare secrets.

### Apple Sign-In Configuration
1. Login to [Apple Developer Portal](https://developer.apple.com/).
2. Create an **App ID** and enable **Sign In with Apple**.
3. Create a **Service ID** with your domain and set Return URL: `https://<api-worker>.workers.dev/auth/callback/apple`.
4. Add `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` to your environment variables / Cloudflare secrets.

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
