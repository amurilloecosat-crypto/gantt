-- Ejecuta este script en Supabase: Dashboard > SQL Editor > New query > Run
-- Colaboración: miembros por proyecto, bitácora de cambios y sincronización en tiempo real.
-- No modifica ni borra datos existentes; es seguro correrlo más de una vez.

-- 1) Tablas -----------------------------------------------------------------

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members(user_id);

create table if not exists public.project_changes (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null default '',
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_changes_project_idx on public.project_changes(project_id, created_at desc);

-- 2) Funciones auxiliares (security definer para evitar recursión entre políticas) ---

create or replace function public.is_project_owner(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.projects where id = pid and user_id = auth.uid());
$$;

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid());
$$;

create or replace function public.can_access_project(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_project_owner(pid) or public.is_project_member(pid);
$$;

-- Busca un usuario registrado por correo (solo para usuarios autenticados).
create or replace function public.lookup_user_by_email(p_email text)
returns table (id uuid, name text, email text)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  return query
    select u.id,
           coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email::text)::text,
           u.email::text
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    limit 1;
end;
$$;

-- Lista al dueño y a los miembros de un proyecto al que se tiene acceso.
create or replace function public.list_project_members(p_project_id uuid)
returns table (user_id uuid, name text, email text, is_owner boolean)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.can_access_project(p_project_id) then
    raise exception 'Sin acceso al proyecto';
  end if;
  return query
    select u.id,
           coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email::text)::text,
           u.email::text,
           (u.id = p.user_id)
    from public.projects p
    join auth.users u on u.id = p.user_id
    where p.id = p_project_id
    union all
    select u.id,
           coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email::text)::text,
           u.email::text,
           false
    from public.project_members m
    join auth.users u on u.id = m.user_id
    where m.project_id = p_project_id;
end;
$$;

grant execute on function public.lookup_user_by_email(text) to authenticated;
grant execute on function public.list_project_members(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;

-- 3) Políticas de projects: dueño o miembro leen/editan; solo el dueño elimina -------

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id or public.is_project_member(id));

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id or public.is_project_member(id))
  with check (auth.uid() = user_id or public.is_project_member(id));

-- Un miembro nunca puede cambiar al dueño del proyecto.
create or replace function public.projects_keep_owner()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists projects_keep_owner on public.projects;
create trigger projects_keep_owner
  before update on public.projects
  for each row execute function public.projects_keep_owner();

-- 4) Políticas de project_members -------------------------------------------------------

alter table public.project_members enable row level security;

drop policy if exists "Members visible to project users" on public.project_members;
create policy "Members visible to project users"
  on public.project_members for select
  using (public.can_access_project(project_id));

drop policy if exists "Owner adds members" on public.project_members;
create policy "Owner adds members"
  on public.project_members for insert
  with check (public.is_project_owner(project_id));

drop policy if exists "Owner removes members" on public.project_members;
create policy "Owner removes members"
  on public.project_members for delete
  using (public.is_project_owner(project_id));

-- 5) Políticas de project_changes (bitácora, solo lectura/inserción) --------------------

alter table public.project_changes enable row level security;

drop policy if exists "Changes visible to project users" on public.project_changes;
create policy "Changes visible to project users"
  on public.project_changes for select
  using (public.can_access_project(project_id));

drop policy if exists "Project users log own changes" on public.project_changes;
create policy "Project users log own changes"
  on public.project_changes for insert
  with check (public.can_access_project(project_id) and user_id = auth.uid());

-- 6) Realtime ---------------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.projects;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_changes;
  exception when duplicate_object then null;
  end;
end $$;
