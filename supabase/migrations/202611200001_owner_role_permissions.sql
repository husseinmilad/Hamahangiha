-- Owner-configurable permissions for workspace roles.
-- Apply after 202611190003_realtime_and_membership_rpcs.sql.

begin;

create table if not exists public.workspace_role_permissions (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  role public.workspace_role not null check (role <> 'owner'),
  permission_key text not null check (permission_key in (
    'manage_items', 'delete_items', 'invite_members', 'manage_members', 'edit_workspace'
  )),
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, role, permission_key)
);

alter table public.workspace_role_permissions enable row level security;
revoke all on public.workspace_role_permissions from anon;
grant select, insert, update, delete on public.workspace_role_permissions to authenticated;

drop policy if exists "role_permissions_select_members" on public.workspace_role_permissions;
create policy "role_permissions_select_members"
on public.workspace_role_permissions for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "role_permissions_manage_owner" on public.workspace_role_permissions;
create policy "role_permissions_manage_owner"
on public.workspace_role_permissions for all to authenticated
using (exists (
  select 1 from public.workspaces w
  where w.id = workspace_role_permissions.workspace_id and w.owner_uid = (select auth.uid())
))
with check (exists (
  select 1 from public.workspaces w
  where w.id = workspace_role_permissions.workspace_id and w.owner_uid = (select auth.uid())
));

create or replace function public.has_workspace_permission(
  p_workspace_id text,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_allowed boolean;
begin
  if auth.uid() is null then return false; end if;
  select role into v_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_role is null then return false; end if;
  if v_role = 'owner' then return true; end if;

  select allowed into v_allowed
  from public.workspace_role_permissions
  where workspace_id = p_workspace_id
    and role = v_role
    and permission_key = p_permission_key;

  if found then return v_allowed; end if;

  -- Backward-compatible defaults for workspaces created before this migration.
  return case
    when v_role = 'executive' then p_permission_key in ('manage_items','delete_items','invite_members','manage_members')
    when v_role = 'coordinator' then p_permission_key in ('manage_items','delete_items','invite_members')
    else false
  end;
end;
$$;

revoke all on function public.has_workspace_permission(text, text) from public;
grant execute on function public.has_workspace_permission(text, text) to authenticated;

drop policy if exists "workspaces_update_managers" on public.workspaces;
create policy "workspaces_update_by_permission"
on public.workspaces for update to authenticated
using (public.has_workspace_permission(id, 'edit_workspace'))
with check (public.has_workspace_permission(id, 'edit_workspace'));

drop policy if exists "items_insert_managers" on public.workspace_items;
create policy "items_insert_by_permission"
on public.workspace_items for insert to authenticated
with check (public.has_workspace_permission(workspace_id, 'manage_items'));

drop policy if exists "items_update_managers" on public.workspace_items;
create policy "items_update_by_permission"
on public.workspace_items for update to authenticated
using (public.has_workspace_permission(workspace_id, 'manage_items'))
with check (public.has_workspace_permission(workspace_id, 'manage_items'));

drop policy if exists "items_delete_managers" on public.workspace_items;
create policy "items_delete_by_permission"
on public.workspace_items for delete to authenticated
using (public.has_workspace_permission(workspace_id, 'delete_items'));

drop policy if exists "invites_insert_managers" on public.workspace_invites;
create policy "invites_insert_by_permission"
on public.workspace_invites for insert to authenticated
with check (
  invited_by_uid = (select auth.uid())
  and public.has_workspace_permission(workspace_id, 'invite_members')
);

drop policy if exists "members_delete_managed_non_owner" on public.workspace_members;
create policy "members_delete_by_permission"
on public.workspace_members for delete to authenticated
using (
  role <> 'owner'
  and public.has_workspace_permission(workspace_id, 'manage_members')
);

create or replace function public.update_workspace_member_role(
  p_workspace_id text,
  p_user_id uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.workspace_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role is null or p_role not in ('executive', 'coordinator', 'member') then
    raise exception 'Invalid target role';
  end if;
  if p_user_id = auth.uid() then raise exception 'Cannot change your own role'; end if;
  if not public.has_workspace_permission(p_workspace_id, 'manage_members') then
    raise exception 'Insufficient permission';
  end if;

  select role into v_target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_target_role is null then raise exception 'Member not found'; end if;
  if v_target_role = 'owner' then raise exception 'Owner role is protected'; end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_workspace_member(
  p_workspace_id text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.workspace_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_user_id = auth.uid() then raise exception 'Cannot remove yourself'; end if;
  if not public.has_workspace_permission(p_workspace_id, 'manage_members') then
    raise exception 'Insufficient permission';
  end if;

  select role into v_target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_target_role is null then raise exception 'Member not found'; end if;
  if v_target_role = 'owner' then raise exception 'Owner cannot be removed'; end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

revoke all on function public.update_workspace_member_role(text, uuid, public.workspace_role) from public;
revoke all on function public.remove_workspace_member(text, uuid) from public;
grant execute on function public.update_workspace_member_role(text, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(text, uuid) to authenticated;

commit;
