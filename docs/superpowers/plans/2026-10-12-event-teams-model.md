# Event Teams: Model and Organizer (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A team belongs to one event and one of its team divisions. A division says whether it is individual or team and how many athletes a team has. Organizers create teams and manage rosters from the event's Teams page, and the database enforces one team per athlete per event, the team size and the organization.

**Architecture:** Migration `0036_event_teams.sql` reshapes `divisions`, `teams`, `team_members` and guards `registrations`, with triggers for the rules a constraint can't express. The team actions move from organization scope to event scope and keep returning `ActionResult`. The org-level Teams screen is replaced by an event Teams screen built from the admin parts (`DataTable`, `FormDialog`, `RowActions`, `ConfirmAction`).

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, RLS), zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-event-teams-design.md`, §1–§4 and §6. §5 (teams on the floor) is PR 2 and gets its own plan once this PR is merged.

**Branch:** `feat/event-teams`, from `staging`. The PR targets `staging`.

## Global Constraints

**Database**
- The migration is `0036_event_teams.sql`. The project is not live: no data is carried over, and the seed is updated.
- Verify with `pnpm db:reset && pnpm db:types && pnpm dev:accounts && ./scripts/seed-qa.sh`.
- `team_size` is 2–20, and 2 for `pair`. It is null for `individual`.
- Every trigger function is `security definer set search_path = public`. Each raises a tagged message the actions map: `team_division_individual`, `team_division_event`, `team_member_other_team`, `team_full`, `team_member_org`, `registration_kind`, `registration_team_mismatch`, `team_captain_not_member`.

**Guards**
- Team actions use `requireEventAccess(eventId)` (managers only) and filter by `event_id`. RLS mirrors it through the event's organization.
- The app never uses a service key.

**Commits**
- `pnpm check && git commit …`, chained. Stage files by name.
- The title is a plain sentence, the body says why, and the last line is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Copy (exact strings)**
- `That division is for individuals. Choose a team division.`
- `A team with that name already exists in this event.`
- `That athlete is already on another team in this event.`
- `This team is full: its division takes {n} per team.`
- `That athlete isn't part of this organization.`
- `This team has results and can't be deleted. Remove its results first.`
- `That division is for teams. Add the athlete to a team instead.`
- `This division already has registrations, so its format can't change.`
- `Only a member of the team can be its captain.`
- Empty state without a team division: `Add a team division first.`

**UI**
- Tables, not cards (`ui:guard`). Targets are at least 44px on a phone.

## Review Focus

1. **Two organizers add the last member to the same team at once.** Only one succeeds; the other gets the "team is full" message. *Pinned by:* `db:team-check` (two concurrent inserts).
2. **An athlete already on a team in this event is added to another.** Refused with the readable message, also through the API. *Pinned by:* `db:team-check` and an action test.
3. **A division changes format after teams or athletes are registered in it.** Refused. *Pinned by:* an action test and `db:team-check` (an athlete registration in a team division is refused by the trigger).
4. **A team is deleted after it has results.** Refused by the action; results are not silently cascaded away. *Pinned by:* an action test.
5. **A team's captain is removed from the roster.** The captain is cleared, not left pointing at a non-member. *Pinned by:* `db:team-check`.

---

### Task 1: Migration, seed and DB check

**Files:**
- Create: `supabase/migrations/0036_event_teams.sql`, `scripts/team-check.ts`
- Modify: `supabase/seed.sql`, `supabase/seed_qa_circuit.sql` (if it creates teams), `package.json` (`db:team-check`)

**Produces**
- `divisions(…, entry_format competitor_entry_type not null default 'individual', team_size int)`
- `teams(id, event_id, division_id, name, affiliate, captain_athlete_id, created_at)`
- `team_members(id, team_id, athlete_id, event_id)`

