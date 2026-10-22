-- Calculadora 3D: talleres compartidos, impresoras y presupuestos.
-- Pegar entero en el SQL Editor de Supabase. Idempotente.

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU', 'MXN', 'COP')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workshop_members (
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workshop_id, user_id)
);

create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  name text not null,
  watts numeric not null default 0,
  price numeric not null default 0,
  life_hours numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  printer_id uuid references public.printers (id) on delete set null,
  name text not null,
  currency text not null default 'ARS',
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_workshop_created_idx on public.quotes (workshop_id, created_at desc);
create index if not exists printers_workshop_idx on public.printers (workshop_id, created_at);
create index if not exists workshop_members_user_idx on public.workshop_members (user_id);

-- ---------- Helpers ----------

-- security definer: las políticas de workshop_members la usan sin recursión.
create or replace function public.is_member(w uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where workshop_id = w and user_id = auth.uid()
  );
$$;

-- Quien crea un taller queda como owner.
create or replace function public.handle_new_workshop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workshop_members (workshop_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_workshop_created on public.workshops;
create trigger on_workshop_created
  after insert on public.workshops
  for each row execute function public.handle_new_workshop();

-- Cada usuario nuevo arranca con un taller propio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workshops (name, created_by) values ('Mi taller', new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Unirse a un taller con su código. Devuelve el id del taller.
create or replace function public.join_workshop(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  select id into w from public.workshops where join_code = lower(trim(code));
  if w is null then
    raise exception 'Código inválido';
  end if;
  insert into public.workshop_members (workshop_id, user_id, role)
  values (w, auth.uid(), 'member')
  on conflict do nothing;
  return w;
end;
$$;

revoke all on function public.join_workshop(text) from public, anon;
grant execute on function public.join_workshop(text) to authenticated;

-- Mantener updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists printers_touch on public.printers;
create trigger printers_touch before update on public.printers
  for each row execute function public.touch_updated_at();

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------

alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;
alter table public.printers enable row level security;
alter table public.quotes enable row level security;

drop policy if exists "workshops: members read" on public.workshops;
create policy "workshops: members read" on public.workshops
  for select to authenticated using (public.is_member(id));

drop policy if exists "workshops: anyone creates own" on public.workshops;
create policy "workshops: anyone creates own" on public.workshops
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "workshops: members rename" on public.workshops;
create policy "workshops: members rename" on public.workshops
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members: members read" on public.workshop_members;
create policy "members: members read" on public.workshop_members
  for select to authenticated using (public.is_member(workshop_id));

drop policy if exists "members: leave" on public.workshop_members;
create policy "members: leave" on public.workshop_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "printers: members all" on public.printers;
create policy "printers: members all" on public.printers
  for all to authenticated
  using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));

drop policy if exists "quotes: members all" on public.quotes;
create policy "quotes: members all" on public.quotes
  for all to authenticated
  using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));

