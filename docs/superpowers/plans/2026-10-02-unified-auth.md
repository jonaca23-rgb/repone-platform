# Unified Sign-in, Permissions and Invitations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `/login` and `/signup` for everyone. Roles and permissions live in BetterAuth's organization plugin (`createAccessControl`). After sign-in, `/` sends each person to the modules their permissions open, so an admin sees every module. Staff arrive by email invitation. Password accounts must verify their email, and can reset their password.

**Architecture:** Two PRs.
- **Part 1** moves org roles from RepOne's `user_roles` to the plugin's `member` table. `has_role()` keeps its signature and reads `member`, so the 31 RLS policies are unchanged. App guards keep their names but decide by permission. Nothing visible changes.
- **Part 2** adds:
  - SMTP mail and required verification
  - the `(auth)` route group
  - a pure `resolveHome` plus `userModules` behind `/`
  - `requireModule` guards and an account menu
  - invitations (`createUser` + `addMember` / assignment + `requestPasswordReset`), as in school-schedule

**Tech Stack:**
- better-auth **1.7.6** (`organization`, `admin` plugins, `better-auth/plugins/access`)
- drizzle adapter over `pg`
- Supabase (Postgres, RLS) locally
- Next.js 16.3 App Router
- nodemailer (new)
- vitest

**Spec:** `docs/superpowers/specs/2026-10-02-unified-auth-design.md`. Read it first. This plan argues from it.

**Reference implementation:** `~/Documents/GitHub/school-schedule`. Port from these files, don't reinvent:
- `lib/auth/permissions.ts`
- `lib/auth/auth.ts`: the plugins and the `databaseHooks.session.create.before`
- `lib/auth/delivery.ts`
- `lib/auth/password-link.ts`
- `lib/mailer.ts`
- `components/auth/set-password-form.tsx`
- `app/(auth)/*`
- `actions/people.ts`

## Global Constraints

- **better-auth stays at `1.7.6`.** Where the docs and the installed code disagree, follow `node_modules/better-auth/dist/**`:
  - `admin.createUser` takes an optional password. Called with **no headers**, it skips its permission check.
  - `resetPassword` does not set `emailVerified`.
- **Ids are `uuid` everywhere.** `advanced.database.generateId: "uuid"` is already set. Every new auth table id and FK is `uuid`.
- **Roles live in code** (`createAccessControl`), never in a table. `member.role` is a comma-joined list of role names.
- **`has_role(uuid, user_role[], uuid)` keeps its exact signature.** No RLS policy that calls it is edited.
- **UI copy is in English,** like the rest of the app. Emails are in English.
- **Env names:** `SMTP_URL` and `EMAIL_FROM`. Locally: `SMTP_URL=smtp://127.0.0.1:54525` and `EMAIL_FROM="RepOne <no-reply@repone.test>"`.
- **Link lifetimes:**
  - Reset and invite links: `resetPasswordTokenExpiresIn: 60 * 60 * 24 * 3` (3 days, one setting for both).
  - Email verification: `expiresIn: 60 * 60 * 24`.
- **Passwords:** minimum 10 characters, as today. The dev password `Repone1234!` keeps working, and every dev account is created with `emailVerified = true`.
- **Branches:**
  - Part 1 is `refactor/org-plugin-permissions`, from `feat/better-auth`.
  - Part 2 is `feat/unified-auth`, rebased onto Part 1. It already holds the spec commits.
  - Both PRs target `staging` and merge after #8.
- **Every commit:**
  - `pnpm check` passes.
  - Stage files by name.
  - The title is a plain sentence saying what is now true, with a body explaining why.
  - End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Migrations:** hand-written in `supabase/migrations/`, verified with `pnpm db:reset && pnpm db:types && pnpm dev:accounts`.

## Review Focus

1. **Someone with two roles in one org** (comma-joined, e.g. `event_director,commentator`). `has_role`, `roleCan` and the start page must all treat it as the union. *Tests:* Task 1 (`roleCan` union) and Task 3 (`db:authz-check` with a two-role member).
2. **An owner where a policy asks for `admin`.** Every admin-only policy must still let the owner through, or the first admin loses `/admin` after this change. *Test:* Task 3 (owner passes `has_role(..., '{admin}')`, checked through an admin-only table write).
3. **An invited email typed with different case or spaces** (` Ana@Box.com `) for a person who already has `ana@box.com`. It must match the existing account, not create a second one or fail on the unique email. *Test:* Task 7 (`db:invite-check`, mixed-case invite).
4. **A password sign-in for an unverified account.** It must show "verify your email", resend the email, and never say "wrong password" (that would make people reset in a loop). *Test:* Task 4 (`db:auth-check`, sign-in returns `EMAIL_NOT_VERIFIED`) and Task 6 (the form maps that code).
5. **The mail server is down when an admin invites.** The admin must see "the invitation email was not sent". The account and role must still exist, so "Resend" can fix it later, and nothing may be half-created silently. *Test:* Task 7 (`db:invite-check` with `SMTP_URL` pointed at a closed port).

---

## File Structure

| File | Responsibility |
|---|---|
| **Part 1** | |
| `src/lib/auth/permissions.ts` (new) + `.test.ts` | `statement`, `ac`, `roles`, `OrgRole`, `isOrgRole`, `roleCan`, `EVENT_STAFF_ROLE` |
| `supabase/migrations/0029_organization_plugin.sql` (new) | Plugin columns and tables; `has_role` and the direct readers move to `member`; `bootstrap_organization`; drops `user_roles` and `profiles.organization_id` |
| `src/db/schema/auth.ts` (modify) | Drizzle mirror: `organizations`, `member`, `invitation`, the admin and organization columns |
| `src/lib/auth/auth.ts` (modify) | `organization({ ac, roles })`, `admin()`, the session hook that sets `activeOrganizationId` |
| `src/lib/auth/authorize.ts` (modify) | `SessionContext` from `member`; `orgCan`; `orgManagerOf` by permission; `hasAnyRole` removed |
| `src/lib/auth/session.ts`, `eventRoles.ts`, `guards.ts`, `src/lib/actions/eventStaff.ts`, `src/lib/auth/eventStaffCandidates.ts`, `src/lib/db/messages.ts`, `src/lib/constants/roles.ts`, `src/app/(app)/admin/layout.tsx` (modify) | Callers move to permissions and `member` |
| `scripts/dev-accounts.ts`, `scripts/authz-check.ts`, `scripts/auth-check.ts`, `scripts/rls-check.ts` (modify) | Role setup and assertions on `member` |
| **Part 2** | |
| `src/lib/mailer.ts`, `src/lib/auth/delivery.ts`, `src/lib/auth/emails.ts`, `src/lib/auth/passwordLink.ts` (new) | SMTP, delivery report, message bodies, invite/reset link |
| `scripts/mailpit.ts` (new) | Read the latest email for an address from Mailpit's API, for checks |
| `src/lib/auth/modules.ts` + `.test.ts` (new) | `Module`, `modulesFor` (pure), `resolveHome` (pure) |
| `src/lib/auth/userModules.ts` (new) | `userModules(ctx)` (server, cached) and `requireModule(kind)` |
| `src/components/AccountMenu.tsx` (new) | Header menu: Home, modules, Sign out |
| `src/app/(app)/page.tsx` (rewrite) | Public landing, or the start page |
| `src/app/(auth)/layout.tsx`, `login`, `signup`, `verify-email`, `forgot-password`, `reset-password`, `invite` (new) | Auth screens |
| `src/components/auth/*` (new) | `AuthCard`, `GoogleButton`, `SetPasswordForm` |
| `src/lib/auth/invite.ts` (new) | `inviteToOrg`, `inviteToEvent`, `resendInvitation` (server) |
| `src/lib/actions/team.ts` (new), `src/app/(app)/admin/team/page.tsx` (new) | Team page |
| `src/lib/actions/eventStaff.ts`, `src/app/(app)/admin/events/[eventId]/staff/page.tsx` (rewrite) | Invite by email |
| `scripts/invite-check.ts` (new) | `pnpm db:invite-check` |

---

# Part 1 — Roles on BetterAuth (`refactor/org-plugin-permissions`)

### Task 1: Roles and permissions in code

**Files:**
- Create: `src/lib/auth/permissions.ts`
- Test: `src/lib/auth/permissions.test.ts`

**Interfaces:**
- Produces:

```ts
export const statement: { organization; member; invitation; team; ac; event; athlete; heat; score; broadcast; commentary; sponsor; finance; staff };
export const ac: ReturnType<typeof createAccessControl<typeof statement>>;
export const roles: { owner; admin; event_director; production_director; scoring_operator; commentator };
export type OrgRole = keyof typeof roles;
export const ORG_ROLES: OrgRole[];
export type Permissions = Parameters<(typeof roles)["owner"]["authorize"]>[0];
export function isOrgRole(role: string): role is OrgRole;
export function splitRoles(field: string | null | undefined): OrgRole[];  // "a, b" → ["a","b"], unknown names dropped
export function roleCan(rolesField: string | readonly string[] | null | undefined, permissions: Permissions): boolean;
export const EVENT_STAFF_ROLE: { scorekeeper: "scoring_operator"; producer: "production_director"; commentator: "commentator" };
```

- [ ] **Step 1: Branch and install nothing.** better-auth already ships the plugins.

```bash
git checkout feat/better-auth && git pull && git checkout -b refactor/org-plugin-permissions
```

- [ ] **Step 2: Write the failing test** `src/lib/auth/permissions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ORG_ROLES, roleCan, splitRoles } from "./permissions";

const APP = {
  event: ["create", "update", "delete"],
  athlete: ["manage"],
  heat: ["manage"],
  score: ["enter"],
  broadcast: ["control"],
  commentary: ["read"],
  sponsor: ["manage"],
  finance: ["manage"],
  staff: ["invite"],
} as const;

describe("roles", () => {
  it("owner and admin hold every app permission and manage members", () => {
    for (const role of ["owner", "admin"]) {
      for (const [resource, actions] of Object.entries(APP)) {
        expect(roleCan(role, { [resource]: [...actions] }), `${role} ${resource}`).toBe(true);
      }
      expect(roleCan(role, { member: ["create", "update", "delete"] })).toBe(true);
      expect(roleCan(role, { invitation: ["create"] })).toBe(true);
    }
  });

  it("only the owner may delete the organization", () => {
    expect(roleCan("owner", { organization: ["delete"] })).toBe(true);
    expect(roleCan("admin", { organization: ["delete"] })).toBe(false);
  });

  it("event_director runs events but cannot grant org roles", () => {
    for (const [resource, actions] of Object.entries(APP)) {
      expect(roleCan("event_director", { [resource]: [...actions] }), resource).toBe(true);
    }
    expect(roleCan("event_director", { member: ["create"] })).toBe(false);
    expect(roleCan("event_director", { invitation: ["create"] })).toBe(false);
  });

  it("the working roles get only their job", () => {
    expect(roleCan("scoring_operator", { score: ["enter"] })).toBe(true);
    expect(roleCan("scoring_operator", { broadcast: ["control"] })).toBe(false);
    expect(roleCan("production_director", { broadcast: ["control"] })).toBe(true);
    expect(roleCan("production_director", { score: ["enter"] })).toBe(false);
    expect(roleCan("commentator", { commentary: ["read"] })).toBe(true);
    expect(roleCan("commentator", { heat: ["manage"] })).toBe(false);
    for (const role of ["production_director", "scoring_operator", "commentator"]) {
      expect(roleCan(role, { event: ["update"] }), role).toBe(false);
    }
  });

  it("comma-joined roles grant the union", () => {
    expect(roleCan("scoring_operator,commentator", { commentary: ["read"] })).toBe(true);
    expect(roleCan("scoring_operator, commentator", { score: ["enter"] })).toBe(true);
    expect(roleCan(["commentator", "scoring_operator"], { score: ["enter"] })).toBe(true);
  });

  it("unknown or empty roles grant nothing", () => {
    expect(roleCan("member", { commentary: ["read"] })).toBe(false);
    expect(roleCan("", { commentary: ["read"] })).toBe(false);
    expect(roleCan(null, { commentary: ["read"] })).toBe(false);
    expect(splitRoles("owner,nope, admin")).toEqual(["owner", "admin"]);
  });

  it("lists the six roles", () => {
    expect(ORG_ROLES).toEqual([
      "owner", "admin", "event_director", "production_director", "scoring_operator", "commentator",
    ]);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/lib/auth/permissions.test.ts`
