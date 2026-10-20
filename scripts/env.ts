// Resolves which Supabase project a script is about to touch, from .env.local.
// Every script that writes data (or creates accounts) calls requireLocal() so
// a production URL pasted into .env.local can never be seeded with dev logins.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export interface Target {
  apiUrl: string;
  secretKey: string;
  isLocal: boolean;
}

const isLocalHost = (v: string) =>
  /(^|\/\/|@)(127\.0\.0\.1|localhost|host\.docker\.internal)([:/]|$)/.test(v);

export function resolveTarget(): Target {
  const apiUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
  const missing = [
    !apiUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !secretKey && "SUPABASE_SECRET_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")} in .env.local — run \`pnpm env:local\`.`);
    process.exit(1);
  }
  return { apiUrl, secretKey, isLocal: isLocalHost(apiUrl) };
}

export function requireLocal(): Target {
  const target = resolveTarget();
  if (!target.isLocal) {
    console.error(
      `Refusing to run against ${new URL(target.apiUrl).hostname}: this script is for the local stack only.`,
    );
    process.exit(1);
  }
  return target;
}
