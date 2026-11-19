-- Realtime publication and safe membership management RPCs.
-- Apply after 202611190001 and 202611190002.

begin;

-- Realtime is used only as a change signal; row visibility remains governed by RLS.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'profiles',
      'workspaces',
      'workspace_members',
      'workspace_items',
      'workspace_invites',
      'user_notifications'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

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
  v_actor_role public.workspace_role;
  v_target_role public.workspace_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role not in ('executive', 'coordinator', 'member') then
    raise exception 'Invalid target role';
  end if;
  if p_user_id = auth.uid() then raise exception 'Cannot change your own role'; end if;

  select role into v_actor_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  select role into v_target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_target_role is null then raise exception 'Member not found'; end if;
  if v_target_role = 'owner' then raise exception 'Owner role is protected'; end if;

  if v_actor_role not in ('owner', 'executive')
     and not (v_actor_role = 'coordinator' and p_role = 'member' and v_target_role = 'member') then
    raise exception 'Insufficient permission';
  end if;

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
  v_actor_role public.workspace_role;
  v_target_role public.workspace_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_user_id = auth.uid() then raise exception 'Cannot remove yourself'; end if;

  select role into v_actor_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  select role into v_target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_target_role is null then raise exception 'Member not found'; end if;
  if v_target_role = 'owner' then raise exception 'Owner cannot be removed'; end if;

  if v_actor_role not in ('owner', 'executive')
     and not (v_actor_role = 'coordinator' and v_target_role = 'member') then
    raise exception 'Insufficient permission';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

revoke all on function public.update_workspace_member_role(text, uuid, public.workspace_role) from public;
revoke all on function public.remove_workspace_member(text, uuid) from public;
grant execute on function public.update_workspace_member_role(text, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(text, uuid) to authenticated;

commit;
