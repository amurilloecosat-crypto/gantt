-- Ejecuta este script en Supabase: Dashboard > SQL Editor > New query > Run
-- Plantilla personal de notas: una fila por usuario, visible y editable solo por su dueño.
-- Es aditivo: no modifica ni borra datos existentes y se puede correr más de una vez.

create table if not exists public.user_note_templates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  html text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.user_note_templates enable row level security;

drop policy if exists "Own template select" on public.user_note_templates;
create policy "Own template select"
  on public.user_note_templates for select
  using (auth.uid() = user_id);

drop policy if exists "Own template insert" on public.user_note_templates;
create policy "Own template insert"
  on public.user_note_templates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Own template update" on public.user_note_templates;
create policy "Own template update"
  on public.user_note_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Own template delete" on public.user_note_templates;
create policy "Own template delete"
  on public.user_note_templates for delete
  using (auth.uid() = user_id);
