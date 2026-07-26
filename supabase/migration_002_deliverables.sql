-- Ejecuta este script en Supabase: Dashboard > SQL Editor > New query > Run
-- Agrega la columna "deliverables" a proyectos ya existentes (no afecta datos actuales).

alter table public.projects
  add column if not exists deliverables jsonb not null default '[]'::jsonb;
