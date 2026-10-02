# Unified sign-in, permission-based modules and invitations — Design

**Date:** 2026-10-02
**Status:** design approved in conversation; this is the revision that moves roles to BetterAuth's organization plugin. Awaiting review.

**Branch:** `feat/unified-auth`, stacked on `feat/better-auth` (#8). PRs target `staging` and merge after #8 (see Delivery).

**Model:** the sibling repo `~/Documents/GitHub/school-schedule`:
- BetterAuth `organization` + `admin` plugins, with roles defined in code with `createAccessControl` (`lib/auth/permissions.ts`)
- RLS reads the plugin's `member` table
- one `/login`, and `/` resolves where a signed-in person belongs
- invitations through `createUser` + `addMember` + a password link (`actions/people.ts`, `lib/auth/password-link.ts`)
- SMTP mail (`lib/mailer.ts`)

**Verified against:** better-auth **1.7.6** as installed (`node_modules/better-auth/dist/plugins/{organization,access,admin}`). Where the docs and the installed code disagree, this spec follows the installed code. The disagreements are listed under *Version notes*.

## Problem

1. **Two doors.** `/login` is for staff: everyone lands on `/admin`, which bounces non-admins through `staffLandingPath`. `/athlete/login`, `/athlete/signup` and `/athlete/onboarding` are for athletes, and Google exists only there. Signing up means becoming an athlete, so the dev admin ended up with an athlete profile it never wanted.
2. **Roles are hand-rolled.** A custom `user_roles` table and enum, plus area rules written by hand ("if role X, show Y"). That is why a first design hid modules from the admin. Nothing defines what each role may *do* in one place.
3. **No email.** There is no password reset, no email verification, and no way to bring in staff except picking from accounts that already exist.

## Goals

1. One sign-in and one sign-up for everyone, with Google on both.
2. Roles and permissions defined once, with BetterAuth's access control. What a person can see (modules) and do (guards) follows from their permissions. **An admin sees every module.**
3. People with several roles see every option: a start page with cards, and a header menu.
4. Public sign-up is for future athletes. Staff arrive only by email invitation, org-wide or for one event.
5. Email verification is required for password accounts. Password reset works.
6. Every module rejects outsiders without loops.

## Non-goals

- Multiple organizations. RepOne runs one organization (`bootstrap_organization` enforces it). The plugin supports more, but nothing here adds an org switcher.
- Dynamic, database-defined roles (`dynamicAccessControl`). Roles stay in code so they can be reviewed in a diff.
- Changing what RLS allows. The policies keep their meaning; only the source of roles changes.
- Passkeys, and `/live` and the overlays (they stay public).

## Decisions from the conversation

| Question | Decision |
|---|---|
| Someone with several roles | Start page with every module they can open, plus a header menu |
| What the admin sees | Every module, because they hold every permission |
| A fresh sign-up | An account with no role. The athlete profile is created by choice, only from the start page |
| How staff join | Email invitation only, org-wide (Team page) and per event (event staff page) |
| Mail | Invitations, password reset, required verification |
| Unverified password account | Cannot sign in |
| Roles and permissions | BetterAuth `organization` plugin + `createAccessControl`, as in school-schedule |

---

## 1. Roles and permissions

### Permissions: `src/lib/auth/permissions.ts`

These are defined in code with `createAccessControl`, following the sibling's `permissions.ts`:

```ts
export const statement = {
  ...defaultStatements,              // organization, member, invitation, team, ac
  event:      ["create", "update", "delete"],   // events, venues, floors, divisions, WODs
  athlete:    ["manage"],                       // roster, registrations, teams, lifts
  heat:       ["manage"],                       // heats and lanes
  score:      ["enter"],                        // results and standings
  broadcast:  ["control"],                      // broadcast_state, timer, graphics
  commentary: ["read"],                         // commentator notes and screens
  sponsor:    ["manage"],
  finance:    ["manage"],                       // fees, payments, expenses
  staff:      ["invite"],                       // per-event staff assignments
} as const;
```

| Role | Permissions | Replaces |
|---|---|---|
| `owner` | everything (`ownerAc` + all of the above) | the first `admin` |
| `admin` | everything except `organization:delete` (`adminAc` + all of the above) | `admin` |
| `event_director` | `event`, `athlete`, `heat`, `score`, `broadcast`, `commentary`, `sponsor`, `finance`, `staff:invite`. No `member` or `invitation`, so it cannot grant org roles | `event_director` |
| `production_director` | `heat`, `score`, `broadcast`, `commentary` (producers enter and correct scores) | `production_director` |
| `scoring_operator` | `heat`, `score` | `scoring_operator` |
| `commentator` | `commentary` | `commentator` |

- **Several roles per person:** the plugin stores them comma-joined in `member.role` and grants a permission if any of them authorizes it.
- **The same `ac` and `roles` go to `organization({ ac, roles })` and `organizationClient`.**
- **The plugin's own `member`/`invitation` permissions** guard its endpoints. The plugin also prevents removing or demoting the last owner (`YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER`), so no separate last-admin trigger is needed.

### Event-scoped staff

BetterAuth teams have no per-member role, so per-event staff stay in RepOne's assignment tables (`event_{scorekeeper,producer,commentator}_assignments`). Each one maps to a role from the same `ac`:

| Assignment | Role it grants for that event |
|---|---|
| scorekeeper | `scoring_operator` |
| producer | `production_director` |
| commentator | `commentator` |

### App checks: `src/lib/auth/authorize.ts`

- **`can(ctx, permissions, eventId?)`:** true if any org role authorizes it (`roles[r].authorize(permissions)`, as in the sibling's `roleCan`), or, when `eventId` is given, if the role of an active assignment for that event authorizes it.
- **The existing guards keep their names and signatures,** but they are reimplemented on `can`:
  - `requireOrgManager` → `event:update`
  - `requireEventAccess(eventId, staff)` → org manager, or the assignment
  - Every server action's call site stays the same.
- **`SessionContext`** keeps `userId`, `email` and `organizationId`. `roles: string[]` now comes from `member.role`. `organizationId` comes from the person's `member` row, set as `session.activeOrganizationId` by a `databaseHooks.session.create.before` hook, as in the sibling.

## 2. Database

### Schema the plugins need

These are hand-written in a new migration, matching the installed plugin schema. Ids are `uuid`, through the existing `generateId: "uuid"`.

- **`organizations`** (kept, and mapped as the plugin's `organization` model with `modelName: "organizations"`): add `slug text not null unique` (backfilled from the name), `logo text` and `metadata text`.
- **`member`:** `id`, `organization_id` (FK `organizations`), `user_id` (FK `public."user"`), `role text not null default 'member'`, `created_at`. Unique on `(organization_id, user_id)`.
- **`invitation`:** the plugin's columns. The plugin requires the table, even though RepOne invites through `createUser` (see §4).
- **`public."user"`:** add `role`, `banned`, `ban_reason` and `ban_expires` for the `admin` plugin.
- **`session`:** add `active_organization_id` and `impersonated_by`.
- **RLS:** `invitation` is closed to the API like the other auth tables. `member` is **readable** with the same policies `user_roles` had (your own rows; org members; athletes of the org, for messaging), and never writable through the API: writes go through BetterAuth.

### Roles move from `user_roles` to `member`

- **`has_role(p_organization_id, p_roles user_role[], p_event_id)` keeps its signature,** so the 31 policies and 4 functions that call it don't change.
  - Its body reads `member` instead of `user_roles`: `string_to_array(m.role, ',') && p_roles::text[]`.
  - `owner` counts wherever `admin` is asked for.
  - `p_event_id` is ignored, because org roles are org-wide. Event scope stays in the assignment tables and `is_event_*()`.
  - The `user_role` enum stays only as `has_role`'s parameter type.
- **These are rewritten to read `member`:** `can_message`, `can_like`, the "athlete read org staff roles/profiles" policies, `athlete_private_details`, and `bootstrap_organization`. The last one inserts the org and an `owner` member.
- **Dropped:**
  - `user_roles`
  - `profiles.organization_id`, since membership is the `member` row. Its readers move to `member`: `authorize.ts`, `messages.ts` and `dev-accounts.ts`.
- **Event-assignment write policies** allow org members whose role grants `staff:invite`: `admin`, `owner` and `event_director`. Today they allow `admin` only.
- **Seed and dev accounts:**
  - `seed.sql` gives the org a slug.
  - `dev-accounts.ts` adds `admin@repone.test` as an `owner` member through `auth.api.addMember`.
  - Event staff keep their assignments.
  - Every dev account is created with `emailVerified = true`.

### Drizzle mirror

`src/db/schema/auth.ts` gains:
- `member` and `invitation`
- the `organizations` mapping
- the new columns on `user` and `session`

The comment that org and roles are "deliberately not BetterAuth's" is removed.

## 3. Sign-in screens and routes

A route group `(auth)` gets its own layout: a centered card with the RepOne logo and no app header.

| Route | Behaviour |
|---|---|
| `/login` | Email and password, "Continue with Google", and "Forgot your password?". With a session it redirects to `/`. It reads `?reset=1`, `?invited=1` and `?verified=1` to show a notice. |
| `/signup` | Name, email and password, plus Google. Goes to `/verify-email?email=…`. With a session it redirects to `/`. |
| `/verify-email` | "We sent an email to …", with a resend button. The link verifies, signs in, and lands on `/`. |
| `/forgot-password` | Takes an email. Always shows the same confirmation. |
| `/reset-password?token=` | New password. Goes to `/login?reset=1`. An expired token shows "This link no longer works" with a link to `/forgot-password`. BetterAuth's emailed URL (`/api/auth/reset-password/<token>?callbackURL=/reset-password`) redirects here with `?token=`. |
| `/invite?token=` | The same set-password form for invited people, plus "Continue with Google". Goes to `/login?invited=1`. An expired token says to ask the organizer to resend the invitation. |

**Changes to existing routes:**
- `/athlete/login` → permanent redirect to `/login`, and `/athlete/signup` → permanent redirect to `/signup`, both keeping the query string.
- `/athlete/onboarding` remains, but nothing redirects into it automatically.
- Sign-in, Google and verification end at `/`.
- Sign-out ends at `/login`, with a full page load.
- `/` without a session keeps the public landing, with one "Entrar" link.

## 4. Modules, the start page and guards

### Modules: `src/lib/auth/modules.ts`

Each module declares the permission that opens it:

| Module | Href | Opens with |
|---|---|---|
| Admin | `/admin` | `event:update` (org role) |
| Equipo | `/admin/team` | `member:create` (shown inside Admin) |
| Producción | `/producer` (+ `/dashboard`) | `broadcast:control`, org role or any active producer assignment |
| Scorekeeper | `/scorekeeper` | `score:enter`, org role or any active scorekeeper or producer assignment |
| Comentarista | `/commentator` | `commentary:read`, org role or any active commentator or producer assignment |
| Atleta | `/athlete` | an `athletes` row linked to the account (a profile, not a permission) |

- **`userModules(ctx)`:** server-only, `cache()`d per request, with its queries in parallel. Returns `{ kind, href, label, detail }[]`, where `detail` is the org name, the event names or the athlete's name.
- **Owners and admins hold every permission, so they get Admin, Producción, Scorekeeper and Comentarista.** They also get Atleta if they have a profile.
- **An assignment opens every module whose permission its event role holds** (`assignmentsOpening`): a producer assignment (`production_director`) opens Producción, Scorekeeper and Comentarista, each with the producer's event names as detail. An org role holding a module's permission reaches every event in the org on that module's screens (`eventAccess`, the pickers).

### `resolveHome(modules)` (pure)

| Modules | `/` with a session |
|---|---|
| exactly `[athlete]` | redirect `/athlete` |
| none | empty start page: one action, **"Create my athlete profile"**, and below it "Invited as staff? Use the link in your email." |
| anything with a staff module | start page "Hi, <name>" with a card per module, plus "Create my athlete profile" when there is no athlete profile |

"Create my athlete profile" appears only on the start page.

### Guards

- **Each module's layout calls `requireModule(kind)`.** It redirects to `/login` without a session, and to `/` when the module isn't in `userModules`. `/` never redirects into a module the person lacks, so there are no loops.
- **The per-event layouts and the server actions keep their existing checks,** now implemented on `can`.
- **Removed:** `staffLandingPath`, `ADMIN_AREA_ROLES`, and the `/admin` bounce.

### Header

The (app) header gets an account menu with the person's name. It contains "Inicio", one entry per module, and "Cerrar sesión".

## 5. Mail, verification and invitations

### Mailer

`src/lib/mailer.ts` is ported from the sibling:
- `server-only`, nodemailer over SMTP, configured by `SMTP_URL` and `EMAIL_FROM` (the sibling's names).
- Messages are in English, like the rest of the app's copy, as HTML with a text alternative.
- **Local:** `SMTP_URL=smtp://127.0.0.1:54525`, the Mailpit started by `pnpm dev` (UI at :54524). `pnpm env:local` writes it.
- **Production:** the provider's SMTP relay. Add it to `.env.example` and the README.
- **Delivery check:** the sibling's `lib/auth/delivery.ts` (`expectEmailSent`) is ported too, because `requestPasswordReset` swallows send errors on purpose.

### BetterAuth options

- `emailAndPassword.requireEmailVerification: true`. Signing in unverified fails with a clear message. The form resends the email and goes to `/verify-email`.
- `emailVerification`:
  - `sendVerificationEmail`
  - `sendOnSignUp: true`
  - `autoSignInAfterVerification: true`
  - `expiresIn: 24 h`
  - callback `/`
- `emailAndPassword.sendResetPassword`:
  - The link's `redirectTo` is `/invite` when the account has no credential yet and `/reset-password` otherwise, as in the sibling's `sendPasswordLink`.
  - `resetPasswordTokenExpiresIn: 3 days`. It is a single setting that covers both reset and invite links, and invites need days.
  - `revokeSessionsOnPasswordReset: true`.
- Google is unchanged; its accounts arrive verified, and `accountLinking` links Google only to verified accounts.

### Invitations

The plugin's `inviteMember` / `acceptInvitation` require the invitee to already have an account and a session, which adds a step. Like the sibling, RepOne creates the person instead:

1. The inviter enters an email and a role. The email is trimmed and lowercased.
2. **No account with that email:**
   - `auth.api.createUser({ body: { email, name, data: { emailVerified: true } } })`, called from the server with **no headers** and no password.
   - Then grant the role.
   - Then `auth.api.requestPasswordReset({ body: { email, redirectTo: "/invite" } })`, checked with `expectEmailSent`.
   - The person can either set a password or use "Continue with Google". Google works because the account is already verified.
3. **The account exists:** grant the role. Email a notice with a link to `/login`.
4. **Granting the role:**
   - **Org role:** `auth.api.addMember({ body: { userId, role, organizationId } })` if the person isn't a member yet. This call is server-only and has no permission check of its own, so the action authorizes first.
   - If the person is already a member, `auth.api.updateMemberRole` with the inviter's headers, adding the role to the comma-joined list.
   - **Event role:** upsert the assignment row with status `active`.
5. **Pending invitation:** the person has never had a session. Lists show "Invitación pendiente" with **Reenviar**, which issues a fresh link.

| Where | Who may invite (permission) | What |
|---|---|---|
| **Equipo** `/admin/team` (new) | `member:create` (owner, admin) | org roles: `admin`, `event_director`, `production_director`, `scoring_operator`, `commentator`. Only an owner can grant `owner`, which the plugin enforces |
| **Event staff** `/admin/events/[eventId]/staff` | `staff:invite` (owner, admin, event_director) | that event's scorekeeper, producer, commentator |

- **Equipo** lists the members, their roles and their status. It has invite, remove-role (`updateMemberRole` / `removeMember` with the caller's headers), and resend.
- **Event staff** replaces the candidate picker (`getEventStaffCandidates`) with the email field. Removing someone keeps today's behaviour: the assignment becomes `removed` and the account stays.

## 6. Errors, tests and delivery

### Errors

Every new or touched form shows its error inline and keeps what was typed (the `{ error }` pattern of today's login). The forms are:
- `/login`, `/signup`, `/forgot-password`, `/reset-password` and `/invite`
- Equipo and the event staff invite
- **athlete onboarding**, which currently throws to the runtime error screen

### Tests

- **Unit (vitest):**
  - `resolveHome` for every row of its table.
  - The role table: each role's `authorize` result for each statement. This pins down "admin and owner hold every permission" and "event_director has no `member`".
  - `userModules` mapping as a pure function over plain data.
  - The error mappers.
- **DB and auth scripts** (reading mail through the Mailpit HTTP API):
  - `has_role` gives the same answers as before for every dev account. The existing `rls-check`, `authz-check`, `auth-check` and `token-check` pass, with their role setup moved to `member`.
  - Unverified accounts can't sign in, and the verification link signs them in.
  - A reset link works once.
  - Inviting a new email creates a verified, passwordless user, the role and the email. Inviting an existing account only grants the role.
  - An `event_director` cannot add org members or grant `admin`/`owner`, and cannot invite staff to another org's event.
  - The last owner cannot be removed.
- **Browser (`verify-repone`):**
  - Sign up, email, verify, empty start page, create athlete profile, `/athlete`.
  - The admin's start page shows every module and never sends them to onboarding.
  - Invite a scorekeeper, email, `/invite`, `/scorekeeper`.
  - The old athlete URLs redirect.
  - Each module sends an outsider to `/`.
  - Forgot password.
  - Google from `/login` lands on `/`. Done by the user, since it needs a real Google account.

### Delivery: two PRs on `feat/unified-auth`'s line

1. **`refactor/org-plugin-permissions`** (on `feat/better-auth`):
   - The plugins, `permissions.ts`, the migration (§2), and guards on `can`.
   - **No visible change:** every role keeps its screens, and the RLS and authz checks pass unchanged in meaning.
2. **`feat/unified-auth`** (on 1):
   - Mail, verification, the new routes, modules, the start page, the header, invitations and Equipo.
   - Retiring the old athlete doors and `staffLandingPath`.

Each PR targets `staging`. After pulling, `pnpm dev:setup` is required: the migration, new env vars and verified dev accounts.

### Version notes (installed 1.7.6 vs docs)

- `admin.createUser`:
  - `password` is optional.
  - With **no headers** it skips the permission check. With headers that hold no valid session it returns 401.
  - The docs say a password and a session are required.
- `team.memberCount` and `teamMember.membershipKey` exist in the installed schema but not in the docs. They don't matter here, because teams are not enabled.
- `resetPassword` creates the missing credential account but does **not** set `emailVerified`. Invited accounts are created verified (step 2), so this doesn't block them.
