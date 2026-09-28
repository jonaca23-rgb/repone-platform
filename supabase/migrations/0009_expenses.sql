-- RepOne Platform — Event Expenses + Income & Expense Statement
--
-- Jonathan asked for a section that contrasts competition-fee income against
-- what an event actually cost to run. The income side already exists (the
-- `payments` ledger from 0007_payments_and_teams.sql) — this migration adds
-- the missing other half: a place to record spending. Same manual-ledger
-- philosophy as payments: this is hand-entered bookkeeping, not an
-- accounting-software integration or a bank/card feed.

create type expense_category as enum ('venue', 'equipment', 'staff_judges', 'prizes', 'marketing', 'other');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  category expense_category not null default 'other',
  description text not null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'usd',
  incurred_on date, -- when the cost was actually incurred; null if unknown/not tracked
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on expenses (event_id);

create trigger expenses_set_updated_at before update on expenses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — same organizer-only convention as payments/payment_accounts: what an
-- event spent isn't broadcast-facing or public, and organization_id lives
-- directly on the row (like fee_schedules) so the policy needs no join.
-- ---------------------------------------------------------------------------

alter table expenses enable row level security;

create policy "org staff manage expenses" on expenses for all
  using (has_role(organization_id, array['admin','event_director']::user_role[]))
  with check (has_role(organization_id, array['admin','event_director']::user_role[]));