Expected: FAIL, because `./permissions` cannot be resolved.

- [ ] **Step 4: Implement** `src/lib/auth/permissions.ts`

```ts
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Who may do what in the organization. Defined in code, as in school-schedule,
 * so a permission change is a reviewable diff. These govern the application;
 * RLS remains the security boundary, and has_role() reads the same member row
 * these roles are stored in (0029_organization_plugin.sql).
 */
export const statement = {
  ...defaultStatements,
  /** Events, venues, floors, divisions, WODs. */
  event: ["create", "update", "delete"],
  /** Roster, registrations, teams, lifts. */
  athlete: ["manage"],
  /** Heats and lanes. */
  heat: ["manage"],
  /** Results and standings. */
  score: ["enter"],
  /** broadcast_state: current heat, graphics, timer. */
  broadcast: ["control"],
  /** Commentator screens and notes. */
  commentary: ["read"],
  sponsor: ["manage"],
  /** Fees, payments, expenses. */
  finance: ["manage"],
  /** Per-event staff assignments. */
  staff: ["invite"],
} as const;

export const ac = createAccessControl(statement);

const runsEvents = {
  event: ["create", "update", "delete"],
  athlete: ["manage"],
  heat: ["manage"],
  score: ["enter"],
  broadcast: ["control"],
  commentary: ["read"],
  sponsor: ["manage"],
  finance: ["manage"],
  staff: ["invite"],
} as const;

/** Answers for the organization. One per organization (member_one_owner_idx). */
const owner = ac.newRole({ ...ownerAc.statements, ...runsEvents });
/** Everything the owner can do except delete the organization. */
const admin = ac.newRole({ ...adminAc.statements, ...runsEvents });
/** Runs events and their staff; cannot add or change org members. */
const event_director = ac.newRole({ ...memberAc.statements, ...runsEvents });
const production_director = ac.newRole({
  ...memberAc.statements,
  heat: ["manage"],
  broadcast: ["control"],
  commentary: ["read"],
});
const scoring_operator = ac.newRole({ ...memberAc.statements, heat: ["manage"], score: ["enter"] });
const commentator = ac.newRole({ ...memberAc.statements, commentary: ["read"] });

export const roles = {
  owner,
  admin,
  event_director,
  production_director,
  scoring_operator,
  commentator,
};

export type OrgRole = keyof typeof roles;
export const ORG_ROLES = Object.keys(roles) as OrgRole[];
export type Permissions = Parameters<(typeof roles)["owner"]["authorize"]>[0];

export function isOrgRole(role: string): role is OrgRole {
  return Object.hasOwn(roles, role);
}

/** member.role is comma-joined (BetterAuth stores several roles that way). */
export function splitRoles(field: string | null | undefined): OrgRole[] {
  return (field ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(isOrgRole);
}

/** True if any of the roles authorizes every listed action, as BetterAuth's hasPermission decides. */
export function roleCan(
  rolesField: string | readonly string[] | null | undefined,
  permissions: Permissions,
): boolean {
  const list = typeof rolesField === "string" || rolesField == null
    ? splitRoles(rolesField)
    : rolesField.flatMap((r) => splitRoles(r));
  return list.some((r) => roles[r].authorize(permissions).success);
}

/** The role an event assignment grants for that one event. */
export const EVENT_STAFF_ROLE = {
  scorekeeper: "scoring_operator",
  producer: "production_director",
  commentator: "commentator",
} as const satisfies Record<"scorekeeper" | "producer" | "commentator", OrgRole>;
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/auth/permissions.test.ts`
Expected: PASS. If `authorize` rejects a resource the role lacks under the default connector, it already returns `success: false`, so no change is needed. If TypeScript rejects `{ [resource]: [...actions] }` in the test, cast it with `as never` *in the test only*.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/permissions.test.ts
git commit -m "Roles and permissions are defined once with BetterAuth access control

RepOne decided access with hand-written role lists in several places. The
six org roles now come from createAccessControl, as in school-schedule:
owner and admin hold every permission, event_director runs events but
cannot grant org roles, and the working roles hold only their job.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Migration and BetterAuth plugins

**Files:**
- Create: `supabase/migrations/0029_organization_plugin.sql`
- Modify: `src/db/schema/auth.ts`, `src/lib/auth/auth.ts`, `supabase/seed.sql:4-5`, `scripts/dev-accounts.ts`

**Interfaces:**
- Consumes: `ac`, `roles` (Task 1).
- Produces:
  - Tables `member(id, organization_id, user_id, role, created_at)` and `invitation`.
  - Columns `organizations.slug|logo|metadata`, `"user".role|banned|ban_reason|ban_expires` and `session.active_organization_id|impersonated_by`.
  - Drizzle exports `organizations`, `member`, `invitation`.
  - `auth.api.addMember`, `auth.api.createUser`, `auth.api.updateMemberRole`, `auth.api.removeMember`.

This task and Task 3 land as **one commit** at the end of Task 3, because the app does not typecheck in between.

- [ ] **Step 1: Write the migration** `supabase/migrations/0029_organization_plugin.sql`

```sql
-- ---------------------------------------------------------------------------
-- 0029 — Org roles move to BetterAuth's organization plugin.
--
-- organizations becomes the plugin's `organization` model and `member` holds
-- each person's roles (comma-joined), defined in code with createAccessControl
-- (src/lib/auth/permissions.ts). has_role() keeps its signature and reads
-- member, so no policy that calls it changes. user_roles and
-- profiles.organization_id go away: membership is the member row.
-- Tables and columns mirror src/db/schema/auth.ts.
-- ---------------------------------------------------------------------------

-- The plugin's organization columns.
alter table organizations add column slug text, add column logo text, add column metadata text;
update organizations
  set slug = coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'org')
             || '-' || left(id::text, 8);
alter table organizations alter column slug set not null;
alter table organizations add constraint organizations_slug_key unique (slug);

-- The admin plugin's user columns, and the plugins' session columns.
alter table public."user"
  add column role text,
  add column banned boolean default false,
  add column ban_reason text,
  add column ban_expires timestamptz;
alter table public.session
  add column active_organization_id uuid references organizations(id) on delete set null,
  add column impersonated_by uuid references public."user"(id) on delete set null;

create table public.member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references public."user"(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
create unique index member_organization_user_idx on public.member (organization_id, user_id);
-- One owner per organization; ownership changes hands, it is never shared.
create unique index member_one_owner_idx on public.member (organization_id)
  where role ~ '(^|,)\s*owner\s*(,|$)';
create index member_user_id_idx on public.member (user_id);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  inviter_id uuid not null references public."user"(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index invitation_email_idx on public.invitation (email);

-- invitation: like the other auth tables, closed to the API.
alter table public.invitation enable row level security;
revoke all on public.invitation from anon, authenticated;

-- member: readable as user_roles was, never writable through the API
-- (BetterAuth writes it over the owner connection).
alter table public.member enable row level security;
revoke all on public.member from anon, authenticated;
grant select on public.member to authenticated;

-- ---------------------------------------------------------------------------
-- has_role reads member. Same signature, so every policy keeps working.
-- An owner counts wherever admin is asked for; p_event_id is ignored because
-- org roles are org-wide (event scope lives in the assignment tables).
-- ---------------------------------------------------------------------------
create or replace function has_role(
  p_organization_id uuid,
  p_roles user_role[],
  p_event_id uuid default null
) returns boolean as $$
  select exists (
    select 1 from public.member m
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and string_to_array(replace(m.role, ' ', ''), ',')
          && (p_roles::text[] || case when 'admin' = any(p_roles::text[]) then array['owner'] else array[]::text[] end)
  );
$$ language sql stable security definer set search_path = public;

create policy "read own membership" on public.member for select using (user_id = auth.uid());
create policy "members read org members" on public.member for select
  using (has_role(organization_id, enum_range(null::user_role)));
create policy "athletes read org members" on public.member for select
  using (exists (select 1 from athletes a
                 where a.auth_user_id = auth.uid() and a.organization_id = member.organization_id));

-- The direct readers of user_roles move to member.
create or replace function can_message(p_sender uuid, p_recipient uuid) returns boolean as $$
  select p_sender <> p_recipient and (
    exists (
      select 1 from athletes s join athletes r on r.organization_id = s.organization_id
      where s.auth_user_id = p_sender and r.auth_user_id = p_recipient
    )
    or exists (
      select 1 from athletes s join public.member m on m.organization_id = s.organization_id
      where s.auth_user_id = p_sender and m.user_id = p_recipient
    )
    or exists (
      select 1 from athletes r join public.member m on m.organization_id = r.organization_id
      where r.auth_user_id = p_recipient and m.user_id = p_sender
    )
  );
$$ language sql stable security definer set search_path = public;

create or replace function can_like(p_liker uuid, p_athlete_id uuid) returns boolean as $$
  select exists (
    select 1 from athletes target
    where target.id = p_athlete_id
      and (
        exists (select 1 from athletes s where s.auth_user_id = p_liker and s.organization_id = target.organization_id)
        or exists (select 1 from public.member m where m.user_id = p_liker and m.organization_id = target.organization_id)
      )
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "athlete read org staff profiles" on profiles;
create policy "athlete read org staff profiles" on profiles for select
  using (exists (
    select 1 from athletes a join public.member m on m.organization_id = a.organization_id
    where a.auth_user_id = auth.uid() and m.user_id = profiles.id
  ));
-- Org members see each other's names (the Team page, staff lists).
create policy "members read org member profiles" on profiles for select
  using (exists (
    select 1 from public.member m
    where m.user_id = profiles.id and has_role(m.organization_id, enum_range(null::user_role))
  ));

-- Event directors manage event staff too (permission staff:invite).
do $$ declare t text; begin
  foreach t in array array['scorekeeper', 'producer', 'commentator'] loop
    execute format('drop policy if exists "admins manage %s assignments" on event_%s_assignments', t, t);
    execute format($p$create policy "managers manage %1$s assignments" on event_%1$s_assignments for all
      using (exists (select 1 from events e where e.id = event_%1$s_assignments.event_id
        and has_role(e.organization_id, array['admin','event_director']::user_role[])))
      with check (exists (select 1 from events e where e.id = event_%1$s_assignments.event_id
        and has_role(e.organization_id, array['admin','event_director']::user_role[])))$p$, t);
  end loop;
end $$;

-- First-run setup creates the org and makes the caller its owner.
create or replace function bootstrap_organization(p_name text) returns uuid as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  lock table organizations in exclusive mode;
  if exists (select 1 from organizations) then
    raise exception 'An organization already exists; ask its admin for access';
  end if;
  insert into organizations (name, slug)
    values (p_name, coalesce(nullif(trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')), ''), 'org'))
    returning id into v_org_id;
  insert into public.member (organization_id, user_id, role) values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Gone: membership is the member row.
drop table user_roles;
alter table profiles drop column organization_id;
```

