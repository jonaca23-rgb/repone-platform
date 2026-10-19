-- ---------------------------------------------------------------------------
-- 0042 — A sponsor switched off org-wide holds no category
--
-- 0032 made a category exclusive per event while the sponsorship is active,
-- but a sponsor switched off for the whole organization still held it,
-- although it shows nowhere. Only active sponsors count now, and switching
-- one back on is checked the way re-activating its sponsorship is.
-- ---------------------------------------------------------------------------

create or replace function check_sponsor_category_exclusive(
  p_sponsorship_id uuid, p_event_id uuid, p_category text, p_exclusive boolean
) returns void as $$
declare
  v_category text := lower(btrim(p_category));
begin
  if v_category is null or v_category = '' then return; end if;
  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':' || v_category));
  if exists (
    select 1 from event_sponsorships es join sponsors s on s.id = es.sponsor_id
    where es.event_id = p_event_id and es.id <> p_sponsorship_id and es.active and s.active
      and lower(btrim(s.category)) = v_category
      and (es.category_exclusive or p_exclusive)
  ) then
    raise exception 'sponsor_category_exclusive: category "%" is exclusive for this event', v_category
      using errcode = '23505';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_sponsor_category_exclusive() returns trigger as $$
declare
  v_sponsor sponsors%rowtype;
begin
  select * into v_sponsor from sponsors where id = new.sponsor_id;
  if new.active and v_sponsor.active then
    perform check_sponsor_category_exclusive(
      new.id, new.event_id, v_sponsor.category, new.category_exclusive);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- A sponsor's sponsorships are checked when it moves into a category or
-- comes back on, whichever brings it into a clash.
create or replace function enforce_sponsor_recategory_exclusive() returns trigger as $$
declare
  r record;
begin
  if not new.active then
    return new;
  end if;
  if old.active
     and lower(btrim(coalesce(new.category, ''))) = lower(btrim(coalesce(old.category, ''))) then
    return new;
  end if;
  for r in select id, event_id, category_exclusive from event_sponsorships
           where sponsor_id = new.id and active loop
    perform check_sponsor_category_exclusive(r.id, r.event_id, new.category, r.category_exclusive);
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists sponsors_category_exclusive on sponsors;
create trigger sponsors_category_exclusive
  after update of category, active on sponsors
  for each row execute function enforce_sponsor_recategory_exclusive();
