# Venue Display & Sponsor Delivery — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a vertical TV at the venue into a RepOne presentation layer. It rotates sponsor creatives with weighted frequency and interleaves the live current heat, next heat and leaderboard from the same data the overlays use. It records delivered impressions and keeps playing sponsors when the venue internet drops.

**Architecture:** The venue display is one more consumer of the existing per-floor `broadcast_state`, heats, lanes and standings. It adds no copy of competition data.

- **Sponsors:** the sponsor module is reshaped into org-level `sponsors`, editable `sponsor_packages`, per-event `event_sponsorships` (package plus overrides) and `sponsor_creatives`.
- **Devices:** each `display_devices` row is one screen bound to an event and a floor.
- **Player:** a full-screen client player at `/display/[eventId]/[displayId]` runs a pure, tested weighted scheduler (smooth weighted round-robin). It loads its own snapshot through the browser Supabase client and refreshes it from Realtime.
- **Device key:** the kiosk authenticates with a per-device key in its URL. The key is only ever checked inside `security definer` RPCs, which record heartbeats and impressions. The app never uses a service key.
- **Offline:** a service worker scoped to `/display/` caches the shell and sponsor creatives. The player persists its last snapshot and its unsent impressions in `localStorage`.

**Tech Stack:** Next.js 16.3 (App Router), React 19.2, Supabase (Postgres, RLS, Realtime, Storage), BetterAuth sessions minting Supabase JWTs, zod 4, vitest, Tailwind 4.

**Spec:** `docs/specs/venue-display.md` (client's "Venue Display & Sponsor Delivery Architecture"). This plan implements its **MVP** section only. Phase 2 and Phase 3 items are listed under *Out of scope* at the end.

**Branches:** start after `feat/better-auth` is merged. Each Part is its own branch from an up-to-date `staging` (the branch PRs target in practice; `main` is still the initial commit) and its own PR against `staging`, otherwise following AGENTS.md "Shipping a change":

| Part | Branch | Depends on |
|---|---|---|
| A — Sponsor model | `feat/sponsor-packages` | `staging` (with better-auth merged) |
| B — Display player | `feat/venue-display` | A merged |
| C — Device key, heartbeat, impressions | `feat/display-impressions` | B merged |
| D — Offline resilience | `feat/display-offline` | C merged |

If `staging` already has migrations past `0028` when a Part starts, renumber that Part's migration to the next free number and update every reference in this plan's steps.

## Decisions taken for the client's open questions

These are the defaults the plan builds. Each is cheap to change later. Confirm them with the client before Part B ships.

1. **One display shows one floor.** The route carries `eventId` (as in the spec) plus `displayId`, and the device row carries `floor_id`. Current and next heat come from that floor's `broadcast_state`.
2. **Event-state eligibility is derived from data, not from an operator mode.** Current Heat shows only while the floor's current heat exists and has not ended. Next Heat shows only when an unfinished heat follows in running order. Leaderboard shows only when the relevant division has standings. The PRE-EVENT, BREAK and AWARDS modes are Phase 2.
3. **What counts as delivered:** a sponsor creative that was on screen for its full scheduled duration, with the page visible, and with the creative image loaded (or the text fallback shown when the sponsor has no creative). Interrupted plays are stored with `completed = false` and are not counted as delivered.
4. **Creatives are images only** (PNG, JPEG or WebP, ≤ 4 MB, designed at 2160 × 3840). No video in the MVP.
5. **The six existing tiers become the default packages** of every organization. Admins can edit them.

## Global Constraints

- **Screen:** 9:16 portrait. The design stage is 1080 × 1920 CSS px, scaled uniformly to the viewport. At 2160 × 3840 that is a scale of 2.
- **Route:** `/display/[eventId]/[displayId]?key=<device key>`. It must not require a login.
- **No duplicated competition data:** the display reads `broadcast_state`, `heats`, `lanes`, `athletes`, `wods`, `divisions` and `standings` directly.
- **Durations:** sponsor display durations are 3–60 s and weights are 1–10 (DB `check` constraints). Info block durations are 5–60 s.
- **Migrations:** hand-written SQL in `supabase/migrations/`, verified with `pnpm db:reset && pnpm db:types`. No remote database to preserve.
- **Guards:** org-level sponsor and package changes use `requireOrgManager()`. Display device changes use `requireEventAccess(eventId, ["producer"])`. RLS mirrors both, so a direct PostgREST call can't bypass the app.
- **No service key in the app:** the kiosk is anonymous, and its writes go only through `security definer` RPCs that verify the device key.
- **Every commit:** `pnpm check` passes. Stage files by name. The commit title is a plain sentence saying what is now true. End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **UI work:** load the `impeccable` (or `frontend-design:frontend-design`) skill before building the display block components, and prove each Part in the browser with the `verify-repone` skill before opening its PR.

## Review Focus

1. **Two sponsors share an exclusive category.** Adding the second active sponsorship, or re-activating it, must fail with a readable message. *Test:* Task A1's `db:sponsor-check`.
2. **Someone copies a kiosk URL without the key, or with an old key after rotation.** The page must still render (it is public data), but heartbeats and impressions must be rejected, and a rotated key must stop the old one immediately. *Test:* Task C1's `db:display-check`.
3. **The venue internet drops mid-rotation.** Sponsors must keep rotating. Heat and leaderboard blocks keep their last data for up to 5 minutes, then drop out until Realtime reconnects. Impressions recorded offline must arrive exactly once after reconnecting. *Tests:* Task B2 (`eligibleInfoSlots` staleness), Task C3 (queue dedupe and retry), Task D2 (browser offline run).
4. **The schedule changes mid-rotation** (a sponsorship is deactivated, a weight is edited, the producer advances the heat). The player must switch on the next item without restarting from the top and without showing a removed sponsor again. *Test:* Task B1 (credits for removed slots are dropped).
5. **Only one sponsor is eligible, or none is, or no info block is eligible.** The player must never stall, never spin, and never show a blank screen. *Test:* Task B1 (degenerate inputs).

---

## File Structure

| File | Responsibility |
|---|---|
| **Part A** | |
| `supabase/migrations/0029_sponsor_packages.sql` (new) | `sponsor_packages`, `event_sponsorships`, `sponsor_creatives`; default packages per org; exclusivity trigger; reshapes `sponsors`; RLS; `sponsor-creatives` bucket |
| `supabase/seed.sql` (modify) | Seed sponsors as org-level rows plus sponsorships of the seed event |
| `src/lib/sponsors/effective.ts` + `.test.ts` (new) | `effectiveDisplay(pkg, overrides)`: the one place a sponsorship's duration and weight are resolved |
| `src/lib/db/sponsors.ts` (new) | `getEventSponsors(eventId)`: every server page that lists an event's sponsors calls this |
| `src/lib/actions/sponsors.ts` (rewrite) | Org-level sponsor CRUD, logo upload, creative upload and toggle |
| `src/lib/actions/sponsorPackages.ts` (new) | Package create, update and toggle |
| `src/lib/actions/eventSponsorships.ts` (new) | Attach a sponsor to an event with a package; overrides; toggle |
| `src/lib/constants/sponsors.ts` (delete) | Tier labels replaced by package names |
| `src/app/(app)/admin/sponsors/page.tsx` (rewrite) | Sponsors and creatives |
| `src/app/(app)/admin/sponsors/packages/page.tsx` (new) | Package editor |
| `src/app/(app)/admin/events/[eventId]/sponsors/page.tsx` (new) | Event sponsorships editor |
| Callers listed in Task A4 (modify) | Read sponsors through `getEventSponsors` |
| `scripts/sponsor-check.ts` (new), `package.json` (modify) | `pnpm db:sponsor-check` proves the trigger and RLS |
| **Part B** | |
| `supabase/migrations/0030_display_devices.sql` (new) | `display_devices`, `display_blocks`, default blocks trigger, `can_manage_event_displays()`, RLS, realtime publication |
| `src/lib/display/scheduler.ts` + `.test.ts` (new) | Pure weighted scheduler |
| `src/lib/display/eligibility.ts` + `.test.ts` (new) | `currentAndNextHeat`, `eligibleInfoSlots` (includes the staleness rule) |
| `src/lib/display/snapshot.ts` (new) | `loadDisplaySnapshot(supabase, displayId)`, shared by server page and client hook |
| `src/lib/realtime/useTableChanges.ts` (new) | Generic debounced Realtime watcher; `useRefreshOnChanges` becomes a thin wrapper |
| `src/lib/realtime/useDisplaySnapshot.ts` (new) | Client snapshot that reloads on change, keeps the last good one, and persists it (persistence added in D1) |
| `src/app/(display)/layout.tsx` (new) | Opaque black root layout, no cursor |
| `src/app/(display)/display/[eventId]/[displayId]/page.tsx` (new) | Server loads the snapshot and renders the player |
| `src/app/(display)/display/[eventId]/[displayId]/DisplayPlayer.tsx` (new) | Runs the scheduler and the timers |
| `src/components/display/*.tsx` (new) | `DisplayStage`, `SponsorAdBlock`, `CurrentHeatBlock`, `NextHeatBlock`, `LeaderboardBlock`, `StandbyScreen` |
| `src/lib/actions/displays.ts` (new) | Create a device, toggle it, edit block settings |
| `src/app/(app)/producer/events/[eventId]/displays/page.tsx` (new) + layout tab | Display management |
| **Part C** | |
| `supabase/migrations/0031_display_telemetry.sql` (new) | Device keys, `rotate_display_key`, heartbeat columns and RPC, `display_impressions`, `record_display_impressions`, `display_delivery_summary` |
| `src/lib/display/impressionQueue.ts` + `.test.ts` (new) | Persistent, deduplicating outbox |
| `src/lib/display/deviceStatus.ts` + `.test.ts` (new) | Online/stale/offline from `last_seen_at` |
| `src/lib/realtime/useDisplayTelemetry.ts` (new) | Heartbeat every 30 s and outbox flush |
| `scripts/display-check.ts` (new), `package.json` (modify) | `pnpm db:display-check` |
| **Part D** | |
| `public/display-sw.js` (new) | Service worker: network-first shell, cache-first static and creatives |
| `src/app/(display)/display/[eventId]/[displayId]/RegisterDisplayWorker.tsx` (new) | Registration and precache messages |
| `README.md` (modify) | Kiosk setup section |

---

# Part A — Sponsor model (`feat/sponsor-packages`)

### Task A1: Migration for packages, sponsorships and creatives

**Files:**
- Create: `supabase/migrations/0029_sponsor_packages.sql`
- Modify: `supabase/seed.sql:58-64`
- Create: `scripts/sponsor-check.ts`
- Modify: `package.json` (script `db:sponsor-check`)

**Interfaces:**
- Produces tables:
  - `sponsor_packages(id, organization_id, name, display_enabled, display_duration_seconds, display_weight, sort_order, active, created_at)`
  - `event_sponsorships(id, event_id, sponsor_id, package_id, category_exclusive, display_duration_override, display_weight_override, active, created_at)`
  - `sponsor_creatives(id, sponsor_id, storage_path, public_url, active, created_at)`
  - `sponsors(id, organization_id, business_name, logo_url, website, category, active, notes, created_at)`. The columns `event_id`, `tier`, `category_exclusive` and `commercial_video_url` are gone, and so is the enum `sponsor_tier`.
- Produces the storage bucket `sponsor-creatives`, with paths `{sponsor_id}/{timestamp}.{ext}`.

- [ ] **Step 1: Branch**

```bash
git checkout staging && git pull && git checkout -b feat/sponsor-packages
```

- [ ] **Step 2: Write the failing DB check** `scripts/sponsor-check.ts`. Copy the sign-in, `expect` and `service` boilerplate from `scripts/timer-check.ts:1-45`, plus the publishable-key anon client from `scripts/rls-check.ts:19`. Then:

```ts
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const EVENT_ID = "00000000-0000-0000-0000-000000000010";

async function main() {
  const admin = await signIn("admin@repone.test");
  const producer = await signIn("producer@repone.test");
  const anon = createClient(target.apiUrl, publishableKey, options);

  // Default packages exist for the seed org (trigger on organizations).
  const { data: pkgs } = await service.from("sponsor_packages").select("name").eq("organization_id", ORG_ID);
  expect("seed org has the 6 default packages", (pkgs ?? []).length === 6, pkgs);

  // Two sponsors in one category; one exclusive sponsorship blocks the other.
  const { data: s1 } = await admin.from("sponsors")
    .insert({ organization_id: ORG_ID, business_name: "Check PT 1", category: "CheckCat" }).select("id").single();
  const { data: s2 } = await admin.from("sponsors")
    .insert({ organization_id: ORG_ID, business_name: "Check PT 2", category: "checkcat" }).select("id").single();
  const { data: pkg } = await service.from("sponsor_packages").select("id")
    .eq("organization_id", ORG_ID).eq("name", "Logo Sponsor").single();
  const first = await admin.from("event_sponsorships").insert({
    event_id: EVENT_ID, sponsor_id: s1!.id, package_id: pkg!.id, category_exclusive: true,
  }).select("id").single();
  expect("manager adds an exclusive sponsorship", !first.error, first.error);
  const second = await admin.from("event_sponsorships").insert({
    event_id: EVENT_ID, sponsor_id: s2!.id, package_id: pkg!.id,
  });
  expect("same category (any case) is refused while exclusive", !!second.error?.message.includes("sponsor_category_exclusive"), second.error);

  await admin.from("event_sponsorships").update({ active: false }).eq("id", first.data!.id);
  const third = await admin.from("event_sponsorships").insert({
    event_id: EVENT_ID, sponsor_id: s2!.id, package_id: pkg!.id,
  }).select("id").single();
  expect("allowed once the exclusive one is inactive", !third.error, third.error);
  const reactivate = await admin.from("event_sponsorships").update({ active: true }).eq("id", first.data!.id);
  expect("re-activating the exclusive one is refused", !!reactivate.error, reactivate.error);

  // RLS
  const anonInactive = await anon.from("event_sponsorships").select("id").eq("id", first.data!.id);
  expect("anon can't see an inactive sponsorship", (anonInactive.data ?? []).length === 0, anonInactive.data);
  const prodInsert = await producer.from("event_sponsorships").insert({
    event_id: EVENT_ID, sponsor_id: s1!.id, package_id: pkg!.id,
  });
  expect("producer can't create sponsorships", !!prodInsert.error, prodInsert.error);
  const anonPkg = await anon.from("sponsor_packages").insert({ organization_id: ORG_ID, name: "Hack" });
  expect("anon can't create packages", !!anonPkg.error, anonPkg.error);

  // cleanup
  await service.from("sponsors").delete().in("id", [s1!.id, s2!.id]);
  if (failures) process.exit(1);
}
void main();
```

Add the script to `package.json` next to the other checks: `"db:sponsor-check": "tsx scripts/sponsor-check.ts"`.

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm db:sponsor-check`
Expected: it fails because the relation `sponsor_packages` does not exist.

- [ ] **Step 4: Write the migration** `supabase/migrations/0029_sponsor_packages.sql`:

```sql
-- ---------------------------------------------------------------------------
-- 0029 — Sponsor packages, per-event sponsorships, creatives
--
-- A sponsor is one org-level record. What it bought for an event lives on
-- event_sponsorships (package + optional overrides), so the same sponsor can
-- buy a different level at each event (docs/specs/venue-display.md "Sponsor architecture").
-- Packages replace the sponsor_tier enum and are editable per org.
-- ---------------------------------------------------------------------------

create table sponsor_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  display_enabled boolean not null default true,
  display_duration_seconds int not null default 10 check (display_duration_seconds between 3 and 60),
  display_weight int not null default 1 check (display_weight between 1 and 10),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table event_sponsorships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  package_id uuid not null references sponsor_packages(id) on delete restrict,
  category_exclusive boolean not null default false,
  display_duration_override int check (display_duration_override between 3 and 60),
  display_weight_override int check (display_weight_override between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, sponsor_id)
);
create index on event_sponsorships (event_id) where active;

