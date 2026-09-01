-- RepOne Platform — account bootstrap helpers
--
-- Two chicken-and-egg problems every fresh install hits:
--  1. `profiles` needs a row for every auth.users row, but nothing creates one.
--  2. Creating the FIRST organization/admin role can't go through the normal
--     RLS policies, because those policies require already having a role.
-- Both are solved with SECURITY DEFINER functions scoped tightly enough that
-- they can't be used to escalate privileges after the fact.

-- Auto-create a profile row whenever a new Supabase auth user is created.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Lets a signed-in user create their organization and become its admin —
-- but ONLY if they don't already belong to one. Safe to expose via RPC:
-- it can create at most one organization per user, ever.
create or replace function bootstrap_organization(p_name text) returns uuid as $$
declare
  v_org_id uuid;
  v_existing uuid;
begin
  select organization_id into v_existing from profiles where id = auth.uid();
  if v_existing is not null then
    raise exception 'User already belongs to an organization';
  end if;

  insert into organizations (name) values (p_name) returning id into v_org_id;

  update profiles set organization_id = v_org_id where id = auth.uid();

  insert into user_roles (user_id, organization_id, role)
  values (auth.uid(), v_org_id, 'admin');

  return v_org_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function bootstrap_organization(text) to authenticated;
