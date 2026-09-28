-- RepOne Platform — Payments & Registration Fees (architecture-only phase)
--
-- SCOPE OF THIS MIGRATION — read before touching Stripe:
--  * This does NOT integrate Stripe. No Stripe SDK calls happen anywhere in
--    this codebase yet.
--  * This does NOT process a real payment. Every "paid" status here is a
--    manual, human-recorded ledger entry (cash at the door, e-transfer,
--    comped, etc.) — there is no checkout flow.
--  * No credit card or bank account data is requested or stored, anywhere.
--    `payment_accounts.external_account_id` and `payments.stripe_payment_intent_id`
--    are inert placeholder columns — they exist so that when Stripe Connect
--    is wired up later, the ID Stripe returns has a column to land in without
--    another schema migration. Nothing writes to them today.
--  * Design goal: let a future Stripe integration slot in underneath this
--    schema (fee_schedules -> payments) without changing how the rest of the
--    app already models a competitor. See below for why payments hang off
--    `registrations` rather than a new "competitor entry" concept.
--
-- FLEXIBLE ENTRY MODEL — the product rule this schema exists to satisfy:
--   "The system must NOT assume teams of 3. Payments must be connected to
--   the flexible competitor entry model. A competitor entry can be:
--   individual / pair / team of any size / custom format."
--
--   `registrations` (0001_init.sql) already models a competitor entry
--   correctly: exactly one of athlete_id (individual) or team_id (everything
--   else) per row. Rather than inventing a parallel "competitor_entries"
--   table — which would mean teaching Generate Heats, lane assignment,
--   results entry and standings (all built against athlete_id/team_id today)
--   about a second identity — this migration tags *teams* with how they
--   should be treated for fee-matching purposes via `teams.entry_format`,
--   and adds an informational-only `teams.team_size`. Neither is enforced
--   by a CHECK constraint: a "team" can have 2 members or 12, a "pair" can
--   (for one bracket's rules) have 3. Fee schedules key off entry_format,
--   never off a hardcoded headcount.

-- ---------------------------------------------------------------------------
-- Teams: give the existing (UI-less) teams/team_members tables an entry type
-- ---------------------------------------------------------------------------

create type entry_format as enum ('pair', 'team', 'custom');

alter table teams
  add column entry_format entry_format not null default 'team',
  add column team_size int; -- informational only; never a constraint — no fixed roster size is assumed

comment on column teams.team_size is
  'Informational headcount for display/fee-matching only. Never enforced — '
  'rosters of any size are valid, per product rule "must not assume teams of 3".';

-- ---------------------------------------------------------------------------
-- Fee schedules: what an organizer charges, per event/division/entry type
-- ---------------------------------------------------------------------------

-- Includes 'individual' (a registration with athlete_id set, no team row) so
-- a single enum can describe "who this fee applies to" across every entry
-- shape, even though 'individual' never appears in teams.entry_format.
create type competitor_entry_type as enum ('individual', 'pair', 'team', 'custom');

create table fee_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  division_id uuid references divisions(id) on delete cascade, -- null = applies to every division
  entry_type competitor_entry_type, -- null = applies to every entry type
  name text not null, -- e.g. "Individual Registration", "Team of 4+ Add-on", "Late Fee"
  description text,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'usd',
  is_addon boolean not null default false, -- false = base registration fee, true = optional add-on
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on fee_schedules (event_id);

-- ---------------------------------------------------------------------------
-- Payment accounts: one inert Stripe Connect placeholder row per org
-- ---------------------------------------------------------------------------

create type payment_account_status as enum ('not_connected', 'pending', 'connected');

create table payment_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  provider text not null default 'stripe',
  status payment_account_status not null default 'not_connected',
  external_account_id text, -- future: Stripe Connect account id. Unused today.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payments: one manual ledger row per registration (individual OR team)
-- ---------------------------------------------------------------------------

create type payment_status as enum ('unpaid', 'paid', 'waived', 'refunded');

-- 'stripe' is listed so the ledger can represent a future online payment,
-- but nothing in this phase creates a Stripe charge — selecting it here is
-- purely a manual record-keeping label until real Stripe integration lands.
create type payment_method_type as enum ('unpaid', 'cash', 'manual_other', 'stripe');

create table payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  fee_schedule_id uuid references fee_schedules(id) on delete set null,
  amount_cents int not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  status payment_status not null default 'unpaid',
  payment_method payment_method_type not null default 'unpaid',
  stripe_payment_intent_id text, -- future: Stripe PaymentIntent id. Unused today — no card data, ever.
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on payments (status);

-- Itemized breakdown for a payment (base fee + optional add-ons). Sum of
-- line items is expected to equal payments.amount_cents but is not enforced
-- by a trigger in this phase — organizers reconcile manually while this is
-- a manual ledger, same as everything else here.
create table payment_line_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  fee_schedule_id uuid references fee_schedules(id) on delete set null,
  description text not null,
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);

create index on payment_line_items (payment_id);

create trigger payments_set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger payment_accounts_set_updated_at before update on payment_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table fee_schedules enable row level security;
alter table payment_accounts enable row level security;
alter table payments enable row level security;
alter table payment_line_items enable row level security;

-- Fee amounts are non-sensitive and useful on future public registration/
-- payment pages, so they follow the same "public read" convention as
-- divisions/sponsors.
create policy "public read fee_schedules" on fee_schedules for select using (active = true);

create policy "org staff manage fee_schedules" on fee_schedules for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));

-- Payment status/ledger data is organizer-only — who has and hasn't paid is
-- not broadcast-facing and not public.
create policy "org staff manage payment_accounts" on payment_accounts for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));

create policy "org staff manage payments" on payments for all
  using (exists (
    select 1 from registrations r join events e on e.id = r.event_id
    where r.id = payments.registration_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])
  ));

create policy "org staff manage payment_line_items" on payment_line_items for all
  using (exists (
    select 1 from payments p
    join registrations r on r.id = p.registration_id
    join events e on e.id = r.event_id
    where p.id = payment_line_items.payment_id
      and has_role(e.organization_id, array['admin','event_director']::user_role[])
  ));
