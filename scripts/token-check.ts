// Proves local PostgREST accepts tokens minted by src/lib/supabase/sign-token.ts
// and rejects everything else.
//
//   pnpm db:token-check     (needs the stack running and `pnpm env:local --force`)
import { createClient } from "@supabase/supabase-js";
import { SignJWT, generateKeyPair } from "jose";
import { mintSupabaseToken, signSupabaseToken } from "../src/lib/supabase/sign-token";
import { requireLocal } from "./env";

const target = requireLocal();
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
if (!publishable) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — run `pnpm env:local --force`.");
  process.exit(1);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

const withToken = (token?: string) =>
  createClient(target.apiUrl, publishable, {
    ...options,
    ...(token ? { accessToken: async () => token } : {}),
  });
const probe = (db: ReturnType<typeof withToken>) =>
  db.rpc("athlete_private_details", { p_athlete_ids: [] });

async function main() {
  // public."user" does not exist yet, so the subject is a random uuid: an
  // unknown user simply gets an empty list, which is enough to prove the
  // token was accepted as `authenticated`.
  const good = await mintSupabaseToken({ userId: crypto.randomUUID(), email: "x@example.test" });
  const accepted = await probe(withToken(good));
  expect("minted token is accepted as authenticated", !accepted.error, accepted.error);

  const anon = await probe(withToken());
  expect(
    "publishable key alone (anon) is denied",
    !!anon.error && /permission denied/i.test(anon.error.message),
    anon.error,
  );

  // Real kid, wrong private key: exercises signature failure, not unknown-kid.
  const realKid = (JSON.parse(process.env.SUPABASE_JWT_SIGNING_KEY ?? "{}") as { kid?: string })
    .kid;
  const { privateKey } = await generateKeyPair("ES256");
  const forged = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: realKid })
    .setSubject(crypto.randomUUID())
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const rejected = await probe(withToken(forged));
  expect("token signed by another key is rejected", !!rejected.error && rejected.status === 401, {
    status: rejected.status,
    error: rejected.error,
  });

  // Real key and kid but no `role` claim: PostgREST must not treat it as authenticated.
  const noRole = await signSupabaseToken({ email: "x@example.test" }, crypto.randomUUID());
  const roleless = await probe(withToken(noRole));
  expect(
    "token without a role claim is denied like anon",
    !!roleless.error && /permission denied/i.test(roleless.error.message),
    roleless.error,
  );

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll token checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
