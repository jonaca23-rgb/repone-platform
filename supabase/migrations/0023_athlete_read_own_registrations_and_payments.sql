-- RepOne Platform — Let an athlete read (never write) their own
-- registrations/payment status
--
-- Jonathan asked that the athlete dashboard show the check-in QR code the
-- athlete will use to register the day of the competition, tied to their
-- own athlete record, and that it show whether their event fee is paid or
-- pending. The QR code itself just points at the existing staff-only
-- /admin/checkin/[athleteId] screen (0007_payments_and_teams.sql's
-- green/red payment banner, already built for staff scanning at the
-- registration desk) — no new schema needed for that part. But showing the
-- athlete their OWN paid/pending status directly on their own dashboard
-- (not just when staff scans them) needs read access to `registrations`
-- and `payments`, which today are staff-only ("org staff manage
-- registrations"/"org staff manage payments" — see 0002_rls_and_realtime.sql
-- and 0007_payments_and_teams.sql; payments' own comment there says "who
-- has and hasn't paid is not broadcast-facing and not public", which this
-- respects — an athlete can only ever see their OWN status, never anyone
-- else's, and only SELECT, never write).
--
-- Additive SELECT-only policies — RLS SELECT policies are OR'd together, so
-- this only ever widens read access for the athlete's own rows and never
-- touches staff's existing manage (read+write) access, and there is
-- deliberately no matching insert/update/delete policy here: only staff can
-- change a payment's status (mark paid/waived/reset), same as before.

create policy "athlete read own registrations" on registrations for select
  using (exists (select 1 from athletes a where a.id = registrations.athlete_id and a.auth_user_id = auth.uid()));

create policy "athlete read own payments" on payments for select
  using (exists (
    select 1 from registrations r
    join athletes a on a.id = r.athlete_id
    where r.id = payments.registration_id and a.auth_user_id = auth.uid()
  ));
