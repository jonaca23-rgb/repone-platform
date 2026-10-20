-- ---------------------------------------------------------------------------
-- 0037 — A team member reads their team's registration and payment
--
-- An athlete reads their own registrations and payments (0023), matched on
-- registrations.athlete_id. A team member has no registration of their own:
-- their team's (0036) is the one their fee is paid on, so they read that one
-- too, and its payments. Nobody else's.
-- ---------------------------------------------------------------------------

create policy "team member read team registrations" on registrations for select
  using (exists (
    select 1 from team_members m
    join athletes a on a.id = m.athlete_id
    where m.team_id = registrations.team_id and a.auth_user_id = auth.uid()
  ));

create policy "team member read team payments" on payments for select
  using (exists (
    select 1 from registrations r
    join team_members m on m.team_id = r.team_id
    join athletes a on a.id = m.athlete_id
    where r.id = payments.registration_id and a.auth_user_id = auth.uid()
  ));
