# Sponsor Packages (Venue Display Part A, revised) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sponsor becomes one org-level record that buys a package per event. Packages are editable and replace the tier enum. Event sponsorships carry overrides and exclusivity. Image creatives are uploaded per sponsor. All of it is managed from admin screens built on the redesign's foundations.

**Architecture:** This revises **Part A** of `docs/superpowers/plans/2026-10-02-venue-display-mvp.md`, which was written before the redesign. The data model, migration SQL, seed, DB check and `effectiveDisplay` helper are reused from that plan, with the changes below. The actions and the admin UI are redone to the current contracts (`ActionResult`, `DataTable`, `FormDialog`, `RowActions`, DESIGN.md "Building an admin screen").

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, RLS, Storage), zod 4, TanStack Table v9 via `DataTable`, Vitest.

**Spec:** `docs/specs/venue-display.md` (client spec, MVP section, "Sponsor architecture"), with the original plan's "Decisions taken for the client's open questions" #5: the six tiers become each org's default packages.

## Changes from the original Part A

1. **Migration number.** It is `0032_sponsor_packages.sql`, because staging is at `0031`. Parts B and C later become `0033` and `0034`.
2. **RLS helper.** `has_role(org, user_role[])` still exists with the same signature and reads `member` (0029), so the original policies are used as written. `organizations` is still the org table, so the default-packages trigger fires on it.
3. **Actions.** Every action wraps `safeAction`, returns `ActionResult`, and returns `fail(...)` for user-facing refusals instead of throwing literal messages. `sponsorPackages.ts` and `eventSponsorships.ts` join `ACTION_RESULT_FILES`; `sponsors.ts` is already on it. `setActiveSponsor` (`broadcast.ts`) checks for an active `event_sponsorships` row and returns `fail("That sponsor isn't part of this event.")`.
4. **Admin UI.** It follows DESIGN.md: a DataTable, a FormDialog for create and edit, RowActions, and an ActionSwitch for active.
   - `/admin/sponsors` and `/admin/sponsors/packages` share `LinkTabs` ("Sponsors" | "Packages").
   - `/admin/events/[eventId]/sponsors` is a new entry, "Sponsors", in the sidebar's event group, placed after "Staff".
5. **Readers.** They read through `getEventSponsors(eventId)`. Client components get `{ id, business_name, logo_url, packageName }` (`BroadcastSponsor`), so the `tier` field becomes `packageName`. `SponsorCard`'s `tierLabel` becomes `packageName`.

## Global Constraints

**Database**
- Durations are 3–60 s and weights are 1–10 (DB checks).
- Creatives are PNG, JPEG or WebP, at most 4 MB, designed at 2160×3840.
- Migrations are verified with `pnpm db:reset && pnpm db:types && pnpm dev:accounts`.

**Guards**
- Sponsors, packages and sponsorships use `requireOrgManager()`. RLS mirrors this.
- The app never uses a service key.

**Commits**
- `pnpm check && git commit …`, chained.
- Stage files by name.
- Title is a plain sentence, the body says why, and the last line is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Copy (exact strings)**
- `Another active sponsor holds this category exclusively at this event.`
- `That sponsor is already part of this event.`
- `A package with that name already exists.`
- `Creative must be under 4MB — export a 2160×3840 JPEG or WebP.`
- `Venue display creatives: 2160×3840 (9:16), JPEG or WebP, under 4MB.`

**UI**
- Targets are at least 44px.
- Tables, not cards (`ui:guard` enforces this).

## Review Focus

1. **Two sponsors share an exclusive category.** The second activation must fail with the readable message, case-insensitively. Pinned by `db:sponsor-check` and an action test.
2. **The overlays show sponsors from another event.** They must now show only this event's active sponsorships. Pinned by a `getEventSponsors` test and the browser check.
3. **A package referenced by a sponsorship is deleted.** Packages are never deleted, only deactivated, and `on delete restrict` backs that up. The UI offers no delete.
4. **Override fields are left blank.** The package defaults must apply, with `null` stored. Pinned by `effectiveDisplay` tests and an action test.
5. **A creative over 4 MB, or not an image.** The upload must return a readable failure. Pinned by an action test.

---

