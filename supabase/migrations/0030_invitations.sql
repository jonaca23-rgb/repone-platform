-- 0030 — What invitations need: when someone first signed in (pending = never),
-- and members' emails for the Team page (public."user" is closed to the API).
--
-- last_sign_in_at is written by BetterAuth's session.create.after hook
-- (src/lib/auth/auth.ts). A session row is deleted at sign-out, so "has a
-- session" cannot tell an accepted invitation from a pending one; this column can.
alter table public."user" add column last_sign_in_at timestamptz;

-- The Team page lists the org's members with their email and whether they have
-- ever signed in. Only an owner, admin or event director of that org gets rows;
-- anyone else gets none.
create or replace function org_member_emails(p_organization_id uuid)
returns table (user_id uuid, email text, last_sign_in_at timestamptz) as $$
  select u.id, u.email, u.last_sign_in_at
  from public.member m join public."user" u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and has_role(p_organization_id, array['admin','event_director']::user_role[]);
$$ language sql stable security definer set search_path = public;
revoke execute on function org_member_emails(uuid) from public, anon;
grant execute on function org_member_emails(uuid) to authenticated;
