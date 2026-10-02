// Proves invitations (src/lib/auth/invite.ts) on the LOCAL stack: a new email
// becomes a verified, passwordless account holding the role, with the
// invitation in Mailpit; the same email in another case finds that account;
// an existing account is only granted access; an event director cannot grant
// org roles; the last owner stays; and with the mail server down the account
// and role still exist for Resend. BetterAuth's own invite-member route is
// closed (organizationHooks.beforeCreateInvitation).
//
//   pnpm db:invite-check     (needs pnpm dev:accounts; the HTTP check needs pnpm dev)
import { signInAs } from "./auth-helpers";
import { clearMailbox, latestEmailTo } from "./mailpit";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/db/database.types";
import { requireLocal } from "./env";
import { auth } from "../src/lib/auth/auth";
import { inviteToEvent, inviteToOrg, normalizeEmail } from "../src/lib/auth/invite";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const APP = "http://localhost:3200";

const target = requireLocal();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(target.apiUrl, target.secretKey, options);

let failures = 0;
function expect(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}${pass || detail === undefined ? "" : `  -> ${JSON.stringify(detail, errorFields)}`}`,
  );
}
function errorFields(_key: string, value: unknown) {
  return value instanceof Error ? { name: value.name, message: value.message } : value;
}

async function main() {
  const admin = await signInAs("admin@repone.test");
  await clearMailbox();

  const createdUsers: string[] = [];
  let directorId: string | null = null;
  let assignedId: string | null = null;
  const routeEmail = `route+${Date.now()}@example.test`;

  try {
    // New email → verified, passwordless account + member role + invitation email.
    const fresh = `invite+${Date.now()}@example.test`;
    const r1 = await inviteToOrg({ email: fresh, role: "event_director", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers });
    createdUsers.push(r1.userId);
    expect("new email creates an account", r1.created && r1.emailSent, r1);
    const { data: u } = await service.from("user").select("email_verified").eq("id", r1.userId).single();
    expect("invited account is verified", u?.email_verified === true, u);
    const { data: creds } = await service.from("account").select("id").eq("user_id", r1.userId).eq("provider_id", "credential");
    expect("invited account has no password yet", (creds ?? []).length === 0, creds);
    const { data: m } = await service.from("member").select("role").eq("user_id", r1.userId).single();
    expect("invited account holds the role", m?.role === "event_director", m);
    const mail = await latestEmailTo(fresh);
    expect("invitation email links to /invite", !!mail?.links.some((l) => l.includes("callbackURL=%2Finvite")), mail);

    // Review Focus 3: different case/spaces → same person, role added, nothing duplicated.
    const r2 = await inviteToOrg({ email: `  ${fresh.toUpperCase()} `, role: "commentator", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers });
    expect("mixed-case invite finds the same account", !r2.created && r2.userId === r1.userId, r2);
    const { data: m2 } = await service.from("member").select("role").eq("user_id", r1.userId).single();
    expect("roles are joined", m2?.role === "event_director,commentator", m2);
    const { count } = await service.from("user").select("id", { count: "exact", head: true }).ilike("email", fresh);
    expect("one account for that email", count === 1, count);
    expect("normalizeEmail", normalizeEmail("  A@B.Co ") === "a@b.co");

    // Existing account → event assignment only, notice email.
    const r3 = await inviteToEvent({ email: "athlete@repone.test", kind: "scorekeeper", eventId: EVENT_ID, eventName: "Seed Event", invitedBy: admin.userId, db: admin.db });
    assignedId = r3.userId;
    expect("existing account is not re-created", !r3.created && r3.emailSent, r3);
    const { data: a } = await service.from("event_scorekeeper_assignments").select("status").eq("scorekeeper_user_id", r3.userId).eq("event_id", EVENT_ID).single();
    expect("existing account is assigned", a?.status === "active", a);
    const notice = await latestEmailTo("athlete@repone.test");
    expect("existing account gets an access notice", !!notice?.subject.includes("You now have access"), notice?.subject);

    // An event director cannot grant org roles (the action's guard; the plugin refuses too).
    const director = await signInAs("commentator@repone.test");
    directorId = director.userId;
    await service.from("member").insert({ organization_id: ORG_ID, user_id: director.userId, role: "event_director" });
    const outsider = `x+${Date.now()}@example.test`;
    const denied = await inviteToOrg({ email: outsider, role: "admin", organizationId: ORG_ID, orgName: "RepOneLive", headers: (await signInAs("commentator@repone.test")).headers }).catch((e: unknown) => e);
    expect("event_director cannot grant admin", denied instanceof Error, denied);
    const { count: outsiderCount } = await service.from("user").select("id", { count: "exact", head: true }).eq("email", outsider);
    expect("…and no account was created for it", outsiderCount === 0, outsiderCount);

    // Owner is transferred, never granted by invitation.
    const ownerGrant = await inviteToOrg({ email: fresh, role: "owner", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers }).catch((e: unknown) => e);
    expect("owner cannot be granted by invitation", ownerGrant instanceof Error, ownerGrant);

    // The last owner cannot be removed.
    const { data: owner } = await service.from("member").select("id").eq("organization_id", ORG_ID).like("role", "%owner%").single();
    const lastOwner = await auth.api.removeMember({ headers: admin.headers, body: { memberIdOrEmail: owner!.id, organizationId: ORG_ID } }).catch((e: unknown) => e);
    expect("the last owner cannot be removed", lastOwner instanceof Error, lastOwner);
    const { data: ownerStill } = await service.from("member").select("id").eq("id", owner!.id).maybeSingle();
    expect("…and is still there", !!ownerStill, ownerStill);

    // Review Focus 5: mail down → clear error, account and role still there.
    const saved = process.env.SMTP_URL;
    process.env.SMTP_URL = "smtp://127.0.0.1:1";
    const down = `down+${Date.now()}@example.test`;
    const r4 = await inviteToOrg({ email: down, role: "commentator", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers }).finally(() => {
      process.env.SMTP_URL = saved;
    });
    createdUsers.push(r4.userId);
    expect("mail down reports emailSent=false", r4.created && !r4.emailSent, r4);
    const { data: m4 } = await service.from("member").select("role").eq("user_id", r4.userId).single();
    expect("…but the account and role exist for Resend", m4?.role === "commentator", m4);

    // BetterAuth's own invitation route is closed: invitations go through the Team page.
    const probe = await fetch(`${APP}/api/supabase-token`, { cache: "no-store" }).catch(() => null);
    if (probe) {
      const res = await fetch(`${APP}/api/auth/organization/invite-member`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP,
          cookie: admin.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ email: routeEmail, role: "commentator", organizationId: ORG_ID }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      expect(
        "POST /api/auth/organization/invite-member is refused for the owner",
        res.status === 403 && body?.message === "Invite people from the Team page.",
        { status: res.status, body },
      );
      const { count: invitations } = await service.from("invitation").select("id", { count: "exact", head: true }).eq("email", routeEmail);
      expect("…and no invitation row was written", invitations === 0, invitations);
    } else {
      console.warn("skip  invite-member route check: the app is not running on :3200");
    }
  } finally {
    if (directorId) await service.from("member").delete().eq("user_id", directorId);
    if (assignedId)
      await service.from("event_scorekeeper_assignments").delete().eq("scorekeeper_user_id", assignedId).eq("event_id", EVENT_ID);
    await service.from("invitation").delete().eq("email", routeEmail);
    if (createdUsers.length) await service.from("user").delete().in("id", createdUsers);
  }

  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