**Steps**
- [ ] **Write `scripts/team-check.ts`.** Use the `display-check.ts` boilerplate. It creates its fixtures with the service client in the seed event (a "Check Pairs" division with `entry_format = 'pair'`, `team_size = 2`) and removes them in `finally`. Checks:
  - a manager creates a team in the pair division;
  - a team in an individual division is refused (`team_division_individual`);
  - a team in a division of another event is refused (`team_division_event`);
  - a manager adds two members; a third is refused (`team_full`);
  - two concurrent adds of the last free spot: exactly one succeeds;
  - an athlete on a team is refused on a second team in the same event (`team_member_other_team`);
  - a captain who is not a member is refused (`team_captain_not_member`); removing the captain from the roster clears `captain_athlete_id`;
  - an athlete registration in the pair division is refused, and a team registration in an individual division is refused (`registration_kind`);
  - a team registration for another event's division is refused (`registration_team_mismatch`);
  - anon reads teams and members and can't insert either; the scorekeeper can't insert a team.
- [ ] **See it fail.** The columns don't exist yet.
- [ ] **Write the migration:**
  - `alter table divisions add column entry_format …, add column team_size …` with the check `(entry_format = 'individual' and team_size is null) or (entry_format = 'pair' and team_size = 2) or (entry_format in ('team','custom') and team_size between 2 and 20)`.
  - Empty and reshape teams: `delete from teams;` then drop `organization_id`, `entry_format`, `team_size`; add `event_id`, `division_id`, `captain_athlete_id`; `create unique index on teams (event_id, lower(btrim(name)))`.
  - `team_members`: add `event_id uuid not null references events on delete cascade`; `unique (event_id, athlete_id)`.
  - Triggers:
    - `teams` before insert or update: the division belongs to the event and is not individual; the captain, when set, is a member.
    - `team_members` before insert: set `event_id` from the team; the athlete's organization is the event's; lock the team (`pg_advisory_xact_lock`) and count against the division's `team_size`. The unique index reports the other-team case; the trigger raises `team_member_other_team` first for a readable tag.
    - `team_members` after delete: clear the team's captain when it was this athlete.
    - `registrations` before insert or update: the kind matches the division's format; a team registration's event and division equal the team's.
  - RLS: drop `org staff manage teams` and `org staff manage team_members`; recreate both through `events.organization_id` with `has_role(…, array['admin','event_director'])`, `using` and `with check`. Keep the public read policies.
- [ ] **Update the seed.** The seed's team (1 team, 3 members today) becomes: a "Teams of 3" division in the seed event, the team in it, its members, and its registration.
- [ ] **Reset and check.** Every line reads `ok`. `db:rls-check` and `db:authz-check` still pass (adjust any team expectation they hold).

### Task 2: Division format

**Files:**
- Modify: `src/lib/actions/divisions.ts` and its test, `src/app/(app)/admin/events/[eventId]/divisions/DivisionsTable.tsx`, its test and `page.tsx`
- Create: `src/lib/teams/format.ts` and its test

**Produces**

```ts
// src/lib/teams/format.ts
export type EntryFormat = "individual" | "pair" | "team" | "custom";
/** "Individual", "Pairs", "Teams of 4". */
export function formatLabel(format: EntryFormat, teamSize: number | null): string;
export function isTeamFormat(format: EntryFormat): boolean;
```

**Actions**
- `createDivision(eventId, fd)` takes `name`, `entry_format` (default individual) and `team_size`. A pair stores 2 whatever was posted. A team format without a size gets a field error on `team_size`: `Athletes per team is required.`
- `updateDivision(eventId, divisionId, fd)` is new, with the same fields. When the format or size changes and the division has registrations, it returns the "format can't change" string.

**UI**
- The dialog gains **Format** (Select: Individual, Pair, Team) and **Athletes per team** (number, shown for Pair as a fixed 2 and for Team as an input).
- The table gains a **Format** column and an **Edit** row action.

**Tests**
- `formatLabel` for each case.
- Actions: a team without a size; a pair forced to 2; an individual with a size posted stores null; a format change refused with registrations, allowed without.

### Task 3: Team actions

**Files:**
- Rewrite: `src/lib/actions/teams.ts` and its test
- Modify: `src/lib/actions/registrations.ts` and its test (remove `registerTeam`; `registerAthlete` refuses a team division)

**Produces** `createTeam`, `updateTeam`, `deleteTeam`, `addTeamMember`, `removeTeamMember`, `setTeamCaptain`, with the signatures in the spec §2.

