# Calculadora de impresión 3D

Calculá el costo real de una pieza impresa en 3D y cuánto cobrarla. Pensada para Argentina (ARS por defecto), funciona con cualquier moneda.

## Qué calcula

- **Material**: gramos × precio por kilo.
- **Electricidad**: consumo (W) × horas × precio del kWh, con recargo según material (ABS/ASA +60%, PETG +15%, TPU +5%).
- **Desgaste de impresora**: precio de la impresora ÷ vida útil en horas × horas, con recargo según material (PETG +30%, TPU +35%, ABS/ASA +25%).
- **Margen de fallos**: porcentaje sobre material + electricidad + desgaste.
- **Mano de obra** y **extras** se suman al costo y al precio tal cual, sin pasar por el margen. Los extras admiten un recargo opcional (%) por gestionar la compra.
- **Precio sugerido**: (material + electricidad + desgaste + fallos) × multiplicador (×2 mayorista … ×5 minorista, o el que quieras) + mano de obra + extras con recargo.
- **Cantidad** solo divide costo y precio por unidad.
- **IVA** (opcional): alícuota configurable sobre el precio sugerido.
- **Mercado Libre** (opcional, solo ARS): calcula a cuánto publicar para que, descontados los cargos, te quede el precio sugerido. Cargo por vender (%), cuotas, costo fijo por unidad según tramo de precio y 21% de IVA sobre los cargos. Tabla oficial de ML, septiembre 2026; revisala si cambia.

La API de Mercado Libre ya no es pública (todo `api.mercadolibre.com` responde 403 sin token), así que los porcentajes van en una tabla editable. Una versión con consulta en vivo vía `listing_prices` y token de app quedó en el historial (`git show 866fed2 -- src/app/api`); requiere un servidor, no funciona en GitHub Pages.

## Sync entre dispositivos (Supabase)

Sin configurar, todo queda en el navegador (IndexedDB). Con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` aparece "Iniciar sesión" (magic link por email). Cada usuario arranca con un taller propio; presupuestos e impresoras se comparten entre los miembros del taller. Para sumar a alguien, pasale el código del taller (en `/guardados`) y que lo cargue en "Unirme a otro taller". Lo que había guardado en el navegador se puede subir al taller desde la misma página.

Setup del proyecto Supabase: pegar `supabase/schema.sql` en el SQL Editor (tablas, RLS, triggers y la RPC `join_workshop`), habilitar Email en Auth y agregar la URL del sitio a las Redirect URLs. `keepalive.yml` hace una consulta diaria para que el proyecto Free no se pause.

## Deploy

https://3dprint-calc.vercel.app/ en Vercel (plan Hobby), conectado al repo: cada push a `main` despliega; cada PR tiene su preview. Las variables de Supabase las carga la integración Supabase → Vercel, que también suma los dominios de preview a las Redirect URLs de Auth. `keepalive.yml` sigue en GitHub Actions.

## Desarrollo

Requiere Node 22.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest
pnpm lint
pnpm build
```
