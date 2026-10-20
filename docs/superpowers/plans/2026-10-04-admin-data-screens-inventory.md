# Admin screens inventory (2026-10-04)

Generated from the source on 2026-10-04 as input to `2026-10-04-admin-data-screens.md`. Paths are relative to `src/app/(app)/admin/`; `EV` = `events/[eventId]`. It describes the screens **before** the migration.

# Admin inventory

## Shell and shared files (not pages)

- layout.tsx: `requireModule("admin")`, `getSessionContext()`, `getUnreadCount(ctx.userId)`. It renders `<AdminShell userId unreadCount canManageMembers={orgCan(ctx,{member:["create"]})}>`.
- loading.tsx: Skeleton placeholder.
- error.tsx ("use client"): `<ErrorScreen as="div">`.
- DeleteEventButton.tsx:
  - Props `{eventId, eventName}`.
  - Renders ConfirmAction with trigger Trash2 icon + "Delete event" (triggerVariant ghost) and title `Delete ${eventName}?`.
  - Description: "This permanently removes its divisions, registrations, heats, results, standings, fees and payment records. This cannot be undone."
  - confirmLabel "Delete event". onConfirm = `deleteEvent.bind(null, eventId)`.
  - Used by `/admin` and `/admin/events/[eventId]`.
- EV/layout.tsx: `getAdminEvent(eventId)`, then `notFound()` if missing, then `<AdminEventProvider event>` from components/shells/AdminSidebar.
- EV/adminEvent.ts:
  - `getAdminEvent` (React cache) reads `events(id, name, starts_on)` via maybeSingle.
  - `requireAdminEvent` throws `Error("Event not found.")`.
- Breadcrumbs: `AdminBreadcrumb` plus `eventCrumbs(event, ...rest)` from src/components/shells/AdminBreadcrumb.tsx. Crumbs are Events (/admin) > event name > rest.

## Pages

### /admin — page.tsx
- Data loaded:
  - `getSessionContext()`.
  - `events(id, name, status, starts_on, ends_on, circuit_id, cover_image_url)` where organization_id = ctx.organizationId, order created_at desc.
  - `circuits(id, name)` where organization_id, order name.
- Items listed:
  - 1 list: a card grid of events (1/2/3 columns).
  - Each card shows: cover image or a "No cover photo" placeholder; status Badge (top-left); circuit-name Badge (top-right, only if circuit_id resolves); date range text ("Date TBD" / "Mon D, YYYY — Mon D, YYYY"); name.
  - The card is a Link to /admin/events/[id].
  - EmptyState "No events yet" when empty.