Before running it, grep the migrations for every remaining `user_roles` and `profiles.organization_id` reference: `grep -n "user_roles\|organization_id" supabase/migrations/00{01..28}*.sql | grep -i "user_roles\|profiles"`. Every live function or policy in that list must appear above. If one is missing (beyond the agent-mapped set: `has_role`, `can_message`, `can_like`, the two 0016 policies, the `user_roles` policies and `bootstrap_organization`), add its rewrite here.

- [ ] **Step 2: Seed slug.** In `supabase/seed.sql:4-5`, change the org insert to `insert into organizations (id, name, slug) values ('00000000-0000-0000-0000-000000000001', 'RepOneLive', 'repone-live');`.

- [ ] **Step 3: Drizzle mirror.** In `src/db/schema/auth.ts`:
  - Replace the header comment's last paragraph with: "Organizations and their members are BetterAuth's organization plugin (0029); per-event staff stay in RepOne's assignment tables."
  - Add to `user`, after `image`: `role: text(), banned: boolean().default(false), banReason: text(), banExpires: timestamp({ withTimezone: true }),`
  - Add to `session`, after `userId`: `activeOrganizationId: uuid(), impersonatedBy: uuid(),`
  - Then append:

```ts
/** BetterAuth's organization model, on RepOne's existing table (0001, 0029). */
export const organizations = pgTable("organizations", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** A person's roles in an organization, comma-joined (src/lib/auth/permissions.ts). */
export const member = pgTable(
  "member",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull().default("member"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("member_user_id_idx").on(t.userId)],
);

/** Required by the plugin; RepOne invites through createUser + a password link instead. */
export const invitation = pgTable(
  "invitation",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text(),
    status: text().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    inviterId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitation_email_idx").on(t.email)],
);
```

  The unique indexes live in the migration. Drizzle is only the adapter's map, as the existing comment says.

- [ ] **Step 4: Plugins.** In `src/lib/auth/auth.ts`:
  - Add the imports: `import { admin as adminPlugin, organization } from "better-auth/plugins";`, `import { asc, eq } from "drizzle-orm";`, `import { ac, roles } from "@/lib/auth/permissions";`.
  - In the adapter schema, add `organization: schema.organizations, member: schema.member, invitation: schema.invitation`.
  - Add `databaseHooks` and the plugins (keep `nextCookies()` last):

```ts
  databaseHooks: {
    session: {
      create: {
        // Every session opens in the person's organization (their first
        // membership), as the plugin's docs recommend; event-only staff and
        // athletes have none and open with null.
        before: async (session) => {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      schema: { organization: { modelName: "organizations" } },
      // One organization, created by first-run setup (bootstrap_organization).
      allowUserToCreateOrganization: false,
    }),
    // createUser for invitations (called server-side with no headers).
    adminPlugin(),
    nextCookies(), // must stay last: it sets cookies from the other plugins' responses
  ],
```

  If `modelName: "organizations"` conflicts with passing `organization: schema.organizations` in the adapter schema, keep only one mapping. The adapter key is the model name, so with `modelName: "organizations"` the adapter key becomes `organizations`. Run `pnpm typecheck` and a sign-in to see which one the installed adapter resolves, then keep that.

- [ ] **Step 5: Dev accounts.** In `scripts/dev-accounts.ts`:
  - Import `{ auth }` from `@/lib/auth/auth`, `{ db as pg }` from `@/db`, `{ member }` from `@/db/schema`, and `{ and, eq }` from `drizzle-orm`.
  - Change the staff block to keep only the `full_name` update (drop `organization_id` from it).
  - Replace the admin `user_roles` block with:

```ts
    if (account.kind === "admin") {
      adminId = user.id;
      const [existing] = await pg
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, user.id), eq(member.organizationId, ORG_ID)));
      if (!existing) {
        await auth.api.addMember({ body: { userId: user.id, role: "owner", organizationId: ORG_ID } });
      }
      continue;
    }
```

  - Update the admin row's note to `"/admin — org owner, every module"`.

- [ ] **Step 6: Reset and regenerate**

Run: `pnpm db:reset && pnpm db:types && pnpm dev:accounts`
Expected: the migration applies and the accounts print. `pnpm typecheck` fails in the files Task 3 fixes (`user_roles`, `organization_id`, `hasAnyRole`). That is expected.

### Task 3: App and checks decide by permission

**Files:**
- Modify:
  - `src/lib/auth/authorize.ts`, `session.ts`, `eventRoles.ts`, `guards.ts:31-39`, `eventStaffCandidates.ts:22-60`
  - `src/lib/actions/eventStaff.ts:16-21`
  - `src/lib/db/messages.ts:180-200,262-275`
  - `src/lib/constants/roles.ts`
  - `src/app/(app)/admin/layout.tsx:20-23`
  - `scripts/authz-check.ts`, `scripts/auth-check.ts:113`, `scripts/rls-check.ts:142-156`

**Interfaces:**
- Consumes: `roleCan`, `splitRoles`, `OrgRole`, `Permissions` (Task 1); the `member` table (Task 2).
- Produces:
  - `SessionContext { userId; email; organizationId: string | null; roles: OrgRole[] }`
  - `orgCan(ctx, permissions: Permissions): boolean`
  - `orgManagerOf(ctx): string | null`, where the manager permission is `event:update`
  - `hasAnyRole` is removed; callers use `orgCan`
  - `ROLE_LABELS: Record<OrgRole, string>`

- [ ] **Step 1: Write the failing authz assertions.** In `scripts/authz-check.ts`:
  - Replace `roles.includes('admin')` (line ~78) with `admin.ctx.roles.includes("owner")`.
  - Add this section before the cleanup:

```ts
  console.log("\nPermissions on member (0029)");
  {
    // Review Focus 2: an owner passes admin-only policies.
    const { error } = await admin.db.from("circuits").insert({ organization_id: ORG_ID, name: "authz-owner-check" });
    expect("owner passes an admin-only write (has_role admin includes owner)", !error, error);
    await service.from("circuits").delete().eq("name", "authz-owner-check");

    // Review Focus 1: comma-joined roles are a union, in SQL and in the app.
    const { userId } = await signInAs("commentator@repone.test");
    await service.from("member").insert({ organization_id: ORG_ID, user_id: userId, role: "event_director,commentator" });
    const twoRoles = await signInAs("commentator@repone.test");
    const twoCtx = await loadSessionContext(twoRoles.db, { userId: twoRoles.userId, email: twoRoles.email });
    expect("two-role member manages the org (app)", orgManagerOf(twoCtx) === ORG_ID, twoCtx);
    const { error: e2 } = await twoRoles.db.from("circuits").insert({ organization_id: ORG_ID, name: "authz-two-roles" });
    expect("two-role member passes event_director policies (SQL)", !e2, e2);
    await service.from("circuits").delete().eq("name", "authz-two-roles");
    await service.from("member").delete().eq("user_id", userId);

    const { data: others } = await twoRoles.db.from("member").select("user_id");
    expect("a member reads the org's members", (others ?? []).length >= 1, others);
  }
```

  Use whatever names the script already has for the service client, `signInAs`, `ORG_ID` and `expect`. Read the top of `authz-check.ts` and match them. Check the `circuits` insert columns against `supabase/migrations/0008_circuits.sql`. If `name` alone isn't enough, add the other required columns.

  Then replace the `user_roles` assertions (lines ~185-205) with the same assertions on `member` (own row readable signed in; anon reads nothing).

- [ ] **Step 2: Run it and confirm it fails.** Run: `pnpm db:authz-check`. Expected: it doesn't compile or fails, because `loadSessionContext` still reads `user_roles`.

- [ ] **Step 3: `authorize.ts`.**
  - Change the imports to `import type { Database } from "@/lib/db/database.types";` and `import { type OrgRole, type Permissions, roleCan, splitRoles } from "@/lib/auth/permissions";`.
  - Set `roles: OrgRole[]` in `SessionContext`.
  - Delete `ORG_MANAGER_ROLES` and `hasAnyRole`.
  - Replace `loadSessionContext`'s body and `orgManagerOf`:

```ts
  const { data: memberships } = await db
    .from("member")
    .select("organization_id, role, created_at")
    .eq("user_id", identity.userId)
    .order("created_at", { ascending: true });
  // RepOne runs one organization; the first membership is it.
  const first = memberships?.[0];

  return {
    userId: identity.userId,
    email: identity.email,
    organizationId: first?.organization_id ?? null,
    roles: splitRoles(first?.role),
  };
}

/** Does this person's org role grant `permissions`? (Event assignments are checked by eventAccess.) */
export function orgCan(ctx: SessionContext | null, permissions: Permissions): boolean {
  return !!ctx?.organizationId && roleCan(ctx.roles, permissions);
}

/** The organization this person manages (event:update), or null. */
export function orgManagerOf(ctx: SessionContext | null): string | null {
  return orgCan(ctx, { event: ["update"] }) ? ctx!.organizationId : null;
}
```

  Also update the file's comment on `SessionContext` to say roles come from `member`.

- [ ] **Step 4: Callers.**
  - `session.ts`: export `orgCan` instead of `hasAnyRole` (`export { orgCan, type SessionContext } from "@/lib/auth/authorize";`). Delete the `getAthleteSessionContext` doc sentence about `profiles.organization_id` / `user_roles`, and say instead that "an athlete is not an org member".
  - `eventRoles.ts:77`: change `hasAnyRole(ctx, ["admin"])` to `orgCan(ctx, { event: ["update"] })`.
  - `eventRoles.ts:97`: delete `ADMIN_AREA_ROLES`.
  - `eventRoles.ts:111-113`: change the checks to `orgCan(ctx, { score: ["enter"] })` → scorekeeper, `orgCan(ctx, { broadcast: ["control"] })` → producer, and `orgCan(ctx, { commentary: ["read"] })` → commentator. `staffLandingPath` itself stays until Part 2.
  - `admin/layout.tsx:22`: change to `if (!orgCan(ctx, { event: ["update"] })) redirect(await staffLandingPath(ctx));`.
  - `eventStaff.ts:16-21`: change to

