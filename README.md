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

## Deploy

Sitio estático en GitHub Pages: https://leanazulyoro.github.io/3dprint-calc/

Cada push a `main` corre `.github/workflows/pages.yml` (tests, `next build` con `output: export` y `basePath=/3dprint-calc`) y publica `out/`.

## Desarrollo

Requiere Node 22.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest
pnpm lint
pnpm build
```