### Task 1: Migration, seed and DB check

**Files:**
- Create: `supabase/migrations/0032_sponsor_packages.sql`
- Create: `scripts/sponsor-check.ts`
- Modify: `supabase/seed.sql`, `package.json`

- [ ] **Step 1: Write the DB check.** Copy `scripts/sponsor-check.ts` exactly from the original plan, Task A1 Step 2, including the boilerplate it describes from `timer-check.ts` and `rls-check.ts`. Add `"db:sponsor-check": "tsx scripts/sponsor-check.ts"`.
- [ ] **Step 2: Confirm it fails.** Run `pnpm db:sponsor-check`. Expected: it fails because `sponsor_packages` doesn't exist.
- [ ] **Step 3: Write the migration.** Use the SQL from the original plan's Task A1 Step 4, verbatim, with the header line changed to `0032`.
- [ ] **Step 4: Update the seed.** Use the original plan's Task A1 Step 5, replacing the current `insert into sponsors …` in `supabase/seed.sql`. Check that ids `…081`–`…083` are free.
- [ ] **Step 5: Reset and check.** Run `pnpm db:reset && pnpm db:types && pnpm dev:accounts && pnpm db:sponsor-check`. Expected: every line reads `ok`.
- [ ] **Step 6: Don't commit yet.** The app doesn't typecheck until Task 4. Tasks 1–4 commit separately, but only once `pnpm check` passes, so commit Task 1 together with Task 3's actions. Ledger the grouping.

### Task 2: `effectiveDisplay`

- [ ] Write `src/lib/sponsors/effective.ts` and `effective.test.ts` exactly as in the original plan, Task A2. The test should fail first, then pass.

### Task 3: Shared query and actions on `ActionResult`

**Files:**
- Create: `src/lib/db/sponsors.ts`, `src/lib/actions/sponsorPackages.ts`, `src/lib/actions/eventSponsorships.ts`
- Rewrite: `src/lib/actions/sponsors.ts`
- Modify: `src/lib/design/uiGuard.ts`, `src/lib/actions/broadcast.ts`
- Tests:
  - `src/lib/db/sponsors.test.ts` (`toEventSponsor`)
  - `src/lib/actions/sponsorPackages.test.ts`
  - `src/lib/actions/eventSponsorships.test.ts`
  - extend `src/lib/actions/sponsors` tests if a file exists, otherwise create `sponsors.test.ts`

**Interfaces:** Produces `EventSponsor`, `EVENT_SPONSOR_SELECT`, `toEventSponsor` and `getEventSponsors` as in the original Task A3 Step 1, plus:

```ts
/** What a broadcast surface (board, overlays) needs of a sponsor. */
export interface BroadcastSponsor { id: string; business_name: string; logo_url: string | null; packageName: string }
export function toBroadcastSponsor(s: EventSponsor): BroadcastSponsor;
```

**Actions.** Each returns `Promise<ActionResult>` inside `safeAction`. All refusals use `fail`, and only database errors throw.

`sponsors.ts`:
- `createSponsor(fd)` takes `business_name`, `category`, `website` and `notes`. It drops `tier`, `event_id` and `category_exclusive`.
- `updateSponsor(sponsorId, fd)` is new, with the same fields.
- `toggleSponsorActive(id, active)` keeps its behaviour. The exclusive-index branch goes away.
- `uploadSponsorLogo(sponsorId, fd)`:
  - Mirrors `uploadEventCoverPhoto` in `events.ts`: `imageUpload(fd.get("logo"), "logo")`, bucket `sponsor-creatives`, path `${sponsorId}/logo-${Date.now()}.${ext}`.
  - Checks the sponsor belongs to the org, otherwise `fail("That sponsor doesn't belong to your organization.")`.
  - Updates `logo_url` through `expectChanged`.
- `uploadSponsorCreative(sponsorId, fd)`:
  - Same flow with `imageUpload(fd.get("creative"), "creative")`.
  - Over 4 MB returns `fail("Creative must be under 4MB — export a 2160×3840 JPEG or WebP.", { creative: [...] })`.
  - Inserts `sponsor_creatives`.
- `toggleCreativeActive(creativeId, active)`.

