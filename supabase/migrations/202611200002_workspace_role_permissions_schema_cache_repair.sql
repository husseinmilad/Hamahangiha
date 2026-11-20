-- Repair missing role-permission table and refresh PostgREST schema cache.
-- Safe to run even if the original owner-role-permissions migration was partially applied.

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
using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_role_permissions.workspace_id
      and w.owner_uid = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_role_permissions.workspace_id
      and w.owner_uid = (select auth.uid())
  )
);

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

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid();

  if v_role is null then return false; end if;
  if v_role = 'owner' then return true; end if;

  select rp.allowed into v_allowed
  from public.workspace_role_permissions rp
  where rp.workspace_id = p_workspace_id
    and rp.role = v_role
    and rp.permission_key = p_permission_key;

  if found then return v_allowed; end if;

  return case
    when v_role = 'executive' then p_permission_key in ('manage_items','delete_items','invite_members','manage_members')
    when v_role = 'coordinator' then p_permission_key in ('manage_items','delete_items','invite_members')
    else false
  end;
end;
$$;

revoke all on function public.has_workspace_permission(text, text) from public;
grant execute on function public.has_workspace_permission(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
