-- Ejecuta este script en Supabase: Dashboard > SQL Editor > New query > Run
-- Agrega columnas de personalización de color de cabecera (no afecta datos actuales).

alter table public.projects
  add column if not exists header_bg text not null default '#F5F8F7',
  add column if not exists header_fg text not null default '#475A52';