`sponsorPackages.ts`:
- `createSponsorPackage(fd)`, `updateSponsorPackage(packageId, fd)` and `togglePackageActive(id, active)`.
- Form fields are as in the original Task A3 Step 3.
- A duplicate name returns `fail("A package with that name already exists.", { name: [...] })`.
- Revalidates `/admin/sponsors/packages`.

`eventSponsorships.ts`:
- `addEventSponsorship(eventId, fd)`, `updateEventSponsorship(eventId, sponsorshipId, fd)` and `toggleEventSponsorshipActive(eventId, sponsorshipId, active)`.
- Forms are as in the original Task A3 Step 4.
- `friendly()` messages become `fail(...)`. An event outside the org returns `fail("That event doesn't belong to your organization.")`.
- A blank override stores `null`.
- Revalidates `/admin/events/${eventId}/sponsors` and the producer's sponsors and production pages.

`broadcast.ts`, `setActiveSponsor`: replace the sponsor `event_id` check with an active `event_sponsorships` row for `(eventId, sponsorId)`. When none exists, return `fail("That sponsor isn't part of this event.")`.

Guard: add `"src/lib/actions/sponsorPackages.ts"` and `"src/lib/actions/eventSponsorships.ts"` to `ACTION_RESULT_FILES`.

**Tests**, using `fakeSupabase` with the guards mocked:
1. `sponsors.test.ts`:
   - `createSponsor` inserts the four fields;
   - `uploadSponsorCreative` with a 5 MB PNG returns the 4 MB message.
2. `sponsorPackages.test.ts`:
   - `createSponsorPackage` with a duplicate-key error returns the duplicate-name message;
   - duration 2 returns a field error.
3. `eventSponsorships.test.ts`:
   - add with a `sponsor_category_exclusive` error returns the exclusive message;
   - add with a duplicate returns "already part";
   - update with blank overrides sends `null` to the update, checked through `fake.calls`.
4. `sponsors.test.ts` (db):
   - `toEventSponsor` drops an inactive sponsor and a missing package;
   - it orders creatives newest first and filters out inactive ones;
   - it applies overrides.
5. `broadcast.test.ts`: update the existing sponsor case so that no active sponsorship returns the refusal.

Steps:
1. Write the tests and confirm they fail.
2. Implement.
3. Run `pnpm vitest run src/lib && pnpm ui:guard`.
4. Commit Tasks 1–3 together once `pnpm check` passes, which needs Task 4's readers. If typecheck fails only in callers, do Task 4 Step 1 first.

### Task 4: Readers and admin UI

**Readers** (Step 1):
- These pages switch to `getEventSponsors(eventId)` and map with `toBroadcastSponsor`:
  - `producer/events/[eventId]/sponsors/page.tsx` (its table shows business name and package);
  - `producer/events/[eventId]/production/page.tsx`;
  - `dashboard/[floorId]/page.tsx`;
  - `overlay/[floorId]/program/page.tsx`;
  - `overlay/[floorId]/sponsor/page.tsx`.

  Floor pages get the event id from `getFloorContext(floorId).eventId`.
- Client prop types `{ id, business_name, tier }` become `BroadcastSponsor`, in `DashboardClient`, `EventProducerProduction`, `onAir.ts` (uses `business_name` only), `ProgramOverlayClient` and `SponsorOverlayClient`.
- In `SponsorCard`, `tierLabel?: string` becomes `packageName?: string`, and callers pass `packageName`.
- Delete `src/lib/constants/sponsors.ts` and `admin/sponsors/tiers.ts`.
- Run `grep -rn "SPONSOR_TIER\|TIER_LABELS\|\.tier\b\|sponsor_tier" src`. Expected: no output.