```ts
async function requireEventAdmin(eventId: string) {
  const access = await requireEventAccess(eventId);
  if (!orgCan(access.ctx, { staff: ["invite"] }))
    throw new NotAuthorizedError("Only an admin or event director can manage event staff.");
  return access;
}
```

  - `eventStaffCandidates.ts`: the staff half of `getEventStaffCandidates` reads `member` (`select user_id`, filtered by `organization_id`) instead of `profiles.organization_id`, then takes names from `profiles` by id. The athlete half is unchanged.
  - `messages.ts`: both `user_roles` reads become `member` reads (`.from("member").select("user_id, role")`). Each row's `role` goes through `splitRoles` into the `rolesByUser` lists.
  - `constants/roles.ts`: `Record<OrgRole, string>` with `owner: "Owner"` added. Import `OrgRole` from `@/lib/auth/permissions`.

- [ ] **Step 5: Other scripts.**
  - `auth-check.ts:113` reads the admin's `member` row and asserts its role includes `owner`.
  - `rls-check.ts:142-156`: the `bootstrap_organization` assertions stay (it still refuses a second org). Any `user_roles` reference becomes `member`. Run `grep -n "user_roles\|organization_id" scripts/*.ts` and fix every hit that means profile membership.

- [ ] **Step 6: Run everything**

Run: `pnpm check && pnpm db:rls-check && pnpm db:authz-check && pnpm db:auth-check && pnpm db:token-check && pnpm db:standings-check && pnpm db:timer-check`
Expected: all pass, including the new section from Step 1.

- [ ] **Step 7: Prove nothing visible changed.** Start the app (`pnpm dev`) and run the `verify-repone` skill's access-control recipe:
  - each dev account lands where it did before
  - `/admin` works for the admin (now owner)
  - the scorekeeper is bounced to `/scorekeeper`

  Screenshots go to `.verify/`.

- [ ] **Step 8: Commit and open the PR**

```bash
git add supabase/migrations/0029_organization_plugin.sql supabase/seed.sql src/db/schema/auth.ts \
  src/lib/auth/auth.ts src/lib/auth/authorize.ts src/lib/auth/session.ts src/lib/auth/eventRoles.ts \
  src/lib/auth/eventStaffCandidates.ts src/lib/actions/eventStaff.ts src/lib/db/messages.ts \
  src/lib/constants/roles.ts src/lib/db/supabase.types.ts "src/app/(app)/admin/layout.tsx" \
  scripts/dev-accounts.ts scripts/authz-check.ts scripts/auth-check.ts scripts/rls-check.ts
git status   # nothing unrelated staged
git commit -m "Org roles live in BetterAuth's member table and guards decide by permission

Roles were a custom user_roles table checked with hand-written role lists.
They are now the organization plugin's member rows, with the permissions
defined in code (createAccessControl). has_role() keeps its signature and
reads member, owners count as admins, and comma-joined roles are a union,
so every RLS policy keeps its meaning. Event directors can now manage event
staff, as their permissions say.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin refactor/org-plugin-permissions
gh pr create --base staging --title "Org roles live in BetterAuth's member table and guards decide by permission" --body "<why (spec §1-2), what changed, 'no visible change', merge after #8, pnpm dev:setup after pulling, verification commands and verify-repone run>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Stop at the PR link. Part 2 starts from this branch.

---

# Part 2 — One sign-in, modules, invitations (`feat/unified-auth`)

- [ ] **Step 0: Rebase the spec branch onto Part 1**

```bash
git checkout feat/unified-auth && git rebase refactor/org-plugin-permissions
```

### Task 4: Mail and required verification

**Files:**
- Create: `src/lib/mailer.ts`, `src/lib/auth/delivery.ts`, `src/lib/auth/emails.ts`, `src/lib/auth/passwordLink.ts`, `scripts/mailpit.ts`
- Modify: `src/lib/auth/auth.ts`, `scripts/env-local.ts`, `.env.example`, `scripts/auth-helpers.ts` (`createOrResetUser`), `scripts/auth-check.ts`, `package.json`

**Interfaces:**
- Produces:
  - `sendEmail({ to, subject, text, html }): Promise<void>`
  - `expectEmailSent(request: () => Promise<unknown>): Promise<void>`
  - `reportDelivery(send: () => Promise<void>): Promise<void>`
  - `sendPasswordLink(userId: string, email: string): Promise<void>`
  - `latestEmailTo(address: string): Promise<{ subject: string; text: string; links: string[] } | null>` (scripts only)

- [ ] **Step 1: Dependency**

```bash
pnpm add nodemailer && pnpm add -D @types/nodemailer
```

- [ ] **Step 2: Port the three files.** Copy them from school-schedule, changing only comments and paths:
  - `src/lib/mailer.ts` is the sibling's `lib/mailer.ts` verbatim. Fix the inbox URL in its comment to `http://127.0.0.1:54524`.
  - `src/lib/auth/delivery.ts` is the sibling's `lib/auth/delivery.ts` verbatim.
  - `src/lib/auth/passwordLink.ts` is the sibling's `lib/auth/password-link.ts`, with the import changed to `@/lib/auth/delivery`.

- [ ] **Step 3: Emails** `src/lib/auth/emails.ts`

```ts
import type { Email } from "@/lib/mailer";

const wrap = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">${body}</div>`;
const button = (url: string, label: string) =>
  `<p><a href="${url}" style="display:inline-block;background:#e10600;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${label}</a></p>`;

export function verifyEmail({ to, url }: { to: string; url: string }): Email {
  return {
    to,
    subject: "Confirm your email for RepOne",
    text: `Confirm your email to finish creating your RepOne account:\n\n${url}\n\nThe link works for 24 hours.`,
    html: wrap(`<p>Confirm your email to finish creating your RepOne account.</p>${button(url, "Confirm email")}<p>The link works for 24 hours.</p>`),
  };
}

export function passwordLinkEmail({
  to, url, firstTime, organization,
}: { to: string; url: string; firstTime: boolean; organization: string | null }): Email {
  const who = organization ? ` by ${organization}` : "";
  return firstTime
    ? {
        to,
        subject: "You're invited to RepOne",
        text: `You've been invited to RepOne${who}. Set your password to get in:\n\n${url}\n\nOr sign in with Google using this email. The link works for 3 days.`,
        html: wrap(`<p>You've been invited to RepOne${who}.</p>${button(url, "Set my password")}<p>Or sign in with Google using this email. The link works for 3 days.</p>`),
      }
    : {
        to,
        subject: "Reset your RepOne password",
        text: `Someone asked to reset your RepOne password. If it was you:\n\n${url}\n\nIf not, ignore this email.`,
        html: wrap(`<p>Someone asked to reset your RepOne password. If it was you:</p>${button(url, "Choose a new password")}<p>If not, ignore this email.</p>`),
      };
}

export function roleGrantedEmail({ to, what, loginUrl }: { to: string; what: string; loginUrl: string }): Email {
  return {
    to,
    subject: `You now have access: ${what}`,
    text: `You were given access in RepOne: ${what}.\n\nSign in: ${loginUrl}`,
    html: wrap(`<p>You were given access in RepOne: <strong>${what}</strong>.</p>${button(loginUrl, "Sign in")}`),
  };
}
```

`what` and the org name come from our own database, never from the request. Still, escape them with a tiny `escapeHtml` (replace `&<>"'`) before putting them in `html`, and add it in this file.

- [ ] **Step 4: Write the failing checks.** Create `scripts/mailpit.ts`:

```ts
// Reads mail from the local Mailpit (supabase config [inbucket], UI :54524).
const API = "http://127.0.0.1:54524/api/v1";

export async function latestEmailTo(address: string) {
  const res = await fetch(`${API}/search?query=${encodeURIComponent(`to:${address}`)}&limit=1`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const { messages } = (await res.json()) as { messages: Array<{ ID: string; Subject: string }> };
  if (!messages.length) return null;
  const msg = (await (await fetch(`${API}/message/${messages[0].ID}`)).json()) as { Subject: string; Text: string };
  const links = [...msg.Text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
  return { subject: msg.Subject, text: msg.Text, links };
}

export async function clearMailbox() {
  await fetch(`${API}/messages`, { method: "DELETE" });
}
```

  Add to `scripts/auth-check.ts` (reuse its `expect`):

```ts
  console.log("\nEmail verification and reset (Mailpit)");
  await clearMailbox();
  const fresh = `verify+${Date.now()}@example.test`;
  await auth.api.signUpEmail({ body: { email: fresh, password: "Verify12345!", name: "" } });
  const verifyMail = await latestEmailTo(fresh);
  expect("sign-up sends a verification email", !!verifyMail?.links.length, verifyMail);
  const blocked = await auth.api.signInEmail({ body: { email: fresh, password: "Verify12345!" } }).catch((e) => e);
  expect("unverified sign-in is refused with EMAIL_NOT_VERIFIED", blocked?.body?.code === "EMAIL_NOT_VERIFIED", blocked?.body);
  const verifyRes = await fetch(verifyMail!.links[0], { redirect: "manual" });
  expect("the verification link redirects (verified)", verifyRes.status === 302 || verifyRes.status === 307, verifyRes.status);
  const ok = await auth.api.signInEmail({ body: { email: fresh, password: "Verify12345!" } }).catch((e) => e);
  expect("verified account signs in", !!ok?.user, ok?.body);

  await clearMailbox();
  await auth.api.requestPasswordReset({ body: { email: fresh, redirectTo: "/reset-password" } });
  const resetMail = await latestEmailTo(fresh);
  const token = resetMail?.links[0]?.match(/reset-password\/([^?]+)/)?.[1];
  expect("reset email carries a token", !!token, resetMail);
  await auth.api.resetPassword({ body: { token: token!, newPassword: "Changed12345!" } });
  const reuse = await auth.api.resetPassword({ body: { token: token!, newPassword: "Again12345!!" } }).catch((e) => e);
  expect("a reset link works once", !!reuse?.body || reuse instanceof Error, reuse);
```

  The verification link points at the dev server (`BETTER_AUTH_URL`), so this section needs `pnpm dev` running. Wrap it in the script's existing "app is up" skip helper, like its 401 test.

- [ ] **Step 5: Run it and confirm it fails.** Run: `pnpm db:auth-check`. Expected: "sign-up sends a verification email" fails, because nothing is sent.

- [ ] **Step 6: Configure BetterAuth.** In `src/lib/auth/auth.ts`:
  - Import `sendEmail`, `reportDelivery`, `verifyEmail` and `passwordLinkEmail`.
  - Import `and` from drizzle.
  - Replace `emailAndPassword` and add `emailVerification`:

