-- Security hardening for the initial Hamahangi Supabase schema.
-- Apply AFTER 202611190001_initial_schema.sql.
begin;

-- Profile identity is controlled by Supabase Auth; clients may edit presentation fields only.
revoke update on public.profiles from authenticated;
grant update (display_name, photo_url, default_title, updated_at) on public.profiles to authenticated;

-- Workspace creation must go through the RPC so the creator is atomically added as owner.
drop policy if exists "workspaces_insert_owner" on public.workspaces;
revoke insert on public.workspaces from authenticated;
revoke update on public.workspaces from authenticated;
grant update (name, description, updated_at) on public.workspaces to authenticated;

-- Membership changes must not allow a coordinator to promote themselves or others to owner.
drop policy if exists "members_manage_managers" on public.workspace_members;
revoke insert, update, delete on public.workspace_members from authenticated;

create policy "members_insert_from_valid_invite_only"
on public.workspace_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.workspace_invites i
    where i.workspace_id = workspace_members.workspace_id
      and i.id = workspace_members.invite_id
      and i.status = 'pending'
      and lower(i.invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and i.role = workspace_members.role
  )
);

create policy "members_delete_managed_non_owner"
on public.workspace_members for delete to authenticated
using (
  role <> 'owner'
  and public.has_workspace_role(
    workspace_id,
    array['owner','executive','coordinator']::public.workspace_role[]
  )
  and (
    role = 'member'
    or public.has_workspace_role(workspace_id, array['owner','executive']::public.workspace_role[])
  )
);

-- Keep item ownership/workspace identity immutable through direct client updates.
revoke update on public.workspace_items from authenticated;
grant update (
  type, title, description, jalali_date, gregorian_date, start_time, end_time,
  location, meeting_link, priority, status, assignee_email, assignee_name,
  assignee_uid, agenda, minutes, checklist, confirmed_uids, declined_uids,
  notify_members, reminder_minutes, updated_at
) on public.workspace_items to authenticated;

-- Invitation status changes are performed by narrow RPCs, not arbitrary row updates.
drop policy if exists "invites_update_managers_or_recipient" on public.workspace_invites;
revoke update on public.workspace_invites from authenticated;

create policy "invites_delete_managed_pending"
on public.workspace_invites for delete to authenticated
using (
  status = 'pending'
  and invited_by_uid = (select auth.uid())
  and public.has_workspace_role(
    workspace_id,
    array['owner','executive','coordinator']::public.workspace_role[]
  )
);

create or replace function public.decline_workspace_invite(p_invite_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(coalesce(email, '')) into v_email
  from public.profiles where id = auth.uid();

  update public.workspace_invites
    set status = 'declined', updated_at = now()
  where id = p_invite_id
    and status = 'pending'
    and lower(invited_email) = v_email;

  if not found then raise exception 'Invitation not found or email does not match'; end if;
end;
$$;

-- A notification may only target a real member of the same workspace.
drop policy if exists "notifications_insert_workspace_managers" on public.user_notifications;
create policy "notifications_insert_workspace_members"
on public.user_notifications for insert to authenticated
with check (
  sender_uid = (select auth.uid())
  and public.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members recipient
    where recipient.workspace_id = user_notifications.workspace_id
      and recipient.user_id = user_notifications.user_id
  )
);

revoke all on function public.create_workspace(text, text, text) from public;
revoke all on function public.accept_workspace_invite(text) from public;
revoke all on function public.decline_workspace_invite(text) from public;
grant execute on function public.create_workspace(text, text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.decline_workspace_invite(text) to authenticated;

commit;