**Details**
- `createTeam` inserts the team, then its registration (`event_id`, `division_id`, `team_id`). If the registration insert fails, it deletes the team it just created and reports the failure.
- A helper `refusal(message)` maps the tagged database messages to the exact strings above; `team_full` reads the size from the division.
- `deleteTeam` first counts `results` for the team; any result refuses.
- Every action revalidates `/admin/events/${eventId}/teams`; `createTeam` and `deleteTeam` also revalidate the Athletes and Payments pages.

**Tests** (`fakeSupabase`)
- each refusal string, driven by the tagged database error;
- `createTeam` writes the team and its registration, and removes the team when the registration fails;
- `deleteTeam` refuses a team with results;
- `registerAthlete` refuses a team division.

### Task 4: The Teams screen

**Files:**
- Create: `src/app/(app)/admin/events/[eventId]/teams/page.tsx`, `TeamsTable.tsx`, `TeamForm.tsx`, `RosterDialog.tsx`
- Delete: `src/app/(app)/admin/teams/*`
- Modify: `src/components/shells/AdminSidebar.tsx` (remove the org-level Teams item; add `{ slug: "teams", label: "Teams" }` after Athletes) and its test if it lists items

**Page.** It reads the event's teams with their division, members (athlete names) and captain; the event's team divisions; and the organization's athletes who are not on a team in this event.

**Table and dialogs.** As in the spec §3: columns Team, Division, Roster ("3 / 4" with an Incomplete badge), Captain, Actions (Roster primary; Edit; Delete confirmed). Filters: division; complete or incomplete. Toolbar: Add team. Without a team division the empty state shows the string above and a link to Divisions.

**Roster dialog.** The members with a Captain toggle and Remove; an Add athlete select. It stays open after each add.

### Task 5: Registrations, heats, check-in and circuits

**Files:**
- Modify:
  - `src/app/(app)/admin/events/[eventId]/athletes/RegisterForm.tsx`, `RegistrationsTable.tsx`, `page.tsx`
  - `src/lib/actions/heats.ts` (`generateHeats`) and its test
  - `src/lib/actions/lanes.ts` and the admin heat's Lanes tab (assign a team in a team division)
  - `src/app/(app)/admin/checkin/[athleteId]/page.tsx`
  - `src/app/(app)/admin/circuits/[circuitId]/page.tsx`, `src/app/(app)/live/circuits/[circuitId]/page.tsx`

**Details**
- **Register form:** no team option; the division select lists individual divisions only.
- **Registrations table:** a team registration shows "Team · {name}".
- **`generateHeats`:** it reads the division's format and lanes teams or athletes accordingly.
- **Lanes tab:** in a team division the lane select lists the division's teams not yet in the heat.
- **Check-in:** when the athlete has no registration of their own in the event, look up their team in it and show the team's name and its registration's payment status.
- **Circuits:** a pure helper `circuitCompetitorKey({ athleteId, teamId, teamName })` returns the athlete id, or `team:${lower(trim(name))}` for a team. Both circuit pages use it and say in their description that teams are matched by name.

**Tests**
- `generateHeats` lanes teams in a team division and athletes in an individual one.
- `circuitCompetitorKey` for an athlete, a team, and two teams whose names differ only in case or spacing.

### Task 6: Browser verification, review and PR

1. **As admin** (`.verify/teams/`):
   - Divisions: add "Pairs RX" (Pair) and edit an existing division's format while it has registrations (refused).
   - Teams: add two teams in "Pairs RX"; open Roster and add two members to the first; check the second team's picker no longer lists them; try a third member through the API or a second tab (refused); set a captain; remove the captain (the captain clears); see Incomplete turn into complete.
   - Athletes: the register form lists only individual divisions; the team shows in registrations; record its payment.
   - Heats: generate heats for "Pairs RX" and see teams in the Lanes tab.
   - Check-in: open a team member's check-in page and see the team and its payment status.
2. **Phone:** the Teams page and the Roster dialog at 390 wide, with no horizontal scroll.
3. **Clean up:** `pnpm db:reset && pnpm dev:accounts && ./scripts/seed-qa.sh`. Close the pages.
4. **Final review** on the most capable model. Fix Critical and Important findings test-first.
5. **PR** against staging. It says that a team's lane still shows empty on the floor screens until PR 2. Stop at the link, or merge under the standing authorization once CI is green and the review is settled.
