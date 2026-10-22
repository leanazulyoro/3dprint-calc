-- Moneda del taller, compartida por sus miembros. Pegar en el SQL Editor.
alter table public.workshops
  add column if not exists currency text not null default 'ARS'
  check (currency in ('ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU', 'MXN', 'COP'));
