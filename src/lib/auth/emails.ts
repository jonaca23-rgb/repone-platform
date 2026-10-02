import type { Email } from "@/lib/mailer";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const wrap = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">${body}</div>`;
const button = (url: string, label: string) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#e10600;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${label}</a></p>`;

export function verifyEmail({ to, url }: { to: string; url: string }): Email {
  return {
    to,
    subject: "Confirm your email for RepOne",
    text: `Confirm your email to finish creating your RepOne account:\n\n${url}\n\nThe link works for 24 hours.`,
    html: wrap(
      `<p>Confirm your email to finish creating your RepOne account.</p>${button(url, "Confirm email")}<p>The link works for 24 hours.</p>`,
    ),
  };
}

/**
 * True when a password link lands on /invite (sendPasswordLink chose it for an
 * account with no password yet); BetterAuth carries it as the callbackURL.
 */
export function isInvitationLink(url: string): boolean {
  try {
    const callback = new URL(url).searchParams.get("callbackURL");
    return callback !== null && new URL(callback, url).pathname === "/invite";
  } catch {
    return false;
  }
}

/** Invitation copy only for an /invite link; /forgot-password always reads as a reset. */
export function passwordLinkEmail({
  to,
  url,
  organization,
}: {
  to: string;
  url: string;
  organization: string | null;
}): Email {
  const firstTime = isInvitationLink(url);
  const who = organization ? ` by ${organization}` : "";
  const whoHtml = organization ? ` by ${escapeHtml(organization)}` : "";
  return firstTime
    ? {
        to,
        subject: "You're invited to RepOne",
        text: `You've been invited to RepOne${who}. Set your password to get in:\n\n${url}\n\nOr sign in with Google using this email. The link works for 3 days.`,
        html: wrap(
          `<p>You've been invited to RepOne${whoHtml}.</p>${button(url, "Set my password")}<p>Or sign in with Google using this email. The link works for 3 days.</p>`,
        ),
      }
    : {
        to,
        subject: "Reset your RepOne password",
        text: `Someone asked to reset your RepOne password. If it was you:\n\n${url}\n\nIf not, ignore this email.`,
        html: wrap(
          `<p>Someone asked to reset your RepOne password. If it was you:</p>${button(url, "Choose a new password")}<p>If not, ignore this email.</p>`,
        ),
      };
}

export function roleGrantedEmail({
  to,
  what,
  loginUrl,
}: {
  to: string;
  what: string;
  loginUrl: string;
}): Email {
  return {
    to,
    subject: `You now have access: ${what}`,
    text: `You were given access in RepOne: ${what}.\n\nSign in: ${loginUrl}`,
    html: wrap(
      `<p>You were given access in RepOne: <strong>${escapeHtml(what)}</strong>.</p>${button(loginUrl, "Sign in")}`,
    ),
  };
}

/** Someone signed up with an address that already has a working account. */
export function existingAccountEmail({
  to,
  loginUrl,
  forgotUrl,
}: {
  to: string;
  loginUrl: string;
  forgotUrl: string;
}): Email {
  return {
    to,
    subject: "You already have a RepOne account",
    text: `Someone tried to create a RepOne account with this email, but you already have one.\n\nSign in: ${loginUrl}\nForgot your password? ${forgotUrl}\n\nIf it wasn't you, ignore this email.`,
    html: wrap(
      `<p>Someone tried to create a RepOne account with this email, but you already have one.</p>${button(loginUrl, "Sign in")}<p>Forgot your password? <a href="${escapeHtml(forgotUrl)}">Reset it</a>.</p><p>If it wasn't you, ignore this email.</p>`,
    ),
  };
}