- Inline forms:
  1. Bootstrap org form. Shown instead of the whole page when `!ctx?.organizationId`.
     - Field: `name`, text, required, id org-name, "Organization name".
     - Action: `bootstrapOrganization` (org.ts).
  2. New event form.
     - `name`: text, required.
     - `starts_on`: date.
     - `ends_on`: date.
     - `circuit_choice`: Select, default NONE. Options: NONE "Single event (standalone)", "new" "Start a new circuit…", then each circuit id "Add to circuit: {name}".
     - `new_circuit_name`: text, "Only for a new circuit".
     - Action: `createEvent` (events.ts).
  3. Per-card cover photo form, inside `<details>` ("Upload photo"/"Change photo").
     - `cover_photo`: file, accept image/*, required.
     - Action: `uploadEventCoverPhoto.bind(null, e.id)`.
- Per-item buttons/forms:
  - "Save" (submit of the photo form): `uploadEventCoverPhoto`. Plain form, not ConfirmAction.
  - "Remove photo" (only if cover exists): `removeEventCoverPhoto.bind(null,e.id)`. ConfirmAction: yes.
  - "Delete event" via DeleteEventButton: `deleteEvent`. ConfirmAction: yes.
- Client components: ConfirmAction, plus shadcn Select/Input. No local "use client" files.
- Other notable UI: footer link to /admin/circuits. Images are plain `<img>` with eslint-disable.
- Suggested DataTable:
  - Columns: Name (name, high, link), Status (status, high), Dates (starts_on/ends_on, high), Circuit (circuit_id to name, low), Cover (cover_image_url thumbnail, low), Actions (cover upload/remove, delete, high).
  - Filters: status (draft/scheduled/live/completed/archived), circuit, text search on name.
  - Keep the create form above the table, and keep the grid as an optional view.

### /admin/athletes — athletes/page.tsx
- Data loaded:
  - `athletes(id, first_name, last_name, affiliate, gender, photo_url)` where organization_id, order last_name.
  - RPC `athlete_private_details(p_athlete_ids)` via `getAthletePrivateDetails` (src/lib/db/athletePrivate.ts), giving email, phone, date_of_birth. It is used only for the age category.
- Items listed:
  - 1 list, a 2-column grid.
  - Each item shows: photo (9x9 round) or a gray placeholder; "First Last" (Link to /admin/athletes/[id]); affiliate text; age-category label (`AGE_CATEGORY_LABELS[computeAgeCategory(dob, gender, new Date())]`, only if computed).
  - EmptyState "No athletes yet".
- Inline forms:
  - Add athlete form, action `createAthlete` (athletes.ts). Fields:
    - `first_name`: text, required.
    - `last_name`: text, required.
    - `affiliate`: text.
    - `email`: email, required.
    - `phone`: tel, placeholder Optional.
    - `date_of_birth`: date.
    - `gender`: Select, default NONE. Options: "Not set", male, female.
- Per-item buttons/forms: "Remove" calls `deleteAthlete.bind(null,a.id)`. ConfirmAction: yes.
- Client components: ConfirmAction.
- Other notable UI: none (no search or filter today).
- Suggested DataTable:
  - Columns: Athlete (photo + first_name last_name, high, link), Affiliate (affiliate, high), Age category (computed, high), Gender (gender, low), Actions (Remove, high).
  - Filters: search by name or affiliate, gender, age category.

### /admin/athletes/[athleteId] — athletes/[athleteId]/page.tsx
- Data loaded:
  - `athletes(id, first_name, last_name, affiliate, gender, photo_url, auth_user_id)` filtered by id and organization_id. `notFound()` if missing.
  - RPC athlete_private_details gives email, phone, date_of_birth.
  - `athlete_lifts(lift, weight_lbs, time_seconds)` by athlete_id.
  - `athlete_benchmarks(id, name, result_display)` by athlete_id, order name.
  - `standings(event_id, division_id, wod_id, placement, points)` by athlete_id.
  - Then `events(id, name, starts_on)`, `divisions(id, name)` and `wods(id, name, sort_order)` via `.in()` on the ids found.
  - Reads the request `headers()` (host, x-forwarded-proto) to build the QR URL.
- Items listed (4 lists):
  1. Benchmarks. Each shows name, result_display, and a Remove button.
  2. Competition history, one card per event, sorted by starts_on desc. Each card shows: event name; division name; "Overall: #placement (points pts)"; a Badge per WOD "{name}: #placement".
  3. Lift inputs (LIFT_NAMES grid), which is a form rather than a list.
  4. A header block with age category and a message link.
- Inline forms (5):
  1. Photo upload, `uploadAthletePhoto.bind(null,athleteId)`. Field `photo`: file, accept image/*, required.
  2. Profile, `updateAthleteProfile.bind(null,athleteId)`. Fields:
     - `first_name`: text, required.
     - `last_name`: text, required.
     - `affiliate`: text.
     - `email`: email, required.
     - `phone`: tel.
     - `date_of_birth`: date.
     - `gender`: Select (NONE/male/female), default = current.
  3. Lifts, `saveAthleteLifts.bind(null,athleteId)`. One field per LIFT_NAMES entry (field name = lift key; labels from LIFT_LABELS).
     - Time lifts use type=text, inputMode decimal, pattern `[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?`, placeholder 21:30, labelled "(mm:ss)", default formatClock(time_seconds).
     - Weight lifts use type=number, step 0.5, min 0, labelled "(lbs)".
     - Blank fields are ignored by the action.
  4. Benchmark upsert, `upsertAthleteBenchmark.bind(null,athleteId)`. Fields `name`: text, required, placeholder Fran; `result_display`: text, required, placeholder 3:45.
- Per-item buttons/forms:
  - "Remove current photo" (only if photo_url exists): `removeAthletePhoto`. ConfirmAction: yes.
  - Per benchmark "Remove": `deleteAthleteBenchmark.bind(null,athleteId,b.id)`. ConfirmAction: yes.
  - Link "Message {first}" to /admin/messages/[auth_user_id], or text "Hasn't created a RepOne account yet, so can't be messaged." when auth_user_id is null.
- Client components: ConfirmAction.
- Other notable UI:
  - Check-In QR code: `QRCode.toDataURL(`${protocol}://${host}/admin/checkin/${athleteId}`, {width:220, margin:1})` rendered as a data: URI `<img>` 32x32. Link "Open Check-In screen" to /admin/checkin/[id].
  - Photo opens full-size in a new tab.
  - Age category line "(as of today)".
- Suggested DataTable: it is a detail page, so keep the cards. A DataTable could replace the benchmark list (columns name, result_display, actions) and the competition history (columns Event, Division, Overall place, Points, per-WOD placements).

### /admin/checkin — checkin/page.tsx
- Data loaded: `athletes(id, first_name, last_name, affiliate, photo_url)` where organization_id, order last_name, `.limit(50)`. When `?q=` is present it adds `.or("first_name.ilike.%q%,last_name.ilike.%q%,affiliate.ilike.%q%")`. The `q` search param is read from `searchParams`.
- Items listed: 1 list of up to 50 athletes. Each is a Link to /admin/checkin/[id] showing photo, name and affiliate. EmptyState has a different title depending on whether a query was given.
- Inline forms: a GET search form (no action, so the browser submits `?q=`). Field `q`: text, id checkin-q, "Search by name or box". Submit button size touch with a Search icon.
- Per-item buttons/forms: none.
- Client components: none.
- Other notable UI: description mentions scanning the athlete's QR code.
- Suggested DataTable: not really needed. It is a search-and-jump picker. If used, columns are Athlete (high), Affiliate (high). Filter is the existing `q` search; the 50-row limit would become pagination.

### /admin/checkin/[athleteId] — checkin/[athleteId]/page.tsx
- Data loaded:
  - `athletes(id, first_name, last_name, affiliate, photo_url)` by id and organization_id. `notFound()` if missing.
  - `registrations(id, event_id, bib_number, events(name,status), divisions(name), payments(status, amount_cents, payment_method))` where athlete_id.
- Items listed: 1 list, one big card per registration:
  - Banner: green "Good to go" if payment status is paid or waived (GOOD_STATUSES), otherwise red "Payment missing". A registration with no payment row counts as unpaid.
  - Under the banner: "{event} — {division} — Bib #{bib}"; "$amount · status" (or just status).
  - EmptyState "No event registrations yet" with a link to /admin.
- Inline forms (per registration, 2):
  - "Mark paid": `markPaymentStatusForCheckin.bind(null,athleteId,r.event_id,r.id,"paid")`.
  - "Waive": same action with "waived".
  - Each is a form with no fields (a button only), size touch.
- Per-item buttons/forms:
  - "Mark paid": plain form, no ConfirmAction.
  - "Waive": plain form, no ConfirmAction.
  - "Reset to unpaid": ConfirmAction (yes), triggerSize touch, calls `markPaymentStatusForCheckin(..., "unpaid")`.
  - Link "Full Payments page" to /admin/events/[eventId]/payments.
- Client components: ConfirmAction.
- Other notable UI: photo or "No photo" avatar; link "Open {first}'s profile". The page is meant for the registration desk.
- Suggested DataTable: keep the large card UI (it is a glance-and-act screen).

### /admin/circuits — circuits/page.tsx
- Data loaded:
  - `circuits(id, name, description, starts_on, ends_on)` where organization_id, order starts_on desc nullsFirst false.
  - `events(circuit_id)` where organization_id and circuit_id is not null. Used to count events per circuit.
- Items listed: 1 list of circuits. Each shows name (Link to /admin/circuits/[id]), "{n} event(s)", and a date range "start → end" if either date exists. The `description` is selected but NOT displayed. EmptyState "No circuits yet".
- Inline forms: Create circuit, action `createCircuit` (circuits.ts). Fields:
  - `name`: text, required.
  - `description`: text.
  - `starts_on`: date.
  - `ends_on`: date.
- Per-item buttons/forms: "Delete circuit" calls `deleteCircuit.bind(null,c.id)`. ConfirmAction: yes.
- Client components: ConfirmAction.
- Other notable UI: none.
- Suggested DataTable:
  - Columns: Circuit (name, high, link), Events (count, high), Season (starts_on to ends_on, high), Description (description, low), Actions (Delete, high).
  - Filters: search name, date range.

### /admin/circuits/[circuitId] — circuits/[circuitId]/page.tsx
- Data loaded:
  - `circuits(id, name, description, starts_on, ends_on)` by id. `notFound()` if missing.
  - `events(id, name, status, starts_on, ends_on)` where circuit_id, order starts_on asc.
  - `events(id, name)` where organization_id and circuit_id is null, order name. These are the standalone events.
  - `divisions(id, event_id, name)` in event ids.
  - `standings(division_id, athlete_id, team_id, placement, points)` in division ids where wod_id is null.
  - `athletes(id, first_name, last_name)` and `teams(id, name)` for the names.
  - Computes `computeOverallStandings` from src/lib/scoring, grouped by lowercased division name.
- Items listed (2 kinds):
  1. Events in this circuit: each shows name (Link to /admin/events/[id]), a status Badge and a "Remove from circuit" button.
  2. Cumulative leaderboard: one Table per division name. Columns: Place, Competitor, one column per circuit event (placement or "—"), Total points.
  - Empty texts for both.
- Inline forms: Add event to circuit, `addEventToCircuit.bind(null,circuitId)`. It is only rendered when standalone events exist.
  - Field `event_id`: Select, default is the first standalone event, "Standalone event".
- Per-item buttons/forms: "Remove from circuit" calls `removeEventFromCircuit.bind(null,circuitId,e.id)`. ConfirmAction: yes.
- Client components: ConfirmAction.
- Other notable UI:
  - Header action "Public leaderboard" opens /live/circuits/[id] in a new tab.
  - Circuit description and dates appear in the description line.
  - Only page using the shadcn Table.
- Suggested DataTable:
  - Events in circuit: Event (name, high), Status (status, high), Dates (starts_on, low), Remove (high).
  - Leaderboard: columns Place, Competitor, per-event placements (dynamic), Total. Filter by division.

### /admin/events/[eventId] — EV/page.tsx
- Data loaded:
  - `events` with `select("*")` by id. `notFound()` if missing.
  - `circuits(id, name)` by event.circuit_id.
  - Also `getAdminEvent` for generateMetadata.
- Items listed:
  - 1 grid of 9 static section cards (SECTIONS): venues, divisions, athletes, wods, heats, staff, fees, payments, statement. Each card shows label and desc and links to /admin/events/[id]/<slug>.
  - Plus a banner cover image if cover_image_url exists, and a circuit link ("Part of circuit: {name}" or "Standalone event, not part of a circuit.").
- Inline forms: status switcher, a button group with `role=group aria-label="Event status"`. For statuses draft, scheduled, completed, a `<form action={updateEventStatus.bind(null,eventId,s)}>` with a submit button (no fields). The current status renders as a disabled pressed button.
- Per-item buttons/forms:
  - "Live": ConfirmAction (yes), variant default, description "The event shows as live on the public leaderboard and to its staff." Calls `updateEventStatus(eventId,"live")`.
  - "Archived": ConfirmAction (yes), description "The event is hidden from the active lists. You can set it back to another status later."
  - Draft, Scheduled and Completed buttons: plain forms, no ConfirmAction.
  - DeleteEventButton: ConfirmAction (yes), `deleteEvent`.
- Client components: ConfirmAction.
- Other notable UI: header action "Public leaderboard" opens /live/[eventId] in a new tab. The dates string is "start → end".
- Suggested DataTable: none. It is a hub page of links plus a status control.

### /admin/events/[eventId]/athletes — EV/athletes/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `divisions(id, name)` where event_id, order sort_order.
  - `athletes(id, first_name, last_name, affiliate, gender)` where organization_id, order last_name.
  - `teams(id, name, affiliate, entry_format)` where organization_id, order name.
  - `registrations(id, bib_number, division_id, athlete_id, athletes(first_name,last_name,affiliate,gender), teams(name,affiliate,entry_format))` where event_id.
  - RPC athlete_private_details for the registered athletes (dob).
  - Cookie `repone_last_division_${eventId}`.
- Items listed:
  - 1 grouped list: one section per division, with a registration row each.
  - A row shows name, affiliate ("— affiliate"), a team entry_format Badge for teams, "#bib", the age-category label (computed as of the event's starts_on, or today if none), and a Remove button.
  - A per-division empty line "No registrations in this division yet."
  - If there are no divisions, an EmptyState "No divisions yet" with a link to Divisions.
- Inline forms: 2 forms inside the client component RegisterForms. Both use `useActionState`, show errors via toast.error and an inline role=alert message, and the button shows "Registering…" when pending.
  - Register an athlete, `registerAthlete.bind(null,eventId)`:
    - `athlete_id`: Select, required, default the first athlete, label "First Last (affiliate)".
    - `division_id`: Select, required, default the cookie division or the first division.
    - `bib_number`: text.
    - If there are no athletes, it shows a link to /admin/athletes instead of the form.
  - Register a pair, team or custom entry, `registerTeam.bind(null,eventId)`:
    - `team_id`: Select, required, "Name (affiliate)".
    - `division_id`: same as above.
    - `bib_number`: text.
    - If there are no teams, it links to /admin/teams.
- Per-item buttons/forms: "Remove" calls `removeRegistration.bind(null,eventId,r.id)`. ConfirmAction: yes.
- Client components: RegisterForms.tsx ("use client"), ConfirmAction.
- Other notable UI: intro paragraph with links to Athletes, Teams, Fees, Payments and Heats.
- Suggested DataTable:
  - Columns: Competitor (athletes or teams name, high), Type (Individual or entry_format, high), Division (division, high), Bib (bib_number, high), Affiliate (affiliate, low), Age category (computed, low), Remove (high).
  - Filters: division, type (athlete/team), search name or bib.
  - Keep RegisterForms above the table.

### /admin/events/[eventId]/divisions — EV/divisions/page.tsx
- Data loaded: `requireAdminEvent`; `divisions(id, name)` where event_id, order sort_order.
- Items listed: 1 list. Each item shows the name and a Remove button. EmptyState "No divisions yet".
- Inline forms: Add division, `createDivision.bind(null,eventId)`. Field `name`: text, required, placeholder "Intermediate Female".
- Per-item buttons/forms: "Remove" calls `deleteDivision.bind(null,eventId,d.id)`. ConfirmAction: yes. The description warns that registrations, heats and results are deleted.
- Client components: ConfirmAction.
- Other notable UI: none.
- Suggested DataTable: Division (name, high), Actions (Remove, high). The list is small enough that a table is optional. A registration count column would be a possible addition.

### /admin/events/[eventId]/fees — EV/fees/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `divisions(id, name)` where event_id, order sort_order.
  - `fee_schedules(id, name, description, division_id, entry_type, amount_cents, is_addon, active)` where event_id, order created_at desc.
- Items listed:
  - 1 list. Each item shows: name, amount ("$x.xx"), an Add-on Badge if is_addon, "division name or Any division · entry type label or Any entry type", and description.
  - Controls: active switch and Delete.
  - EmptyState "No fees set up yet" with a link to Payments.
- Inline forms: Add fee, `createFeeSchedule.bind(null,eventId)`. Fields:
  - `name`: text, required.
  - `amount_dollars`: number, min 0, step 0.01, required.
  - `division_id`: Select, default NONE, options "Any division" plus the event's divisions.
  - `entry_type`: Select, default NONE, options "Any entry type", individual, pair, team, custom.
  - `description`: text.
  - `is_addon`: Checkbox, label "Optional add-on (not a base registration fee)".
- Per-item buttons/forms:
  - ActionSwitch "{name} active": `toggleFeeScheduleActive.bind(null,eventId,f.id)` receives the new boolean. It is not a ConfirmAction.
  - "Delete": `deleteFeeSchedule.bind(null,eventId,f.id)`. ConfirmAction: yes.
- Client components: ActionSwitch, ConfirmAction.
- Other notable UI: none.
- Suggested DataTable:
  - Columns: Fee (name, high), Amount (amount_cents, high), Division (division_id to name, high), Entry type (entry_type, high), Add-on (is_addon, low), Description (description, low), Active (switch, high), Delete (high).
  - Filters: active, add-on, division, entry type.

### /admin/events/[eventId]/heats — EV/heats/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `floors(id, name, venues!inner(event_id))` where venues.event_id.
  - `wods(id, name, created_at)` where event_id, order created_at.
  - `divisions(id, name)` where event_id. Re-sorted in JS with `compareDivisionNames`.
  - `heats(id, heat_number, heat_count, scheduled_start, ended_at, wods(name,created_at), divisions(name), floors(name), lanes(id))` where event_id. Sorted with `compareHeatsForRunningOrder`.
  - `registrations(division_id)` for the per-division counts.
  - Cookie `repone_lanes_per_heat_${eventId}` (default 6).
- Items listed:
  - 1 list of heats. Each is a Link to /admin/events/[id]/heats/[heatId].
  - Shows "{WOD} — Heat {n} / {heat_count}", a Completed badge (ended_at), a "Next up" badge on the first not-ended heat, and "division · floor · {lanes.length} lanes". The next-up heat is highlighted. `scheduled_start` is selected but not displayed.
  - EmptyState "Not ready for heats yet" if there is no floor, WOD or division. Also "No heats yet".
- Inline forms (2):
  1. Generate heats, `generateHeats.bind(null,eventId)` (heats.ts). Fields:
     - `floor_id`: Select, required, default the first floor.
     - `wod_id`: Select, required, default the first WOD.
     - `division_id`: Select, required, label "{name} ({n} registered)", default the first division.
     - `lanes_per_heat`: number, min 1, max 20, required, default = cookie value.
     - `scheduled_start`: datetime-local, "First heat start".
     - `interval_minutes`: number, min 0, default 10.
  2. Add a single heat (manual), inside `<details>`, `createHeat.bind(null,eventId)`. Fields:
     - `floor_id`, `wod_id`, `division_id`: required Selects.
     - `heat_number`: number, min 1, required.
     - `heat_count`: number, min 1.
     - `lane_count`: number, min 1, max 20, default 6.
     - `scheduled_start`: datetime-local.
- Per-item buttons/forms: "Remove" calls `deleteHeat.bind(null,eventId,h.id)`. ConfirmAction: yes.
- Client components: ConfirmAction. The local `PickOne` helper is not a client component.
- Other notable UI: "Next up" highlight.
- Suggested DataTable:
  - Columns: Heat (WOD + heat_number/heat_count, high, link), Division (high), Floor (high), Lanes (lanes.length, low), Start (scheduled_start, high), Status (Completed/Next up/Pending from ended_at, high), Remove (high).
  - Filters: WOD, division, floor, status.
  - Keep the running-order sort as the default.

### /admin/events/[eventId]/heats/[heatId] — EV/heats/[heatId]/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `heats(id, heat_number, heat_count, division_id, wod_id, floor_id, wods(name,scoring_type,time_cap_seconds), divisions(name), floors(name))` by id. `notFound()` if missing.
  - `heats(id, heat_number, wods(name,created_at), divisions(name))` where event_id, for prev/next ordering.
  - `lanes(id, lane_number, athlete_id, athletes(first_name,last_name,affiliate))` where heat_id, order lane_number.
  - `registrations(athlete_id, athletes(id,first_name,last_name))` where division_id.
  - `results` with `select("*")` where heat_id.
  - `standings(placement, points, athlete_id, athletes(first_name,last_name))` where division_id and wod_id, order placement.
  - `heats(heat_number, lanes(lane_number, athlete_id))` for the same wod and division, excluding this heat. Used for conflict detection.
- Items listed (3 lists):
  1. Lanes: one `LaneAssignmentForm` per lane.
  2. Results entry: one card per lane that has an athlete. Fields depend on the scoring type.
  3. Live standings (only if rows exist): placement, athlete name, "N pts".
- Inline forms:
  1. Per-lane form in LaneAssignmentForm.tsx, `assignLane.bind(null,eventId,heatId,lane.id)` via `useActionState`.
     - `athlete_id`: Select, default current or NONE. Options "Empty" (NONE) plus registered athletes (those with athlete_id).
     - Save button, "Saving…" when pending.
     - Errors show as toast and inline role=alert text. `conflictMessage` comes from the server component's duplicate detection.
  2. One bulk results form, `saveHeatResults.bind(null,eventId,heatId,wod_id,division_id,scoringType,floor_id,laneAthleteIds)`. Per lane, field names are suffixed `__{athleteId}`:
     - for_time: `time_seconds__id` (text, pattern `[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?`, placeholder 3:45), `capped__id` (Checkbox), `reps__id` (number, "Reps (if capped)").
     - amrap: `reps__id` (number, "Total reps").
     - max_load: `load__id` (number, step 0.5).
     - points or other: `points__id` (number, step 0.01).
     - All types: `tiebreak_value__id` (number, step 0.01); `status__id` (Select, default existing or "completed", options completed/dnf/dns/dq); `manual_adjustment__id` (Checkbox, with an "Adjusted" Badge when `manually_adjusted`).
     - "Save all" button, shown only if lanes have athletes.
- Per-item buttons/forms:
  - Header "Previous heat" / "Next heat" are Links (disabled buttons at the ends). No ConfirmAction.
  - Per lane "Save" is a plain form.
  - "Save all" is a plain form. It redirects after saving.
- Client components: LaneAssignmentForm.tsx ("use client"). No ConfirmAction on this page.
- Other notable UI:
  - Heat description line "division · floor · scoring type · N min cap".
  - Red conflict styling for an athlete in two lanes or in another heat of the same WOD and division.
  - Note text "For backup or manual entry only…".
- Suggested DataTable: keep the form-heavy layout. Possible table candidates are standings (Place, Athlete, Points) and results entry (Lane, Athlete, score inputs, Status). No filters.

### /admin/events/[eventId]/payments — EV/payments/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `divisions(id, name)` where event_id.
  - `fee_schedules(id, name, amount_cents)` where event_id and active=true, order name.
  - `registrations(id, bib_number, division_id, athletes(first_name,last_name), teams(name,entry_format), payments(id, status, payment_method, amount_cents, fee_schedule_id, notes))` where event_id.
  - `payment_accounts(status)` where organization_id (maybeSingle). Status defaults to "not_connected".
- Items listed:
  - 1 list of cards, one per registration. A card shows: name; a kind Badge ("Individual" or entry_format); "#bib"; division name; a status Badge (unpaid/paid/waived/refunded, styled via STATUS_STYLES); amount.
  - EmptyState "No registrations yet" with a link to Athletes.
  - Hint text when there are no active fees, linking to Fees.
- Inline forms: per-card Save form, `updateRegistrationPayment.bind(null,eventId,r.id)`. Fields:
  - `fee_schedule_id`: Select, default current or NONE. Options "None" plus "{name} ($x.xx)".
  - `amount_dollars`: number, min 0, step 0.01, placeholder = current amount, "Amount override".
  - `status`: Select, default current. Options unpaid/paid/waived/refunded.
  - `payment_method`: Select, default current or "unpaid". Options: "Not set" (unpaid), cash, manual_other "Other (manual)", stripe "Stripe (future)".
  - `notes`: text, placeholder "e.g. paid cash at check-in".
- Per-item buttons/forms (all call `markPaymentStatus.bind(null,eventId,r.id,<status>)`):
  - "Mark paid": plain form.
  - "Waive": plain form.
  - "Refunded": ConfirmAction (yes), triggerVariant outline.
  - "Reset to unpaid": ConfirmAction (yes), triggerVariant outline.
- Client components: ConfirmAction.
- Other notable UI:
  - Warning banner "Online payments: Connected/Not connected" saying this is a manual ledger and Stripe is not integrated.
  - Two summary cards: Collected (sum of paid amounts) and Outstanding (non-paid, non-waived amounts).
- Suggested DataTable:
  - Columns: Competitor (athletes or teams name, high), Type (kind, low), Division (high), Bib (low), Status (payments.status, high), Amount (amount_cents, high), Method (payment_method, low), Notes (notes, low), Actions (Mark paid, Waive, Refund, Reset, Edit, high).
  - Filters: status, division, type.
  - Keep the Collected and Outstanding cards. The edit form could move into a row dialog.

### /admin/events/[eventId]/staff — EV/staff/page.tsx
- Data loaded:
  - `getSessionContext`. Redirects to /admin unless `orgCan(ctx,{staff:["invite"]})`.
  - `events(id, name, organization_id)` by id. `notFound()` if missing or in another org.
  - `event_scorekeeper_assignments(id, scorekeeper_user_id)`, `event_producer_assignments(id, producer_user_id)` and `event_commentator_assignments(id, commentator_user_id, role_label)`, each where event_id and status="active".
  - `getDisplayNamesByUserId`, `emailsByUserId` and `isPending` (src/lib/db/people.ts, src/lib/auth/invite.ts).
- Items listed:
  - 3 lists via the local `StaffRoleSection` card: Scorekeepers, Producers, Commentators.
  - Each row shows the name (falling back to email, then "Unknown account"), the commentator role_label (underscores replaced by spaces, uppercased), and a "Pending ·" Resend control if the user has never signed in.
  - Each section has an empty line "Nobody assigned yet."
- Inline forms: one `InviteByEmailForm` per section (3 total). It is a client component that submits via `useActionState`, with a result message in role=status. Action `inviteEventStaff.bind(null, role, eventId)`, where role is "scorekeeper", "producer" or "commentator". Fields:
  - `email`: email, required, placeholder name@example.com.
  - Commentators only: `roleLabel`: Select, default NONE. Options "None", main_commentator, co_commentator, sideline_reporter, interviewer.
- Per-item buttons/forms:
  - "Resend" (InlineActionButton, a link-variant submit): `resendEventInvite.bind(null,eventId,userId)`. Plain form, no ConfirmAction.
  - "Remove": `removeEventScorekeeper`, `removeEventProducer` or `removeEventCommentator`, bound with eventId and then `.bind(null, r.id)`. ConfirmAction: yes.
- Client components: src/components/InviteForms.tsx (InviteByEmailForm, InlineActionButton), ConfirmAction.
- Other notable UI: none.
- Suggested DataTable:
  - One combined table: Name (high), Email (low, requires `emailsByUserId`), Role (Scorekeeper/Producer/Commentator, high), Role label (low), Invite status (Pending/Active, high), Actions (Resend, Remove, high).
  - Filter: role. Keep the 3 invite forms.

### /admin/events/[eventId]/statement — EV/statement/page.tsx
- Data loaded:
  - `requireAdminEvent`.
  - `registrations(id, payments(amount_cents, status))` where event_id.
  - `expenses(id, category, description, amount_cents, incurred_on, notes)` where event_id, order created_at desc.
- Items listed:
  - 3 summary cards: Income collected (sum of paid; "N paid registration(s)"), Expenses ("N entries"), Net profit or Net loss.
  - A "By category" Badge row, shown only if there are expenses.
  - An "Expense log" list. Each row shows description, amount, "Category · incurred_on", notes, and a Remove button.
  - Empty text "No expenses logged yet."
- Inline forms: Add an expense, `createExpense.bind(null,eventId)` (expenses.ts). Fields:
  - `category`: Select, default "other". Options venue, equipment, staff_judges ("Judges / Staff"), prizes, marketing, other.
  - `description`: text, required.
  - `amount_dollars`: number, min 0, step 0.01, required.
  - `incurred_on`: date.
  - `notes`: text.
- Per-item buttons/forms: "Remove" calls `deleteExpense.bind(null,eventId,e.id)`. ConfirmAction: yes.
- Client components: ConfirmAction.
- Other notable UI: a link to Payments in the intro text.
- Suggested DataTable:
  - Columns: Date (incurred_on, high), Category (category, high), Description (description, high), Amount (amount_cents, high), Notes (notes, low), Remove (high).
  - Filters: category, date range.
  - Keep the summary cards.

### /admin/events/[eventId]/venues — EV/venues/page.tsx
- Data loaded: `requireAdminEvent`; `venues(id, name, floors(id, name, sort_order))` where event_id.
- Items listed: 1 list of venue cards. Each shows the venue name and floors as Badges sorted by sort_order. There is no empty state.
- Inline forms: one per venue, "Add floor", `addFloor.bind(null,eventId,v.id)` (venues.ts). Field `name`: text, required, "New floor name", placeholder "Floor B".
- Per-item buttons/forms: none (there is no floor delete or rename).
- Client components: none.
- Other notable UI: none.
- Suggested DataTable: not needed (few rows). If used: Venue (high), Floors (low).

### /admin/events/[eventId]/wods — EV/wods/page.tsx
- Data loaded: `requireAdminEvent`; `wods(id, name, scoring_type, time_cap_seconds, tiebreak_type, description, rules)` where event_id, order sort_order.
- Items listed: 1 list. Each shows name, "scoring type · N min cap", a Remove button and an Edit `<details>`. EmptyState "No WODs yet". `description` and `tiebreak_type` are only visible inside the edit form.
- Inline forms (the local `WodFields` renders the same fields in both):
  1. Add WOD, `createWod.bind(null,eventId)`:
     - `name`: text, required.
     - `scoring_type`: Select, default for_time. Options for_time "For Time", amrap "AMRAP", max_load "Max Load", points "Points", other "Other".
     - `time_cap_minutes`: number, min 0.
     - `tiebreak_type`: Select, default none. Options none, time, reps, load, points.
     - `description`: Textarea (2 rows).
  2. Per-WOD edit (inside `<details>`), `updateWod.bind(null,eventId,w.id)`. Same fields plus a hidden `rules` input (the only raw hidden input).
- Per-item buttons/forms: "Remove" calls `deleteWod.bind(null,eventId,w.id)`. ConfirmAction: yes. The Edit form's "Save changes" button is a plain form.
- Client components: ConfirmAction.
- Other notable UI: none.
- Suggested DataTable:
  - Columns: WOD (name, high), Scoring (scoring_type, high), Time cap (time_cap_seconds/60, high), Tie-break (tiebreak_type, low), Description (description, low), Actions (Edit, Remove, high).
  - Filter: scoring type. Edit could move to a dialog.

### /admin/messages — messages/page.tsx
- Data loaded: `getSessionContext` (redirects to /login if none). `getConversations(ctx.userId, ctx.organizationId)` (src/lib/db/messages.ts) reads `messages(id, sender_id, recipient_id, body, read_at, created_at)` where sender or recipient = me. It also resolves names from `athletes` and `profiles`/`member`.
- Items listed: 1 list of conversations. Each is a Link to /admin/messages/[counterpartId] showing counterpartName, counterpartSublabel (affiliate or roles), "You: " + lastMessage (truncated), and an unread-count Badge. EmptyState "No messages yet".
- Inline forms: none.
- Per-item buttons/forms: none.
- Client components: none.
- Other notable UI: new conversations are started from an athlete's profile.
- Suggested DataTable: Counterpart (high), Kind (athlete/staff, low), Last message (lastMessage, high), When (lastMessageAt, high), Unread (unreadCount, high). Filters: unread only, kind.

### /admin/messages/[counterpartId] — messages/[counterpartId]/page.tsx
- Data loaded: session (redirects to /login). `resolveCounterparts([counterpartId], orgId)`, with `notFound()` if unknown. `markThreadRead(ctx.userId, counterpartId)` (a write on render). `getThread(ctx.userId, counterpartId)` reads `messages(id, sender_id, recipient_id, body, read_at, created_at)`.
- Items listed: 1 chat-bubble list. Each message shows body (whitespace-pre-wrap) and `createdAt.toLocaleString()`. My messages are right-aligned on a primary background. Empty text "No messages yet. Say hello."
- Inline forms: Send, `sendMessage.bind(null,counterpartId)` (messages.ts). Field `body`: Textarea, required, 2 rows, placeholder "Write a message…", with an sr-only label "Message".
- Per-item buttons/forms: "Send" (plain form).
- Client components: none.
- Other notable UI: breadcrumb Messages > name.
- Suggested DataTable: not applicable (chat thread).

### /admin/sponsors — sponsors/page.tsx
- Data loaded:
  - `sponsors(id, business_name, tier, category, category_exclusive, active, event_id)` where organization_id, order created_at desc.
  - `events(id, name)` where organization_id.
- Items listed: 1 list. Each shows business_name, an Exclusive Badge ("Exclusive · {category}") if category_exclusive, the tier label (TIER_LABELS, e.g. "Logo Sponsor — $50/event"), and an active switch. EmptyState "No sponsors yet". `event_id` is selected but not displayed. `website` is never shown.
- Inline forms: Add sponsor, `createSponsor` (sponsors.ts). Fields:
  - `business_name`: text, required.
  - `tier`: Select, default logo_sponsor. Options logo_sponsor, brand_mention, commercial_30, commercial_30_plus, wod_sponsor, presenting_sponsor (labels with prices).
  - `event_id`: Select, default NONE. Options "All events" plus the org's events.
  - `category`: text, placeholder "Physical Therapy".
  - `category_exclusive`: Checkbox, "Category exclusive".
  - `website`: text.
- Per-item buttons/forms: ActionSwitch "{business_name} active", `toggleSponsorActive.bind(null,s.id)`. No ConfirmAction. There is no delete.
- Client components: ActionSwitch.
- Other notable UI: the description explains category exclusivity is enforced in the DB per event.
- Suggested DataTable:
  - Columns: Sponsor (business_name, high), Tier (tier, high), Category (category plus exclusive flag, high), Event (event_id to name or "All events", low; would need a lookup), Active (switch, high).
  - Filters: tier, active, exclusive, event.

### /admin/team — team/page.tsx (titled "Members")
- Data loaded:
  - `getSessionContext`. Redirects to /admin unless `orgCan(ctx,{member:["create"]})`.
  - `member(id, user_id, role, created_at)` where organization_id, order created_at.
  - RPC `org_member_emails({p_organization_id})`, which returns user_id, email, last_sign_in_at.
  - `profiles(id, full_name)` in the member user ids.
- Items listed: 1 list of members. Each shows name (profile full_name, then email, then "Unknown account"), the email (if different from the name), one outline Badge per role (`splitRoles(m.role)`, labelled via ROLE_LABEL) with an inline X remove button, and "Pending · Resend" when `last_sign_in_at` is null. Empty text "Nobody in the organization yet."
- Inline forms: invite, `InviteByEmailForm` with `action={inviteTeamMember}` and `roles={INVITABLE}` (every ORG_ROLES entry except owner). Fields:
  - `email`: email, required.
  - `role`: Select, required, default the first role (admin).
  - Role labels: Admin, Event director, Production director, Scoring operator, Commentator.
- Per-item buttons/forms:
  - Role X via `ConfirmFormResultAction`: `removeTeamRole.bind(null, m.id, role)`. ConfirmAction-based: yes (wraps ConfirmAction; a refusal is shown as an error, success as a toast).
  - "Resend" (InlineActionButton): `resendTeamInvite.bind(null, m.user_id)`. No ConfirmAction.
- Client components: src/components/InviteForms.tsx (InviteByEmailForm, InlineActionButton, ConfirmFormResultAction), ConfirmAction (inside).
- Other notable UI: none.
- Suggested DataTable:
  - Columns: Member (name, high), Email (email, high), Roles (badges with remove, high), Status (Pending/Active, high), Joined (created_at, low), Resend (high).
  - Filters: role, pending only.

### /admin/teams — teams/page.tsx
- Data loaded:
  - `teams(id, name, affiliate, entry_format, team_size)` where organization_id, order name.
  - `athletes(id, first_name, last_name, affiliate)` where organization_id, order last_name.
  - `team_members(id, team_id, athletes(id, first_name, last_name, affiliate))`, which is not filtered by org in the query and relies on RLS.
- Items listed:
  - 1 list of team cards. Each shows: name; affiliate; "FORMAT · N roster spots · M on roster now"; and roster Badges (athlete name plus an X remove).
  - Empty text "No roster members yet."
  - EmptyState "No teams yet".
- Inline forms:
  1. Add team, `createTeam` (teams.ts). Fields:
     - `name`: text, required.
     - `affiliate`: text.
     - `entry_format`: Select, default "team". Options pair, team, custom ("Custom format").
     - `team_size`: number, min 1, placeholder "e.g. 4".
  2. Per team, "Add to roster", `addTeamMember.bind(null,t.id)`. Rendered only if athletes are available. Field `athlete_id`: Select, default the first available athlete, label "First Last (affiliate)".
- Per-item buttons/forms:
  - "Delete team": `deleteTeam.bind(null,t.id)`. ConfirmAction: yes.
  - Roster X: `removeTeamMember.bind(null,m.id)`. ConfirmAction: yes.
  - "Add to roster": plain form.
- Client components: ConfirmAction.
- Other notable UI: none.
- Suggested DataTable:
  - Columns: Team (name, high), Format (entry_format, high), Affiliate (affiliate, low), Headcount (team_size, low), Roster (member names, high), Roster count (count, low), Actions (Add member, Delete, high).
  - Filters: format, search.

## Actions

Admin-called exported functions. "Redirects" means the action calls `redirect()`. Callers outside admin means any hit in src/ other than src/app/(app)/admin/ (comment-only mentions are noted separately).

Common error sources, not repeated for every action:
- `requireSignedIn` throws NotAuthorizedError "Please sign in again."
- `requireOrgManager` throws NotAuthorizedError "Only an admin or event director can do that." It is used by athletes, circuits, sponsors, teams, createEvent and org-level actions. Event actions use `requireEventAccess`, which throws NotAuthorizedError "You don't have access to this event."
- `parseForm`/`parseArg` throw ValidationError with the first zod issue. The templates are:
  - "<Label> is required."
  - "<Label> is too long."
  - "<Label> must be a number." / "must be a whole number." / "must be at least N." / "must be at most N."
  - "<Label> must be a valid date."
  - "<Label> isn't a valid email address."
  - "Choose a valid <label>."
  - "<Label> is missing or invalid." / "<Label> is invalid."
  - "Choose an event to add." / "Choose an athlete to add."
  - Images: "Choose an image file to upload." / "Please upload a JPEG, PNG, WebP, GIF or HEIC image." / "Image must be under 8MB."
- `expectChanged(res, what)` throws `Couldn't ${what}: ${dbMessage}` on a DB error, or NotAuthorizedError `Couldn't ${what}: not found, or not yours.` when no row changed.
- A raw Supabase `error.message` is thrown for DB failures (shown as `new Error(error.message)`).

Callers outside admin: for every function below, a grep of the whole src/ outside src/app/(app)/admin/ finds NO callers, except where stated.

### org.ts
- `bootstrapOrganization(formData)`. Throws the `error.message` from rpc bootstrap_organization. No redirect. Callers outside admin: none.

### events.ts
- `createEvent(formData)`. Redirects to /admin/events/{id}. Throws:
  - "Circuit name is required when starting a new circuit."
  - "That circuit doesn't belong to your organization."
  - "Event created, but its default venue wasn't: {msg}"
  - "Event created, but its default floor wasn't: {msg}"
  - "Event created, but its floor's broadcast state wasn't: {msg}"
  - Plus DB messages. Outside callers: none (comment mention in src/lib/actions/circuits.ts line 25 only).
- `uploadEventCoverPhoto(eventId, formData)`. No redirect. Throws the storage `uploadError.message`, the image validation messages, and `Couldn't save the cover photo: …`. Outside callers: none (comment in events.ts only).
- `removeEventCoverPhoto(eventId)`. No redirect. Throws `Couldn't remove the cover photo: …`. Outside callers: none.
- `updateEventStatus(eventId, status: EventStatus)`. No redirect. Throws "Choose a valid event status." and `Couldn't change the event status: …`. Outside callers: none.
- `deleteEvent(eventId)`. Redirects to /admin. Throws `Couldn't delete the event: …`. Outside callers: none.

### athletes.ts
- `createAthlete(formData)`. Throws `friendlyAthleteWriteError`:
  - "An athlete with this email already exists in your organization."
  - "An athlete with this phone number already exists in your organization."
  - "An athlete with this email or phone number already exists in your organization."
  - "Something went wrong saving this athlete."
  - Outside callers: none.
- `updateAthleteProfile(athleteId, formData)`. Throws the same friendly errors, plus `Couldn't save the athlete: …`. Outside callers: none.
- `deleteAthlete(athleteId)`. Throws `Couldn't delete the athlete: …`. Outside callers: none.
- `saveAthleteLifts(athleteId, formData)`. Throws:
  - `${label} must be a time like mm:ss.`
  - `${label} must be a weight between 0 and 2000 lbs.`
  - "That athlete isn't on your organization's roster."
  - Outside callers: none (src/lib/actions/myLifts.ts has a comment saying it mirrors this).
- `upsertAthleteBenchmark(athleteId, formData)`. Throws "That athlete isn't on your organization's roster." Outside callers: none (comment mention in myLifts.ts).
- `deleteAthleteBenchmark(athleteId, benchmarkId)`. Throws "That athlete isn't on your organization's roster." and `Couldn't remove the benchmark: …`. Outside callers: none (comment mention in myLifts.ts).
- `uploadAthletePhoto(athleteId, formData)`. Throws "That athlete isn't on your organization's roster.", the storage error message, the image messages, and `Couldn't save the photo: …`. Outside callers: none (comment in events.ts).
- `removeAthletePhoto(athleteId)`. Throws `Couldn't remove the photo: …`. Outside callers: none (comment in events.ts).

### payments.ts
- `markPaymentStatusForCheckin(athleteId, eventId, registrationId, status: PaymentStatus)`. Throws "Athlete is missing or invalid.", "Choose a valid payment status." and "That registration isn't part of this event." Outside callers: none.
- `updateRegistrationPayment(eventId, registrationId, formData)`. Throws "That registration isn't part of this event.", "That fee isn't part of this event.", "Enter a valid amount." and "Amount is too large." Outside callers: none.
- `markPaymentStatus(eventId, registrationId, status)`. Throws "Choose a valid payment status." and "That registration isn't part of this event." Outside callers: none (comment in the same file).
- None of the payment actions redirect.

### circuits.ts
- `createCircuit(formData)`. Redirects to /admin/circuits/{id}. Outside callers: none (comment in events.ts).
- `deleteCircuit(circuitId)`. Redirects to /admin/circuits. Throws `Couldn't delete the circuit: …`. Outside callers: none.
- `addEventToCircuit(circuitId, formData)`. No redirect. Throws "That circuit doesn't belong to your organization." and `Couldn't add the event to this circuit: …`. Outside callers: none.
- `removeEventFromCircuit(circuitId, eventId)`. No redirect. Throws `Couldn't remove the event from this circuit: …`. Outside callers: none.

### messages.ts
- `sendMessage(recipientId, formData)`. No redirect. Throws "Recipient is missing or invalid.", "Message is required.", "Message is too long.", NotAuthorizedError "You can't message this person." (on a 42501 RLS refusal) and the DB message. Outside callers: **src/app/(app)/athlete/messages/[counterpartId]/page.tsx** (import at line 8, used as `action={sendMessage.bind(null, counterpartId)}` at line 94).

### sponsors.ts
- `createSponsor(formData)`. Throws:
  - "That event doesn't belong to your organization."
  - `Another active sponsor already holds exclusive category "${f.category}" for this event.`
  - Outside callers: none.
- `toggleSponsorActive(sponsorId, active: boolean)`. Throws "Invalid sponsor status.", "Another active sponsor already holds this sponsor's exclusive category." and `Couldn't update the sponsor: …`. Outside callers: none.

### team.ts
- These actions return `FormResult` (`{ok,message}`) and do not throw user-facing errors. `failure()` converts ValidationError, NotAuthorizedError, InviteError and BetterAuth APIError into `{ok:false,message}`. Other errors rethrow. They do not redirect. Outside callers: none.
- `inviteTeamMember(_previous, formData)`. Messages:
  - "Invitation sent." / "Access granted and notified." / "Saved, but the email didn't send — use Resend."
  - Errors: "Only an owner or admin can manage the team.", "Ownership can't be granted by invitation.", "Only an owner or admin can invite to the team."
- `resendTeamInvite(userId, _previous)`. Messages:
  - "That person isn't on this team."
  - "They have already signed in; there's nothing to resend."
  - "Invitation sent again."
  - "The invitation email was not sent. Try again later."
- `removeTeamRole(memberId, role, _previous)`. Messages:
  - "That person isn't on this team."
  - "Role removed." / "Removed from the team."
  - "The organization must keep an owner."

### teams.ts
- `createTeam(formData)`. Throws "Headcount must be a whole number." plus validation messages. Outside callers: none.
- `deleteTeam(teamId)`. Throws `Couldn't delete the team: …`. Outside callers: none.
- `addTeamMember(teamId, formData)`. Throws:
  - "That team doesn't belong to your organization."
  - "That athlete doesn't belong to your organization."
  - "That athlete is already on this team's roster."
  - Outside callers: none.
- `removeTeamMember(teamMemberId)`. Throws:
  - "That roster entry doesn't exist."
  - "That team doesn't belong to your organization."
  - `Couldn't remove the team member: …`
  - Outside callers: none.

### registrations.ts
- `registerAthlete(eventId, _prevState:{error:string}, formData)`. Returns `{error}` for expected failures and does not throw them. Outside callers: none.
  - "That division isn't part of this event."
  - "That athlete isn't in this event's organization."
  - "This athlete is already registered in this division/category."
  - It also returns validation and authorization messages.
  - It sets cookie `repone_last_division_${eventId}`.
- `registerTeam(eventId, _prevState, formData)`. Returns `{error}`. Outside callers: none.
  - "That team isn't in this event's organization."
  - "This team is already registered in this division/category."
  - Also the division message above.
- `removeRegistration(eventId, registrationId)`. Throws `Couldn't remove the registration: …`. Outside callers: none.
- None redirect.

### divisions.ts
- `createDivision(eventId, formData)`. Outside callers: none.
- `deleteDivision(eventId, divisionId)`. Throws `Couldn't remove the division: …`. Outside callers: none.

### venues.ts
- `addFloor(eventId, venueId, formData)`. Throws "That venue doesn't belong to this event." and "Floor added, but its broadcast state wasn't: {msg}". Outside callers: none.

### fees.ts
- `createFeeSchedule(eventId, formData)`. Throws "That division isn't part of this event.", "Enter a valid fee amount." and "Fee amount is too large." Outside callers: none.
- `toggleFeeScheduleActive(eventId, feeScheduleId, active: boolean)`. Throws `Couldn't update the fee: …`. Outside callers: none.
- `deleteFeeSchedule(eventId, feeScheduleId)`. Throws `Couldn't remove the fee: …`. Outside callers: none.

### expenses.ts
- `createExpense(eventId, formData)`. Throws "Enter a valid expense amount." and "Expense amount is too large." Outside callers: none.
- `deleteExpense(eventId, expenseId)`. Throws `Couldn't remove the expense: …`. Outside callers: none.

### eventStaff.ts
- Returns `FormResult` (for invite and resend); remove actions throw. Needs `orgCan({staff:["invite"]})`, otherwise NotAuthorizedError "Only an admin or event director can manage event staff." Outside callers: none.
- `inviteEventStaff(role, eventId, _previous, formData)`. Returns the invite messages listed above.
- `resendEventInvite(eventId, userId, _previous)`. Returns:
  - "That person isn't on this event's staff."
  - "They have already signed in; there's nothing to resend."
  - "Invitation sent again."
- `removeEventScorekeeper(eventId, assignmentId)`, `removeEventProducer(...)` and `removeEventCommentator(...)`. Throw `Couldn't remove the scorekeeper|producer|commentator: …`. They soft-delete (status="removed").

### wods.ts
- `createWod(eventId, formData)`. Outside callers: none.
- `updateWod(eventId, wodId, formData)`. Throws `Couldn't save the WOD: …`. Outside callers: none.
- `deleteWod(eventId, wodId)`. Throws `Couldn't remove the WOD: …`. Outside callers: none.

### heats.ts
- Access is `requireEventAccess(eventId, ["producer"])`, so producers can also use these.
- `createHeat(eventId, formData)`. Throws NotAuthorizedError "That floor isn't part of this event." / "That WOD isn't part of this event." / "That division isn't part of this event." and "Couldn't add the heat's lanes: {msg}". Outside callers: none.
- `deleteHeat(eventId, heatId)`. Throws `Couldn't remove the heat: …`. Outside callers: none.
- `generateHeats(eventId, formData)`. Throws:
  - "Heats already exist for this WOD/Division — remove them first (or use Add Single Heat) before generating a new set, so no one ends up double-booked."
  - "No registered athletes/teams found for this division — register participants first."
  - It sets cookie `repone_lanes_per_heat_${eventId}`.
  - Outside callers: none (comment in registrations.ts).
- `finishHeat` and the other exports in heats.ts are not called by any admin page.

### lanes.ts
- `assignLane(eventId, heatId, laneId, _prevState:{error:string}, formData)`. Returns `{error}`. Outside callers: none. Messages:
  - "That heat isn't part of this event."
  - "That athlete isn't registered in this heat's division."
  - "This athlete is already assigned to Lane {n} in this heat ({category}) — remove them from that lane first."
  - "This athlete is already registered in another heat/category — Heat {h}, Lane {n} ({category}) — remove them from there first."
  - "This athlete is already registered in another lane/heat for this category."
  - "Couldn't save the lane: not found, or not yours."

### results.ts
- `saveHeatResults(eventId, heatId, wodId, divisionId, scoringType, floorId, athleteIds: string[], formData)`. Redirects to /admin/events/{eventId}/heats. Throws:
  - "The list of athletes isn't valid."
  - NotAuthorizedError "One of those athletes isn't in this heat."
  - "This heat's WOD no longer exists."
  - "<Time> must be a time like 3:45, or seconds." (from `field.clock`)
  - Outside callers: none (comment in heats.ts). Access is scorekeeper or producer.
- `enterResult` is not called by admin pages.

## Shared/test conventions

Vitest:
- Config is /Users/cfboy/Documents/GitHub/repone-platform/vitest.config.mts:
  ```ts
  export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: { environment: "node", include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
  });
  ```
- No `setupFiles` and no global setup. `globals` is off, so tests import `describe/it/expect/vi/afterEach` from "vitest".
- The default environment is node. Component tests opt into jsdom per file with a first-line `// @vitest-environment jsdom`. jsdom ^30 is installed.
- Libraries: `@testing-library/react` ^16 (`render`, `screen`, `cleanup`, `waitFor`) and `@testing-library/user-event` ^14. There is no jest-dom, so assertions use `toBeTruthy()`, `toBeNull()`, `getAttribute()` and `hasAttribute()`.
- Cleanup is manual: `afterEach(cleanup)`.
- Mocking uses `vi.mock` and `vi.hoisted`. Server-only modules are mocked, e.g. OperatorShell.test.tsx mocks "@/components/app/ModuleMenu", and ModuleMenu.test.tsx has a comment about its server-only import throwing in jsdom.
- Scripts: `"test": "vitest run"`, `"ui:guard": "tsx scripts/ui-guard.ts"`, `"lint": "eslint"`, `"typecheck": "next typegen && tsc --noEmit"`, `"check": "pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm ui:guard"`.
- Existing tests:
  - Components: src/components/app/{moduleMenuItems.test.ts, ConfirmAction.test.tsx, ModuleMenu.test.tsx, EmptyState.test.tsx}, src/components/shells/{OperatorShell.test.tsx, AdminSidebar.test.ts, EventTabs.test.ts}.
  - Lib: src/lib/design/{contrast.test.ts, uiGuard.test.ts}, src/lib/auth/{emails,formErrors,modules,permissions}.test.ts, src/lib/timer/compute.test.ts, src/lib/scoring/{ageCategory,rank,divisionOrder,formatResult}.test.ts, src/lib/broadcast/heatOnAir.test.ts, src/lib/validation/form.test.ts.
  - There are no tests for the admin pages or the server actions.
  - Other check scripts that are not vitest: scripts/{auth-check,authz-check,invite-check,rls-check,standings-check,timer-check,token-check}.ts.

Example: src/components/app/ConfirmAction.test.tsx:
- First line `// @vitest-environment jsdom`. Mocks sonner with `vi.hoisted`: `vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))`.
- A `Boundary` class component stands in for Next's redirect boundary. A `setup()` helper renders `<ConfirmAction trigger="Remove" title="Remove Heat 3?" description="Its lanes and results are deleted." confirmLabel="Remove heat" onConfirm={vi.fn().mockResolvedValue(undefined)}/>` with `userEvent.setup()`. `afterEach` runs cleanup and clears the toast mock.
- Tests:
  1. Nothing runs until confirmed (alertdialog appears, onConfirm not called).
  2. Cancel closes without running.
  3. Confirm runs exactly once even on a double click (`user.dblClick`).
  4. A rejecting action leaves the dialog open and retryable.
  5. A redirect error (digest "NEXT_REDIRECT;replace;/admin;307;") is rethrown to the boundary and not toasted. It checks for "redirected" text and `expect(toastError).not.toHaveBeenCalled()`.
  6. An ordinary failure calls `toast.error("Nope")`.
  7. Controlled mode with `open`/`onOpenChange` and no trigger.
- Queries are by role and accessible name: `getByRole("button", {name:"Remove"})`, `getByRole("alertdialog")`.

scripts/ui-guard.ts:
- Run with `pnpm ui:guard [paths…]`. The default roots are `src/app` and `src/components`.
- It skips `src/components/ui`, `src/components/graphics` and `src/app/(overlay)`, and ignores `*.test.ts(x)`.
- It walks the `.ts` and `.tsx` files, runs `checkSource(file, text)` from src/lib/design/uiGuard.ts line by line, prints `file:line  [rule] message` plus the offending line, then "N violation(s)." (exit 1) or "ui-guard: clean" (exit 0).
- Rules live in `GUARD_RULES` in src/lib/design/uiGuard.ts. Each is `{id, pattern: RegExp, message}`, tested per source line:
  - `control-btn`: `/\bcontrol-btn\b/`. Use `<Button>` (size="touch" for live controls).
  - `confirm`: `/\b(?:window\.)?confirm\(/`. Use `<ConfirmAction>`.
  - `light-colour`: `/\b(?:text|bg|border)-(?:black|white)(?:\/\d+)?\b(?![\w-])/`. Use theme tokens.
  - `status-colour`: `/\b(?:text|bg|border)-(?:green|red|amber|yellow|blue|emerald|orange)-\d{2,3}\b/`. Use success/warning/destructive/brand-text tokens.
  - `dim-text`: `/\btext-(?:white|black|foreground)\/[1-5]0\b/`. Below AA on dark; use text-muted-foreground.
  - `raw-control`: `/<(?:select|textarea)\b|<input\b(?![^>]*type=["']hidden["'])/`. Use the shadcn Input/Select/Textarea/Checkbox/Switch. Hidden inputs are allowed.
  - `focus`: `/\boutline-none\b(?![^"'`]*focus-visible:)/`. Keep a visible focus style.
  - `emoji`: `/[\u{1F300}-\u{1FAFF}]/u`. Use a lucide-react icon.
- Excerpt of how a rule is written:
  ```ts
  { id: "confirm", pattern: /\b(?:window\.)?confirm\(/, message: "Use <ConfirmAction>." },
  ```
- Exemption: `ui-guard-ignore: <reason>`. The marker needs a non-empty reason (`/ui-guard-ignore:\s*\S/`). It exempts its own line, and a comment-only marker line (starting `//`, `{/*` or `/*`) also exempts the next line. A marker without a reason is ignored.
  ```ts
  const MARKER = /ui-guard-ignore:\s*\S/;
  const COMMENT_ONLY = /^(?:\/\/|\{\/\*|\/\*)/;
  ```
- The guard itself is tested in src/lib/design/uiGuard.test.ts (a `rules(src)` helper that maps `checkSource("x.tsx", src)` to rule ids). The spec reference is docs/superpowers/specs/2026-10-02-design-system-foundation-design.md §4. DESIGN.md line 283 says to run `pnpm ui:guard`.
- New admin tables must use shadcn Table, Button, Input, Select, Checkbox and ConfirmAction, and must not use raw `<input>`, `<select>`, `window.confirm`, bg-white or text-green-*.