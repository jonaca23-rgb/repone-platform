-- ---------------------------------------------------------------------------
-- 0043 — A display's settings save in one transaction
--
-- updateDisplaySettings wrote the device row and then its blocks in two
-- requests, so a failed blocks write left the device half-saved. This saves
-- both together. It runs as the caller (security invoker), so the display
-- policies of 0033 still decide who may change what; a device the caller
-- can't change, or of another event, is "display_not_found".
-- ---------------------------------------------------------------------------

create or replace function save_display_settings(
  p_event_id uuid,
  p_display_id uuid,
  p_sponsors_enabled boolean,
  p_info_blocks_between_sponsors int,
  p_blocks jsonb
) returns void as $$
begin
  update display_devices
  set sponsors_enabled = p_sponsors_enabled,
      info_blocks_between_sponsors = p_info_blocks_between_sponsors
  where id = p_display_id and event_id = p_event_id;
  if not found then
    raise exception 'display_not_found: no such display in this event' using errcode = 'P0002';
  end if;

  insert into display_blocks (display_id, block_type, enabled, duration_seconds, weight)
  select p_display_id, b.block_type, b.enabled, b.duration_seconds, b.weight
  from jsonb_to_recordset(p_blocks)
    as b(block_type display_block_type, enabled boolean, duration_seconds int, weight int)
  on conflict (display_id, block_type) do update
    set enabled = excluded.enabled,
        duration_seconds = excluded.duration_seconds,
        weight = excluded.weight;
end;
$$ language plpgsql security invoker set search_path = public;

revoke execute on function save_display_settings(uuid, uuid, boolean, int, jsonb) from public, anon;
grant execute on function save_display_settings(uuid, uuid, boolean, int, jsonb) to authenticated;