**Admin, `/admin/sponsors`** (Step 2):
- `page.tsx` reads sponsors with `id, business_name, category, website, notes, logo_url, active, sponsor_creatives(id, public_url, active, created_at)` for the org, ordered by name.
- It renders `PageHeader` "Sponsors" and `<LinkTabs tabs={[Sponsors, Packages]}>`. Both tabs are links: `/admin/sponsors` and `/admin/sponsors/packages`. Check the `LinkTabs` API: if it is `?tab=`-based, build the two pages as one page with `?tab=packages` instead and ledger that.
- `SponsorsTable` columns, at module scope:
  - **Sponsor:** the logo thumbnail (40px, or initials) plus the name;
  - **Category**, low priority;
  - **Creatives:** a count, or "None";
  - **Active:** `ActionSwitch`;
  - **Actions:** `RowActions` with Edit (FormDialog with `SponsorForm` in edit mode), Logo (FormDialog with a file input for `uploadSponsorLogo`) and Creatives (FormDialog listing creative thumbnails with an `ActionSwitch` each, plus an upload form for `uploadSponsorCreative` with the guidance text and `accept="image/png,image/jpeg,image/webp"`).
- `SponsorForm` takes the name, category, website and notes (Textarea), and an optional `sponsor` for edit mode, which calls `updateSponsor`.
- Filters: Status (active/inactive).
- Toolbar: Add sponsor.

**Admin, Packages** (Step 3): `PackagesTable` (DataTable).
- Columns:
  - **Package:** the name;
  - **On the venue display:** "Yes · 15 s · weight 3", or "No";
  - **Order**, low priority;
  - **Active:** `ActionSwitch`;
  - **Actions:** Edit.
- `PackageForm` is a FormDialog with name, "Show on the venue display" (Switch), duration in seconds (3–60), weight (1–10) and order.
- Toolbar: Add package.
- Include inactive packages.

**Admin, event Sponsors** (Step 4): `admin/events/[eventId]/sponsors/page.tsx` plus `EventSponsorsTable`.
- Rows are the event's sponsorships, including inactive ones, read with the user's client and joined to the sponsor's name and category and the package's name and defaults.
- Columns:
  - **Sponsor:** name, plus an "Exclusive · {category}" badge;
  - **Package**;
  - **Display:** the effective duration and weight from `effectiveDisplay`, with an "override" marker when either is overridden;
  - **Active:** `ActionSwitch` → `toggleEventSponsorshipActive`;
  - **Actions:** Edit, a FormDialog with the package select, the exclusive checkbox, and both overrides with the package defaults as placeholders.
- Toolbar: Add sponsor, a FormDialog with the org's active sponsors not yet attached, the active packages and the exclusive checkbox.
- Empty state: "No sponsors at this event yet."
- `requireAdminEvent` guards the page, as other event pages do.
- Add a "Sponsors" item to the sidebar's event group after Staff (`AdminSidebar.tsx`, icon `BadgeDollarSign`), and to `eventCrumbs` if the breadcrumb lists tabs.

**Step 5:** Run `pnpm check && pnpm db:sponsor-check && pnpm db:rls-check && pnpm db:authz-check`. If `rls-check` enumerates tables, add the three new ones with "public read of active rows only". Then commit with the title "Sponsors are managed once and buy a package per event".

### Task 5: Browser verification, review and PR

1. **Browser run** (`.verify/sponsors/`). As admin:
   - Packages tab: create one, edit its duration and toggle it.
   - Sponsors: add one, edit it, upload a logo and a creative (test PNG under 4 MB), and see the creative count.
   - Try a file over 4 MB (generate it with `head -c 5000000 /dev/urandom > big.png`) and see the inline error.
   - Event Sponsors: attach Borinquen Nutrition with a weight override and see "override". Attach a second sponsor in "Physical Therapy" and see the exclusive error.
   - As producer, on the Sponsors tab: three seed sponsors with their packages.
   - On the board, trigger a sponsor. The On air bar names it, and `/overlay/<floor>/sponsor` shows only this event's sponsor, with its package label.
2. **Phone:** 390 on the admin pages, with no horizontal scroll and no target under 44px.
3. **Cleanup:** remove test packages, sponsors, sponsorships, creatives and storage objects. Simpler: run `pnpm db:reset && pnpm dev:accounts` afterwards, then re-run `./scripts/seed-qa.sh` as `dev:setup` does. Never run `pnpm env:local --force`. Close the pages.
4. **Final review:** one whole-branch review on the most capable model. Fix Critical and Important findings test-first.
5. **PR:** `gh pr create --base staging`. The body covers what changed, why and how it was verified, and lists the five client decisions to confirm before Part B. Stop at the link.
