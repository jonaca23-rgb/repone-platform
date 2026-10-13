# Event teams — Design

**Date:** 2026-10-12

**Status:** Design approved in conversation (teams belong to events; the fee is per team; one team per athlete per event; the organizer manages teams first, athlete self-registration follows). This written spec is awaiting review.

**Branch:** `feat/event-teams`, from `staging`. Two PRs, both against `staging`:
1. **PR 1, model and organizer:** §1–§4.
2. **PR 2, teams on the floor:** §5.

**Follow-up, its own spec:** athlete self-registration with teammate invitations ("3b"). This design leaves room for it (§7).

## Context: what exists today

- **A team belongs to the organization.** `teams(organization_id, name, affiliate, entry_format, team_size)` is managed at `/admin/teams`, with a roster in `team_members(team_id, athlete_id)` drawn from any athlete of the organization.
- **A team joins an event through a registration row.** `registrations(event_id, division_id, team_id)` is the alternative to an athlete registration. Payments attach to the registration.
- **A division has no format.** Nothing says whether a division is for individuals or for teams, so a division can hold both.
- **Heats can lane a team, but the floor can't show it.**
  - `generateHeats` fills lanes from registrations, athlete or team, and `lanes.team_id` exists.
  - The scorekeeper, the commentator desk, the overlays, the venue display, the admin lane editor and the live "Now" view read only `lanes.athlete_id`. A team's lane shows as empty there and cannot be scored.
  - The action `enterResult` accepts `competitor_type = "team"`, and standings already carry `team_id` and team names.

So teams exist in the schema but do not work end to end.

## Goal

A team is created inside an event, in one of that event's team divisions, from athletes of the organization. It owes one fee, competes in heats as one lane, and is scored and ranked as one competitor. An athlete is in at most one team per event.

**Success means:**
- A division says whether it is individual or team, and for teams, how many members.
- An organizer creates a team from the event's **Teams** page, adds and removes members, and names a captain. The database refuses:
  - a second team for the same athlete in the event;
  - a member past the division's team size;
  - an athlete from another organization.
- Creating a team registers it in its division, so one payment can be recorded for it, exactly as for an athlete today.
- A team division's heats lane teams, and an individual division's heats lane athletes. A registration of the wrong kind for its division is refused.
- (PR 2) On the scorekeeper, the commentator desk, the overlays, the venue display, the live page and the admin heat, a team's lane shows the team's name, and its result can be entered and corrected.
- `/admin/teams` is gone. Nothing in the app lists teams outside an event.

## Non-goals

- **Athlete self-registration and teammate invitations by email.** This is the follow-up spec (3b). Here only organizers create and change teams.
- **Online payment.** The organizer keeps recording payments.
- **Roster lock dates, waivers, substitutions history.**
- **A lower third for a team.** The lower third stays athlete-only; in a team heat its picker lists nobody.
- **Carrying a team from one event to the next.** A team is created per event. See §6 for circuit standings.

## 1. Data model (migration `0036_event_teams.sql`)

The project is not live, so there is no data to carry over. The seed is updated.

### Divisions

Two new columns on `divisions`:

| Column | Type | Rule |
|---|---|---|
| `entry_format` | `competitor_entry_type`, not null, default `'individual'` | `individual`, `pair`, `team` or `custom` (the existing enum) |
| `team_size` | `int`, nullable | null when `entry_format = 'individual'`; otherwise required, 2–20; `pair` forces 2 |

A check constraint enforces the pairing of format and size.

### Teams

`teams` becomes event-scoped:

| Column | Change |
|---|---|
| `organization_id` | dropped (the organization comes from the event) |
| `entry_format`, `team_size` | dropped (they live on the division) |
| `event_id` | new, not null, references `events` on delete cascade |
| `division_id` | new, not null, references `divisions` on delete cascade |
| `captain_athlete_id` | new, nullable, references `athletes` on delete set null |
| `name`, `affiliate` | kept |

- A team's name is unique within its event, case-insensitively.
- A trigger checks that the division belongs to the event and is not `individual`.
- The captain, when set, must be one of the team's members. Removing that member clears the captain.

### Team members

