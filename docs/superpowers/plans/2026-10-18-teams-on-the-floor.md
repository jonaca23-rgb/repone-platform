# Teams on the Floor (Event Teams PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lane that holds a team shows the team on every screen that shows lanes, and its result can be entered and corrected like an athlete's. A team member sees their team's registration and standing in their own portal.

**Architecture:** One change of shape at the source: a floor lane describes its occupant (athlete or team), loaded by one shared mapper in `src/lib/db/queries.ts`. A scoring lane carries a competitor type and id instead of an athlete id, and results are keyed by competitor. Every screen then follows from those two types. The athlete portal needs one migration (`0037`) so a team member can read their team's registration and payment.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, RLS, Realtime), zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-event-teams-design.md` §5, plus the follow-ups listed in PR #35's review: manual team lane assignment, the athlete portal for team members, team results under the finished-heat lock, and lane cleanup when a team is deleted.

**Branch:** `feat/teams-on-the-floor`, from `staging`. The PR targets `staging`.

## What is already team-aware (no change)

From mapping every lane consumer:
- the schema (`lanes.team_id`, one of the two set) and `generateHeats`;
- `enterResult` and `eligibleCompetitors` (they accept `competitor_type = "team"`);
- `recomputeWodStandings`, `useStandings`, `useDivisionStandings`, `pivotStandings`;
- the producer Scores page;
- the graphics components (`LanesBoard`, `HeatResults`, `Leaderboard`), which take only a name and an affiliate.

Deleting a team sets its lanes' `team_id` to null (`on delete set null`), which leaves the lane empty, as removing an athlete from a lane does. **No cleanup code is needed.**

## Global Constraints

**Data**
- Results and standings stay keyed by `athlete_id ?? team_id`. Ids are uuids, so the two never collide in one map.
- The migration is `0037_team_member_reads.sql`. Verify with `pnpm db:reset && pnpm db:types && pnpm dev:accounts && ./scripts/seed-qa.sh`.

**Unchanged behaviour**
- The lower third stays athlete-only (spec non-goal). In a team heat its picker lists nobody, and it says so.
- The finished-heat lock (0034) applies to team results exactly as to athletes'.

**Commits**
- `pnpm check && git commit`. Stage files by name. The title is a plain sentence. The last line is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Copy**
- Empty lane lists say `No one in lanes for this heat yet.` They used to say "athletes".
- A team's lane assignment label is `Lane {n} team`.
- In a team heat the lower third picker says `The lower third shows athletes; this heat's lanes hold teams.`

## Review Focus

1. **A team's result is saved or corrected after the heat is finished.**
   - Floor staff are refused; an organizer can correct it.
   - *Pinned by:* a `scoring.test.ts` case with `competitor_type = "team"`, and a `db:rls-check` case inserting a team result on a finished heat.
2. **The admin puts an athlete into a lane that holds a team, or a team into a lane that holds an athlete.**
   - The lane ends up holding exactly the new occupant; it never violates "not both".
   - *Pinned by:* `assignLane` tests.
3. **The same team is put in two lanes or two heats of the same WOD and division.**
   - Refused with a message naming the other heat and lane, as for athletes.
   - *Pinned by:* an `assignLane` test.
