-- ---------------------------------------------------------------------------
-- 0027 — Server-authoritative timer commands (audit finding M5)
--
-- The timer actions read broadcast_state in the app, computed the new state,
-- and wrote it back: "resume" had no status check (a double click while
-- running reset the anchor and dropped the time since), pause/adjust could
-- interleave between two operators, and the anchor was the app server's
-- clock. timer_command() does each transition on one locked row with the
-- database clock, and no-ops a command that doesn't apply to the current
-- state. Proven by scripts/timer-check.ts (pnpm db:timer-check).
-- ---------------------------------------------------------------------------

create or replace function timer_command(
  p_floor_id uuid,
  p_command text,
  p_direction timer_direction default null,
  p_duration_seconds int default null,
  p_delta_seconds numeric default null
) returns broadcast_state as $$
declare
  s broadcast_state;
  v_now timestamptz := clock_timestamp();
  v_elapsed numeric;
begin
  select * into s from broadcast_state where floor_id = p_floor_id for update;
  if not found then
    raise exception 'Floor % has no broadcast state', p_floor_id;
  end if;

  -- Elapsed time right now, whatever the status.
  v_elapsed := s.timer_elapsed_at_anchor
    + case when s.timer_status = 'running' and s.timer_anchor_time is not null
           then greatest(0, extract(epoch from v_now - s.timer_anchor_time)) else 0 end;

  case p_command
    when 'start' then
      if p_direction is null or p_duration_seconds is null then
        raise exception 'start needs a direction and a duration';
      end if;
      update broadcast_state set
        timer_status = 'running', timer_direction = p_direction,
        timer_duration_seconds = p_duration_seconds, timer_elapsed_at_anchor = 0,
        timer_anchor_time = v_now, active_graphic = 'timer'
      where floor_id = p_floor_id returning * into s;

    when 'pause' then
      if s.timer_status = 'running' then
        update broadcast_state set
          timer_status = 'paused', timer_elapsed_at_anchor = v_elapsed, timer_anchor_time = null
        where floor_id = p_floor_id returning * into s;
      end if;

    when 'resume' then
      if s.timer_status = 'paused' then
        update broadcast_state set timer_status = 'running', timer_anchor_time = v_now
        where floor_id = p_floor_id returning * into s;
      end if;

    when 'reset' then
      update broadcast_state set
        timer_status = 'idle', timer_elapsed_at_anchor = 0, timer_anchor_time = null
      where floor_id = p_floor_id returning * into s;

    when 'adjust' then
      if p_delta_seconds is null then
        raise exception 'adjust needs a delta';
      end if;
      -- Count-down: "+10s" puts 10s back on the clock (less elapsed).
      update broadcast_state set
        timer_elapsed_at_anchor = greatest(0, v_elapsed
          + case when s.timer_direction = 'count_down' then -p_delta_seconds else p_delta_seconds end),
        timer_anchor_time = case when s.timer_status = 'running' then v_now else null end
      where floor_id = p_floor_id returning * into s;

    else
      raise exception 'Unknown timer command %', p_command;
  end case;

  return s;
end;
$$ language plpgsql security invoker set search_path = public;

revoke execute on function timer_command(uuid, text, timer_direction, int, numeric) from public, anon;
grant execute on function timer_command(uuid, text, timer_direction, int, numeric) to authenticated;