`team_members` gains `event_id`, filled by a trigger from the team, so the database can enforce the rules below with plain constraints and one trigger:

- **One team per athlete per event:** `unique (event_id, athlete_id)`.
- **Same organization:** the athlete's organization is the event's organization.
- **Team size:** a team cannot have more members than its division's `team_size`. The trigger takes an advisory lock per team so two concurrent adds cannot both pass.

A team with fewer members than its division's size is **incomplete**. Incomplete teams are allowed to exist, be laned and compete; the organizer decides. The UI marks them.

### Registrations

- A team's registration row is kept: `registrations(event_id, division_id, team_id)`. It is what a payment attaches to.
- A trigger on `registrations` refuses:
  - an athlete registration in a division that is not `individual`;
  - a team registration in an `individual` division;
  - a team registration whose event or division differs from the team's.
- An athlete may be registered in an individual division and also be a member of one team in the same event.

### Access (RLS)

- **Read:** teams and team members stay publicly readable, as today (the live page and the overlays run signed out).
- **Write:** an organization's managers (admin, event director) manage the teams and members of their events. The policy goes through the event's organization, since `teams.organization_id` is gone.
- Floor staff and athletes do not write teams in this spec.

## 2. Actions

All in `src/lib/actions/teams.ts`, returning `ActionResult` (the file is already on the guard list). Every action starts with `requireEventAccess(eventId)` (managers only) and filters by `event_id`.

| Action | Does |
|---|---|
| `createTeam(eventId, formData)` | Takes `name`, `division_id`, `affiliate`. Creates the team and its registration together. Refuses an individual division and a duplicate name. |
| `updateTeam(eventId, teamId, formData)` | Renames, changes affiliate. The division cannot change once the team has results. |
| `deleteTeam(eventId, teamId)` | Removes the team, its roster and its registration. Refused when the team has results. |
| `addTeamMember(eventId, teamId, formData)` | Adds one athlete. |
| `removeTeamMember(eventId, teamId, memberId)` | Removes one. |
| `setTeamCaptain(eventId, teamId, athleteId)` | Sets or clears the captain. |

Refusals a person can act on come back as `fail(...)` with these exact strings:

- `That division is for individuals. Choose a team division.`
- `A team with that name already exists in this event.`
- `That athlete is already on another team in this event.`
- `This team is full: its division takes {n} per team.`
- `That athlete isn't part of this organization.`
- `This team has results and can't be deleted. Remove its results first.`

`registerTeam` in `registrations.ts` is removed. `registerAthlete` refuses a team division with: `That division is for teams. Add the athlete to a team instead.`

`divisions.ts` create and update accept `entry_format` and `team_size`. Changing a division's format is refused once it has registrations.

## 3. Organizer screens

They follow DESIGN.md "Building an admin screen".

### Divisions (`/admin/events/[eventId]/divisions`)

- The create and edit dialog gains **Format** (Individual, Pair, Team) and, for Pair and Team, **Athletes per team**. Pair fixes it at 2.
- The table gains a **Format** column: "Individual", "Pairs", "Teams of 4".

### Teams (`/admin/events/[eventId]/teams`, new)

A new **Teams** item in the event sidebar, after Athletes. The org-level **Teams** item and `/admin/teams` are removed.

- **Table** (`DataTable`):

  | Column | Shows |
  |---|---|
  | Team | name, affiliate under it |
  | Division | the division's name |
  | Roster | "3 / 4" with an **Incomplete** badge until full |
  | Captain | the captain's name, or "—" |
  | Actions | **Roster** (primary); Edit; Delete (confirmed) |

- **Filters:** division; complete or incomplete.
- **Toolbar:** **Add team**, a `FormDialog` with name, division (team divisions only) and affiliate. When the event has no team division, the empty state says: "Add a team division first", with a link to Divisions.
- **Roster dialog:** the members, each with a **Captain** toggle and **Remove**; and an **Add athlete** select listing the organization's athletes who are not on a team in this event. It closes on its own button, so several members can be added in a row.

### Athletes (`/admin/events/[eventId]/athletes`)

- The register form no longer offers a team. Its division select lists only individual divisions.
- Team registrations keep appearing in the registrations table, as "Team · {name}", for payments.

### Check-in

