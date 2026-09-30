-- 0028 — BetterAuth owns identity (replaces Supabase Auth). The app mints a Supabase JWT per request
-- (sub = public."user".id), so auth.uid() and every policy keep working. Tables mirror src/db/schema/auth.ts.
create table public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null unique,
  email_verified boolean not null default false, image text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.session (
  id uuid primary key default gen_random_uuid(), expires_at timestamptz not null, token text not null unique,
  ip_address text, user_agent text, user_id uuid not null references public."user"(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index session_user_id_idx on public.session (user_id);
create table public.account (
  id uuid primary key default gen_random_uuid(), account_id text not null, provider_id text not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index account_user_id_idx on public.account (user_id);
create table public.verification (
  id uuid primary key default gen_random_uuid(), identifier text not null, value text not null,
  expires_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index verification_identifier_idx on public.verification (identifier);
create table public.rate_limit (id uuid primary key default gen_random_uuid(), key text not null unique,
  count integer not null, last_request bigint not null);

-- Nobody reaches these through the API; BetterAuth uses the owner connection.
alter table public."user" enable row level security;
alter table public.session enable row level security;
alter table public.account enable row level security;
alter table public.verification enable row level security;
alter table public.rate_limit enable row level security;
revoke all on public."user", public.session, public.account, public.verification, public.rate_limit from anon, authenticated;

-- Repoint every FK that referenced auth.users(id). The constraint names are Postgres defaults (<table>_<column>_fkey).
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col, c.confdeltype
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public."user"(id) on delete %s',
      r.tbl, r.conname, r.col,
      case r.confdeltype when 'c' then 'cascade' when 'n' then 'set null' else 'no action' end);
  end loop;
end $$;

-- profiles: one per user, now created when BetterAuth inserts a user.
drop trigger if exists on_auth_user_created on auth.users;
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.name) on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger on_user_created after insert on public."user" for each row execute function handle_new_user();
