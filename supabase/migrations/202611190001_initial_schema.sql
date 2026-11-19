-- Hamahangi: Supabase/PostgreSQL foundation
-- Apply in Supabase SQL Editor or with Supabase CLI migrations.
begin;

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'executive', 'coordinator', 'member');
create type public.item_type as enum ('meeting', 'task', 'event');
create type public.item_priority as enum ('urgent', 'high', 'normal', 'low');
create type public.item_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.invite_status as enum ('pending', 'accepted', 'declined');
create type public.notification_action_status as enum ('none', 'pending', 'confirmed', 'declined', 'done');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  photo_url text not null default '',
  default_title text not null default 'عضو تیم',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id text primary key,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 300),
  owner_uid uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  photo_url text not null default '',
  role public.workspace_role not null default 'member',
  invite_id text not null default '',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_items (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  type public.item_type not null,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  jalali_date text not null check (jalali_date ~ '^\d{4}/\d{2}/\d{2}$'),
  gregorian_date date not null,
  start_time text not null default '',
  end_time text not null default '',
  location text not null default '',
  meeting_link text not null default '',
  priority public.item_priority not null default 'normal',
  status public.item_status not null default 'scheduled',
  assignee_email text not null default '',
  assignee_name text not null default '',
  assignee_uid text not null default '',
  agenda text not null default '',
  minutes text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  confirmed_uids text[] not null default '{}',
  declined_uids text[] not null default '{}',
  notify_members boolean not null default true,
  reminder_minutes integer not null default 15 check (reminder_minutes between 0 and 1440),
  created_by_uid uuid not null references auth.users(id),
  created_by_name text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_items_workspace_date_idx on public.workspace_items(workspace_id, gregorian_date, start_time);

create table public.workspace_invites (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  workspace_name text not null,
  invited_email text not null,
  invited_by_uid uuid not null references auth.users(id),
  invited_by_name text not null,
  invited_by_email text not null,
  role public.workspace_role not null check (role in ('executive', 'coordinator', 'member')),
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_invites_email_status_idx on public.workspace_invites(lower(invited_email), status);

create table public.user_notifications (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  workspace_name text not null,
  item_id text not null default '',
  item_type text not null check (item_type in ('meeting', 'task', 'event', 'invite', 'system')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 500),
  sender_uid uuid,
  sender_name text not null default '',
  sender_email text not null default '',
  read boolean not null default false,
  action_status public.notification_action_status not null default 'none',
  created_at timestamptz not null default now()
);

create index user_notifications_user_created_idx on public.user_notifications(user_id, created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_workspace_member(p_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(p_workspace_id text, p_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role = any(p_roles)
  );
$$;

create or replace function public.create_workspace(p_id text, p_name text, p_description text default '')
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) not between 1 and 100 then raise exception 'Invalid workspace name'; end if;
  select lower(coalesce(email, '')), coalesce(display_name, '')
    into v_email, v_name from public.profiles where id = auth.uid();

  insert into public.workspaces (id, name, description, owner_uid)
  values (p_id, trim(p_name), left(coalesce(p_description, ''), 300), auth.uid());

  insert into public.workspace_members (workspace_id, user_id, email, display_name, role)
  values (p_id, auth.uid(), v_email, v_name, 'owner');

  return p_id;
end;
$$;

create or replace function public.accept_workspace_invite(p_invite_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_email text;
  v_name text;
  v_photo text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(coalesce(email, '')), display_name, photo_url
    into v_email, v_name, v_photo from public.profiles where id = auth.uid();

  select * into v_invite from public.workspace_invites
    where id = p_invite_id and status = 'pending'
      and lower(invited_email) = v_email
    for update;

  if not found then raise exception 'Invitation not found or email does not match'; end if;

  insert into public.workspace_members (workspace_id, user_id, email, display_name, photo_url, role, invite_id)
  values (v_invite.workspace_id, auth.uid(), v_email, coalesce(v_name, ''), coalesce(v_photo, ''), v_invite.role, v_invite.id)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
    set status = 'accepted', updated_at = now()
    where id = p_invite_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_items enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.user_notifications enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workspaces_select_members" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces_insert_owner" on public.workspaces
  for insert to authenticated with check (owner_uid = (select auth.uid()));
create policy "workspaces_update_managers" on public.workspaces
  for update to authenticated using (public.has_workspace_role(id, array['owner','executive']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner','executive']::public.workspace_role[]));
create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated using (owner_uid = (select auth.uid()));

create policy "members_select_workspace" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members_manage_managers" on public.workspace_members
  for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[]));

create policy "items_select_members" on public.workspace_items
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "items_insert_managers" on public.workspace_items
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[])
    and created_by_uid = (select auth.uid())
  );
create policy "items_update_managers" on public.workspace_items
  for update to authenticated using (public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[]));
create policy "items_delete_managers" on public.workspace_items
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[]));

create policy "invites_select_inviter_or_recipient" on public.workspace_invites
  for select to authenticated using (
    invited_by_uid = (select auth.uid())
    or lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
create policy "invites_insert_managers" on public.workspace_invites
  for insert to authenticated with check (
    invited_by_uid = (select auth.uid())
    and public.has_workspace_role(workspace_id, array['owner','executive','coordinator']::public.workspace_role[])
  );
create policy "invites_update_managers_or_recipient" on public.workspace_invites
  for update to authenticated
  using (
    invited_by_uid = (select auth.uid())
    or lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  with check (
    invited_by_uid = (select auth.uid())
    or lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy "notifications_select_own" on public.user_notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications_update_own" on public.user_notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications_insert_workspace_managers" on public.user_notifications
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id)
    and sender_uid = (select auth.uid())
  );
create policy "notifications_delete_own" on public.user_notifications
  for delete to authenticated using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.workspace_items to authenticated;
grant select, insert, update on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.user_notifications to authenticated;
grant execute on function public.create_workspace(text, text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

commit;
