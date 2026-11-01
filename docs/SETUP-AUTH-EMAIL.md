# Sign-in providers, email and sessions — setup guide

API Flow uses [Better Auth](https://www.better-auth.com) on the Cloudflare Worker in `apps/api`.
Every secret below goes in **two places**:

| Where | How |
|---|---|
| Local dev | `apps/api/.dev.vars` (copy from `.dev.vars.example`, git-ignored). Restart `pnpm dev` after editing. |
| Production | `cd apps/api && npx wrangler secret put NAME` (prompts for the value, stored encrypted) |

Make sure `BETTER_AUTH_URL` is the **public URL of the API Worker** (e.g. `https://api-flow-api.<you>.workers.dev`)
and `NEXT_PUBLIC_APP_URL` is the web app URL. OAuth callbacks always go to `{BETTER_AUTH_URL}/auth/callback/{provider}`.

> "Provider not found" means the provider's ID/secret are not set on the Worker. The sign-in pages now
> ask `GET /auth/providers` and hide buttons for providers that aren't configured.

---

## 1. Google sign-in

1. Open <https://console.cloud.google.com> → create (or pick) a project.
2. **Google Auth Platform → Branding** (older UI: *APIs & Services → OAuth consent screen*):
   app name "API Flow", support email, and under *Authorized domains* add your web and API domains
   (e.g. `pages.dev`/`workers.dev` won't verify — use your own domain for production branding).
3. **Audience**: *External*. While the app is in *Testing*, add your Google account under *Test users*.
   Click **Publish app** when you're ready for everyone.
4. **Clients → Create client → Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3100` and your production web URL
   - *Authorized redirect URIs*:
     - `http://localhost:8787/auth/callback/google`
     - `https://<your-api-domain>/auth/callback/google`
5. Copy the **Client ID** and **Client secret**:
   ```bash
   # apps/api/.dev.vars
   GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
   ```bash
   cd apps/api
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
6. Restart / redeploy. "Continue with Google" appears on `/login` and `/register`.

## 2. Sign in with Apple

Requires a paid **Apple Developer Program** membership. Apple does **not** allow `localhost` or plain
HTTP return URLs, so test against your deployed API (or an HTTPS tunnel such as `cloudflared tunnel`).

1. <https://developer.apple.com/account> → **Certificates, IDs & Profiles → Identifiers → +**
   → **App IDs** → App → description "API Flow", bundle ID e.g. `com.yourcompany.apiflow`,
   tick **Sign In with Apple** → Register.
2. **Identifiers → + → Services IDs** → description "API Flow Web", identifier e.g.
   `com.yourcompany.apiflow.web` → Register. **This identifier is `APPLE_CLIENT_ID`.**
3. Open the Services ID → tick **Sign In with Apple → Configure**:
   - Primary App ID: the App ID from step 1
   - Domains and Subdomains: your API host, e.g. `api-flow-api.you.workers.dev` (no `https://`)
   - Return URLs: `https://api-flow-api.you.workers.dev/auth/callback/apple`
   - Save → Continue → Save.
4. **Keys → +** → name "API Flow Sign in with Apple", tick **Sign In with Apple → Configure** (choose the
   App ID) → Register → **Download** the `AuthKey_XXXXXXXXXX.p8` (one-time download). Note the **Key ID**.
   Your **Team ID** is shown top-right of the developer portal.
5. Generate the client secret (a JWT valid for up to 6 months):
   ```bash
   cd apps/api
   node scripts/apple-client-secret.mjs --team TEAMID --key KEYID --client com.yourcompany.apiflow.web --p8 ./AuthKey_KEYID.p8
   ```
   Keep the `.p8` file out of git.
6. Store the values:
   ```bash
   npx wrangler secret put APPLE_CLIENT_ID      # com.yourcompany.apiflow.web
   npx wrangler secret put APPLE_CLIENT_SECRET  # the JWT printed above
   ```
7. **Set a reminder**: regenerate `APPLE_CLIENT_SECRET` before the expiry date the script prints.

`https://appleid.apple.com` is added to the trusted origins automatically when Apple is configured
(Apple posts its callback from that origin).

## 3. Email with Resend

Used for: email verification (sign-up), resend verification, password reset, "password changed"
notice, welcome email after verification / social sign-up, and "you already have an account" when
someone re-registers an existing address.

1. Create an account at <https://resend.com>.
2. **Domains → Add Domain** → enter a domain you own (a subdomain like `mail.yourdomain.com` is fine).
   Resend shows DNS records (SPF `TXT`, DKIM `TXT`, and an `MX` for bounces). Add them in your DNS
   (Cloudflare: *DNS → Records → Add record*, set proxy status to **DNS only**) → **Verify**. Usually a few minutes.
3. **API Keys → Create API Key** → name "api-flow-worker", permission **Sending access**,
   restrict to your domain → **Add**. Copy the `re_...` key now — it is shown only once.
4. Configure:
   ```bash
   # apps/api/.dev.vars
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   EMAIL_FROM=API Flow <noreply@yourdomain.com>
   ```
   ```bash
   cd apps/api
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put EMAIL_FROM
   ```
5. Test: register a new account → the verification email arrives. Use "Forgot password?" on `/login`
   to test the reset flow. Delivery logs are in Resend → **Emails**.

Notes:
- Before your domain is verified you can leave `EMAIL_FROM` empty: emails are sent from
  `onboarding@resend.dev`, which **only delivers to the email address of your Resend account**.
- With no `RESEND_API_KEY` in local dev, links are printed in the `wrangler dev` terminal instead.
- Email failures are logged and never block sign-up; users can press "Resend verification email".

## 4. Sessions

- Sessions last **30 days** and are **rolled forward** (new expiry) at most once a day while the user
  keeps using the app — an active user effectively stays signed in.
- After a password reset, all other sessions are revoked.
- Production cookies are `Secure; SameSite=None; Partitioned` because the web app and API are on
  different sites. If you later serve both from one domain (e.g. `app.example.com` + `api.example.com`),
  sessions also survive strict third-party-cookie blocking.

## 5. Database

No new D1 migrations are needed for these features (backup/import uses existing tables).
