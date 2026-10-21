-- Une impresoras duplicadas (mismo taller y mismos números: consumo, precio, vida útil).
-- Conserva la más antigua, reapunta los presupuestos y borra el resto.
-- Correr una vez en el SQL Editor. Si la que queda tiene mal el nombre, se cambia desde el form.

begin;

create temp table dup as
  select
    id,
    first_value(id) over (
      partition by workshop_id, watts, price, life_hours
      order by created_at, id
    ) as keep_id
  from public.printers;

update public.quotes q
set printer_id = d.keep_id
from dup d
where q.printer_id = d.id and d.id <> d.keep_id;

delete from public.printers p
using dup d
where p.id = d.id and d.id <> d.keep_id;

drop table dup;

commit;

select workshop_id, name, watts, price, life_hours, created_at from public.printers order by workshop_id, created_at;
