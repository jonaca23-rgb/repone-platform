# Role access and private athlete data

Everyone signs in at one `/login` and lands on the start page with cards for the modules their permissions open (an athlete-only account is forwarded on to `/athlete`); nobody can open a module their permissions don't cover; athlete email, phone and date of birth are visible only to staff and the athlete themselves, never on public pages.

## Sub-features

- `access-landing` sign-in lands on `/`: admin, scorekeeper, producer and commentator end on `/` with their module cards; `athlete@` (athlete-only) is forwarded on to `/athlete`; `new-athlete@` ends on `/` with the empty start page and `Create my athlete profile`.
- `access-admin-gate` a non-admin opening any `/admin/*` URL is redirected to the start page `/`.
- `access-signed-out` a signed-out visitor opening a staff URL is sent to `/login`.
- `access-pii-staff` admin sees an athlete's email/phone/date of birth and age category on the roster and athlete page.
- `access-pii-public` public pages and other athletes never see them (the directory profile of another athlete shows no age category).

## How to get to it (user POV)

- `/login` for everyone (`/athlete/login` redirects to it). `/` is the start page with a card per module the account may open.
- Deep links: `/admin/athletes/<id>`, `/scorekeeper`, `/producer`, `/commentator`.
- Public: `/live`, `/overlay/<floorId>/*`, `/athlete/directory/<id>` as another athlete.

## Driving it with Chrome DevTools MCP

Preconditions:

- `doctor.sh` exits 0.
- Evidence folder: `dir=$(scripts/evidence.sh access-control)`.

- **Landing per role.** For each of `admin`, `scorekeeper`, `producer`, `commentator`: `new_page url=http://localhost:3200/login isolatedContext=verify-<role>`, sign in, then `evaluate_script () => location.pathname` after the redirect settles. Expect `/` for each, with that role's module cards in the snapshot. `new-athlete@repone.test` also ends on `/` (empty start page, `Create my athlete profile`). `athlete@repone.test` on the same form is forwarded on to `/athlete`.
- **Admin gate.** In the scorekeeper context `navigate_page url=http://localhost:3200/admin/athletes/00000000-0000-0000-0000-000000000062`. The page ends on `/` (the start page), and no email is rendered.
- **Signed out.** `new_page url=http://localhost:3200/admin isolatedContext=verify-anon` → ends on `/login`. After `Sign out` from the account menu (full page load) `/api/supabase-token` answers 401.
- **Staff sees private data.** In the admin context open `/admin/athletes/00000000-0000-0000-0000-000000000062`. Snapshot: heading `SofiaDelgado`, textbox `Email` value `sofia@example.test`, a `Phone` textbox, a `Date of birth` date input.
- **Public never does.** `curl -s http://localhost:3200/overlay/00000000-0000-0000-0000-000000000030/lanes | grep -c example.test` → `0` while names (`Rivera`, `Delgado`) are present. The same for `/live/00000000-0000-0000-0000-000000000010`.
- **Other athletes don't.** In the athlete context open `/athlete/directory/00000000-0000-0000-0000-000000000062`: `Sofia Delgado`, `Box 787`, and no age-category line (even when Sofia has a date of birth set).
- **Proof.** `$dir/landing.txt` with each account's final pathname (`/` for the four staff accounts and `new-athlete@`, `/athlete` for `athlete@`) and the cards shown, `take_screenshot filePath=$dir/admin-athlete.png`, `$dir/athlete-directory.png`, and the curl outputs in `$dir/public.txt`. Sign-in and sign-out end in a full page load (BetterAuth), so re-snapshot afterwards.

## Gotchas

- The database side of these rules is covered exhaustively by `pnpm db:rls-check` (30+ checks as each account); run it when changing policies. This recipe proves the UI paths.
- Staff landing is now `/` (start page) when an account has more than one module; the module layouts send outsiders to `/`, not to their own screen.
- An age category needs both a date of birth and a gender, and only shows for ages 35+ (`35-44`, `45+`).
- Seeded athletes have no date of birth or phone; set one on the admin athlete page first if the recipe needs it, and clear it afterwards.
- Use a separate `isolatedContext` per role, or the last login wins for every page in that context.
- Sign-in and sign-up are rate limited by BetterAuth: 3 requests per 10 s from one IP (all local contexts share it). Signing in four roles back to back can show `Too many attempts. Wait a few seconds and try again.`; wait 10 s and submit again.

## Invite recipe (email in Mailpit)

Preconditions: admin context signed in; a unique address like `verify+<ts>@example.test`.

- **Send.** `Members` in the admin sidebar (`/admin/team`) -> invite the address as `Scorekeeper` (org-wide), or on `/admin/events/<eventId>/staff` invite per role. The event page shows `Pending` with `Resend`.
- **Read the mail.** `curl -s http://127.0.0.1:54524/api/v1/messages` lists messages; `curl -s http://127.0.0.1:54524/api/v1/message/<ID>` has the `/invite?token=` link in `Text`/`HTML` (or open http://127.0.0.1:54524 in the browser).
- **Accept.** In a fresh `isolatedContext`, open the link, set a password (10+ chars) -> `/login?invited=1`, sign in -> start page with the `Scorekeeper` card.
- **Cleanup.** Delete the address's `"user"` row (and any invitation rows) with `psql "$DATABASE_URL"`.
