// Imported by scripts directly; app code uses token.ts (server-only).
import { type JWK, SignJWT, importJWK } from "jose";

export const TOKEN_TTL_SECONDS = 5 * 60;

let signingKey: Promise<{ key: CryptoKey; kid: string }> | null = null;

function getSigningKey() {
  signingKey ??= (async () => {
    const raw = process.env.SUPABASE_JWT_SIGNING_KEY;
    if (!raw) throw new Error("SUPABASE_JWT_SIGNING_KEY is not set. Run `pnpm env:local --force`.");
    const jwk = JSON.parse(raw) as JWK;
    if (!jwk.kid) throw new Error("SUPABASE_JWT_SIGNING_KEY has no kid.");
    const key = await importJWK({ ...jwk, key_ops: ["sign"] }, "ES256");
    return { key: key as CryptoKey, kid: jwk.kid };
  })();
  return signingKey;
}

/** Signs arbitrary claims with the real key; exported so scripts can build deliberately malformed tokens. */
export async function signSupabaseToken(
  claims: Record<string, unknown>,
  userId: string,
): Promise<string> {
  const { key, kid } = await getSigningKey();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

/**
 * Short-lived JWT that PostgREST verifies against the key in supabase/signing_keys.json.
 * `sub` must be public."user".id (auth.uid() casts it); `role` must be "authenticated"
 * or PostgREST silently runs the request as anon.
 */
export function mintSupabaseToken(identity: {
  userId: string;
  email: string | null;
}): Promise<string> {
  return signSupabaseToken({ role: "authenticated", email: identity.email }, identity.userId);
}
