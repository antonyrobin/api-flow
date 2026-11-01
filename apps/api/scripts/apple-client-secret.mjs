#!/usr/bin/env node
/**
 * Generate the APPLE_CLIENT_SECRET (an ES256-signed JWT, valid up to 6 months).
 *
 * Usage:
 *   node scripts/apple-client-secret.mjs --team TEAMID --key KEYID --client com.example.apiflow.web --p8 ./AuthKey_KEYID.p8
 *
 * Re-run and update the secret before it expires (the script prints the expiry date).
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => (i % 2 === 0 ? [...pairs, [value.replace(/^--/, ""), all[i + 1]]] : pairs), [])
);
for (const required of ["team", "key", "client", "p8"]) {
  if (!args[required]) {
    console.error(`Missing --${required}. See the usage comment at the top of this file.`);
    process.exit(1);
  }
}

const b64url = (input) => Buffer.from(input).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 60 * 60; // Apple's maximum is 6 months

const header = { alg: "ES256", kid: args.key, typ: "JWT" };
const payload = { iss: args.team, iat: now, exp, aud: "https://appleid.apple.com", sub: args.client };
const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

const key = createPrivateKey(readFileSync(args.p8, "utf8"));
const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });

console.log(`${unsigned}.${b64url(signature)}`);
console.error(`\nExpires ${new Date(exp * 1000).toISOString().slice(0, 10)} — regenerate before then.`);
