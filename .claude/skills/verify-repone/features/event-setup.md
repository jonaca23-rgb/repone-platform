# Set up an event

An admin creates an event and prepares it to run: divisions, WODs, floors, athlete registrations, generated heats with lanes, staff assignments, fees and payments.

## Sub-features

- `setup-event` create an event (standalone or in a circuit) → its event page.
- `setup-divisions` add / remove divisions.
- `setup-wods` add a WOD (scoring type, time cap, tie-break), edit, remove.
- `setup-floors` every event gets a default venue and `Floor A`; add more floors.
- `setup-registrations` register athletes (or teams) into divisions; duplicates are refused.
- `setup-heats` generate heats for a floor/WOD/division from its registrations (lanes filled), or add a single heat.
- `setup-staff` assign scorekeepers, producers, commentators.
- `setup-fees-payments` define fees, apply them, mark registrations paid/waived.

## How to get to it (user POV)

- Sign in as `admin@repone.test` → start page `/` → `Admin` card → `/admin` (`Events`) → create form → the event page `/admin/events/<id>`. The sidebar then shows the event's sections: `Overview`, `Venues`, `Divisions`, `Athletes`, `WODs`, `Heats`, `Staff`, `Fees`, `Payments`, `Statement` (page headings are longer, e.g. `Heats & lanes`, `Athletes & registrations`).

## Driving it with Chrome DevTools MCP

Preconditions:

- `doctor.sh` exits 0.
- Use a throwaway event name, e.g. `Verify Event <timestamp>`, so the run never touches the seed event.
- Evidence folder: `dir=$(scripts/evidence.sh event-setup)`.

- **Create the event.** Admin context, `/admin`: `fill` `Event name` = `Verify Event <ts>`, keep `Single Event or Circuit?` = `Single Event (standalone)`, `click` `New Event`. Lands on `/admin/events/<newId>` with the event name as `<h1>`. Save `<newId>` from the URL.
- **Division.** `Divisions` → `fill` `Division name` = `Rx Female`, `click` `Add Division`. The row `Rx Female` with `Remove` appears.
- **WOD.** `WODs` → `Name` = `Verify WOD`, `Scoring type` = `For Time`, `Time cap (minutes)` = `12`, `Tie-break` = `Time`, `click` `Add WOD`. Row reads `Verify WOD` / `for time · 12 min cap`.
- **Floor.** `Venues` shows `Floor A` already (created with the event).
- **Registrations.** `Athletes` (heading `Athletes & registrations`) → in the `Register an athlete` form choose `Athlete` = `Rivera, Maria` (option text as listed), `Division` = `Rx Female`, `click` that form's `Register`. Repeat for `Sofia Delgado`. Registering Maria again → `This athlete is already registered in this division/category.` shows inline under the form and as a toast (no native alert).
- **Heats.** `Heats` → `Generate Heats`: `Floor` = `Floor A`, `WOD` = `Verify WOD`, `Division` = `Rx Female (2 registered)`, `Lanes per heat` = `6`, `click` `Generate Heats`. List shows `Verify WOD — Heat 1 / 1`; opening it lists lanes with Maria and Sofia assigned.
- **Staff.** `Staff` → `Scorekeepers` section `Account` = `Sam Scorekeeper (Staff)`, `click` `Assign`. The row appears. DB: `scripts/q.sh "select count(*) from event_scorekeeper_assignments where event_id='<newId>'"` → `1`.
- **Proof.** Screenshot each section after its change (`$dir/<section>.png`) and `scripts/q.sh "select (select count(*) from divisions where event_id='<newId>'), (select count(*) from registrations where event_id='<newId>'), (select count(*) from heats where event_id='<newId>'), (select count(*) from lanes l join heats h on h.id=l.heat_id where h.event_id='<newId>' and l.athlete_id is not null)" > $dir/event.db.txt`.
- **Cleanup.** On `/admin` click `Delete event` on the throwaway event's card → dialog `Delete Verify Event <ts>?` → `click` the dialog's `Delete event`. It disappears from the list.

## Gotchas

- `Athletes & registrations` has two `Register` buttons and two `Division` / `Bib #` fields (athlete form and team form). Pick uids inside the `Register an athlete` form.
- `Generate Heats` refuses when heats already exist for that WOD/division, and when the division has no registrations. Register first.
- Server-action errors on most admin forms have no inline message: a failure shows Next's error overlay. Screenshot it as evidence of the failure.
- There is no "create venue" form; each event has one default venue with `Floor A`.
- Never run this against the seed event `Aprieta Entry Level`: scoring and production recipes depend on its exact heat and lanes.
