-- ---------------------------------------------------------------------------
-- 0044 — A sponsor that is switched off comes off air, and one without a
-- category holds nothing
--
-- - A sponsor on air stayed there when its sponsorship, or the sponsor
--   itself org-wide, was switched off: the overlay follows broadcast_state,
--   which nothing cleared. Both now take it off every floor showing it.
-- - Clearing a sponsor's category left its sponsorships marked exclusive,
--   so editing one was refused ("give the sponsor a category first") and a
--   new category later brought the exclusivity back unasked. It now clears.
-- - The sponsorship check read the sponsor before taking any lock, so an
--   insert and a switch-on of the same sponsor at the same moment could both
--   pass. It now holds the sponsor's row (FOR SHARE), which a switch-on has
--   to wait for, and the switch-on's loop takes its locks in event order.
-- ---------------------------------------------------------------------------

create or replace function enforce_sponsor_category_exclusive() returns trigger as $$
declare
  v_sponsor sponsors%rowtype;
begin
  select * into v_sponsor from sponsors where id = new.sponsor_id for share;
  if new.active and v_sponsor.active then
    perform check_sponsor_category_exclusive(
      new.id, new.event_id, v_sponsor.category, new.category_exclusive);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_sponsor_recategory_exclusive() returns trigger as $$
declare
  r record;
begin
  if coalesce(btrim(new.category), '') = '' then
    update event_sponsorships set category_exclusive = false
    where sponsor_id = new.id and category_exclusive;
  end if;
  if not new.active then
    update broadcast_state
    set active_sponsor_id = null,
        active_graphic = case when active_graphic = 'sponsor' then 'none' else active_graphic end
    where active_sponsor_id = new.id;
    return new;
  end if;
  if old.active
     and lower(btrim(coalesce(new.category, ''))) = lower(btrim(coalesce(old.category, ''))) then
    return new;
  end if;
  for r in select id, event_id, category_exclusive from event_sponsorships
           where sponsor_id = new.id and active order by event_id loop
    perform check_sponsor_category_exclusive(r.id, r.event_id, new.category, r.category_exclusive);
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function take_sponsorship_off_air() returns trigger as $$
begin
  if tg_op = 'DELETE' or (old.active and not new.active) then
    update broadcast_state b
    set active_sponsor_id = null,
        active_graphic = case when b.active_graphic = 'sponsor' then 'none' else b.active_graphic end
    from floors f join venues v on v.id = f.venue_id
    where b.floor_id = f.id and v.event_id = old.event_id and b.active_sponsor_id = old.sponsor_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger event_sponsorships_off_air
  after update of active or delete on event_sponsorships
  for each row execute function take_sponsorship_off_air();
