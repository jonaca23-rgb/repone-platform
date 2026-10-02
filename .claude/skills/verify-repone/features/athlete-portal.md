# Athlete portal

Athletes sign up or sign in, complete a profile, log lifts and benchmarks, browse other athletes, like profiles and message athletes or staff.

## Sub-features

- `athlete-signup` create an account with email/password → onboarding.
- `athlete-login` email/password sign-in at the single `/login` (Google is off locally).
- `athlete-onboarding` first/last name, affiliate, email, phone, date of birth, gender → `/athlete`.
- `athlete-lifts` save lifts/run times and benchmark workouts on the home page.
- `athlete-directory` search athletes, open a profile, add a roster athlete.
- `athlete-messages` message another athlete or staff; thread shows the message and marks read.
- `athlete-like` like another athlete's profile.

## How to get to it (user POV)

- `/` → `Athlete Portal`, or `/login` / `/signup` (the old `/athlete/login` and `/athlete/signup` redirect).
- Nav after onboarding: `Home` (`/athlete`), `Athletes` (`/athlete/directory`), `Messages`.

## Driving it with Chrome DevTools MCP

Preconditions:

- `doctor.sh` exits 0. `athlete@repone.test` is onboarded (Maria Rivera); `new-athlete@repone.test` is not.
- Evidence folder: `dir=$(scripts/evidence.sh athlete-portal)`.

- **Sign in.** `new_page url=http://localhost:3200/login isolatedContext=verify-athlete`, `fill_form` `Email` / `Password`, `click` `Sign In` → `/athlete` with heading `Welcome, Maria`.
- **Onboarding.** In a new context sign in as `new-athlete@repone.test` → lands on `/athlete/onboarding` (`Tell us about yourself`). `fill_form` `First name` `Nina`, `Last name` `Nueva`; set `Date of birth` with `evaluate_script`; `click` `Continue` → `/athlete`, `Welcome, Nina`. DB: `scripts/q.sh "select first_name from athletes where email='new-athlete@repone.test'"` → `Nina`.
- **Lifts.** On `/athlete` `fill` `Deadlift (lbs)` = `315`, `click` `Save Lifts`; reload — the value persists. DB: `scripts/q.sh "select weight_lbs from athlete_lifts where lift='deadlift' and athlete_id='00000000-0000-0000-0000-000000000061'"` → `315`.
- **Directory.** `click` `Athletes`, `fill` the search box (placeholder `Search athletes by name or affiliate…`) with `Delgado`, open `Sofia Delgado` → `/athlete/directory/00000000-0000-0000-0000-000000000062`, which shows `Sofia hasn't created a RepOne account yet — no way to message them.`
- **Message staff.** `Messages` → under `Message Staff` open `Ada Admin` → fill the textarea (placeholder `Write a message…`) with `Hello from verify`, `click` `Send`. The thread shows it. In the admin context (left open on `/admin`, no reload) the `MESSAGES` nav link gains an unread count badge live through Realtime; a reload also shows it (server count), so check the badge before reloading. `/admin/messages` lists the conversation. DB: `scripts/q.sh "select body from messages order by created_at desc limit 1"`.
- **Proof.** Screenshots `$dir/home.png`, `$dir/onboarding-done.png`, `$dir/thread.png`, `$dir/admin-inbox.png`, and the DB queries in `$dir/*.db.txt`.
- **Reset.** `scripts/fixtures.sh reset-onboarding` so the next run can onboard `new-athlete@` again.

## Gotchas

- Sign-up of a brand-new email creates a real BetterAuth user (password ≥10 chars) and needs email verification: read the link in Mailpit (see the Invite recipe in access-control.md), open it, and you land on an empty start page, where `Create my athlete profile` leads to onboarding. Use a unique `verify+<ts>@example.test` address and afterwards delete its messages, its `athletes` row and its `"user"` row with `psql "$DATABASE_URL"` (sessions/accounts cascade). `Sign out` ends in a full page load on `/login`; `/api/supabase-token` then answers 401.
- The like button's accessible name is only its count (empty at 0): find it by its position after the profile heading in the snapshot, not by name.
- Only onboarded athletes (linked to an `athletes` row) can message; `new-athlete@` must finish onboarding first.
- Staff contacts appear only for staff in the athlete's organization (the seed admin is `Ada Admin`).