create table sponsor_creatives (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on sponsor_creatives (sponsor_id) where active;

-- Sponsors become org-level. Not in production: no rows to carry over.
drop index if exists sponsors_category_exclusive_uidx;
alter table sponsors
  drop column event_id,
  drop column tier,
  drop column category_exclusive,
  drop column commercial_video_url;
drop type sponsor_tier;

-- Default packages for every organization (the former tiers).
create or replace function create_default_sponsor_packages() returns trigger as $$
begin
  insert into sponsor_packages (organization_id, name, display_duration_seconds, display_weight, sort_order) values
    (new.id, 'Logo Sponsor',        10, 1, 0),
    (new.id, 'Brand Mention',       10, 1, 1),
    (new.id, 'Commercial 30',       10, 2, 2),
    (new.id, 'Commercial 30 Plus',  15, 3, 3),
    (new.id, 'WOD Sponsor',         15, 3, 4),
    (new.id, 'Presenting Sponsor',  20, 4, 5);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger organizations_default_sponsor_packages after insert on organizations
  for each row execute function create_default_sponsor_packages();

insert into sponsor_packages (organization_id, name, display_duration_seconds, display_weight, sort_order)
select o.id, p.name, p.d, p.w, p.s from organizations o
cross join (values ('Logo Sponsor',10,1,0),('Brand Mention',10,1,1),('Commercial 30',10,2,2),
  ('Commercial 30 Plus',15,3,3),('WOD Sponsor',15,3,4),('Presenting Sponsor',20,4,5)) as p(name,d,w,s)
on conflict do nothing;

-- One exclusive sponsor per category per event. The category lives on the
-- sponsor, so a partial unique index can't express it; a trigger can.
-- Categories compare case-insensitively. The advisory lock serializes two
-- concurrent inserts for the same (event, category).
create or replace function enforce_sponsor_category_exclusive() returns trigger as $$
declare
  v_category text;
begin
  if not new.active then return new; end if;
  select lower(btrim(category)) into v_category from sponsors where id = new.sponsor_id;
  if v_category is null or v_category = '' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.event_id::text || ':' || v_category));
  if exists (
    select 1 from event_sponsorships es join sponsors s on s.id = es.sponsor_id
    where es.event_id = new.event_id and es.id <> new.id and es.active
      and lower(btrim(s.category)) = v_category
      and (es.category_exclusive or new.category_exclusive)
  ) then
    raise exception 'sponsor_category_exclusive: category "%" is exclusive for this event', v_category
      using errcode = '23505';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger event_sponsorships_category_exclusive
  before insert or update of active, category_exclusive, sponsor_id, event_id on event_sponsorships
  for each row execute function enforce_sponsor_category_exclusive();

-- RLS ----------------------------------------------------------------------
alter table sponsor_packages enable row level security;
alter table event_sponsorships enable row level security;
alter table sponsor_creatives enable row level security;

-- Public reads: the venue display and overlays run signed out.
create policy "public read active sponsor_packages" on sponsor_packages for select using (active);
create policy "public read active event_sponsorships" on event_sponsorships for select using (active);
create policy "public read active sponsor_creatives" on sponsor_creatives for select using (active);

create policy "org managers manage sponsor_packages" on sponsor_packages for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org managers manage event_sponsorships" on event_sponsorships for all
  using (exists (select 1 from events e where e.id = event_sponsorships.event_id
    and has_role(e.organization_id, array['admin','event_director']::user_role[])))
  with check (
    exists (select 1 from events e where e.id = event_sponsorships.event_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[]))
    -- sponsor and package must belong to the event's org
    and exists (select 1 from events e join sponsors s on s.organization_id = e.organization_id
      join sponsor_packages p on p.organization_id = e.organization_id
      where e.id = event_sponsorships.event_id and s.id = event_sponsorships.sponsor_id
        and p.id = event_sponsorships.package_id));

create policy "org managers manage sponsor_creatives" on sponsor_creatives for all
  using (exists (select 1 from sponsors s where s.id = sponsor_creatives.sponsor_id
    and has_role(s.organization_id, array['admin','event_director']::user_role[])))
  with check (exists (select 1 from sponsors s where s.id = sponsor_creatives.sponsor_id
    and has_role(s.organization_id, array['admin','event_director']::user_role[])));

-- Event producers read their event's sponsorships even when inactive.
create policy "event producer read event_sponsorships" on event_sponsorships for select
  using (is_event_producer(event_id));

-- Storage: sponsor-creatives ------------------------------------------------
-- 4 MB cap: Vercel Functions reject request bodies over 4.5 MB, and uploads
-- go through a Server Action.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-creatives', 'sponsor-creatives', true, 4194304,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create or replace function can_manage_sponsor_creative(p_object_name text) returns boolean as $$
  select exists (
    select 1 from sponsors s
    where s.id::text = (storage.foldername(p_object_name))[1]
      and has_role(s.organization_id, array['admin','event_director']::user_role[])
  );
$$ language sql stable security definer set search_path = public;
revoke execute on function can_manage_sponsor_creative(text) from public, anon;
grant execute on function can_manage_sponsor_creative(text) to authenticated;

drop policy if exists "public read sponsor_creatives objects" on storage.objects;
create policy "public read sponsor_creatives objects" on storage.objects for select
  using (bucket_id = 'sponsor-creatives');
drop policy if exists "manage org sponsor_creatives objects" on storage.objects;
create policy "manage org sponsor_creatives objects" on storage.objects for all to authenticated
  using (bucket_id = 'sponsor-creatives' and can_manage_sponsor_creative(name))
  with check (bucket_id = 'sponsor-creatives' and can_manage_sponsor_creative(name));
```

- [ ] **Step 5: Update the seed.** Replace `supabase/seed.sql:58-64` (the `insert into sponsors …` statement) with:

```sql
insert into sponsors (id, organization_id, business_name, category) values
  ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000001', 'Isla Physical Therapy', 'Physical Therapy'),
  ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000001', 'Borinquen Nutrition', 'Nutrition'),
  ('00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000001', 'San Juan Sports Gear', 'Retail');

