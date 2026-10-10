// Proves the sponsor model on the LOCAL stack: every org gets the default
// packages, a category held exclusively at an event refuses a second sponsor
// in it (case-insensitively, and on re-activation), and RLS keeps
// sponsorships and packages to org managers.
//
//   pnpm db:sponsor-check     (needs pnpm dev:accounts to have run)
import { createClient } from "@supabase/supabase-js";
import { signInAs } from "./auth-helpers";
import { requireLocal } from "./env";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";

const target = requireLocal();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(target.apiUrl, target.secretKey, options);

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`,
  );
}

async function signIn(email: string) {
  try {
    return (await signInAs(email)).db;
  } catch (e) {
    console.error(
      `Cannot sign in as ${email} (${e instanceof Error ? e.message : e}). Run \`pnpm dev:accounts\`.`,
    );
    process.exit(1);
  }
}

async function main() {
  const admin = await signIn("admin@repone.test");
  const producer = await signIn("producer@repone.test");
  const anon = createClient(target.apiUrl, publishableKey, options);

  const { data: pkgs, error: pkgError } = await service
    .from("sponsor_packages")
    .select("name")
    .eq("organization_id", ORG_ID);
  if (pkgError) {
    expect("sponsor_packages exists", false, pkgError.message);
    process.exit(1);
  }
  expect("seed org has the 6 default packages", (pkgs ?? []).length === 6, pkgs);

  const { data: s1 } = await admin
    .from("sponsors")
    .insert({ organization_id: ORG_ID, business_name: "Check PT 1", category: "CheckCat" })
    .select("id")
    .single();
  const { data: s2 } = await admin
    .from("sponsors")
    .insert({ organization_id: ORG_ID, business_name: "Check PT 2", category: "checkcat" })
    .select("id")
    .single();
  const { data: pkg } = await service
    .from("sponsor_packages")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("name", "Logo Sponsor")
    .single();
  if (!s1 || !s2 || !pkg) {
    expect("setup rows created", false, { s1, s2, pkg });
    process.exit(1);
  }

  const extra: string[] = [];
  try {
    const first = await admin
      .from("event_sponsorships")
      .insert({
        event_id: EVENT_ID,
        sponsor_id: s1.id,
        package_id: pkg.id,
        category_exclusive: true,
      })
      .select("id")
      .single();
    expect("manager adds an exclusive sponsorship", !first.error, first.error);
    const second = await admin
      .from("event_sponsorships")
      .insert({ event_id: EVENT_ID, sponsor_id: s2.id, package_id: pkg.id });
    expect(
      "same category (any case) is refused while exclusive",
      !!second.error?.message.includes("sponsor_category_exclusive"),
      second.error,
    );

    await admin
      .from("event_sponsorships")
      .update({ active: false })
      .eq("id", first.data?.id ?? "");
    const third = await admin
      .from("event_sponsorships")
      .insert({ event_id: EVENT_ID, sponsor_id: s2.id, package_id: pkg.id })
      .select("id")
      .single();
    expect("allowed once the exclusive one is inactive", !third.error, third.error);
    const reactivate = await admin
      .from("event_sponsorships")
      .update({ active: true })
      .eq("id", first.data?.id ?? "");
    expect("re-activating the exclusive one is refused", !!reactivate.error, reactivate.error);

    // Editing a sponsor's category can't land it in a category held exclusively.
    await admin
      .from("event_sponsorships")
      .update({ category_exclusive: true })
      .eq("id", third.data?.id ?? "");
    const { data: s3 } = await admin
      .from("sponsors")
      .insert({ organization_id: ORG_ID, business_name: "Check PT 3", category: "OtherCat" })
      .select("id")
      .single();
    extra.push(s3?.id ?? "");
    await admin
      .from("event_sponsorships")
      .insert({ event_id: EVENT_ID, sponsor_id: s3?.id ?? "", package_id: pkg.id });
    const recategorize = await admin
      .from("sponsors")
      .update({ category: " CHECKCAT " })
      .eq("id", s3?.id ?? "");
    expect(
      "editing a sponsor into an exclusively held category is refused",
      !!recategorize.error?.message.includes("sponsor_category_exclusive"),
      recategorize.error,
    );

    const anonInactive = await anon
      .from("event_sponsorships")
      .select("id")
      .eq("id", first.data?.id ?? "");
    expect(
      "anon can't see an inactive sponsorship",
      (anonInactive.data ?? []).length === 0,
      anonInactive.data,
    );
    const prodRead = await producer
      .from("event_sponsorships")
      .select("id")
      .eq("id", first.data?.id ?? "");
    expect(
      "event producer reads an inactive sponsorship",
      (prodRead.data ?? []).length === 1,
      prodRead,
    );
    const prodInsert = await producer
      .from("event_sponsorships")
      .insert({ event_id: EVENT_ID, sponsor_id: s1.id, package_id: pkg.id });
    expect("producer can't create sponsorships", !!prodInsert.error, prodInsert.error);
    const anonPkg = await anon
      .from("sponsor_packages")
      .insert({ organization_id: ORG_ID, name: "Hack" });
    expect("anon can't create packages", !!anonPkg.error, anonPkg.error);
    const usedPkg = await service.from("sponsor_packages").delete().eq("id", pkg.id);
    expect("a package in use can't be deleted", !!usedPkg.error, usedPkg.error);
  } finally {
    await service
      .from("sponsors")
      .delete()
      .in("id", [s1.id, s2.id, ...extra.filter(Boolean)]);
  }
  if (failures) process.exit(1);
}
void main();
