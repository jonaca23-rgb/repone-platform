# Unified sign-in, role areas and invitations — Design

**Date:** 2026-10-02
**Status:** approved in conversation; awaiting review of this written spec
**Branch:** `feat/unified-auth`, stacked on `feat/better-auth` (#8). The PR targets `staging` and merges after #8.
**Model:** the sibling repo `~/Documents/GitHub/school-schedule`:
- one `/login`
- `/` resolves where a signed-in person belongs
- each area's layout guard sends outsiders back to `/`
- the `/invite`, `/forgot-password` and `/reset-password` flows share one set-password form
- SMTP mail through `lib/mailer.ts`

## Problem

RepOne has two separate front doors:
- `/login` for staff. Everyone lands on `/admin`, whose layout bounces non-admins through `staffLandingPath`.
- `/athlete/login`, `/athlete/signup` and `/athlete/onboarding` for athletes. Google exists only there.

People have to know which door is theirs. Signing up means becoming an athlete, so a staff account can end up with an athlete profile it never wanted. That already happened to the dev admin, and it later collided on the phone number. The app also sends no email at all, which causes three gaps:
- No password reset.
- No email verification.
- No way to bring in staff except picking from accounts that already exist, athletes included.

## Goals

1. **One way in.** One sign-in and one sign-up for everyone, with Google on both.
2. **After sign-in, the app decides where you go** based on what you are. People with more than one role see all their options.
3. **Two doors, one purpose each.** Public sign-up is for future athletes. Staff arrive only by invitation, for organization-wide roles or for one event.
4. **Mail-backed account safety.** Email verification is required for password accounts, and password reset is available.
5. **Every area rejects outsiders without loops.**

## Non-goals

- Passkeys. school-schedule has them; RepOne doesn't need them now.
- Remembering a selected "active area" in the session. Areas are recomputed per request.
- Changing what any role may *do*. The action guards (`requireOrgManager`, `requireEventAccess`, …) and the RLS policies on data tables stay as they are.
- `/live` and the overlays. They stay public.

## Decisions (from the conversation)

| Question | Decision |
|---|---|
| Someone with several roles | They see every option: a start page with one card per area, plus a header menu to switch areas |
| What a fresh sign-up is | An account with no role. The athlete profile is created by choice, and only from the start page |
| How staff join | By email invitation only, both org-wide (from the new Team page) and per event (from the event staff page) |
| Mail scope | Invitations, password reset, and required email verification |
| Unverified password account | Cannot sign in until verified |
| Architecture | A computed `userAreas()`, `/` as resolver, and layout guards that return to `/` (no session state) |

---

## 1. Routes and auth screens

A route group `(auth)` gets its own layout: a centered card with the RepOne logo and no app header.

| Route | Behaviour |
|---|---|
| `/login` | Email and password, "Continuar con Google", and "¿Olvidaste tu contraseña?". With a session it redirects to `/`. It reads `?reset=1`, `?invited=1` and `?verified=1` to show a notice. |
| `/signup` | Name, email and password, plus Google. On submit it goes to `/verify-email?email=…`. With a session it redirects to `/`. |
| `/verify-email` | "Te enviamos un correo a x@y.com", with a resend button. The emailed link verifies the account, signs the person in and lands on `/`. |
| `/forgot-password` | Takes an email and sends a reset link. It shows the same confirmation whether or not the account exists. |
| `/reset-password?token=` | New-password form. Success goes to `/login?reset=1`. An invalid or expired token shows "Este link ya no sirve" with a link to `/forgot-password`. |
| `/invite?token=` | The same set-password form, for invited staff, plus a "Continuar con Google" option. Success goes to `/login?invited=1`. An expired token shows "Este link ya no sirve, pídele al organizador que te reenvíe la invitación". |

**Changes to existing routes:**
- `/athlete/login` → permanent redirect to `/login`, keeping the query string.
- `/athlete/signup` → permanent redirect to `/signup`, keeping the query string.
- `/athlete/onboarding` stays. It redirects to `/login` without a session and to `/athlete` when a profile already exists. Nothing redirects into it automatically.
- Sign-in, Google, and verification all end at `/`.
- Sign-out always ends at `/login`, with a full page load as today.
- The (app) home page's links to the two old doors become one "Entrar" link to `/login`.

## 2. Areas, the resolver and the guards

### `userAreas(ctx)`

`userAreas(ctx)` lives in `src/lib/auth/areas.ts`. It is server-only, wrapped in React `cache()` so it runs once per request, and its queries run in parallel.

```ts
type AreaKind = "admin" | "producer" | "scorekeeper" | "commentator" | "athlete";
interface Area {
  kind: AreaKind;
  href: string;
  label: string;       // "Admin", "Producción", "Scorekeeper", "Comentarista", "Atleta"
  detail: string;      // org name, event names, or athlete name
}
```

| Area | Granted by | Href |
|---|---|---|
| `admin` | `user_roles.role` in (`admin`, `event_director`) | `/admin` |
| `producer` | `user_roles.role = production_director`, or an active `event_producer_assignments` row | `/producer` |
| `scorekeeper` | `user_roles.role = scoring_operator`, or an active `event_scorekeeper_assignments` row | `/scorekeeper` |
| `commentator` | `user_roles.role = commentator`, or an active `event_commentator_assignments` row | `/commentator` |
| `athlete` | an `athletes` row with `auth_user_id = user` | `/athlete` |

The org-manager roles keep their existing implicit access to event screens through the action guards. They don't get extra cards unless they also hold that role or assignment.

### `resolveHome(areas)` (pure)

| Areas | Result |
|---|---|
| exactly `[athlete]` | redirect `/athlete` |
| none | the empty start page |
| anything that includes a staff area | the start page with one card per area, plus a "Crear mi perfil de atleta" card when there is no athlete area |

### `/` with a session

`/` runs `resolveHome(userAreas(ctx))`:

- **Empty start page:** one primary action, **"Crear mi perfil de atleta"**, which goes to `/athlete/onboarding`. Below it, small text: "¿Te invitaron como staff? Usa el link de tu correo."
- **Start page with cards:** "Hola, <nombre>", with a card per area showing the label, the detail and a link.
- The "Crear mi perfil de atleta" action appears **only** on the start page.

Without a session, `/` keeps today's public landing.

### Guards

The layouts for `/admin`, `/producer`, `/dashboard`, `/scorekeeper` and `/commentator` call `requireArea(...kinds)`. It redirects to `/login` without a session, and to `/` when none of the given kinds is in `userAreas`.

| Layout | Admits |
|---|---|
| `/admin` | `admin` |
| `/producer`, `/dashboard` | `producer`, `admin` |
| `/scorekeeper` | `scorekeeper`, `admin` |
| `/commentator` | `commentator`, `admin` |

- **Why `admin` is in every row:** org managers can reach every event screen today. The current staff layouts only require a session, and the per-event layouts allow managers. Admitting `admin` keeps that access. Their start page still shows only the areas they actually hold.
- The per-event layouts (`/producer/events/[eventId]`, …) keep their existing per-event checks unchanged.
- `/` never redirects into an area the person lacks, so there are no loops.
- `staffLandingPath` and the `/admin` bounce are removed.
- `/athlete` pages keep their own checks. Without a profile they go to `/`, not to `/athlete/login`.

### Header

The (app) header gets an account menu with the person's name. It contains:
- "Inicio" (`/`)
- one entry per area
- "Cerrar sesión"

## 3. Mail, verification and invitations

### Mailer

`src/lib/mailer.ts` is ported from school-schedule:
- `server-only`, nodemailer over SMTP, configured only by `SMTP_URL`.
- `MAIL_FROM` sets the sender.
- Messages are plain HTML with a text alternative, written in Spanish.
- **Local:** `SMTP_URL=smtp://127.0.0.1:54525` goes to the Mailpit that `pnpm dev` already starts (UI at http://127.0.0.1:54524). `pnpm env:local` writes it.
- **Production:** the provider's SMTP relay. Add it to `.env.example` and to the README's Production section.

### BetterAuth

- `emailAndPassword.requireEmailVerification: true`. Signing in unverified fails with a clear message. The form re-sends the email and routes to `/verify-email`.
- `emailVerification`:
  - `sendOnSignUp: true`
  - `autoSignInAfterVerification: true`
  - `expiresIn: 24 h`
  - the callback goes to `/`
- `emailAndPassword.sendResetPassword` sends a link to `/reset-password` with `resetPasswordTokenExpiresIn: 1 h`. A reset revokes the person's other sessions.
- Google is unchanged; its accounts arrive verified. The existing `accountLinking` rule stays: Google links only to a verified account.

### Invitations

The flow is shared by both places that invite:

1. The inviter enters an email and a role.
2. **Existing account:** grant the role. Email "Te asignaron como <rol> en <org/evento>" with a link to `/login`.
3. **No account:**
   - Create the user with **no password and `emailVerified = true`**, using `auth.api.createUser` from the server. This is safe because only the mailbox owner can use the reset link or Google for that address.
   - Grant the role.
   - Email an invitation link to `/invite?token=…`, valid for 3 days. It is a reset-password token, the same mechanism as school-schedule's `sendPasswordLink`.
4. **Pending state:** the person has never signed in (no session row ever created). Lists show "Invitación pendiente" with **Reenviar**, which issues a fresh link.
5. Invitee and existing-account emails are matched case-insensitively and trimmed.

**Where invitations happen:**

| Place | Who may invite | Roles |
|---|---|---|
| New **`/admin/team`** page ("Equipo") | `admin` only | org-wide `user_roles`: `admin`, `event_director`, `scoring_operator`, `production_director`, `commentator` |
| Existing **event staff page** `/admin/events/[eventId]/staff` | `admin`, `event_director` | that event's scorekeeper, producer or commentator (the assignment tables) |

**The Team page:**
- Lists the organization's people with their roles and status (active or pending).
- Has an invite form, a remove-role action and a resend action.

**The event staff page:**
- The current candidate picker (staff profiles and athletes, `getEventStaffCandidates`) is replaced by the email field.
- Removing someone from an event keeps today's behaviour: the assignment's status becomes `removed`, and the account stays.

### Database

One new migration:

- **Last-admin protection:** a trigger on `user_roles` refuses a delete, or a role change, that would leave an organization with no `admin`.
- **RLS:**
  - `user_roles` stays admin-managed ("admins manage roles").
  - Event-assignment management stays with the existing policies.
  - The migration adds only what invitations need that the current policies refuse. That is decided while writing the plan, after reading the 0024 and 0025 policies.
- **Account creation:** happens through BetterAuth on the server. The profile trigger on `public."user"` keeps creating the `profiles` row.

### Dev accounts

`scripts/dev-accounts.ts` creates every dev account with `emailVerified = true`. The dev password `Repone1234!` keeps working.

## 4. Errors, tests and delivery

### Errors

Every new or touched form shows its error inline and keeps what was typed. This follows the existing login form's `{ error }` pattern and `signInErrorMessage` / `signUpErrorMessage`. The forms are:
- `/login`, `/signup`, `/forgot-password`, `/reset-password` and `/invite`
- the Team page and the event staff invite
- **athlete onboarding**, which currently throws and shows the runtime error screen

### Tests

- **Unit (vitest):**
  - `resolveHome` for every row of its table.
  - The mapping from roles, assignments and athlete profile to areas, as a pure function over plain data.
  - The new error-message mappers.
- **DB and auth scripts** (they read mail through the Mailpit HTTP API):
  - An unverified password account cannot sign in. The verification link signs it in.
  - A reset changes the password, and the link fails a second time.
  - Inviting a new email creates a verified, passwordless user with the role and sends the email. Inviting an existing account only grants the role.
  - An `event_director` cannot grant `admin` or any org-wide role, and cannot invite to another org's event.
  - Removing the last `admin` fails.
  - The existing `rls-check`, `authz-check`, `auth-check` and `token-check` still pass.
- **Browser (`verify-repone`):**
  - Sign up, read the email, verify, reach the empty start page, create the athlete profile, reach `/athlete`.
  - The admin with an event assignment sees the cards and never sees onboarding.
  - Invite a scorekeeper, read the email, open `/invite`, set a password, land in `/scorekeeper`.
  - `/athlete/login` and `/athlete/signup` redirect.
  - Each area sends an outsider to `/`.
  - Forgot password end to end.
  - Google sign-in from `/login` lands on `/`. Done by the user, since the Google login needs a real account.

### Delivery

- **Branch:** `feat/unified-auth`, on top of `feat/better-auth`. One PR against `staging`, merged after #8.
- **After pulling:** `pnpm dev:setup` is required (new env var, migration, verified dev accounts).
- **Removed:**
  - `staffLandingPath`
  - the `/admin` bounce
  - `getEventStaffCandidates` and its picker
  - the old athlete login and sign-up pages (only redirects remain)
  - the athlete-only Google button placement (the button moves to `/login` and `/signup`)
- **Docs:** the README covers the auth flows, `SMTP_URL` and `MAIL_FROM`. `verify-repone` recipes that sign in through the old athlete pages are updated.
