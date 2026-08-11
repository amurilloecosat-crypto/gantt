-- Ejecuta este script en Supabase: Dashboard > SQL Editor > New query > Run
-- Agrega la columna de posición de la guía vertical del Gantt (no afecta datos actuales).

alter table public.projects
  add column if not exists guide_position integer not null default 0;