```ts
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Sign-up waits for the verification link (autoSignInAfterVerification).
    autoSignIn: false,
    requireEmailVerification: true,
    // Invitations are password resets for people with no password yet:
    // resetPassword creates their credential. BetterAuth swallows errors thrown
    // here; reportDelivery hands the outcome to the inviting action
    // (lib/auth/delivery.ts).
    sendResetPassword: async ({ user, url }) => {
      const [credential] = await db
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")))
        .limit(1);
      const [org] = await db
        .select({ name: schema.organizations.name })
        .from(schema.member)
        .innerJoin(schema.organizations, eq(schema.organizations.id, schema.member.organizationId))
        .where(eq(schema.member.userId, user.id))
        .limit(1);
      await reportDelivery(() =>
        sendEmail(passwordLinkEmail({ to: user.email, url, firstTime: !credential, organization: org?.name ?? null })),
      );
    },
    resetPasswordTokenExpiresIn: 60 * 60 * 24 * 3, // invitations need days
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // A sign-in attempt while unverified sends a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verifyEmail({ to: user.email, url }));
    },
  },
```

  Update the Google comment: emails are now verified, so Google links to a verified password account. The default stays.

  The verification URL's callback must land on `/`. Check that the client passes `callbackURL: "/"` on `signUp.email` (Task 6). If BetterAuth builds the URL without it, set `emailVerification.callbackURL` if 1.7.6 has it (`grep -n callbackURL node_modules/better-auth/dist/api/routes/email-verification.mjs`). Otherwise append `&callbackURL=%2F` to `url` in `sendVerificationEmail`.

- [ ] **Step 7: Environment.**
  - `scripts/env-local.ts` writes `SMTP_URL=smtp://127.0.0.1:54525` and `EMAIL_FROM="RepOne <no-reply@repone.test>"`.
  - `.env.example` gets both, with this comment: "Outgoing email (verification, password reset, invitations). Locally the Mailpit started by pnpm dev; in production the provider's SMTP relay."
  - Check that `supabase/config.toml`'s `[inbucket] smtp_port = 54525` is uncommented. If it isn't, uncomment it.

- [ ] **Step 8: Verified dev and script accounts.** In `scripts/auth-helpers.ts` `createOrResetUser`, after creating or finding the user: `await db.update(user).set({ emailVerified: true }).where(eq(user.id, id));`. Then return the id.

  Script sign-ups that are meant to sign in right away (`authz-check`'s "new sign-up holds no staff power", `auth-check`'s sign-up) must mark the user verified the same way before `signInAs`. Grep for `signUpEmail` in `scripts/` and handle each one.

- [ ] **Step 9: Run it**

Run: `pnpm env:local --force` (then re-add the Google lines by hand), `pnpm dev:setup`, start `pnpm dev`, then `pnpm check && pnpm db:auth-check && pnpm db:authz-check`.
Expected: all pass, and the new emails are visible in Mailpit.

- [ ] **Step 10: Commit.** Title: "Password accounts verify their email and can reset their password". Stage the files listed above plus `package.json`, `pnpm-lock.yaml` and `supabase/config.toml` if it changed.

### Task 5: Modules, the start page and guards

**Files:**
- Create: `src/lib/auth/modules.ts`, `src/lib/auth/modules.test.ts`, `src/lib/auth/userModules.ts`, `src/components/AccountMenu.tsx`
- Rewrite: `src/app/(app)/page.tsx`
- Modify: the layouts of `admin`, `producer`, `dashboard`, `scorekeeper` and `commentator` (guard plus header menu), and `src/app/(app)/athlete/layout.tsx` (header menu)
- Delete: `staffLandingPath` from `src/lib/auth/eventRoles.ts:99-135`

**Interfaces:**
- Consumes: `roleCan`, `EVENT_STAFF_ROLE`, `OrgRole` (Task 1); `getSessionContext`, `getAuthSession`.
- Produces:

```ts
// modules.ts (pure)
export type ModuleKind = "admin" | "producer" | "scorekeeper" | "commentator" | "athlete";
export interface Module { kind: ModuleKind; href: string; label: string; detail: string }
export interface ModuleFacts {
  orgName: string | null;
  orgRoles: OrgRole[];
  assignments: Record<"scorekeeper" | "producer" | "commentator", string[]>; // event names, active only
  athleteName: string | null;
}
export function modulesFor(f: ModuleFacts): Module[];
export type Home = { redirect: string } | { start: { modules: Module[]; offerAthleteProfile: boolean } };
export function resolveHome(modules: Module[]): Home;

// userModules.ts (server)
export const userModules: () => Promise<Module[]>;   // cache()d; [] when signed out
export async function requireModule(...kinds: ModuleKind[]): Promise<void>; // → /login or /
```

- [ ] **Step 1: Write the failing test** `src/lib/auth/modules.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { modulesFor, resolveHome, type ModuleFacts } from "./modules";

const none: ModuleFacts = {
  orgName: "RepOneLive",
  orgRoles: [],
  assignments: { scorekeeper: [], producer: [], commentator: [] },
  athleteName: null,
};
const kinds = (f: ModuleFacts) => modulesFor(f).map((m) => m.kind);

describe("modulesFor", () => {
  it("an owner or admin sees every staff module", () => {
    expect(kinds({ ...none, orgRoles: ["owner"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
    expect(kinds({ ...none, orgRoles: ["admin"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
  });
  it("an event director sees every staff module too", () => {
    expect(kinds({ ...none, orgRoles: ["event_director"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
  });
  it("an org-wide scoring operator sees only Scorekeeper", () => {
    expect(kinds({ ...none, orgRoles: ["scoring_operator"] })).toEqual(["scorekeeper"]);
  });
  it("event assignments open their module and name the events", () => {
    const m = modulesFor({ ...none, assignments: { scorekeeper: ["Sector 2026", "GBO"], producer: [], commentator: [] } });
    expect(m).toEqual([{ kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", detail: "Sector 2026, GBO" }]);
  });
  it("an athlete profile adds the Athlete module last", () => {
    expect(kinds({ ...none, orgRoles: ["commentator"], athleteName: "Maria Rivera" })).toEqual(["commentator", "athlete"]);
  });
  it("nobody gets nothing", () => {
    expect(modulesFor(none)).toEqual([]);
  });
});

describe("resolveHome", () => {
  const athlete = modulesFor({ ...none, athleteName: "Maria Rivera" });
  const staff = modulesFor({ ...none, orgRoles: ["scoring_operator"] });
  it("only an athlete goes straight to /athlete", () => {
    expect(resolveHome(athlete)).toEqual({ redirect: "/athlete" });
  });
  it("no modules shows the empty start page offering an athlete profile", () => {
    expect(resolveHome([])).toEqual({ start: { modules: [], offerAthleteProfile: true } });
  });
  it("staff with one module still see the start page, with the athlete offer", () => {
    expect(resolveHome(staff)).toEqual({ start: { modules: staff, offerAthleteProfile: true } });
  });
  it("staff who compete see every card and no offer", () => {
    const both = modulesFor({ ...none, orgRoles: ["scoring_operator"], athleteName: "Ana" });
    expect(resolveHome(both)).toEqual({ start: { modules: both, offerAthleteProfile: false } });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run: `pnpm vitest run src/lib/auth/modules.test.ts`.

- [ ] **Step 3: Implement** `src/lib/auth/modules.ts`

```ts
import { roleCan, type OrgRole, type Permissions } from "@/lib/auth/permissions";

export type ModuleKind = "admin" | "producer" | "scorekeeper" | "commentator" | "athlete";
export interface Module { kind: ModuleKind; href: string; label: string; detail: string }
export interface ModuleFacts {
  orgName: string | null;
  orgRoles: OrgRole[];
  assignments: Record<"scorekeeper" | "producer" | "commentator", string[]>;
  athleteName: string | null;
}

/** Each staff module and the permission that opens it org-wide (spec §4). */
const STAFF: Array<{ kind: Exclude<ModuleKind, "athlete">; href: string; label: string; opens: Permissions; assignment?: keyof ModuleFacts["assignments"] }> = [
  { kind: "admin", href: "/admin", label: "Admin", opens: { event: ["update"] } },
  { kind: "producer", href: "/producer", label: "Production", opens: { broadcast: ["control"] }, assignment: "producer" },
  { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", opens: { score: ["enter"] }, assignment: "scorekeeper" },
  { kind: "commentator", href: "/commentator", label: "Commentator", opens: { commentary: ["read"] }, assignment: "commentator" },
];

/** The modules a person can open, from plain facts (userModules gathers them). */
export function modulesFor(f: ModuleFacts): Module[] {
  const out: Module[] = [];
  for (const m of STAFF) {
    const events = m.assignment ? f.assignments[m.assignment] : [];
    if (roleCan(f.orgRoles, m.opens)) {
      out.push({ kind: m.kind, href: m.href, label: m.label, detail: f.orgName ?? "" });
    } else if (events.length) {
      out.push({ kind: m.kind, href: m.href, label: m.label, detail: events.join(", ") });
    }
  }
  if (f.athleteName) out.push({ kind: "athlete", href: "/athlete", label: "Athlete", detail: f.athleteName });
  return out;
}

export type Home = { redirect: string } | { start: { modules: Module[]; offerAthleteProfile: boolean } };

/** Where `/` sends a signed-in person (spec §4, resolveHome table). */
export function resolveHome(modules: Module[]): Home {
  if (modules.length === 1 && modules[0].kind === "athlete") return { redirect: "/athlete" };
  return { start: { modules, offerAthleteProfile: !modules.some((m) => m.kind === "athlete") } };
}
```

- [ ] **Step 4: Run the test and confirm it passes.** Run: `pnpm vitest run src/lib/auth/modules.test.ts`. Expected: PASS.

- [ ] **Step 5: `src/lib/auth/userModules.ts`**

```ts
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuthSession, getSessionContext } from "@/lib/auth/session";
import { modulesFor, type Module, type ModuleKind } from "@/lib/auth/modules";
import { createClient } from "@/lib/db/server";

/** This request's modules (spec §4). Empty when signed out. */
export const userModules = cache(async (): Promise<Module[]> => {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const active = (table: "event_scorekeeper_assignments" | "event_producer_assignments" | "event_commentator_assignments", column: string) =>
    supabase.from(table).select("events(name)").eq(column, ctx.userId).eq("status", "active");

  const [org, sk, pr, co, athlete] = await Promise.all([
    ctx.organizationId
      ? supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
    active("event_scorekeeper_assignments", "scorekeeper_user_id"),
    active("event_producer_assignments", "producer_user_id"),
    active("event_commentator_assignments", "commentator_user_id"),
    supabase.from("athletes").select("first_name, last_name").eq("auth_user_id", ctx.userId).maybeSingle(),
  ]);
  // See lib/db/queries.ts header comment: many-to-one embeds come back as single objects.
  const names = (rows: unknown) =>
    ((rows ?? []) as Array<{ events: { name: string } | null }>).flatMap((r) => (r.events ? [r.events.name] : []));

  return modulesFor({
    orgName: org.data?.name ?? null,
    orgRoles: ctx.roles,
    assignments: { scorekeeper: names(sk.data), producer: names(pr.data), commentator: names(co.data) },
    athleteName: athlete.data ? `${athlete.data.first_name} ${athlete.data.last_name}` : null,
  });
});

