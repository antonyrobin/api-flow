import { isDevelopment, type Env } from "../types";

/**
 * Transactional email via the Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Configuration (wrangler secrets / .dev.vars):
 * - RESEND_API_KEY — "re_..." key from https://resend.com/api-keys
 * - EMAIL_FROM     — sender on a verified Resend domain, e.g. "API Flow <noreply@yourdomain.com>"
 *
 * Without RESEND_API_KEY, emails are logged in development and skipped in production.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Resend's shared test sender — only delivers to the account owner's address
const DEFAULT_FROM = "API Flow <onboarding@resend.dev>";

export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (isDevelopment(env)) {
      console.log(`[Email] (not sent — RESEND_API_KEY missing) to=${message.to} subject="${message.subject}"\n${message.text}`);
    } else {
      console.warn(`[Email] RESEND_API_KEY not configured; "${message.subject}" was not sent`);
    }
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Log without the recipient in production; surface a generic error to the caller
    console.error(`[Email] Resend responded ${res.status}: ${detail.slice(0, 500)}`);
    throw new Error("Failed to send email");
  }
}

// ============================================
// Templates
// ============================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({
  heading,
  intro,
  action,
  outro,
}: {
  heading: string;
  intro: string;
  action?: { label: string; url: string };
  outro?: string;
}): string {
  const button = action
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;font-size:14px">${escapeHtml(action.label)}</a>
       </td></tr>
       <tr><td style="font-size:12px;color:#6b7280;padding-bottom:16px;word-break:break-all">
         Or paste this link into your browser:<br><a href="${escapeHtml(action.url)}" style="color:#0d9488">${escapeHtml(action.url)}</a>
       </td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:18px;font-weight:700;color:#0f766e;padding-bottom:20px">API Flow</td></tr>
        <tr><td style="font-size:20px;font-weight:600;color:#111827;padding-bottom:12px">${escapeHtml(heading)}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#374151;padding-bottom:20px">${intro}</td></tr>
        ${button}
        ${outro ? `<tr><td style="font-size:12px;line-height:1.6;color:#6b7280">${outro}</td></tr>` : ""}
      </table>
    </td></tr>
  </table></body></html>`;
}

export function verificationEmail(name: string, url: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Verify your API Flow email address",
    html: layout({
      heading: "Confirm your email",
      intro: `Hi ${escapeHtml(name || "there")}, thanks for signing up for API Flow. Please confirm your email address to activate your account.`,
      action: { label: "Verify email", url },
      outro: "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
    }),
    text: `Hi ${name || "there"},\n\nConfirm your API Flow email address:\n${url}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.`,
  };
}

export function resetPasswordEmail(name: string, url: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Reset your API Flow password",
    html: layout({
      heading: "Reset your password",
      intro: `Hi ${escapeHtml(name || "there")}, we received a request to reset your API Flow password.`,
      action: { label: "Choose a new password", url },
      outro: "This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email — your password won't change.",
    }),
    text: `Hi ${name || "there"},\n\nReset your API Flow password:\n${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  };
}

export function passwordChangedEmail(name: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Your API Flow password was changed",
    html: layout({
      heading: "Password changed",
      intro: `Hi ${escapeHtml(name || "there")}, the password for your API Flow account was just changed. All other sessions were signed out.`,
      outro: "If this wasn't you, reset your password immediately using “Forgot password” on the sign-in page.",
    }),
    text: `Hi ${name || "there"},\n\nThe password for your API Flow account was just changed. If this wasn't you, reset it immediately using "Forgot password" on the sign-in page.`,
  };
}

export function welcomeEmail(name: string, appUrl: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Welcome to API Flow",
    html: layout({
      heading: "Your account is ready",
      intro: `Hi ${escapeHtml(name || "there")}, welcome to API Flow! You can now save requests, import Postman collections, back up your workspace and monitor endpoints around the clock.`,
      action: { label: "Open API Flow", url: appUrl },
    }),
    text: `Hi ${name || "there"},\n\nWelcome to API Flow! Your account is ready: ${appUrl}`,
  };
}

export function existingAccountEmail(name: string, appUrl: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Someone tried to sign up with your email",
    html: layout({
      heading: "You already have an account",
      intro: `Hi ${escapeHtml(name || "there")}, someone tried to create a new API Flow account with this email address. If it was you, just sign in — or reset your password if you forgot it.`,
      action: { label: "Sign in", url: `${appUrl}/login` },
      outro: "If it wasn't you, no action is needed.",
    }),
    text: `Hi ${name || "there"},\n\nSomeone tried to sign up to API Flow with this email. If it was you, sign in at ${appUrl}/login.`,
  };
}