insert into event_sponsorships (event_id, sponsor_id, package_id, category_exclusive)
select '00000000-0000-0000-0000-000000000010', s.id, p.id, s.exclusive
from (values
  ('00000000-0000-0000-0000-000000000081'::uuid, 'Presenting Sponsor', true),
  ('00000000-0000-0000-0000-000000000082'::uuid, 'WOD Sponsor', false),
  ('00000000-0000-0000-0000-000000000083'::uuid, 'Logo Sponsor', false)
) as s(id, package_name, exclusive)
join sponsor_packages p on p.organization_id = '00000000-0000-0000-0000-000000000001' and p.name = s.package_name;
```

Check that the ids `…081`–`…083` are unused: `grep -n "0000-00000000008" supabase/seed.sql scripts/seed-qa.sh` should print nothing beyond these lines.

- [ ] **Step 6: Reset the database and regenerate types**

Run: `pnpm db:reset && pnpm db:types && pnpm dev:accounts && pnpm db:sponsor-check`
Expected: every line prints `ok`.

- [ ] **Step 7: Commit the migration only after Task A4.** The app code won't typecheck until then, so Tasks A1–A4 land as one commit at the end of A4.

### Task A2: Effective display settings (pure)

**Files:**
- Create: `src/lib/sponsors/effective.ts`
- Test: `src/lib/sponsors/effective.test.ts`

**Interfaces:**
- Produces: `effectiveDisplay(pkg: { display_enabled: boolean; display_duration_seconds: number; display_weight: number }, s: { display_duration_override: number | null; display_weight_override: number | null }): { enabled: boolean; durationSeconds: number; weight: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { effectiveDisplay } from "./effective";

const pkg = { display_enabled: true, display_duration_seconds: 15, display_weight: 3 };

describe("effectiveDisplay", () => {
  it("uses the package defaults when there are no overrides", () => {
    expect(effectiveDisplay(pkg, { display_duration_override: null, display_weight_override: null }))
      .toEqual({ enabled: true, durationSeconds: 15, weight: 3 });
  });
  it("lets the event sponsorship override duration and weight independently", () => {
    expect(effectiveDisplay(pkg, { display_duration_override: 20, display_weight_override: null }))
      .toEqual({ enabled: true, durationSeconds: 20, weight: 3 });
    expect(effectiveDisplay(pkg, { display_duration_override: null, display_weight_override: 1 }))
      .toEqual({ enabled: true, durationSeconds: 15, weight: 1 });
  });
  it("a package without the venue display entitlement is disabled", () => {
    expect(effectiveDisplay({ ...pkg, display_enabled: false }, { display_duration_override: 20, display_weight_override: 4 }).enabled)
      .toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/lib/sponsors/effective.test.ts`
Expected: it fails because `./effective` cannot be resolved.

- [ ] **Step 3: Implement**

```ts
/**
 * What a sponsorship gets on the venue display: the package's defaults,
 * with the event sponsorship's overrides on top (docs/specs/venue-display.md "Sponsor
 * frequency engine"). The only place these are combined.
 */
export function effectiveDisplay(
  pkg: { display_enabled: boolean; display_duration_seconds: number; display_weight: number },
  s: { display_duration_override: number | null; display_weight_override: number | null },
): { enabled: boolean; durationSeconds: number; weight: number } {
  return {
    enabled: pkg.display_enabled,
    durationSeconds: s.display_duration_override ?? pkg.display_duration_seconds,
    weight: s.display_weight_override ?? pkg.display_weight,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/sponsors/effective.test.ts`
Expected: PASS.

### Task A3: Sponsor, package and sponsorship actions plus the shared query

**Files:**
- Rewrite: `src/lib/actions/sponsors.ts`
- Create: `src/lib/actions/sponsorPackages.ts`, `src/lib/actions/eventSponsorships.ts`, `src/lib/db/sponsors.ts`
- Delete: `src/lib/constants/sponsors.ts`

**Interfaces:**
- Produces in `src/lib/db/sponsors.ts`:

```ts
export interface EventSponsor {
  sponsorshipId: string;
  sponsorId: string;
  businessName: string;
  logoUrl: string | null;
  packageId: string;
  packageName: string;
  display: { enabled: boolean; durationSeconds: number; weight: number };
  creatives: Array<{ id: string; url: string }>;
}
export const EVENT_SPONSOR_SELECT: string;          // reused by Part B's snapshot loader
export function toEventSponsor(row: RawSponsorshipRow): EventSponsor;
export async function getEventSponsors(eventId: string): Promise<EventSponsor[]>; // active only, by business name
```

- Produces these actions:
  - `createSponsor(formData)`, `toggleSponsorActive(id, active)`, `uploadSponsorLogo(sponsorId, formData)`
  - `uploadSponsorCreative(sponsorId, formData)`, `toggleCreativeActive(creativeId, active)`
  - `createSponsorPackage(formData)`, `updateSponsorPackage(packageId, formData)`, `togglePackageActive(id, active)`
  - `addEventSponsorship(eventId, formData)`, `updateEventSponsorship(sponsorshipId, formData)`, `toggleEventSponsorshipActive(id, active)`

- [ ] **Step 1: Write `src/lib/db/sponsors.ts`**

```ts
import { createClient } from "@/lib/db/server";
import { effectiveDisplay } from "@/lib/sponsors/effective";

export const EVENT_SPONSOR_SELECT =
  "id, display_duration_override, display_weight_override, sponsors(id, business_name, logo_url, active, sponsor_creatives(id, public_url, active, created_at)), sponsor_packages(id, name, display_enabled, display_duration_seconds, display_weight)";

export interface RawSponsorshipRow {
  id: string;
  display_duration_override: number | null;
  display_weight_override: number | null;
  sponsors: {
    id: string; business_name: string; logo_url: string | null; active: boolean;
    sponsor_creatives: Array<{ id: string; public_url: string; active: boolean; created_at: string }>;
  } | null;
  sponsor_packages: {
    id: string; name: string; display_enabled: boolean; display_duration_seconds: number; display_weight: number;
  } | null;
}

export interface EventSponsor { /* as in Interfaces above */ }

export function toEventSponsor(r: RawSponsorshipRow): EventSponsor | null {
  if (!r.sponsors?.active || !r.sponsor_packages) return null;
  return {
    sponsorshipId: r.id,
    sponsorId: r.sponsors.id,
    businessName: r.sponsors.business_name,
    logoUrl: r.sponsors.logo_url,
    packageId: r.sponsor_packages.id,
    packageName: r.sponsor_packages.name,
    display: effectiveDisplay(r.sponsor_packages, r),
    creatives: r.sponsors.sponsor_creatives
      .filter((c) => c.active)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((c) => ({ id: c.id, url: c.public_url })),
  };
}

/** Every active sponsor of an event, the one query all sponsor lists use. */
export async function getEventSponsors(eventId: string): Promise<EventSponsor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_sponsorships")
    .select(EVENT_SPONSOR_SELECT)
    .eq("event_id", eventId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  return ((data ?? []) as unknown as RawSponsorshipRow[])
    .map(toEventSponsor)
    .filter((s): s is EventSponsor => s !== null)
    .sort((a, b) => a.businessName.localeCompare(b.businessName));
}
```

- [ ] **Step 2: Rewrite `src/lib/actions/sponsors.ts`.** Keep the style of the current file: zod form, `requireOrgManager`, `expectChanged`, `revalidatePath("/admin/sponsors")`.
  - `SponsorForm` keeps `business_name`, `category`, `website`, and adds `notes: field.optionalText({ max: 2000, label: "Notes" })`. It drops `tier`, `category_exclusive` and `event_id`.
  - `createSponsor` inserts `{ organization_id, business_name, category, website, notes }`.
  - `toggleSponsorActive` is unchanged except that the exclusive-index error branch goes away.
  - `uploadSponsorLogo(sponsorId, formData)` is a copy of `uploadAthletePhoto` (`src/lib/actions/athletes.ts:189-218`) with these changes: the bucket is `sponsor-creatives`, the path is `${sponsorId}/logo-${Date.now()}.${ext}`, ownership is checked by selecting `sponsors.id` where `organization_id = organizationId`, and it updates `sponsors.logo_url`.
  - `uploadSponsorCreative(sponsorId, formData)` is the same upload with path `${sponsorId}/${Date.now()}.${ext}`. It runs `imageUpload(formData.get("creative"))` and then rejects a file over 4 MB with `throw new ValidationError("Creative must be under 4MB — export a 2160×3840 JPEG or WebP.")`, importing `ValidationError` from `@/lib/validation/form`. It then inserts `sponsor_creatives { sponsor_id, storage_path: path, public_url }`.
  - `toggleCreativeActive(creativeId, active)` updates `sponsor_creatives.active` and uses `expectChanged`. RLS limits it to the org.

- [ ] **Step 3: Create `src/lib/actions/sponsorPackages.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";

const PackageForm = z.object({
  name: field.text("Package name", { max: 100 }),
  display_enabled: field.checkbox(),
  display_duration_seconds: field.int("Display duration", { min: 3, max: 60 }),
  display_weight: field.int("Display weight", { min: 1, max: 10 }),
  sort_order: field.int("Order", { min: 0, max: 1000 }).default(0),
});

function duplicateName(message: string) {
  return message.includes("sponsor_packages_organization_id_name_key")
    ? "A package with that name already exists."
    : message;
}

export async function createSponsorPackage(formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(PackageForm, formData);
  const supabase = await createClient();
  const { error } = await supabase.from("sponsor_packages").insert({ organization_id: organizationId, ...f });
  if (error) throw new Error(duplicateName(error.message));
  revalidatePath("/admin/sponsors/packages");
}

export async function updateSponsorPackage(packageId: string, formData: FormData) {
  const { organizationId } = await requireOrgManager();
  const f = parseForm(PackageForm, formData);
  const supabase = await createClient();
  const res = await supabase.from("sponsor_packages").update(f)
    .eq("id", packageId).eq("organization_id", organizationId).select("id");
  if (res.error) throw new Error(duplicateName(res.error.message));
  expectChanged(res, "update the package");
  revalidatePath("/admin/sponsors/packages");
}

export async function togglePackageActive(packageId: string, active: boolean) {
  const { organizationId } = await requireOrgManager();
  if (typeof active !== "boolean") throw new Error("Invalid package status.");
  const supabase = await createClient();
  expectChanged(
    await supabase.from("sponsor_packages").update({ active })
      .eq("id", packageId).eq("organization_id", organizationId).select("id"),
    "update the package",
  );
  revalidatePath("/admin/sponsors/packages");
}
```

- [ ] **Step 4: Create `src/lib/actions/eventSponsorships.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expectChanged, requireOrgManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/db/server";
import { field, parseForm } from "@/lib/validation/form";

const AddForm = z.object({
  sponsor_id: field.id("Sponsor"),
  package_id: field.id("Package"),
  category_exclusive: field.checkbox(),
});
const UpdateForm = z.object({
  package_id: field.id("Package"),
  category_exclusive: field.checkbox(),
  display_duration_override: field.optionalNumber("Duration override", { min: 3, max: 60 }),
  display_weight_override: field.optionalNumber("Weight override", { min: 1, max: 10 }),
});

function friendly(message: string) {
  if (message.includes("sponsor_category_exclusive")) {
    return "Another active sponsor holds this category exclusively at this event.";
  }
  if (message.includes("event_sponsorships_event_id_sponsor_id_key")) {
    return "That sponsor is already part of this event.";
  }
  return message;
}

async function requireOwnedEvent(eventId: string) {
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id")
    .eq("id", eventId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That event doesn't belong to your organization.");
  return supabase;
}

export async function addEventSponsorship(eventId: string, formData: FormData) {
  const supabase = await requireOwnedEvent(eventId);
  const f = parseForm(AddForm, formData);
  const { error } = await supabase.from("event_sponsorships").insert({ event_id: eventId, ...f });
  if (error) throw new Error(friendly(error.message));
  revalidatePath(`/admin/events/${eventId}/sponsors`);
}

export async function updateEventSponsorship(eventId: string, sponsorshipId: string, formData: FormData) {
  const supabase = await requireOwnedEvent(eventId);
  const f = parseForm(UpdateForm, formData);
  const res = await supabase.from("event_sponsorships").update({
    package_id: f.package_id,
    category_exclusive: f.category_exclusive,
    display_duration_override: f.display_duration_override ?? null,
    display_weight_override: f.display_weight_override ?? null,
  }).eq("id", sponsorshipId).eq("event_id", eventId).select("id");
  if (res.error) throw new Error(friendly(res.error.message));
  expectChanged(res, "update the sponsorship");
  revalidatePath(`/admin/events/${eventId}/sponsors`);
}

export async function toggleEventSponsorshipActive(eventId: string, sponsorshipId: string, active: boolean) {
  const supabase = await requireOwnedEvent(eventId);
  if (typeof active !== "boolean") throw new Error("Invalid sponsorship status.");
  const res = await supabase.from("event_sponsorships").update({ active })
    .eq("id", sponsorshipId).eq("event_id", eventId).select("id");
  if (res.error) throw new Error(friendly(res.error.message));
  expectChanged(res, "update the sponsorship");
  revalidatePath(`/admin/events/${eventId}/sponsors`);
}
```

Before writing the overrides field, check that `field.optionalNumber` returns `number | undefined` for a blank input (`src/lib/validation/form.ts:78`). If it returns something else, adjust the `?? null` mapping to match.

### Task A4: Admin UI and the callers

**Files:**
- Rewrite: `src/app/(app)/admin/sponsors/page.tsx`
- Create: `src/app/(app)/admin/sponsors/packages/page.tsx`, `src/app/(app)/admin/events/[eventId]/sponsors/page.tsx`
- Modify (sponsor reads):
  - `src/app/(app)/producer/events/[eventId]/sponsors/page.tsx:17-24`
  - `src/app/(app)/producer/events/[eventId]/production/page.tsx:17`
  - `src/app/(app)/dashboard/[floorId]/page.tsx:25`
  - `src/app/(overlay)/overlay/[floorId]/program/page.tsx:20`
  - `src/app/(overlay)/overlay/[floorId]/sponsor/page.tsx:18`
  - `src/app/(app)/producer/events/[eventId]/broadcast/page.tsx`
  - `src/app/(app)/commentator/events/[eventId]/notes/page.tsx`
- Modify: `src/lib/actions/broadcast.ts:150-177` (`setActiveSponsor`), `src/components/graphics/SponsorCard.tsx` (`tierLabel` becomes `packageName`), plus every client component that receives the sponsors prop (`ProgramOverlayClient`, `SponsorOverlayClient`, `EventProducerProduction`, `DashboardClient`).

- [ ] **Step 1: Find every remaining reference**

Run: `pnpm typecheck 2>&1 | grep -E "tier|event_id|category_exclusive|commercial_video_url|SPONSOR_TIER" ; grep -rn "SPONSOR_TIER_LABELS\|sponsor_tier\|\.tier\b" src`
Expected: the list of the call sites above. Fix each one with Steps 2–4.

- [ ] **Step 2: Server pages read through `getEventSponsors(eventId)`.** For pages keyed by floor (the overlays and the dashboard), the event id is already in `getFloorContext(floorId)`. Add `eventId` to its return value if it isn't exported yet; it is computed at `src/lib/db/queries.ts:77`. Pass the client components `EventSponsor[]` and map to the old shape where a component needs it:
  - `id` becomes `sponsorId`
  - `business_name` becomes `businessName`
  - `logo_url` becomes `logoUrl`
  - the tier label becomes `packageName`

  This also fixes the existing bug where `overlay/[floorId]/sponsor` and `program` loaded every org's active sponsors. They now load only the event's.

- [ ] **Step 3: `setActiveSponsor`.** Replace the check at `broadcast.ts:161-170` (sponsor `event_id` null or equal) with: an active `event_sponsorships` row exists for `(eventId, sponsorId)`.

```ts
const { data: sponsorship, error } = await supabase
  .from("event_sponsorships")
  .select("id")
  .eq("event_id", eventId)
  .eq("sponsor_id", sponsorId)
  .eq("active", true)
  .maybeSingle();
if (error) throw new Error(error.message);
if (!sponsorship) throw new NotAuthorizedError("That sponsor isn't part of this event.");
```

- [ ] **Step 4: Admin pages.** Follow the layout, Tailwind classes and form/pill patterns of the current `admin/sponsors/page.tsx` and `admin/events/[eventId]/staff/page.tsx`.
  - `/admin/sponsors`: a create form (name, category, website, notes) and a list. Each row has an active pill (`toggleSponsorActive`), a logo upload (`uploadSponsorLogo`), a creatives strip with upload (`uploadSponsorCreative`, accept `image/png,image/jpeg,image/webp`) and a per-creative active toggle. Add a link to "Packages". Show the guidance text "Venue display creatives: 2160×3840 (9:16), JPEG or WebP, under 4MB."
  - `/admin/sponsors/packages`: a table of the org's packages (including inactive ones), one inline form per row (`updateSponsorPackage`), a create form, and an active pill.
  - `/admin/events/[eventId]/sponsors`: a list of the event's sponsorships (including inactive ones, read with the user's client). For each one show the package select, the exclusive checkbox, the duration and weight overrides with the package defaults shown as placeholders, and an active pill. Add an "Add sponsor" form with selects of the org's active sponsors not yet attached and the org's active packages. Link to it from the admin event page's tab or nav, wherever "Staff" is linked.

- [ ] **Step 5: Run the checks**

Run: `pnpm check && pnpm db:sponsor-check && pnpm db:rls-check && pnpm db:authz-check`
Expected: all pass. `rls-check` lists tables as anon. If it enumerates public tables, add the three new tables to its expectations (public read of active rows only).

- [ ] **Step 6: Verify in the browser** with the `verify-repone` skill, as admin:
  - Create a package.
  - Attach "Borinquen Nutrition" to the seed event with a weight override.
  - Upload a creative.
  - Try to attach a second "Physical Therapy" sponsor. The exclusive error must show.
  - As producer: the Sponsors tab lists the three seed sponsors with package names, and the sponsor overlay shows the triggered one.

- [ ] **Step 7: Commit and open the PR**

```bash
git add supabase/migrations/0029_sponsor_packages.sql supabase/seed.sql scripts/sponsor-check.ts package.json \
  src/lib/sponsors src/lib/db/sponsors.ts src/lib/db/supabase.types.ts src/lib/db/queries.ts \
  src/lib/actions/sponsors.ts src/lib/actions/sponsorPackages.ts src/lib/actions/eventSponsorships.ts src/lib/actions/broadcast.ts \
  src/components/graphics/SponsorCard.tsx "src/app/(app)/admin/sponsors" "src/app/(app)/admin/events/[eventId]/sponsors" \
  "src/app/(app)/producer/events/[eventId]" "src/app/(app)/dashboard/[floorId]" "src/app/(app)/commentator/events/[eventId]/notes" \
  "src/app/(overlay)/overlay/[floorId]"
git rm src/lib/constants/sponsors.ts
git status   # make sure nothing unrelated is staged
git commit -m "A sponsor is one record that buys a package per event

The client's venue display spec needs the same sponsor to buy different
levels at different events, editable packages with display duration and
weight, per-event overrides, and image creatives. Sponsors were tied to one
event and a fixed tier enum. Exclusivity moves to a trigger because the
category lives on the sponsor. The sponsor and program overlays also stop
loading other events' sponsors.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/sponsor-packages
gh pr create --base staging --title "A sponsor is one record that buys a package per event" --body "<what, why, verification: pnpm check, db:sponsor-check, db:rls-check, db:authz-check, browser run>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Stop at the PR link.

---

# Part B — Display player (`feat/venue-display`)

### Task B1: Weighted scheduler (pure)

**Files:**
- Create: `src/lib/display/scheduler.ts`
- Test: `src/lib/display/scheduler.test.ts`

**Interfaces:**

```ts
export type InfoBlockType = "current_heat" | "next_heat" | "leaderboard";
export interface SponsorSlot { sponsorshipId: string; sponsorId: string; durationSeconds: number; weight: number }
export interface InfoSlot { type: InfoBlockType; durationSeconds: number; weight: number }
export type PlaylistItem = { kind: "sponsor"; slot: SponsorSlot } | { kind: "info"; slot: InfoSlot };
export interface SchedulerState {
  sponsorCredit: Record<string, number>;   // keyed by sponsorshipId
  infoCredit: Record<string, number>;      // keyed by InfoBlockType
  lastSponsorId: string | null;            // sponsorId of the previous item if it was a sponsor, else null
  infoSinceSponsor: number;
}
export const INITIAL_SCHEDULER_STATE: SchedulerState;
export function nextItem(
  input: { sponsors: SponsorSlot[]; info: InfoSlot[]; infoBetweenSponsors: number },
  state: SchedulerState,
): { item: PlaylistItem | null; state: SchedulerState };
```

**Algorithm:**
- **Weighted pick:** smooth weighted round-robin. On each pick, every candidate's credit goes up by its weight, the one with the highest credit wins (ties broken by key), and the winner's credit goes down by the total weight. This gives exact proportions over each cycle of `sum(weights)` picks and spreads heavy sponsors evenly. That meets "approximately N× inventory" and "no long gaps for premium advertisers".
- **Mixing:** a sponsor plays once `infoSinceSponsor >= infoBetweenSponsors` (or when no info block is eligible). Otherwise an info block plays.
- **No back-to-back advertiser:** when the previous item was a sponsor (only possible with no eligible info blocks), skip a candidate with the same `sponsorId` if another exists. It keeps its credit and catches up afterwards.
- **Removed slots:** credits for slots no longer in the input are dropped.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { INITIAL_SCHEDULER_STATE, nextItem, type InfoSlot, type PlaylistItem, type SponsorSlot } from "./scheduler";

const sponsor = (id: string, weight: number, durationSeconds = 10): SponsorSlot =>
  ({ sponsorshipId: `ss-${id}`, sponsorId: id, weight, durationSeconds });
const info = (type: InfoSlot["type"], weight = 1): InfoSlot => ({ type, weight, durationSeconds: 15 });

function run(input: Parameters<typeof nextItem>[0], n: number) {
  let state = INITIAL_SCHEDULER_STATE;
  const items: PlaylistItem[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextItem(input, state);
    if (r.item) items.push(r.item);
    state = r.state;
  }
  return items;
}
const sponsorIds = (items: PlaylistItem[]) =>
  items.flatMap((i) => (i.kind === "sponsor" ? [i.slot.sponsorId] : []));

describe("nextItem — weights", () => {
  const input = {
    sponsors: [sponsor("A", 1), sponsor("B", 1), sponsor("C", 2), sponsor("D", 4)],
    info: [info("current_heat"), info("leaderboard")],
    infoBetweenSponsors: 1,
  };

  it("delivers inventory in proportion to weight (1:1:2:4)", () => {
    const ids = sponsorIds(run(input, 160)); // 80 sponsor slots
    const count = (id: string) => ids.filter((x) => x === id).length;
    expect([count("A"), count("B"), count("C"), count("D")]).toEqual([10, 10, 20, 40]);
  });

  it("a premium sponsor never waits more than 2 sponsor slots", () => {
    const ids = sponsorIds(run(input, 160));
    let gap = 0;
    for (const id of ids) {
      gap = id === "D" ? 0 : gap + 1;
      expect(gap).toBeLessThanOrEqual(2);
    }
  });

  it("alternates sponsor and info when infoBetweenSponsors is 1", () => {
    const kinds = run(input, 10).map((i) => i.kind);
    expect(kinds).toEqual(["sponsor", "info", "sponsor", "info", "sponsor", "info", "sponsor", "info", "sponsor", "info"]);
  });

  it("plays two info blocks between sponsors when asked", () => {
    const kinds = run({ ...input, infoBetweenSponsors: 2 }, 6).map((i) => i.kind);
    expect(kinds).toEqual(["sponsor", "info", "info", "sponsor", "info", "info"]);
  });
});

describe("nextItem — degenerate inputs", () => {
  it("returns null when nothing is eligible", () => {
    expect(nextItem({ sponsors: [], info: [], infoBetweenSponsors: 1 }, INITIAL_SCHEDULER_STATE).item).toBeNull();
  });
  it("plays only info when there are no sponsors", () => {
    const items = run({ sponsors: [], info: [info("current_heat"), info("next_heat")], infoBetweenSponsors: 1 }, 4);
    expect(items.every((i) => i.kind === "info")).toBe(true);
    expect(items.map((i) => i.slot)).toHaveLength(4);
  });
  it("never shows the same advertiser twice in a row when only sponsors are eligible", () => {
    const ids = sponsorIds(run({ sponsors: [sponsor("A", 1), sponsor("D", 4)], info: [], infoBetweenSponsors: 1 }, 20));
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });
  it("repeats a single sponsor when it is the only thing to show", () => {
    const ids = sponsorIds(run({ sponsors: [sponsor("A", 3)], info: [], infoBetweenSponsors: 1 }, 3));
    expect(ids).toEqual(["A", "A", "A"]);
  });
});

describe("nextItem — schedule changes mid-rotation", () => {
  it("drops a removed sponsor immediately and forgets its credit", () => {
    const full = { sponsors: [sponsor("A", 1), sponsor("B", 4)], info: [], infoBetweenSponsors: 1 };
    let state = INITIAL_SCHEDULER_STATE;
    for (let i = 0; i < 3; i++) state = nextItem(full, state).state;
    const withoutB = { ...full, sponsors: [sponsor("A", 1)] };
    const r = nextItem(withoutB, state);
    expect(r.item).toMatchObject({ kind: "sponsor", slot: { sponsorId: "A" } });
    expect(Object.keys(r.state.sponsorCredit)).toEqual(["ss-A"]);
  });
  it("an info block that stops being eligible is skipped on the next pick", () => {
    let state = INITIAL_SCHEDULER_STATE;
    state = nextItem({ sponsors: [], info: [info("current_heat"), info("leaderboard")], infoBetweenSponsors: 1 }, state).state;
    const r = nextItem({ sponsors: [], info: [info("leaderboard")], infoBetweenSponsors: 1 }, state);
    expect(r.item).toMatchObject({ kind: "info", slot: { type: "leaderboard" } });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/lib/display/scheduler.test.ts`
Expected: it fails because the module is not found.

- [ ] **Step 3: Implement `src/lib/display/scheduler.ts`**

```ts
/**
 * The venue display's playlist scheduler (docs/specs/venue-display.md "Weighted scheduler").
 * Pure: the player keeps the state and calls nextItem() each time an item
 * ends, with whatever is eligible right now, so a heat change, a removed
 * sponsor or a new weight takes effect on the very next item.
 *
 * Sponsors and info blocks are each picked by smooth weighted round-robin:
 * exact proportions over every cycle of sum(weights) picks, with heavy
 * sponsors spread evenly instead of bunched. Credits for slots that are no
 * longer eligible are dropped.
 */

export type InfoBlockType = "current_heat" | "next_heat" | "leaderboard";
export interface SponsorSlot { sponsorshipId: string; sponsorId: string; durationSeconds: number; weight: number }
export interface InfoSlot { type: InfoBlockType; durationSeconds: number; weight: number }
export type PlaylistItem = { kind: "sponsor"; slot: SponsorSlot } | { kind: "info"; slot: InfoSlot };

export interface SchedulerState {
  sponsorCredit: Record<string, number>;
  infoCredit: Record<string, number>;
  lastSponsorId: string | null;
  infoSinceSponsor: number;
}

export const INITIAL_SCHEDULER_STATE: SchedulerState = {
  sponsorCredit: {},
  infoCredit: {},
  lastSponsorId: null,
  // Start with a sponsor: the first thing on a freshly booted screen.
  infoSinceSponsor: Number.POSITIVE_INFINITY,
};

function pickWeighted<T>(
  items: T[],
  key: (t: T) => string,
  weight: (t: T) => number,
  credit: Record<string, number>,
  skip: (t: T) => boolean,
): { picked: T; credit: Record<string, number> } {
  const next: Record<string, number> = {};
  let total = 0;
  for (const it of items) {
    const w = Math.max(1, weight(it));
    next[key(it)] = (credit[key(it)] ?? 0) + w;
    total += w;
  }
  const ranked = [...items].sort(
    (a, b) => next[key(b)] - next[key(a)] || key(a).localeCompare(key(b)),
  );
  const picked = ranked.find((it) => !skip(it)) ?? ranked[0];
  next[key(picked)] -= total;
  return { picked, credit: next };
}

export function nextItem(
  input: { sponsors: SponsorSlot[]; info: InfoSlot[]; infoBetweenSponsors: number },
  state: SchedulerState,
): { item: PlaylistItem | null; state: SchedulerState } {
  const { sponsors, info, infoBetweenSponsors } = input;
  if (sponsors.length === 0 && info.length === 0) return { item: null, state };

  const sponsorTurn =
    sponsors.length > 0 && (info.length === 0 || state.infoSinceSponsor >= infoBetweenSponsors);

  if (sponsorTurn) {
    const { picked, credit } = pickWeighted(
      sponsors,
      (s) => s.sponsorshipId,
      (s) => s.weight,
      state.sponsorCredit,
      (s) => s.sponsorId === state.lastSponsorId,
    );
    return {
      item: { kind: "sponsor", slot: picked },
      state: { ...state, sponsorCredit: credit, lastSponsorId: picked.sponsorId, infoSinceSponsor: 0 },
    };
  }

  const { picked, credit } = pickWeighted(info, (i) => i.type, (i) => i.weight, state.infoCredit, () => false);
  return {
    item: { kind: "info", slot: picked },
    state: { ...state, infoCredit: credit, lastSponsorId: null, infoSinceSponsor: state.infoSinceSponsor + 1 },
  };
}
```

The `lastSponsorId` check only applies when the previous item was a sponsor, because info items reset it to `null`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run src/lib/display/scheduler.test.ts`
Expected: PASS. If the "never more than 2 slots" gap test fails on cycle boundaries, print the sequence and fix the algorithm, not the test. With weights 1:1:2:4, smooth weighted round-robin yields `DCDABDCD` per cycle, so at most 2 other sponsors play between two D slots.

- [ ] **Step 5: Commit**

```bash
git checkout staging && git pull && git checkout -b feat/venue-display
git add src/lib/display/scheduler.ts src/lib/display/scheduler.test.ts
git commit -m "The venue display has a weighted sponsor and info scheduler

Smooth weighted round-robin gives each sponsor inventory in proportion to
its package weight, spreads premium sponsors evenly, never shows the same
advertiser back to back, and reacts to schedule changes on the next item.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B2: Eligibility (current heat, next heat, staleness)

**Files:**
- Create: `src/lib/display/eligibility.ts`
- Test: `src/lib/display/eligibility.test.ts`

**Interfaces:**
- Consumes: `FloorHeat` from `src/lib/db/queries.ts`, `compareHeatsForRunningOrder` from `src/lib/scoring/divisionOrder.ts`, and `InfoSlot` from Task B1.
- Produces:

```ts
export const STALE_INFO_MS = 5 * 60_000;
export interface BlockSetting { type: InfoBlockType; enabled: boolean; durationSeconds: number; weight: number }
export function currentAndNextHeat<H extends Pick<FloorHeat, "id" | "heatNumber" | "endedAt" | "wod" | "division">>(
  heats: H[], currentHeatId: string | null,
): { current: H | null; next: H | null };
export function eligibleInfoSlots(args: {
  blocks: BlockSetting[];
  current: { endedAt: string | null } | null;
  next: unknown | null;
  leaderboardRows: number;
  disconnectedSinceMs: number | null;
  nowMs: number;
}): InfoSlot[];
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { currentAndNextHeat, eligibleInfoSlots, STALE_INFO_MS, type BlockSetting } from "./eligibility";

const heat = (id: string, wodCreatedAt: string, heatNumber: number, endedAt: string | null = null) => ({
  id, heatNumber, endedAt,
  wod: { id: `w-${wodCreatedAt}`, name: "WOD", description: null, scoring_type: "time", time_cap_seconds: null, created_at: wodCreatedAt },
  division: { id: "d1", name: "Intermediate Female" },
});

describe("currentAndNextHeat", () => {
  const heats = [
    heat("w2h1", "2026-01-02", 1),
    heat("w1h2", "2026-01-01", 2, "x"),
    heat("w1h1", "2026-01-01", 1, "x"),
    heat("w1h3", "2026-01-01", 3),
  ];
  it("next is the first unfinished heat after the current one in running order", () => {
    const r = currentAndNextHeat(heats, "w1h2");
    expect(r.current?.id).toBe("w1h2");
    expect(r.next?.id).toBe("w1h3");
  });
  it("crosses into the next WOD", () => {
    expect(currentAndNextHeat(heats, "w1h3").next?.id).toBe("w2h1");
  });
  it("with no current heat, next is the first unfinished heat", () => {
    expect(currentAndNextHeat(heats, null)).toMatchObject({ current: null, next: { id: "w1h3" } });
  });
  it("after the last heat there is no next", () => {
    expect(currentAndNextHeat(heats, "w2h1").next).toBeNull();
  });
});

describe("eligibleInfoSlots", () => {
  const blocks: BlockSetting[] = [
    { type: "current_heat", enabled: true, durationSeconds: 15, weight: 2 },
    { type: "next_heat", enabled: true, durationSeconds: 12, weight: 1 },
    { type: "leaderboard", enabled: true, durationSeconds: 15, weight: 1 },
  ];
  const base = { blocks, current: { endedAt: null }, next: {}, leaderboardRows: 5, disconnectedSinceMs: null, nowMs: 1_000_000 };

  it("all three during an active heat with a next heat and standings", () => {
    expect(eligibleInfoSlots(base).map((s) => s.type)).toEqual(["current_heat", "next_heat", "leaderboard"]);
  });
  it("between heats: an ended current heat is not shown", () => {
    expect(eligibleInfoSlots({ ...base, current: { endedAt: "x" } }).map((s) => s.type)).toEqual(["next_heat", "leaderboard"]);
  });
  it("no standings, no leaderboard; disabled blocks are skipped", () => {
    const off = blocks.map((b) => (b.type === "next_heat" ? { ...b, enabled: false } : b));
    expect(eligibleInfoSlots({ ...base, blocks: off, leaderboardRows: 0 }).map((s) => s.type)).toEqual(["current_heat"]);
  });
  it("keeps last-known info for 5 minutes offline, then suppresses it", () => {
    const at = base.nowMs - STALE_INFO_MS + 1;
    expect(eligibleInfoSlots({ ...base, disconnectedSinceMs: at })).toHaveLength(3);
    expect(eligibleInfoSlots({ ...base, disconnectedSinceMs: base.nowMs - STALE_INFO_MS })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `pnpm vitest run src/lib/display/eligibility.test.ts`

- [ ] **Step 3: Implement**

```ts
import type { FloorHeat } from "@/lib/db/queries";
import { compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import type { InfoBlockType, InfoSlot } from "./scheduler";

/** Offline for longer than this, heat/leaderboard info is hidden (docs/specs/venue-display.md "Reliability"). */
export const STALE_INFO_MS = 5 * 60_000;

export interface BlockSetting { type: InfoBlockType; enabled: boolean; durationSeconds: number; weight: number }

type HeatLike = Pick<FloorHeat, "id" | "heatNumber" | "endedAt" | "wod" | "division">;

const orderKey = (h: HeatLike) => ({ wodCreatedAt: h.wod.created_at, divisionName: h.division.name, heatNumber: h.heatNumber });

/** The floor's live heat and the next unfinished one in running order. */
export function currentAndNextHeat<H extends HeatLike>(heats: H[], currentHeatId: string | null) {
  const ordered = [...heats].sort((a, b) => compareHeatsForRunningOrder(orderKey(a), orderKey(b)));
  const current = ordered.find((h) => h.id === currentHeatId) ?? null;
  const from = current ? ordered.indexOf(current) + 1 : 0;
  const next = ordered.slice(from).find((h) => !h.endedAt) ?? null;
  return { current, next };
}

export function eligibleInfoSlots(args: {
  blocks: BlockSetting[];
  current: { endedAt: string | null } | null;
  next: unknown | null;
  leaderboardRows: number;
  disconnectedSinceMs: number | null;
  nowMs: number;
}): InfoSlot[] {
  const { blocks, current, next, leaderboardRows, disconnectedSinceMs, nowMs } = args;
  if (disconnectedSinceMs !== null && nowMs - disconnectedSinceMs >= STALE_INFO_MS) return [];
  const has: Record<InfoBlockType, boolean> = {
    current_heat: !!current && !current.endedAt,
    next_heat: !!next,
    leaderboard: leaderboardRows > 0,
  };
  return blocks
    .filter((b) => b.enabled && has[b.type])
    .map(({ type, durationSeconds, weight }) => ({ type, durationSeconds, weight }));
}
```

`blocks` order comes from the DB. The snapshot loader in Task B4 orders them `current_heat`, `next_heat`, `leaderboard` so this output is stable.

- [ ] **Step 4: Run the tests and confirm they pass.** Then commit: `git add src/lib/display/eligibility.*` with the message "The venue display knows which info blocks apply right now".

### Task B3: Display devices migration

**Files:**
- Create: `supabase/migrations/0030_display_devices.sql`
- Modify: `src/lib/realtime/useRefreshOnChanges.ts` (only the `TableWatch` type moves to Task B4)

**Interfaces:**
- Produces: `display_devices(id, event_id, floor_id, name, enabled, sponsors_enabled, info_blocks_between_sponsors, created_at)`, `display_blocks(display_id, block_type, enabled, duration_seconds, weight)`, and the function `can_manage_event_displays(uuid) → boolean`.

- [ ] **Step 1: Write the migration**

```sql
-- ---------------------------------------------------------------------------
-- 0030 — Venue display devices (docs/specs/venue-display.md "Multiple displays", MVP: one)
--
-- A display device is one physical screen, bound to an event and the floor
-- whose broadcast_state it follows. display_blocks are its info-block
-- settings; sponsor frequency comes from event_sponsorships (0029).
-- ---------------------------------------------------------------------------

create type display_block_type as enum ('current_heat', 'next_heat', 'leaderboard');

create table display_devices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  enabled boolean not null default true,
  sponsors_enabled boolean not null default true,
  info_blocks_between_sponsors int not null default 1 check (info_blocks_between_sponsors between 1 and 5),
  created_at timestamptz not null default now()
);
create index on display_devices (event_id);

-- The floor must belong to the event.
create or replace function check_display_floor() returns trigger as $$
begin
  if not exists (select 1 from floors f join venues v on v.id = f.venue_id
                 where f.id = new.floor_id and v.event_id = new.event_id) then
    raise exception 'display_floor_event: floor % is not part of event %', new.floor_id, new.event_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger display_devices_floor_check before insert or update of floor_id, event_id on display_devices
  for each row execute function check_display_floor();

create table display_blocks (
  display_id uuid not null references display_devices(id) on delete cascade,
  block_type display_block_type not null,
  enabled boolean not null default true,
  duration_seconds int not null check (duration_seconds between 5 and 60),
  weight int not null default 1 check (weight between 1 and 10),
  primary key (display_id, block_type)
);

create or replace function create_default_display_blocks() returns trigger as $$
begin
  insert into display_blocks (display_id, block_type, duration_seconds, weight) values
    (new.id, 'current_heat', 15, 2),
    (new.id, 'next_heat', 12, 1),
    (new.id, 'leaderboard', 15, 2);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger display_devices_default_blocks after insert on display_devices
  for each row execute function create_default_display_blocks();

-- Org managers and the event's assigned producers manage displays.
create or replace function can_manage_event_displays(p_event_id uuid) returns boolean as $$
  select exists (
    select 1 from events e where e.id = p_event_id
      and (has_role(e.organization_id, array['admin','event_director','production_director']::user_role[])
           or is_event_producer(e.id))
  );
$$ language sql stable security definer set search_path = public;
revoke execute on function can_manage_event_displays(uuid) from public, anon;
grant execute on function can_manage_event_displays(uuid) to authenticated;

alter table display_devices enable row level security;
alter table display_blocks enable row level security;

-- The kiosk is signed out; device rows carry no secrets (keys live in 0031).
create policy "public read display_devices" on display_devices for select using (true);
create policy "public read display_blocks" on display_blocks for select using (true);

create policy "event displays managers manage display_devices" on display_devices for all
  using (can_manage_event_displays(event_id)) with check (can_manage_event_displays(event_id));
create policy "event displays managers manage display_blocks" on display_blocks for all
  using (exists (select 1 from display_devices d where d.id = display_blocks.display_id
    and can_manage_event_displays(d.event_id)))
  with check (exists (select 1 from display_devices d where d.id = display_blocks.display_id
    and can_manage_event_displays(d.event_id)));

-- The player reloads its snapshot when any of these change.
alter publication supabase_realtime add table display_devices;
alter publication supabase_realtime add table display_blocks;
alter publication supabase_realtime add table event_sponsorships;
alter publication supabase_realtime add table sponsor_creatives;
alter publication supabase_realtime add table sponsor_packages;
alter publication supabase_realtime add table sponsors;
```

- [ ] **Step 2: Reset the database and regenerate types.** Run: `pnpm db:reset && pnpm db:types && pnpm dev:accounts`. Expected: clean.

- [ ] **Step 3: Seed one display** so local development and `verify-repone` have one. Append to `supabase/seed.sql`:

```sql
insert into display_devices (id, event_id, floor_id, name) values
  ('00000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000030', 'Entrance Display');
```

Run `pnpm db:reset` again.

### Task B4: Snapshot loader and a generic Realtime watcher

**Files:**
- Create: `src/lib/display/snapshot.ts`, `src/lib/realtime/useTableChanges.ts`, `src/lib/realtime/useDisplaySnapshot.ts`
- Modify: `src/lib/realtime/useRefreshOnChanges.ts` (becomes a wrapper)

**Interfaces:**

```ts
// snapshot.ts
export interface DisplaySnapshot {
  loadedAt: number;
  device: { id: string; eventId: string; floorId: string; name: string; enabled: boolean;
            sponsorsEnabled: boolean; infoBlocksBetweenSponsors: number };
  blocks: BlockSetting[];                   // ordered current_heat, next_heat, leaderboard
  sponsors: EventSponsor[];                 // display.enabled only
  heats: FloorHeat[];
  eventName: string;
}
export async function loadDisplaySnapshot(supabase: SupabaseClient<Database>, displayId: string): Promise<DisplaySnapshot | null>;

// useTableChanges.ts
export interface TableWatch { table: string; filter?: string }
export function useTableChanges(watches: TableWatch[], onChange: () => void, debounceMs?: number): void;

// useDisplaySnapshot.ts
export function useDisplaySnapshot(initial: DisplaySnapshot): { snapshot: DisplaySnapshot };
```

- [ ] **Step 1: `useTableChanges`.** Move the body of `useRefreshOnChanges` into `useTableChanges(watches, onChange, debounceMs = 400)`. Keep the latest `onChange` in a ref so the channel isn't re-created on every render. Widen `TableWatch.table` to `string` and keep the old union as `RefreshTable` in `useRefreshOnChanges.ts`. Then:

```ts
export function useRefreshOnChanges(watches: TableWatch[], debounceMs = 400) {
  const router = useRouter();
  useTableChanges(watches, () => router.refresh(), debounceMs);
}
```

Run `pnpm check`. The overlays must behave the same, since this is a refactor only.

- [ ] **Step 2: `loadDisplaySnapshot`.** It takes a client so the server page (with `await createClient()` from `@/lib/db/server`) and the browser (with `createClient()` from `@/lib/db/client`) share it.
  1. Read `display_devices` by id. Return `null` if it is missing.
  2. In parallel, read:
     - `display_blocks` for the display, sorted by the enum order (`.order("block_type")`, since enum order is the declaration order)
     - `event_sponsorships` with `EVENT_SPONSOR_SELECT` (from `src/lib/db/sponsors.ts`), active and for the device's event, mapped through `toEventSponsor`, keeping `display.enabled` ones
     - the floor's heats with the same select string as `getFloorContext` (`src/lib/db/queries.ts:80-85`)
     - `events.name`
  3. Map heats with the same mapping as `getFloorContext`. To share it, extract that mapping in `queries.ts` into an exported `toFloorHeats(rows: RawHeatRow[]): FloorHeat[]` and use it in both places.
  4. Return the snapshot with `loadedAt: Date.now()`.

- [ ] **Step 3: `useDisplaySnapshot(initial)`.**
  - Hold the snapshot in state.
  - Use `useTableChanges` with:
    - `display_devices` (`id=eq.<id>`)
    - `display_blocks` (`display_id=eq.<id>`)
    - `event_sponsorships` (`event_id=eq.<eventId>`)
    - `sponsor_creatives` and `sponsors` (unfiltered; the reload is debounced)
    - `sponsor_packages` (unfiltered)
    - `...floorWatches(floorId, heatIds)` from `src/lib/realtime/floorWatches.ts`
  - The reload calls `loadDisplaySnapshot(createClient(), id)`. On error, or a `null` result, keep the current snapshot (the last good one wins). Also reload on `window` `online`.

### Task B5: Display route, player and blocks

**Files:**
- Create:
  - `src/app/(display)/layout.tsx`
  - `src/app/(display)/display/[eventId]/[displayId]/page.tsx`
  - `src/app/(display)/display/[eventId]/[displayId]/DisplayPlayer.tsx`
  - `src/components/display/DisplayStage.tsx`, `SponsorAdBlock.tsx`, `CurrentHeatBlock.tsx`, `NextHeatBlock.tsx`, `LeaderboardBlock.tsx`, `StandbyScreen.tsx`

**Interfaces:**
- Consumes: Tasks B1, B2 and B4; `useBroadcastState` (`src/lib/realtime/useBroadcastState.ts`) and `useStandings` (`src/lib/realtime/useStandings.ts`).
- Produces: `DisplayPlayer` props `{ initial: DisplaySnapshot; initialBroadcastState: BroadcastStateRow | null; deviceKey: string | null }`. Part C uses `deviceKey`. It also calls an optional hook point `onItemEnd(item, playedMs, completed)`, a no-op until Part C.

- [ ] **Step 1: Layout.** It mirrors `src/app/(overlay)/layout.tsx` but is opaque:

```tsx
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = { title: "RepOne Venue Display" };

// Separate root layout for the venue TV: opaque black, no cursor, no
// scrolling. Runs signed out in a kiosk browser (see README "Venue display").
export default function DisplayRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full w-full cursor-none overflow-hidden bg-black">{children}</body>
    </html>
  );
}
```

Check the language of the existing overlay copy. If it's English, keep `lang="en"`.

- [ ] **Step 2: Page.**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { loadDisplaySnapshot } from "@/lib/display/snapshot";
import { DisplayPlayer } from "./DisplayPlayer";

export default async function VenueDisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; displayId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const [{ eventId, displayId }, { key }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const snapshot = await loadDisplaySnapshot(supabase, displayId);
  if (!snapshot || snapshot.device.eventId !== eventId) notFound();
  const { data: broadcastState } = await supabase
    .from("broadcast_state").select("*").eq("floor_id", snapshot.device.floorId).maybeSingle();
  return <DisplayPlayer initial={snapshot} initialBroadcastState={broadcastState ?? null} deviceKey={key ?? null} />;
}
```

Check Next 16's typing for `searchParams` against `node_modules/next/dist/docs/01-app` (search for "searchParams") before writing this. The pattern above follows the async `params` already used in the overlays.

- [ ] **Step 3: `DisplayStage`.** A fixed 1080 × 1920 box, scaled with `transform: scale(s)` where `s = Math.min(innerWidth / 1080, innerHeight / 1920)`. It recomputes on `resize` and is centered. Children are laid out in design pixels.

- [ ] **Step 4: `DisplayPlayer`.** It owns the clock.
  1. `const { snapshot } = useDisplaySnapshot(initial)`.
  2. `const { state: bs, connected } = useBroadcastState(device.floorId, initialBroadcastState)`.
  3. Track `disconnectedSinceMs`: set it to `Date.now()` when `connected` turns false (only after it was true once), and back to `null` when it turns true.
  4. `const { current, next } = currentAndNextHeat(snapshot.heats, bs?.current_heat_id ?? null)`.
  5. `const standings = useStandings((current ?? next)?.division.id ?? null)`.
  6. A `schedulerRef` holds `SchedulerState`, and `[item, setItem]` holds the item on screen. `advance()` computes:
     - `sponsors = device.sponsorsEnabled ? snapshot.sponsors.map(s => ({ sponsorshipId: s.sponsorshipId, sponsorId: s.sponsorId, durationSeconds: s.display.durationSeconds, weight: s.display.weight })) : []`
     - `info = eligibleInfoSlots({ blocks: snapshot.blocks, current, next, leaderboardRows: standings.length, disconnectedSinceMs, nowMs: Date.now() })`
     - `nextItem({ sponsors, info, infoBetweenSponsors: device.infoBlocksBetweenSponsors }, schedulerRef.current)`

     It stores the new state and sets the item. If the item is `null`, it shows `StandbyScreen` and retries in 5 s.
  7. A `useEffect` keyed on the item sets `setTimeout(advance, item.slot.durationSeconds * 1000)`. Use a ref for the latest inputs so the timer callback reads fresh data without resetting the timer on every Realtime change.
  8. If `!device.enabled`, render `StandbyScreen` and pause the rotation, so the next `enabled` change restarts it via `advance()`.
  9. Render inside `DisplayStage`:
     - sponsor → `SponsorAdBlock` with the matching `EventSponsor`
     - `current_heat` → `CurrentHeatBlock heat={current}`
     - `next_heat` → `NextHeatBlock heat={next}`
     - `leaderboard` → `LeaderboardBlock rows={standings.slice(0, 10)} title={division name}`
  10. A fade transition of 300–400 ms between items, keyed on an item counter.

- [ ] **Step 5: Blocks.** Load the `impeccable` skill first. These are 9:16, read from 5–15 m away, with the RepOne palette (`bg-repone-*` / `text-repone-*` tokens already used in `src/components/graphics/`). Minimum text size is 48 design-px for names and 96 for headings.
  - `SponsorAdBlock`: the first creative full-bleed (`<img crossOrigin="anonymous" className="h-full w-full object-cover">`). Otherwise, a logo on white with the business name. It reports `onReady()` after the image `load`, or immediately for the text fallback. Part C uses that for "delivered".
  - `CurrentHeatBlock`: "NOW ON THE FLOOR", WOD name, "HEAT n of m", division, and one row per lane (lane number, athlete, affiliate).
  - `NextHeatBlock`: "UP NEXT", WOD, heat, division and lanes.
  - `LeaderboardBlock`: "LIVE LEADERBOARD · <division>" with the top 10 rows (placement, name, points).
  - `StandbyScreen`: the RepOne logo or wordmark on black.

- [ ] **Step 6: Run `pnpm check`.**

### Task B6: Producer display management

**Files:**
- Create: `src/lib/actions/displays.ts`, `src/app/(app)/producer/events/[eventId]/displays/page.tsx`
- Modify: `src/app/(app)/producer/events/[eventId]/layout.tsx:7-15` (add the tab `{ slug: "displays", label: "Displays" }` after Sponsors)

**Interfaces:**
- Produces: `createDisplay(eventId, formData)` (`name`, `floor_id`), `toggleDisplayEnabled(eventId, displayId, enabled)`, `updateDisplaySettings(eventId, displayId, formData)` (`sponsors_enabled`, `info_blocks_between_sponsors`, and for each block type `<type>_enabled`, `<type>_duration`, `<type>_weight`).

- [ ] **Step 1: Actions.** Every action starts with `await requireEventAccess(eventId, ["producer"])` and filters writes with `.eq("event_id", eventId)`.
  - `createDisplay` maps a `display_floor_event` error to "That floor isn't part of this event."
  - `updateDisplaySettings` updates `display_devices`, then upserts the three `display_blocks` rows with `onConflict: "display_id,block_type"`. The policy has `for all`, so the select needed for upsert is allowed.
  - Every action ends with `revalidatePath(\`/producer/events/${eventId}/displays\`)`.

- [ ] **Step 2: Page.** It lists the event's displays. Each card shows:
  - the name and floor
  - an enabled pill
  - the player URL `/display/{eventId}/{id}` with a copy button (Part C appends `?key=…`)
  - an "Open" link (new tab)
  - the settings form (sponsors on/off, info blocks between sponsors, and enabled/duration/weight per block)

  Below the list is a create form with name and a floor select from the event's floors.

- [ ] **Step 3: Verify in the browser** with the `verify-repone` skill:
  - Open `/display/00000000-0000-0000-0000-000000000010/00000000-0000-0000-0000-000000000090` at a 1080 × 1920 viewport (`mcp__chrome-devtools__resize_page`). Sponsors and info blocks alternate.
  - As producer in a second tab: set the current heat. Within one item the next Current Heat block shows the new heat.
  - Enter a result as scorekeeper. The leaderboard block updates without a reload.
  - Deactivate a sponsorship as admin. It stops appearing.
  - Toggle the display off. Standby shows. Toggle it on and rotation resumes.
  - Take screenshots at 1080 × 1920 and 2160 × 3840.

- [ ] **Step 4: Commit and open the PR.** Stage the files of Tasks B2–B6 by name, including the regenerated `src/lib/db/supabase.types.ts`, `seed.sql`, and `queries.ts`. Title: "A vertical venue display rotates sponsors with the live heat and leaderboard". The body covers what, why (docs/specs/venue-display.md MVP), the decisions 1–2 from the top of this plan, and the verification.

---

# Part C — Device key, heartbeat, impressions (`feat/display-impressions`)

### Task C1: Telemetry migration and its DB check

**Files:**
- Create: `supabase/migrations/0031_display_telemetry.sql`, `scripts/display-check.ts`
- Modify: `package.json` (add `"db:display-check": "tsx scripts/display-check.ts"`)

**Interfaces:**
- Produces these RPCs:
  - `rotate_display_key(p_display_id uuid) → text` (authenticated managers only; returns the new plaintext key once)
  - `display_heartbeat(p_display_id uuid, p_key text, p_now_playing text, p_width int, p_height int) → boolean` (anon allowed)
  - `record_display_impressions(p_display_id uuid, p_key text, p_items jsonb) → int` (anon allowed; returns rows inserted)
  - `display_delivery_summary(p_event_id uuid) → table(display_id uuid, sponsorship_id uuid, delivered bigint, partial bigint)` (security invoker)
- Produces the columns `display_devices.last_seen_at`, `now_playing`, `screen_width`, `screen_height`.
- `p_items` element: `{ "id": uuid, "sponsorshipId": uuid, "creativeId": uuid|null, "sessionId": uuid, "startedAt": iso string, "durationMs": int, "completed": bool }`.

- [ ] **Step 1: Write the failing check `scripts/display-check.ts`.** Use the same boilerplate as `sponsor-check.ts`, with `DISPLAY_ID = "…0090"` and `EVENT_ID = "…0010"`.

```ts
const producer = await signIn("producer@repone.test");
const athlete = await signIn("athlete@repone.test");
const anon = createClient(target.apiUrl, publishableKey, options);

const { data: key, error: keyErr } = await producer.rpc("rotate_display_key", { p_display_id: DISPLAY_ID });
expect("producer rotates the display key", !keyErr && typeof key === "string" && key.length >= 40, keyErr);
const denied = await athlete.rpc("rotate_display_key", { p_display_id: DISPLAY_ID });
expect("athlete can't rotate a key", !!denied.error, denied.data);
const anonRotate = await anon.rpc("rotate_display_key", { p_display_id: DISPLAY_ID });
expect("anon can't rotate a key", !!anonRotate.error, anonRotate.data);
const keysRead = await producer.from("display_device_keys").select("*");
expect("nobody reads key hashes", !!keysRead.error || (keysRead.data ?? []).length === 0, keysRead.data);

const hb = await anon.rpc("display_heartbeat", { p_display_id: DISPLAY_ID, p_key: key!, p_now_playing: "Isla Physical Therapy", p_width: 2160, p_height: 3840 });
expect("anon heartbeat with the key is accepted", hb.data === true, hb);
const hbBad = await anon.rpc("display_heartbeat", { p_display_id: DISPLAY_ID, p_key: "nope", p_now_playing: "x", p_width: 1, p_height: 1 });
expect("heartbeat with a wrong key is rejected", hbBad.data === false, hbBad);

const { data: ss } = await service.from("event_sponsorships").select("id").eq("event_id", EVENT_ID).limit(1).single();
const item = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(), sponsorshipId: ss!.id, creativeId: null, sessionId: crypto.randomUUID(),
  startedAt: new Date(Date.now() - 20_000).toISOString(), durationMs: 10_000, completed: true, ...over,
});
const one = item();
const ins = await anon.rpc("record_display_impressions", { p_display_id: DISPLAY_ID, p_key: key!, p_items: [one, one] });
expect("one impression stored even if sent twice in a batch", ins.data === 1, ins);
const again = await anon.rpc("record_display_impressions", { p_display_id: DISPLAY_ID, p_key: key!, p_items: [one] });
expect("a retried impression is not counted twice", again.data === 0, again);
const bad = await anon.rpc("record_display_impressions", { p_display_id: DISPLAY_ID, p_key: key!, p_items: [
  item({ durationMs: 500 }), item({ startedAt: "2020-01-01T00:00:00Z" }), item({ sponsorshipId: crypto.randomUUID() }),
] });
expect("too short, too old and foreign sponsorships are dropped", bad.data === 0, bad);
const wrongKey = await anon.rpc("record_display_impressions", { p_display_id: DISPLAY_ID, p_key: "nope", p_items: [item()] });
expect("impressions with a wrong key are rejected", !!wrongKey.error, wrongKey);
const direct = await anon.from("display_impressions").insert({});
expect("no direct inserts into display_impressions", !!direct.error, direct);

const { data: key2 } = await producer.rpc("rotate_display_key", { p_display_id: DISPLAY_ID });
const old = await anon.rpc("display_heartbeat", { p_display_id: DISPLAY_ID, p_key: key!, p_now_playing: "x", p_width: 1, p_height: 1 });
expect("the old key stops working after rotation", old.data === false, old);
expect("the new key works", (await anon.rpc("display_heartbeat", { p_display_id: DISPLAY_ID, p_key: key2!, p_now_playing: "x", p_width: 1, p_height: 1 })).data === true);

const summary = await producer.rpc("display_delivery_summary", { p_event_id: EVENT_ID });
expect("producer sees the delivery summary", !summary.error && (summary.data ?? []).some((r: { delivered: number }) => Number(r.delivered) >= 1), summary);
const anonSummary = await anon.rpc("display_delivery_summary", { p_event_id: EVENT_ID });
expect("anon sees no delivery data", (anonSummary.data ?? []).length === 0, anonSummary.data);
```

Run: `pnpm db:display-check`. Expected: it fails because the function `rotate_display_key` does not exist.

- [ ] **Step 2: Write the migration**

```sql
-- ---------------------------------------------------------------------------
-- 0031 — Venue display telemetry: device keys, heartbeat, impressions
--
-- The kiosk runs signed out. It proves it is the display by a per-device key
-- in its URL; only a sha256 of the key is stored, in a table no role can
-- read. Heartbeats and impressions go through security definer RPCs that
-- check the key, so the app needs no service key. "Scheduled ≠ Delivered"
-- (docs/specs/venue-display.md): the player reports each sponsor play with completed = true
-- only when it was on screen, visible and loaded, for its full duration.
-- ---------------------------------------------------------------------------

alter table display_devices
  add column last_seen_at timestamptz,
  add column now_playing text,
  add column screen_width int,
  add column screen_height int;

create table display_device_keys (
  display_id uuid primary key references display_devices(id) on delete cascade,
  key_hash bytea not null,
  rotated_at timestamptz not null default now()
);
alter table display_device_keys enable row level security;
-- No policies: only the security definer functions below touch it.

create or replace function display_key_ok(p_display_id uuid, p_key text) returns boolean as $$
  select exists (select 1 from display_device_keys
                 where display_id = p_display_id and key_hash = extensions.digest(coalesce(p_key, ''), 'sha256'));
$$ language sql stable security definer set search_path = public, extensions;
revoke execute on function display_key_ok(uuid, text) from public, anon, authenticated;

create or replace function rotate_display_key(p_display_id uuid) returns text as $$
declare
  v_event uuid;
  v_key text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select event_id into v_event from display_devices where id = p_display_id;
  if v_event is null or not can_manage_event_displays(v_event) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into display_device_keys (display_id, key_hash) values (p_display_id, extensions.digest(v_key, 'sha256'))
  on conflict (display_id) do update set key_hash = excluded.key_hash, rotated_at = now();
  return v_key;
end;
$$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function rotate_display_key(uuid) from public, anon;
grant execute on function rotate_display_key(uuid) to authenticated;

create or replace function display_heartbeat(
  p_display_id uuid, p_key text, p_now_playing text, p_width int, p_height int
) returns boolean as $$
begin
  if not display_key_ok(p_display_id, p_key) then return false; end if;
  update display_devices set
    last_seen_at = now(),
    now_playing = left(p_now_playing, 200),
    screen_width = case when p_width between 1 and 10000 then p_width end,
    screen_height = case when p_height between 1 and 10000 then p_height end
  where id = p_display_id;
  return true;
end;
$$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function display_heartbeat(uuid, text, text, int, int) from public;
grant execute on function display_heartbeat(uuid, text, text, int, int) to anon, authenticated;

create table display_impressions (
  id uuid primary key,                       -- generated by the player: retries are idempotent
  display_id uuid not null references display_devices(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  sponsorship_id uuid not null references event_sponsorships(id) on delete cascade,
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  package_id uuid not null references sponsor_packages(id),
  creative_id uuid references sponsor_creatives(id) on delete set null,
  content_type text not null default 'sponsor_ad' check (content_type in ('sponsor_ad')),
  playback_session uuid not null,
  started_at timestamptz not null,
  duration_ms int not null,
  completed boolean not null,
  received_at timestamptz not null default now()
);
create index on display_impressions (event_id, sponsorship_id);
alter table display_impressions enable row level security;
create policy "event displays managers read display_impressions" on display_impressions for select
  using (can_manage_event_displays(event_id));

create or replace function record_display_impressions(p_display_id uuid, p_key text, p_items jsonb)
returns int as $$
declare
  v_event uuid;
  v_count int;
begin
  if not display_key_ok(p_display_id, p_key) then
    raise exception 'invalid display key' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'items must be an array of at most 200';
  end if;
  select event_id into v_event from display_devices where id = p_display_id;

  insert into display_impressions (id, display_id, event_id, sponsorship_id, sponsor_id, package_id,
    creative_id, playback_session, started_at, duration_ms, completed)
  select distinct on (i.id) i.id, p_display_id, v_event, es.id, es.sponsor_id, es.package_id,
    c.id, i."sessionId", i."startedAt", i."durationMs", coalesce(i.completed, false)
  from jsonb_to_recordset(p_items) as i(id uuid, "sponsorshipId" uuid, "creativeId" uuid,
    "sessionId" uuid, "startedAt" timestamptz, "durationMs" int, completed boolean)
  join event_sponsorships es on es.id = i."sponsorshipId" and es.event_id = v_event
  left join sponsor_creatives c on c.id = i."creativeId" and c.sponsor_id = es.sponsor_id
  where i.id is not null and i."sessionId" is not null
    and i."durationMs" between 1000 and 120000
    and i."startedAt" between now() - interval '48 hours' and now() + interval '5 minutes'
  on conflict (id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function record_display_impressions(uuid, text, jsonb) from public;
grant execute on function record_display_impressions(uuid, text, jsonb) to anon, authenticated;

-- Basic delivery report (RLS applies: managers/producers of the event only).
create or replace function display_delivery_summary(p_event_id uuid)
returns table (display_id uuid, sponsorship_id uuid, delivered bigint, partial bigint) as $$
  select display_id, sponsorship_id,
         count(*) filter (where completed), count(*) filter (where not completed)
  from display_impressions where event_id = p_event_id
  group by display_id, sponsorship_id;
$$ language sql stable security invoker set search_path = public;
grant execute on function display_delivery_summary(uuid) to authenticated;
```

- [ ] **Step 3: Run it**

Run: `pnpm db:reset && pnpm db:types && pnpm dev:accounts && pnpm db:display-check`
Expected: every line prints `ok`. If `extensions.digest` is missing, run `select extname, extnamespace::regnamespace from pg_extension where extname = 'pgcrypto'` and use that schema.

### Task C2: Device status (pure)

**Files:** Create `src/lib/display/deviceStatus.ts` and `src/lib/display/deviceStatus.test.ts`.

**Interfaces:** `deviceStatus(lastSeenAt: string | null, nowMs: number): "online" | "stale" | "offline" | "never"`, with `HEARTBEAT_MS = 30_000`.

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { deviceStatus, HEARTBEAT_MS } from "./deviceStatus";

describe("deviceStatus", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("never seen", () => expect(deviceStatus(null, now)).toBe("never"));
  it("online within two heartbeats", () => expect(deviceStatus(ago(2 * HEARTBEAT_MS), now)).toBe("online"));
  it("stale after two missed heartbeats", () => expect(deviceStatus(ago(2 * HEARTBEAT_MS + 1), now)).toBe("stale"));
  it("offline after five minutes", () => expect(deviceStatus(ago(5 * 60_000 + 1), now)).toBe("offline"));
});
```

- [ ] **Step 2: Implement**

```ts
export const HEARTBEAT_MS = 30_000;

/** How the producer's Displays page labels a screen from its last heartbeat. */
export function deviceStatus(lastSeenAt: string | null, nowMs: number) {
  if (!lastSeenAt) return "never" as const;
  const age = nowMs - Date.parse(lastSeenAt);
  if (age <= 2 * HEARTBEAT_MS) return "online" as const;
  if (age <= 5 * 60_000) return "stale" as const;
  return "offline" as const;
}
```

Run: `pnpm vitest run src/lib/display/deviceStatus.test.ts`. Expected: PASS.

### Task C3: Impression outbox (pure, persistent)

**Files:** Create `src/lib/display/impressionQueue.ts` and `src/lib/display/impressionQueue.test.ts`.

**Interfaces:**

```ts
export interface Impression { id: string; sponsorshipId: string; creativeId: string | null; sessionId: string;
  startedAt: string; durationMs: number; completed: boolean }
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
export const MAX_QUEUED = 5000;
export function createImpressionQueue(store: KeyValueStore | null, displayId: string): {
  push(i: Impression): void;
  peek(max: number): Impression[];
  ack(ids: string[]): void;
  size(): number;
};
```

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { createImpressionQueue, MAX_QUEUED, type Impression } from "./impressionQueue";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const imp = (id: string): Impression => ({ id, sponsorshipId: "s", creativeId: null, sessionId: "x", startedAt: "2026-10-02T12:00:00Z", durationMs: 10_000, completed: true });

describe("impression queue", () => {
  it("survives a reload (same store, same display)", () => {
    const store = memory();
    createImpressionQueue(store, "d1").push(imp("a"));
    expect(createImpressionQueue(store, "d1").peek(10).map((i) => i.id)).toEqual(["a"]);
  });
  it("ack removes only what the server confirmed", () => {
    const q = createImpressionQueue(memory(), "d1");
    q.push(imp("a")); q.push(imp("b"));
    q.ack(["a"]);
    expect(q.peek(10).map((i) => i.id)).toEqual(["b"]);
  });
  it("pushing the same id twice keeps one", () => {
    const q = createImpressionQueue(memory(), "d1");
    q.push(imp("a")); q.push(imp("a"));
    expect(q.size()).toBe(1);
  });
  it("caps its size by dropping the oldest", () => {
    const q = createImpressionQueue(memory(), "d1");
    for (let i = 0; i <= MAX_QUEUED; i++) q.push(imp(String(i)));
    expect(q.size()).toBe(MAX_QUEUED);
    expect(q.peek(1)[0].id).toBe("1");
  });
  it("works without storage (private mode) and with a throwing store", () => {
    const q = createImpressionQueue(null, "d1");
    q.push(imp("a"));
    expect(q.size()).toBe(1);
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const q2 = createImpressionQueue(throwing, "d1");
    q2.push(imp("b"));
    expect(q2.peek(5).map((i) => i.id)).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Implement.** Keep an in-memory array as the source of truth. Load it once with `try { JSON.parse(store.getItem(k)) } catch { [] }` under the key `repone.display.${displayId}.impressions`, and write it back in `try/catch` after every change. `push` ignores ids already present and splices from the front past `MAX_QUEUED`. `ack` filters by a `Set`.

Run: `pnpm vitest run src/lib/display/impressionQueue.test.ts`. Expected: PASS.

### Task C4: Wire telemetry into the player and the producer page

**Files:**
- Create: `src/lib/realtime/useDisplayTelemetry.ts`
- Modify: `DisplayPlayer.tsx`, `src/components/display/SponsorAdBlock.tsx`, `src/lib/actions/displays.ts`, `src/app/(app)/producer/events/[eventId]/displays/page.tsx`, `src/app/(app)/admin/events/[eventId]/sponsors/page.tsx`

**Interfaces:**
- Produces: `useDisplayTelemetry({ displayId, deviceKey, nowPlaying }): { record(i: Omit<Impression, "id" | "sessionId">): void }`, and the action `rotateDisplayKey(eventId, displayId): Promise<string>`.

- [ ] **Step 1: `useDisplayTelemetry`.**
  - It makes a `sessionId = crypto.randomUUID()` once per page load, and the queue with `typeof window !== "undefined" ? window.localStorage : null`, wrapped in `try`.
  - Every `HEARTBEAT_MS`, and right after mount: if `deviceKey`, it calls `rpc("display_heartbeat", { …, p_now_playing: nowPlayingRef.current, p_width: Math.round(innerWidth * devicePixelRatio), p_height: Math.round(innerHeight * devicePixelRatio) })`.
  - Then it flushes: `peek(200)`, then `rpc("record_display_impressions", …)`, then on success `ack(batch.map(i => i.id))`. On error it keeps them and retries on the next tick.
  - It also flushes on the `online` event.
  - With no key it does nothing. The display still plays, which is the right behaviour for a preview from the producer page.
  - `record()` assigns `id: crypto.randomUUID()` and `sessionId`, then pushes.

- [ ] **Step 2: Delivered rule in the player.** When a sponsor item starts, note `startedAt = Date.now()`, `ready = false` (set to true by `SponsorAdBlock`'s `onReady`), and `hiddenDuringPlay = document.visibilityState !== "visible"`, updated on `visibilitychange`. When the item ends (timer fires, display disabled, or unmount):

```ts
const playedMs = Date.now() - startedAt;
telemetry.record({
  sponsorshipId, creativeId: creative?.id ?? null,
  startedAt: new Date(startedAt).toISOString(),
  durationMs: playedMs,
  completed: ready && !hiddenDuringPlay && playedMs >= slot.durationSeconds * 1000 - 250,
});
```

Records under 1 s are dropped server-side. `nowPlaying` is the sponsor's business name or the block label ("Current Heat", and so on).

- [ ] **Step 3: Producer page.**
  - `rotateDisplayKey` action: `requireEventAccess(eventId, ["producer"])`, then `supabase.rpc("rotate_display_key", { p_display_id })`, then return the key.
  - The card's "Generate kiosk URL" button calls it and shows `${origin}/display/${eventId}/${id}?key=${key}` once, with copy and the text "Save this URL in the player now — it won't be shown again. Generating a new one disconnects the old player."
  - Show status with `deviceStatus(last_seen_at, Date.now())` as a colored dot, the age of the last heartbeat, `now_playing`, the resolution, and delivered/partial totals from `display_delivery_summary` summed per display.
  - Keep it live with `useRefreshOnChanges([{ table: "display_devices", filter: \`event_id=eq.${eventId}\` }])` in a small client wrapper, plus a 15 s interval re-render for the "seconds ago" text.

- [ ] **Step 4: Event sponsors page.** Add "Delivered on venue display" and "Partial" columns from `display_delivery_summary(eventId)`, summed per sponsorship.

- [ ] **Step 5: Verify** with `pnpm check && pnpm db:display-check` and a `verify-repone` run:
  - Generate the kiosk URL as producer and open it.
  - Wait about 70 s. The Displays page shows Online, now playing, and a delivered count above 0.
  - Open the URL without `?key`. It plays, but the delivered count doesn't move.

- [ ] **Step 6: Commit and open the PR.** Title: "Venue displays report heartbeats and delivered sponsor impressions". The body explains the device key model, the delivered rule (decision 3), and the verification.

---

# Part D — Offline resilience (`feat/display-offline`)

### Task D1: Persist the last snapshot

**Files:** Modify `src/lib/realtime/useDisplaySnapshot.ts`.

- [ ] **Step 1:** After every successful load, run `try { localStorage.setItem(\`repone.display.${id}.snapshot\`, JSON.stringify(s)) } catch {}`. On mount, read it in `try/catch`. If its `loadedAt` is newer than `initial.loadedAt`, use it. That is the case when the service worker served an older cached HTML while offline.

- [ ] **Step 2:** Run `pnpm check`.

### Task D2: Service worker scoped to `/display/`

**Files:**
- Create: `public/display-sw.js`, `src/app/(display)/display/[eventId]/[displayId]/RegisterDisplayWorker.tsx`
- Modify: `DisplayPlayer.tsx` (render `<RegisterDisplayWorker creativeUrls={…} />`)

Read `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` first and follow its service worker registration and headers guidance where it differs from the steps below.

- [ ] **Step 1: The worker**

```js
// Venue display service worker (scope /display/). Keeps the TV useful when
// the venue internet drops: the page shell and Next static chunks are cached
// as they load, sponsor creatives are precached by the player, and a reload
// while offline gets the last cached page. Realtime (websocket) and RPCs are
// not intercepted.
const VERSION = "display-v1";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "precache" && Array.isArray(event.data.urls)) {
    event.waitUntil(precache(event.data.urls));
  }
});

async function precache(urls) {
  const cache = await caches.open(MEDIA);
  await Promise.all(urls.map(async (url) => {
    if (await cache.match(url)) return;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) await cache.put(url, res);
    } catch {}
  }));
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") await cache.put(request.url, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.pathname.startsWith("/display/")) {
    event.respondWith(networkFirst(req, SHELL));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, SHELL));
  } else if (url.pathname.includes("/storage/v1/object/public/sponsor-creatives/")) {
    event.respondWith(cacheFirst(req, MEDIA));
  }
});
```

- [ ] **Step 2: Registration**

```tsx
"use client";

import { useEffect } from "react";

/** Registers the venue display's service worker and precaches creatives. */
export function RegisterDisplayWorker({ creativeUrls }: { creativeUrls: string[] }) {
  const signature = creativeUrls.join("|");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/display-sw.js", { scope: "/display/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (!cancelled) reg.active?.postMessage({ type: "precache", urls: signature ? signature.split("|") : [] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [signature]);
  return null;
}
```

`creativeUrls` is every sponsor's creative URLs plus `logoUrl`, with nulls filtered out.

- [ ] **Step 3: Verify offline** with `verify-repone` and Chrome DevTools at 1080 × 1920:
  1. Load the kiosk URL with the key and let it run 2 minutes, so the worker installs and creatives are cached.
  2. Go offline (`mcp__chrome-devtools__emulate` with network offline). Sponsors keep rotating and images still show. Info blocks keep showing for 5 minutes, then only sponsors play.
  3. Reload while offline. The page comes back from the cache and keeps rotating.
  4. Go online. Within one heartbeat the producer page shows Online, and the delivered count jumps by the plays made offline, each counted once (compare with the number of sponsor items seen).
  5. Take screenshots of each step.

### Task D3: Kiosk documentation and the PR

**Files:** Modify `README.md` (new section "Venue display").

- [ ] **Step 1:** Document the following:
  - Create the display under Producer → Displays and generate the kiosk URL.
  - Player setup: Chrome or Chromium in kiosk mode with autostart. Example:

    ```
    chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --disable-infobars --check-for-update-interval=31536000 "<kiosk URL>"
    ```

  - Set the OS display to portrait (rotated 90°) at 2160 × 3840, or 1080 × 1920 at minimum.
  - Disable sleep and screen blanking.
  - Let it run once online before the event so creatives are cached.
  - What happens offline (decision 3 and the 5-minute rule).

- [ ] **Step 2:** Run `pnpm check`, commit, push, and open the PR. Title: "The venue display keeps playing sponsors when the internet drops". Stop at the PR link.

---

## Out of scope (spec Phase 2 / 3)

- **Phase 2:** sponsored content blocks ("Current Heat presented by …"), athlete spotlight, WOD info, schedule, announcements, the RepOne CTA, explicit event modes (pre-event, break, awards) with operator override, live controls (pause, skip, force sponsor, emergency message), several screens per event with different mixes, and detailed exposure reports.
- **Phase 3:** QR engagement, sponsor analytics, venue zones, fleet management, and automated fulfilment reports.

The schema leaves room for these:
- `display_impressions.content_type` is ready for `'sponsored_block'`.
- `display_block_type` can gain values.
- Event modes can become a column on `display_devices`, or on a new per-event state row, read by `eligibleInfoSlots`.