A team member checks in with their own QR. The check-in page finds the athlete's team in the event and shows the team's name and the team registration's payment status.

## 4. Heats

- `generateHeats` reads the division's format: a team division lanes its team registrations, an individual division its athlete registrations. With the registrations trigger, a division can no longer mix both.
- The admin heat's **Lanes** tab assigns a team to a lane in a team division, from the division's teams not yet in that heat.
- `eligibleCompetitors` (used by `enterResult`) is unchanged.

## 5. Teams on the floor (PR 2)

One change of shape, then each screen follows it.

**A lane's occupant.** `FloorHeat.lanes[]` and `ScoringLane` describe an occupant that is an athlete or a team:

```ts
{ laneNumber: number;
  competitorType: "athlete" | "team";
  competitorId: string | null;   // athlete id or team id
  name: string | null;           // athlete's full name, or the team's name
  affiliate: string | null;      // the athlete's, or the team's
  members?: string[];            // a team's member names, in roster order
}
```

`getFloorContext` and the other lane queries select `team_id, teams(name, affiliate, team_members(athletes(first_name, last_name)))` alongside the athlete.

| Screen | With a team in the lane |
|---|---|
| Scorekeeper lane list and score drawer | The row shows the team's name. The drawer is titled "Lane 3 · {team}" and posts `competitor_type = "team"`. Saved results are found by team id. |
| Admin heat: Lanes and Results | Same list and drawer. |
| Commentator desk | The lane card shows the team's name, its affiliate, and its members' names. Previous standings are the team's. |
| Overlays: lanes board, heat results, leaderboard | The team's name in place of the athlete's. |
| Venue display: current heat, next heat, leaderboard | The team's name; the affiliate line when lanes are few, as for athletes. |
| Live page "Now" | The team's name. Standings already name teams. |
| Lower third | Unchanged, athlete-only (non-goal). |

Results, ranking and standings need no change: they already key on `athlete_id ?? team_id`.

## 6. Circuits

Circuit standings add up a competitor's results across a circuit's events by its id. With a team created per event, a team has a different id at each stop.

Circuit standings therefore match **teams by name, case-insensitively, within divisions of the same name**. Two teams that share a name in the same division at different stops count as one team. The circuit pages say so in their description.

## 7. Room for self-registration (3b)

This design is the base the follow-up builds on, without a second schema rewrite:

- `teams.captain_athlete_id` is the athlete who will create and manage the team from their portal.
- A member row is "this athlete is on this team". 3b adds invitations (an email, a pending state, acceptance) as rows of their own that become member rows on acceptance.
- "Incomplete" already exists as a state.
- The team's single registration is where the captain's fee is recorded.

## 8. Testing

**Unit**
- `teams.test.ts`: each refusal string above; `createTeam` writes the team and its registration; `deleteTeam` refuses a team with results; `setTeamCaptain` refuses a non-member.
- `registrations.test.ts`: `registerAthlete` refuses a team division.
- `divisions.test.ts`: `team_size` is required for a team format and forbidden for individual; pair forces 2; a format change is refused once the division has registrations.
- `heats.test.ts`: `generateHeats` lanes teams in a team division.
- (PR 2) Lane-shape tests for the queries' mappers; `LaneList` and `ScoreDrawer` with a team lane; `HeatBlock`, `LanesBoard` with a team lane.

**Database** (`pnpm db:team-check`, new)
- an athlete cannot join a second team in the same event, and can join a team in another event;
- a member past the division's size is refused;
- an athlete from another organization is refused;
- a team cannot be created in an individual division, or in a division of another event;
- an athlete registration in a team division, and a team registration in an individual division, are refused;
- anon reads teams and members and cannot write them; a scorekeeper cannot write them; a manager can.

**Browser** (`.verify/teams/`)
- As admin: make a division "Teams of 2"; create two teams; add members (the second team's picker no longer lists the first team's members); try a third member (refused); set a captain; see Incomplete turn into complete; record the team's payment; generate heats and see teams in lanes.
- (PR 2) As scorekeeper: score a team's lane on a phone. Then see the team's name on the commentator desk, the Program overlay, the venue display and the live page, and its placement in Standings.
- Check the Teams page at 390 wide.
