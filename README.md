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

## Comisión de Mercado Libre en vivo (opcional)

La API de ML ya no es pública (todo `api.mercadolibre.com` responde 403 sin token). Si creás una app en developers.mercadolibre.com.ar y cargás `ML_CLIENT_ID` y `ML_CLIENT_SECRET` (ver `.env.example`), aparece el botón "Consultar comisión en Mercado Libre", que usa `sites/MLA/listing_prices` con un token de app (`client_credentials`). Sin credenciales, se usa la tabla incorporada.

Los valores se guardan en el navegador. "Copiar link" genera una URL con todos los datos.

## Desarrollo

Requiere Node 22.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest
pnpm lint
pnpm build
```