/** Layout guard: signed out → /login; none of `kinds` → / (which never redirects into a module you lack). */
export async function requireModule(...kinds: ModuleKind[]): Promise<void> {
  if (!(await getAuthSession())) redirect("/login");
  const mine = await userModules();
  if (!mine.some((m) => kinds.includes(m.kind))) redirect("/");
}
```

  `organizations` has the "admins read orgs" policy. That policy uses `has_role` with all five roles, so every member can read their org's name. Check this with the scorekeeper account in Step 9.

- [ ] **Step 6: Guards.** In each layout, replace the existing `if (!ctx) redirect("/login")` (and, in admin, the `orgCan` / `staffLandingPath` line) with the guard, placed before anything else that reads data:

| Layout | Call |
|---|---|
| `admin/layout.tsx` | `await requireModule("admin")` |
| `producer/layout.tsx`, `dashboard/layout.tsx` | `await requireModule("producer")` |
| `scorekeeper/layout.tsx` | `await requireModule("scorekeeper")` |
| `commentator/layout.tsx` | `await requireModule("commentator")` |

  Owners, admins and event directors hold every staff module through `modulesFor`, so they keep their access to all four (spec §4). Keep `const ctx = await getSessionContext()` where the layout still uses `ctx` afterwards. Delete `staffLandingPath` and its now-unused helpers from `eventRoles.ts`.

- [ ] **Step 7: `AccountMenu`** `src/components/AccountMenu.tsx`. It is a server component that renders a `<details>` dropdown, so it needs no client JS beyond sign-out:

```tsx
import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { userModules } from "@/lib/auth/userModules";
import { SignOutButton } from "@/components/SignOutButton";
import { signOut } from "@/app/(app)/login/actions";

