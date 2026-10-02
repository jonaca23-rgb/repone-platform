// Makes supabase/signing_keys.json (gitignored) once; --print writes the key as one line for .env.local.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";

const PATH = "supabase/signing_keys.json";

async function main() {
  if (!existsSync(PATH)) {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(privateKey);
    const key = {
      ...jwk,
      alg: "ES256",
      use: "sig",
      kid: randomUUID(),
      ext: true,
      key_ops: ["sign", "verify"],
    };
    writeFileSync(PATH, `${JSON.stringify([key], null, 2)}\n`);
    console.error(`Created ${PATH} (local only, never committed).`);
  }
  if (process.argv.includes("--print")) {
    process.stdout.write(JSON.stringify(JSON.parse(readFileSync(PATH, "utf8"))[0]));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