4. **Standings mix athletes and teams** (an event's leaderboard across divisions).
   - Names resolve for both; nothing shows "—" for a team.
   - *Pinned by:* tests on the scorekeeper standings mapper and the admin heat Standings tab mapper.
5. **A team member opens their portal.**
   - They see their team's registration, payment status and standing, and nobody else's.
   - *Pinned by:* `db:team-check` cases (a member reads their team's registration and payment; a non-member doesn't) and a portal mapper test.

---

### Task 1: The lane occupant, loaded once

**Files**
- Modify: `src/lib/db/queries.ts` (`FloorHeat`, `getFloorContext`, `getEventLiveContext`)
- Modify: the hand-copied lane types `DashboardHeat` (`DashboardClient.tsx`), `ScoreKeeperHeat` (`ScoreKeeperClient.tsx`) and `OnAirHeat` (`onAir.ts`), so they reuse `FloorLane`
- Create: `src/lib/db/floorLanes.ts` and its test

**Produces**

```ts
export interface FloorLane {
  laneNumber: number;
  athleteId: string | null;
  teamId: string | null;
  /** The athlete's full name, or the team's name. */
  name: string | null;
  /** The athlete's affiliate, or the team's. */
  affiliate: string | null;
  /** A team's member names in roster order; empty for an athlete. */
  members: string[];
}
export const FLOOR_LANES_SELECT: string;
// "lane_number, athlete_id, team_id, athletes(first_name, last_name, affiliate), teams(name, affiliate, team_members(athletes(first_name, last_name)))"
export function toFloorLanes(raw: RawLane[]): FloorLane[];          // sorted by lane number
export function laneCompetitor(lane: Pick<FloorLane, "athleteId" | "teamId">):
  { type: "athlete" | "team"; id: string } | null;
```

`FloorHeat.lanes` becomes `FloorLane[]`, and both loaders use `FLOOR_LANES_SELECT` and `toFloorLanes`.

The live page's "Now" tab and the venue display's heat blocks need no other change: they read `name` and `affiliate`.

**Tests**
- `toFloorLanes`:
  - an athlete lane;
  - a team lane, with its name, affiliate and members sorted by name;
  - an empty lane;
  - sorting by lane number.
- `laneCompetitor` for all three cases.
- Update the fixtures listed in the mapping (they build lanes with `athleteId` only) to the new shape.

### Task 2: Scoring a team's lane

**Files**
- Modify: `src/lib/scoring/format.ts` (`LaneResult` gains `team_id`; `ScoringLane` loses `athleteId` and gains `competitorType` and `competitorId`)
- Modify: `src/components/scoring/LaneList.tsx`, `LaneScoring.tsx`, `ScoreDrawer.tsx` and their tests
- Modify: `src/app/(app)/scorekeeper/[floorId]/page.tsx` and `ScoreKeeperClient.tsx`

**Details**
- `resultsByAthlete` is renamed `resultsByCompetitor`. It keys by `athlete_id ?? team_id`, and the `LaneList` prop is renamed to match.
- `ScoreDrawer` posts `competitor_type` and `competitor_id` from the lane.
- The scorekeeper builds scoring lanes with `laneCompetitor` instead of filtering on `athleteId`.
- The scorekeeper's standings query adds `team_id, teams(name)`. A pure `standingName(row)` gives the athlete's name, or the team's, or "—".

**Tests**
- `LaneList` shows a team lane's name and its result.
- `ScoreDrawer` for a team lane posts `competitor_type = "team"` and the team's id.
- `standingName` for an athlete, a team, and neither.
- `scoring.test.ts`: `enterResult` with a team competitor on a finished heat is refused for floor staff and allowed for an organizer.

### Task 3: The admin heat page

**Files**
- Modify: `src/app/(app)/admin/events/[eventId]/heats/[heatId]/page.tsx`, `LaneAssignmentForm.tsx`
- Modify: `src/lib/actions/lanes.ts` and `src/lib/actions/heatDetail.test.ts`

**Action.** `assignLane(eventId, heatId, laneId, fd)` reads the heat's division format.
- In an individual division it takes `athlete_id`; in a team division, `team_id`.
- It checks that the competitor is registered in the heat's division.
- It runs the same conflict check (this heat, or another heat of the same WOD and division), worded for a team: `This team is already in Lane {n} of this heat (…)` and `This team is already in Heat {h}, Lane {n} (…)`.
- The update writes the chosen column and clears the other: `{ athlete_id, team_id: null }` or `{ team_id, athlete_id: null }`.

**Page**
- **Lanes:** the lanes query adds `team_id` and the team's name. Registrations add `team_id, teams(name)`. The lane form lists the division's athletes or teams and is labelled for its kind.
- **Results:** scoring lanes come from `laneCompetitor`.
- **Standings:** they use `standingName`.
- **Conflicts:** the conflict map keys by `athlete_id ?? team_id`.

**Tests**
- `assignLane`:
  - a team into a team-division lane;
  - an athlete into a team-division heat is refused, and a team into an individual one;
  - a team already in another heat of the same WOD and division is refused with the message;
  - assigning a team clears `athlete_id` in the update, and the reverse.

### Task 4: Broadcast, commentary and production

**Files**
- Modify: `src/lib/realtime/useHeatResults.ts`; the Program overlay's results mapping; `src/app/(app)/dashboard/[floorId]/DashboardClient.tsx`
- Modify the commentator files: `[floorId]/page.tsx`, `CommentatorClient.tsx`, `AthleteCard.tsx`, `events/[eventId]/dashboard/page.tsx` and `events/[eventId]/lanes/page.tsx`
- Create: `TeamCard.tsx` in the commentator folder
- Update their tests

**Details**
- `useHeatResults` selects `athlete_id, team_id` from results and standings and keys both by competitor. The Program overlay looks results up with `laneCompetitor`.
- **Dashboard:**
  - The lanes list shows names; the loader already fixes this.
  - The lower third picker lists only athlete lanes. In a team heat it shows the copy above instead of an empty select.
- **Commentator:**
  - Lane cards: an athlete lane keeps `AthleteCard` (details only for athlete ids). A team lane gets `TeamCard`, with the lane number, the team's name, its affiliate, and its members.
  - The lanes page lists every occupied lane, with the column header "Athlete or team".
  - The empty copy changes as above.

**Tests**
- `useHeatResults`'s mapper keys a team result by team id.
- Program shows a team's result in Heat Results.
- `CommentatorClient` renders a `TeamCard` with its members for a team lane.
- The dashboard shows the lower third note in a team heat.

### Task 5: The athlete portal for team members

**Files**
- Create: `supabase/migrations/0037_team_member_reads.sql`
- Modify: `src/app/(app)/athlete/page.tsx`, `src/lib/db/social.ts` (`getAthleteCurrentStanding`) and its test
- Modify: `scripts/team-check.ts`

**Migration.** A team member reads their team's registration and that registration's payments. Two policies:
- **registrations:** `using (team_id in (select team_id from team_members m join athletes a on a.id = m.athlete_id where a.auth_user_id = auth.uid()))`. Match the athlete link that "athlete read own registrations" (0023) uses.
- **payments:** the same, through the registration.

**Portal**
- **My registrations** adds the team registrations of the athlete's teams, marked `Team · {name}`, with their payment status. Read them through `team_members` → `registrations`.
- **`getAthleteCurrentStanding`** also looks at the overall standings of the athlete's teams. The portal shows the best current one, labelled with the team's name when it is a team's.

**Tests**
- `team-check`:
  - a member (as `athlete@repone.test`, linked to athlete …061, put on a check team) reads the team's registration and payment;
  - a non-member athlete doesn't.
- A mapper test that a team registration row renders as `Team · {name}`.

### Task 6: Browser verification, review and PR

1. **Set up.** Seed has "Aprieta Duo" in "Intermediate Pairs". As admin:
   - add a WOD heat for Pairs on Floor A with "Generate heats", or assign the team in the Lanes tab;
   - put that heat on air (SQL `broadcast_state.current_heat_id`).
2. **Scorekeeper** (phone): the team's lane shows "Aprieta Duo". Enter a result, finish the heat, and see the lane read-only.
3. **Admin:** correct the team's result on the Results tab, and see it under Standings.
4. **Commentator:** the team card shows its members.
5. **Program overlay** (1920×1080): the lanes card and Heat Results show the team.
6. **Venue display** (1080×1920): "Now on the floor" shows the team.
7. **Live page:** Now and Standings show the team.
8. **Athlete portal** as `athlete@repone.test`, after adding Maria Rivera to a team: the team's registration and standing appear.
9. **Clean up:**
   - `pnpm db:reset && pnpm dev:accounts && ./scripts/seed-qa.sh`;
   - screenshots in `.verify/teams-floor/`;
   - close the pages.
10. **Final review** on the most capable model. Fix Critical and Important findings test-first.
11. **PR** against staging. Merge under the standing authorization once CI is green and the review is settled.