/** Header menu on every signed-in screen: Home, the person's modules, Sign out. */
export async function AccountMenu() {
  const [session, modules] = await Promise.all([getAuthSession(), userModules()]);
  if (!session) return null;
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-sm font-bold uppercase tracking-wide text-white/80 hover:text-white">
        {session.name || session.email} ▾
      </summary>
      <div className="absolute right-0 z-50 mt-2 flex min-w-56 flex-col rounded-md border border-white/10 bg-repone-gray p-2 text-sm text-white shadow-xl">
        <Link href="/" className="rounded px-3 py-2 hover:bg-white/10">Home</Link>
        {modules.map((m) => (
          <Link key={m.kind} href={m.href} className="rounded px-3 py-2 hover:bg-white/10">
            {m.label}
            <span className="block text-xs text-white/50">{m.detail}</span>
          </Link>
        ))}
        <SignOutButton action={signOut} redirectTo="/login" className="rounded px-3 py-2 text-left text-repone-red hover:bg-white/10" />
      </div>
    </details>
  );
}
```

  In each layout listed in Step 6, and in `athlete/layout.tsx`, replace its `<SignOutButton …/>` with `<AccountMenu />`. The athlete layout's sign-out redirect was `/athlete/login`, and it is now `/login` (inside the menu). In Task 6, `signOut` moves out of `(app)/login/actions.ts`. Update this import then.

- [ ] **Step 8: Start page** `src/app/(app)/page.tsx`. Keep today's landing for signed-out visitors, with the two buttons ("Live Leaderboard" and "Sign in" → `/login`) and the "Sign In" header link. For signed-in visitors:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { resolveHome } from "@/lib/auth/modules";
import { userModules } from "@/lib/auth/userModules";
import { AccountMenu } from "@/components/AccountMenu";

export default async function HomePage() {
  const session = await getAuthSession();
  if (!session) return <PublicLanding />;   // today's markup, moved into a function below
  const home = resolveHome(await userModules());
  if ("redirect" in home) redirect(home.redirect);
  const { modules, offerAthleteProfile } = home.start;

  return (
    <div className="flex min-h-screen flex-col bg-repone-black text-repone-white">
      <header className="flex items-center justify-between px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
        <img src="/repone-logo.png" alt="RepOne" className="h-9 w-auto" width={472} height={240} />
        <AccountMenu />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-bold">Hi, {session.name || session.email}</h1>
        {modules.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((m) => (
              <Link key={m.kind} href={m.href} className="rounded-xl border border-white/10 bg-repone-gray p-6 hover:border-repone-red">
                <p className="text-lg font-bold uppercase tracking-wide">{m.label}</p>
                <p className="mt-1 text-sm text-white/60">{m.detail}</p>
              </Link>
            ))}
          </div>
        ) : null}
        {offerAthleteProfile ? (
          <div className={modules.length ? "rounded-xl border border-dashed border-white/20 p-6" : "flex flex-col items-center gap-4 py-16 text-center"}>
            <Link href="/athlete/onboarding" className="control-btn control-btn-red px-8">Create my athlete profile</Link>
            {modules.length === 0 ? (
              <p className="text-sm text-white/50">Invited as staff? Use the link in your email.</p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Run and look.** Run `pnpm check`. Then with `pnpm dev`, sign in as each dev account at the current `/login`:
  - **admin:** start page with Admin, Production, Scorekeeper and Commentator, plus the athlete offer.
  - **scorekeeper:** start page with Scorekeeper (detail lists the events) and the offer.
  - **athlete:** goes straight to `/athlete`.
  - **new-athlete:** empty start page.
  - The scorekeeper opening `/admin` is sent to `/`.
  - Each header shows the menu.

- [ ] **Step 10: Commit.** Title: "Signing in lands on the modules a person's permissions open".

### Task 6: The auth screens

**Files:**
- Create:
  - `src/app/(auth)/layout.tsx`
  - `src/app/(auth)/login/page.tsx`, `LoginForm.tsx`
  - `src/app/(auth)/signup/page.tsx`, `SignUpForm.tsx`
  - `src/app/(auth)/verify-email/page.tsx`, `ResendButton.tsx`
  - `src/app/(auth)/forgot-password/page.tsx`, `ForgotPasswordForm.tsx`
  - `src/app/(auth)/reset-password/page.tsx`, `src/app/(auth)/invite/page.tsx`
  - `src/components/auth/AuthCard.tsx`, `src/components/auth/SetPasswordForm.tsx`
  - `src/lib/auth/actions.ts` (`signOut`)
- Move: `src/app/(app)/athlete/GoogleButton.tsx` and `GoogleIcon.tsx` → `src/components/auth/`
- Modify: `src/lib/auth/formErrors.ts` (+ test), `src/app/(app)/athlete/onboarding/page.tsx`, `src/app/(app)/athlete/actions.ts`, every `/athlete/*` page that redirects to `/athlete/login` or `/athlete/onboarding`, and `next.config.ts` (redirects)
- Delete: `src/app/(app)/login/`, `src/app/(app)/athlete/login/`, `src/app/(app)/athlete/signup/`

**Interfaces:**
- Produces:
  - `signInErrorMessage(error)`, now returning a verify message for `EMAIL_NOT_VERIFIED`
  - `isUnverified(error): boolean`
  - `resetErrorMessage(error)`
  - `signOut(): Promise<void>` in `src/lib/auth/actions.ts`

- [ ] **Step 1: Write the failing test.** Extend `src/lib/auth/formErrors.test.ts`:

```ts
it("an unverified sign-in asks to verify, never 'incorrect password'", () => {
  const e = { status: 403, code: "EMAIL_NOT_VERIFIED" };
  expect(isUnverified(e)).toBe(true);
  expect(signInErrorMessage(e)).toBe("Confirm your email first — we just sent you a new link.");
});
it("an expired or used link says so", () => {
  expect(resetErrorMessage({ code: "INVALID_TOKEN" })).toBe("This link has expired or was already used.");
  expect(resetErrorMessage({ status: 500 })).toBe("Couldn't save the password. Please try again.");
});
```

  Run `pnpm vitest run src/lib/auth/formErrors.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement** in `formErrors.ts`

```ts
export function isUnverified(error: AuthClientError): boolean {
  return error?.code === "EMAIL_NOT_VERIFIED";
}

export function signInErrorMessage(error: AuthClientError): string {
  if (error?.status === 429) return TOO_MANY;
  if (isUnverified(error)) return "Confirm your email first — we just sent you a new link.";
  return "Email or password is incorrect.";
}

export function resetErrorMessage(error: AuthClientError): string {
  if (error?.code === "INVALID_TOKEN") return "This link has expired or was already used.";
  return "Couldn't save the password. Please try again.";
}
```

  Re-run the test. Expected: PASS.

- [ ] **Step 3: Layout and card.** `src/app/(auth)/layout.tsx` is a separate root layout (like `(overlay)`), with `import "../globals.css"` and `<html lang="en"><body className="min-h-full bg-repone-black">`. `AuthCard` is the current login page's card (`src/app/(app)/login/page.tsx`, lines 15-24), taking `title`, `notice?` and `children`. Every auth page is a server component that redirects to `/` when `getAuthSession()` returns a session (except `reset-password` and `invite`), then renders `AuthCard` with its client form.

- [ ] **Step 4: Login.** `LoginForm` uses the existing `useAuthForm`:

```tsx
const { error, pending, leaving, onSubmit } = useAuthForm(async (email, password) => {
  const { error } = await authClient.signIn.email({ email, password, callbackURL: "/" });
  if (isUnverified(error)) return { to: `/verify-email?email=${encodeURIComponent(email)}` };
  return error ? { error: signInErrorMessage(error) } : { to: "/" };
});
```

  The form also has:
  - a "Forgot your password?" link to `/forgot-password`
  - "No account? Create one" linking to `/signup`
  - `GoogleButton` when `googleEnabled`, passed from the page

  The page reads `searchParams` and turns `reset=1`, `invited=1` and `verified=1` into an `AuthCard` notice: "Password saved — sign in.", "Welcome — sign in with your new password." and "Email confirmed — sign in." It reads `error=oauth` into `OAuthErrorNotice`.

  In `GoogleButton`, use `callbackURL: "/"` and `errorCallbackURL: "/login?error=oauth"`, and update the `account_not_linked` wording: "This email already has a password account that isn't confirmed yet — confirm it from your inbox, then try Google again."

- [ ] **Step 5: Sign-up.** `SignUpForm` has name, email and password:

```tsx
const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/" });
return error ? { error: signUpErrorMessage(error) } : { to: `/verify-email?email=${encodeURIComponent(email)}` };
```

  `useAuthForm` reads only email and password, so take `name` from a ref or controlled input in the component. Do not widen `useAuthForm`.

- [ ] **Step 6: Verify email.** The page shows "We sent an email to {email}. Open the link in it to finish." and a `ResendButton`, a client component. The button calls `authClient.sendVerificationEmail({ email, callbackURL: "/" })` and then shows "Sent — check your inbox (and spam)." After a 429 it shows `TOO_MANY`.

- [ ] **Step 7: Forgot, reset and invite.**
  - `ForgotPasswordForm` calls `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })` and **always** shows "If that email has an account, we sent a link to reset the password." (`TOO_MANY` on a 429).
  - `SetPasswordForm` is ported from the sibling's `components/auth/set-password-form.tsx`, written with `useState` and a plain `onSubmit` instead of TanStack. It uses this app's input classes and `resetErrorMessage`, and calls `authClient.resetPassword({ newPassword, token })`, then `router.replace(redirectTo)`.
  - `reset-password/page.tsx` reads `?token=`. Without a token it shows "This link has expired or was already used." with a link to `/forgot-password`. Otherwise it renders `SetPasswordForm redirectTo="/login?reset=1" submitLabel="Save password"`.
  - `invite/page.tsx` does the same with `redirectTo="/login?invited=1"` and `submitLabel="Set password and continue"`, plus `GoogleButton` under it. The expired message is "This invitation link has expired. Ask the organizer to resend it."

- [ ] **Step 8: Old doors.**
  - In `next.config.ts`, add `async redirects() { return [{ source: "/athlete/login", destination: "/login", permanent: true }, { source: "/athlete/signup", destination: "/signup", permanent: true }]; }`. Query strings carry over by default.
  - Delete `src/app/(app)/login/`, after moving `signOut` to `src/lib/auth/actions.ts`, and update its imports in `AccountMenu` and the athlete actions. Delete `athlete/login/` and `athlete/signup/` too.
  - Every `redirect("/athlete/login")` becomes `redirect("/login")`.
  - Every `redirect("/athlete/onboarding")` in `athlete/page.tsx`, `athlete/messages/**` and `athlete/directory/**` becomes `redirect("/")`. Nothing redirects into onboarding any more.
  - `athlete/onboarding/page.tsx`: without a session it goes to `/login`, and with a profile to `/athlete` (as today).
  - Update every `/login` link (`live/layout.tsx:43`) and comment (`athlete/layout.tsx:11`).
  - `pnpm typecheck` and `grep -rn "athlete/login\|athlete/signup" src` must both come back clean.

- [ ] **Step 9: Onboarding errors inline.**
  - `completeAthleteOnboarding` returns `{ error: string } | undefined` instead of throwing. It still redirects on success.
  - The page becomes a client form with `useActionState(completeAthleteOnboarding, undefined)`. It shows `state?.error` above the button and keeps the inputs uncontrolled, so their values survive (React keeps the form's DOM across the action's re-render).
  - `ValidationError` from `parseForm` is caught and returned as `{ error: e.message }`. A `friendlyAthleteWriteError` is returned the same way.

- [ ] **Step 10: Run** `pnpm check`. With `pnpm dev`, click through `/login`, `/signup` (the email appears in Mailpit and the link lands on `/`), `/forgot-password`, `/reset-password` from that email, `/athlete/login` (redirects), and onboarding with a duplicate phone (inline error, typed values kept).

- [ ] **Step 11: Commit.** Title: "Everyone signs in and signs up through one door".

### Task 7: Invitations and the Team page

**Files:**
- Create: `supabase/migrations/0030_invitations.sql`, `src/lib/auth/invite.ts`, `src/lib/actions/team.ts`, `src/app/(app)/admin/team/page.tsx`, `scripts/invite-check.ts`
- Rewrite: `src/lib/actions/eventStaff.ts`, `src/app/(app)/admin/events/[eventId]/staff/page.tsx`
- Delete: `src/lib/auth/eventStaffCandidates.ts`. Move `getDisplayNamesByUserId` into `src/lib/db/people.ts` first, because `producer/events/[eventId]/commentary/page.tsx` uses it.
- Modify: `src/db/schema/auth.ts` (`lastSignInAt`), `src/lib/auth/auth.ts` (additional field + `session.create.after`), `eslint.config.mjs` (owner-connection allow-list), `src/lib/mailer.ts` (rebuild on `SMTP_URL` change), `src/app/(app)/admin/layout.tsx` NAV (add `{ href: "/admin/team", label: "Team" }`, shown only when `orgCan(ctx, { member: ["create"] })`), `package.json` (`"db:invite-check": "tsx scripts/invite-check.ts"`)

**Interfaces:**
- Consumes: `sendPasswordLink`, `expectEmailSent`, `sendEmail`, `roleGrantedEmail` (Task 4); `roleCan`, `splitRoles`, `OrgRole`, `EVENT_STAFF_ROLE` (Task 1).
- Produces (server-only, in `invite.ts`, authorization done by the caller):

```ts
export type InviteOutcome = { userId: string; created: boolean; emailSent: boolean };
export function normalizeEmail(raw: string): string;                         // trim + lowercase
export async function ensureUser(email: string): Promise<{ userId: string; created: boolean }>;
export async function inviteToOrg(input: { email: string; role: OrgRole; organizationId: string; orgName: string; headers: Headers }): Promise<InviteOutcome>;
export async function inviteToEvent(input: { email: string; kind: "scorekeeper" | "producer" | "commentator"; eventId: string; eventName: string; invitedBy: string; roleLabel?: string | null; db?: SupabaseClient<Database> }): Promise<InviteOutcome>;
export async function resendInvitation(userId: string, email: string): Promise<void>;  // throws if not sent
export async function isPending(userIds: string[]): Promise<Set<string>>;   // user.last_sign_in_at is null
```

- [ ] **Step 1: Write the failing check** `scripts/invite-check.ts`. Copy the boilerplate (`expect`, `signInAs`, `service`) from `scripts/authz-check.ts`:

```ts
import { clearMailbox, latestEmailTo } from "./mailpit";
import { inviteToEvent, inviteToOrg, normalizeEmail } from "@/lib/auth/invite";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";

async function main() {
  const admin = await signInAs("admin@repone.test");
  await clearMailbox();

  // New email → verified, passwordless account + member role + invitation email.
  const fresh = `invite+${Date.now()}@example.test`;
  const r1 = await inviteToOrg({ email: fresh, role: "event_director", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers });
  expect("new email creates an account", r1.created && r1.emailSent, r1);
  const { data: u } = await service.from("user").select("email_verified").eq("id", r1.userId).single();
  expect("invited account is verified", u?.email_verified === true, u);
  const { data: m } = await service.from("member").select("role").eq("user_id", r1.userId).single();
  expect("invited account holds the role", m?.role === "event_director", m);
  const mail = await latestEmailTo(fresh);
  expect("invitation email links to /invite", !!mail?.links.some((l) => l.includes("callbackURL=%2Finvite")), mail);

  // Review Focus 3: different case/spaces → same person, role added, nothing duplicated.
  const r2 = await inviteToOrg({ email: `  ${fresh.toUpperCase()} `, role: "commentator", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers });
  expect("mixed-case invite finds the same account", !r2.created && r2.userId === r1.userId, r2);
  const { data: m2 } = await service.from("member").select("role").eq("user_id", r1.userId).single();
  expect("roles are joined", m2?.role === "event_director,commentator", m2);
  expect("normalizeEmail", normalizeEmail("  A@B.Co ") === "a@b.co");

  // Existing account → event assignment only, notice email.
  const r3 = await inviteToEvent({ email: "athlete@repone.test", kind: "scorekeeper", eventId: EVENT_ID, eventName: "Seed Event", invitedBy: admin.userId, db: admin.db });
  expect("existing account is not re-created", !r3.created, r3);
  const { data: a } = await service.from("event_scorekeeper_assignments").select("status").eq("scorekeeper_user_id", r3.userId).eq("event_id", EVENT_ID).single();
  expect("existing account is assigned", a?.status === "active", a);

  // An event director cannot grant org roles (the action's guard; the plugin refuses too).
  const director = await signInAs("commentator@repone.test");
  await service.from("member").insert({ organization_id: ORG_ID, user_id: director.userId, role: "event_director" });
  const denied = await inviteToOrg({ email: `x+${Date.now()}@example.test`, role: "admin", organizationId: ORG_ID, orgName: "RepOneLive", headers: (await signInAs("commentator@repone.test")).headers }).catch((e) => e);
  expect("event_director cannot grant admin", denied instanceof Error, denied);

  // The last owner cannot be removed.
  const { data: owner } = await service.from("member").select("id").eq("organization_id", ORG_ID).like("role", "%owner%").single();
  const lastOwner = await auth.api.removeMember({ headers: admin.headers, body: { memberIdOrEmail: owner!.id, organizationId: ORG_ID } }).catch((e) => e);
  expect("the last owner cannot be removed", lastOwner instanceof Error, lastOwner);

  // Review Focus 5: mail down → clear error, account and role still there.
  const saved = process.env.SMTP_URL;
  process.env.SMTP_URL = "smtp://127.0.0.1:1";
  const down = `down+${Date.now()}@example.test`;
  const r4 = await inviteToOrg({ email: down, role: "commentator", organizationId: ORG_ID, orgName: "RepOneLive", headers: admin.headers });
  process.env.SMTP_URL = saved;
  expect("mail down reports emailSent=false", r4.created && !r4.emailSent, r4);
  const { data: m4 } = await service.from("member").select("role").eq("user_id", r4.userId).single();
  expect("…but the account and role exist for Resend", m4?.role === "commentator", m4);

  // cleanup
  await service.from("member").delete().eq("user_id", director.userId);
  await service.from("event_scorekeeper_assignments").delete().eq("scorekeeper_user_id", r3.userId).eq("event_id", EVENT_ID);
  await service.from("user").delete().in("id", [r1.userId, r4.userId]);
  if (failures) process.exit(1);
  process.exit(0);
}
void main();
```

  The mailer caches its transport, so Review Focus 5 needs `getTransport()` to rebuild when `SMTP_URL` changes. In `src/lib/mailer.ts`, keep `let cachedUrl` next to `transport` and recreate the transport when `url !== cachedUrl`.

  `inviteToOrg` checks the inviter's permission itself through `auth.api.hasPermission({ headers, body: { permissions: { member: ["create"] } } })`, because Review Focus "event_director cannot grant admin" is asserted at this level. Granting `owner` also requires the caller to be an owner (`roleCan(callerRoles, { organization: ["delete"] })`).

  Run `pnpm db:invite-check`. Expected: it fails, because `@/lib/auth/invite` doesn't exist.

- [ ] **Step 2: Pending state and member emails (migration `0030_invitations.sql`).** "Pending" means "never signed in". A session row is deleted at sign-out, so record the first sign-in on the user instead, as the sibling does:

```sql
-- 0030 — What invitations need: when someone first signed in (pending = never),
-- and members' emails for the Team page (public."user" is closed to the API).
alter table public."user" add column last_sign_in_at timestamptz;

create or replace function org_member_emails(p_organization_id uuid)
returns table (user_id uuid, email text, last_sign_in_at timestamptz) as $$
  select u.id, u.email, u.last_sign_in_at
  from public.member m join public."user" u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and has_role(p_organization_id, array['admin','event_director']::user_role[]);
$$ language sql stable security definer set search_path = public;
revoke execute on function org_member_emails(uuid) from public, anon;
grant execute on function org_member_emails(uuid) to authenticated;
```

  Then make these changes:
  - drizzle `user`: add `lastSignInAt: timestamp({ withTimezone: true }),`
  - `auth.ts`: add `user: { additionalFields: { lastSignInAt: { type: "date", required: false, input: false } } }`, and in `databaseHooks.session.create` add `after: async (s) => { await db.update(schema.user).set({ lastSignInAt: s.createdAt }).where(eq(schema.user.id, s.userId)); }`.
  - `eslint.config.mjs`: allow `@/db` in `src/lib/auth/invite.ts` too. It reads `user`/`member` over the owner connection, because the API can't. Say so in the rule's comment.

  Run `pnpm db:reset && pnpm db:types && pnpm dev:accounts`.

- [ ] **Step 3: Implement** `src/lib/auth/invite.ts`

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { sendPasswordLink } from "@/lib/auth/passwordLink";
import { roleGrantedEmail } from "@/lib/auth/emails";
import { sendEmail } from "@/lib/mailer";
import { splitRoles, type OrgRole } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";

/**
 * Invitations, as in school-schedule (actions/people.ts): the person is
 * created verified and without a password, given the role, and emailed a
 * password link (/invite). BetterAuth's own inviteMember would make them sign
 * up first and then accept. Callers authorize the inviter; inviteToOrg also
 * asks BetterAuth (member:create) because it grants org roles.
 */
export type InviteOutcome = { userId: string; created: boolean; emailSent: boolean };

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The account for `email`, created verified and without a password when missing. */
export async function ensureUser(email: string): Promise<{ userId: string; created: boolean }> {
  const address = normalizeEmail(email);
  const [found] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${address}`);
  if (found) return { userId: found.id, created: false };
  // No headers: the admin plugin skips its own permission check (installed
  // 1.7.6 behaviour); the caller has already authorized the inviter.
  const { user: created } = await auth.api.createUser({
    body: { email: address, name: "", data: { emailVerified: true } },
  });
  return { userId: created.id, created: true };
}

/** Sends the invitation (new account) or the access notice; false if it didn't go out. */
async function deliver(created: boolean, userId: string, email: string, what: string): Promise<boolean> {
  try {
    if (created) await sendPasswordLink(userId, normalizeEmail(email));
    else
      await sendEmail(
        roleGrantedEmail({ to: normalizeEmail(email), what, loginUrl: `${process.env.BETTER_AUTH_URL}/login` }),
      );
    return true;
  } catch (error) {
    // The admin can't fix delivery; the cause goes to the server logs and the
    // action tells them to use Resend.
    console.error("invite: the email was not sent", error);
    return false;
  }
}

export async function inviteToOrg(input: {
  email: string; role: OrgRole; organizationId: string; orgName: string; headers: Headers;
}): Promise<InviteOutcome> {
  if (input.role === "owner") throw new Error("Ownership is transferred, not granted by invitation.");
  const allowed = await auth.api.hasPermission({
    headers: input.headers,
    body: { organizationId: input.organizationId, permissions: { member: ["create"] } },
  });
  if (!allowed.success) throw new Error("Only an owner or admin can invite to the team.");

  const { userId, created } = await ensureUser(input.email);
  const [existing] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, input.organizationId)));
  if (!existing) {
    // Server-only and unchecked by BetterAuth: authorized above.
    await auth.api.addMember({ body: { userId, role: input.role, organizationId: input.organizationId } });
  } else if (!splitRoles(existing.role).includes(input.role)) {
    await auth.api.updateMemberRole({
      headers: input.headers,
      body: {
        memberId: existing.id,
        role: [...splitRoles(existing.role), input.role],
        organizationId: input.organizationId,
      },
    });
  }
  const emailSent = await deliver(created, userId, input.email, `${input.role.replaceAll("_", " ")} at ${input.orgName}`);
  return { userId, created, emailSent };
}

const ASSIGNMENT = {
  scorekeeper: { table: "event_scorekeeper_assignments", column: "scorekeeper_user_id" },
  producer: { table: "event_producer_assignments", column: "producer_user_id" },
  commentator: { table: "event_commentator_assignments", column: "commentator_user_id" },
} as const;

export async function inviteToEvent(input: {
  email: string;
  kind: keyof typeof ASSIGNMENT;
  eventId: string;
  eventName: string;
  invitedBy: string;
  roleLabel?: string | null;
  /** The inviter's client (defaults to the request's). RLS "managers manage … assignments" decides. */
  db?: SupabaseClient<Database>;
}): Promise<InviteOutcome> {
  const { userId, created } = await ensureUser(input.email);
  const { table, column } = ASSIGNMENT[input.kind];
  const supabase = input.db ?? (await createClient());
  const { error } = await supabase.from(table).upsert(
    {
      event_id: input.eventId,
      [column]: userId,
      assigned_by_admin_id: input.invitedBy,
      status: "active",
      assigned_at: new Date().toISOString(),
      removed_at: null,
      ...(input.kind === "commentator" ? { role_label: input.roleLabel ?? null } : {}),
    } as never,
    { onConflict: `event_id,${column}` },
  );
  if (error) throw new Error(error.message);
  const emailSent = await deliver(created, userId, input.email, `${input.kind} for ${input.eventName}`);
  return { userId, created, emailSent };
}

/** Sends a fresh password link; throws if it didn't go out. */
export async function resendInvitation(userId: string, email: string): Promise<void> {
  await sendPasswordLink(userId, normalizeEmail(email));
}

/** People who have never signed in: their invitation is still pending. */
export async function isPending(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, userIds), isNull(user.lastSignInAt)));
  return new Set(rows.map((r) => r.id));
}
```

  In `scripts/invite-check.ts`, pass `db: admin.db` to `inviteToEvent`, because outside Next `createClient()` has no request cookies. In `src/lib/mailer.ts`, rebuild the transport when `SMTP_URL` changes: keep `let cachedUrl: string | undefined` beside `transport`, and recreate it when `url !== cachedUrl`. Review Focus 5's check depends on this.

- [ ] **Step 4: Run the check.** Run: `pnpm db:invite-check`. Expected: every line prints `ok`.

- [ ] **Step 5: Team page and actions.** `src/lib/actions/team.ts` (`"use server"`):
  - `inviteTeamMember(_: unknown, formData)` → `{ ok: true; message } | { ok: false; message }`. It:
    - parses `email` (`field.email()`) and `role` (`field.oneOf` over `ORG_ROLES` minus `owner`)
    - calls `requireOrgManager()` for the org id
    - reads the org name
    - calls `inviteToOrg({ …, headers: await headers() })`
    - returns "Invitation sent." / "Access granted and notified." / "Saved, but the email didn't send — use Resend." based on the outcome
  - `resendTeamInvite(userId)`: `requireOrgManager` plus the `member:create` check, then reads the user's email and calls `resendInvitation`.
  - `removeTeamRole(memberId, role)`: drops one role through `auth.api.updateMemberRole` (the remaining roles), or `auth.api.removeMember` when it was the last. Both use `headers()`. The plugin's last-owner error maps to "The organization must keep an owner."

  `admin/team/page.tsx` starts with `if (!orgCan(ctx, { member: ["create"] })) redirect("/admin")`. Then:
  - It lists `member` rows for the org (through the user's Supabase client, since RLS allows members to read them) joined to `profiles.full_name`.
  - The emails and pending state come from `org_member_emails(orgId)` (Step 2).
  - Each row shows its roles as chips with ×, Pending + Resend when `last_sign_in_at` is null, and the invite form, using `useActionState` for inline messages.

  Follow the markup and classes of `admin/events/[eventId]/staff/page.tsx`.

- [ ] **Step 6: Event staff page.**
  - In `eventStaff.ts`, replace `assign` with `inviteEventStaff(role, eventId, _: unknown, formData)`. It:
    - parses `email` (plus `roleLabel` for commentators)
    - calls `requireEventAdmin(eventId)`, which is now `staff:invite`
    - reads the event name
    - calls `inviteToEvent`
    - returns the same three messages
  - `remove` is unchanged. Add `resendEventInvite(eventId, userId)`.
  - The page drops the candidate select for an email input per section, shows "Pending · Resend" on unaccepted rows, and updates its intro text to "Invite people by email to <event>. Each role only gets access to this event."

- [ ] **Step 7: Run** `pnpm check && pnpm db:invite-check && pnpm db:authz-check && pnpm db:rls-check`.

- [ ] **Step 8: Commit.** Title: "Admins invite staff by email, to the organization or to one event".

### Task 8: Prove it in the real app, docs, PR

**Files:**
- Modify: `README.md`, `.claude/skills/verify-repone/SKILL.md:41`, `.claude/skills/verify-repone/features/access-control.md`, `.claude/skills/verify-repone/features/athlete-portal.md`, `.claude/skills/verify-repone/scripts/fixtures.sh`

- [ ] **Step 1: Docs.**
  - **README:** one "Signing in" section covering:
    - one `/login`, how `/` routes by module, invitations, verification
    - `SMTP_URL` / `EMAIL_FROM` locally (Mailpit at :54524) and in Production (the provider's SMTP relay, sender domain verified)
    - "`pnpm dev:setup` after pulling"
  - **The verify-repone files:** replace `/athlete/login` with `/login`, describe the start page, and add an "Invite" recipe that reads the email in Mailpit at `http://127.0.0.1:54524`.

- [ ] **Step 2: Browser proof with `verify-repone`.** Take screenshots to `.verify/` for each:
  1. **Sign-up:** `/signup` → Mailpit → link → empty start page → Create my athlete profile → `/athlete`.
  2. **Admin:** `/login` → start page with all four staff modules → menu switches between them → never sees onboarding.
  3. **Invitation:** as admin, Team → invite a new email as scorekeeper (org-wide) → Mailpit → `/invite` → set password → `/login?invited=1` → sign in → start page with Scorekeeper.
  4. **Event staff:** invite to one event → Pending shown → Resend sends again.
  5. **Old URLs:** `/athlete/login` and `/athlete/signup` redirect.
  6. **Outsiders:** the athlete opening `/admin`, `/producer`, `/scorekeeper` and `/commentator` lands on `/`.
  7. **Forgot password,** end to end.
  8. **Unverified sign-in:** shows the verify message and a new email arrives.
  9. **Google:** ask the user to do it (needs their account). `/login` → Google → `/`.

- [ ] **Step 3: Full suite.** Run `pnpm check && pnpm build`, then every `db:*` check on a fresh `pnpm dev:setup`. All must pass.

- [ ] **Step 4: Commit and open the PR.** Commit the docs ("Docs describe one sign-in, modules and invitations"), then:

```bash
git push -u origin feat/unified-auth
gh pr create --base staging --title "Everyone signs in through one door and sees the modules their permissions open" --body "<what (spec link), why (two doors, hand-rolled roles, no email), stacked on the Part 1 PR, new env vars SMTP_URL/EMAIL_FROM, pnpm dev:setup after pulling, verification: suite + the 9 browser runs>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Stop at the PR link.
