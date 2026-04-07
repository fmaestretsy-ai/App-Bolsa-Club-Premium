

# Plan: Fase 1 -- Cartera + Dashboard + Operaciones

La Fase 1 del PRD es amplia. Para no sobrecargar una sola iteracion, la dividimos en **3 subfases** que se implementaran secuencialmente. Este plan cubre la **Subfase 1A** completa y describe las siguientes.

---

## Resumen de Subfases

| Subfase | Contenido |
|---------|-----------|
| **1A** (este plan) | Nuevas tablas + tipos de operacion ampliados + formulario mejorado + historial con filtros |
| **1B** | Rediseno de cartera (tabla con filtros, busqueda, ordenacion, peso %, tipo de activo, exposicion) |
| **1C** | Dashboard principal rediseñado (KPIs, graficos de exposicion por sector/pais/divisa/tipo activo, dividendos acumulados, alertas) |

---

## Subfase 1A: Operaciones completas y base de datos

### 1. Migracion de base de datos

Ampliar la tabla `trades` para soportar los nuevos tipos de operacion del PRD:

- Añadir columna `commission` (ya existe, verificar default 0)
- Ampliar los valores posibles de `trade_type` (actualmente solo buy/sell) para incluir: `dividend`, `commission`, `withholding`, `split`, `cash_in`, `cash_out`, `fx_exchange`
- Añadir columnas: `currency_original` (text), `fx_rate_to_base` (numeric, default 1), `amount_base` (numeric) a la tabla `trades`
- Añadir `base_currency` (text, default 'EUR') a tabla `profiles`
- Añadir `asset_type` (text, default 'stock') a tabla `companies` para soportar acciones, ETFs, fondos, renta fija, liquidez

Crear tabla `fx_rates`:
- `id`, `from_currency`, `to_currency`, `date`, `rate`, `source`, `created_at`
- RLS: lectura publica, escritura por usuario autenticado

### 2. Formulario de operacion mejorado (`TradeDialog.tsx`)

Rediseñar el dialogo para soportar todos los tipos:

- Selector de tipo ampliado: Compra, Venta, Dividendo, Comision, Retencion, Split, Ingreso efectivo, Retirada efectivo, Cambio divisa
- Campos condicionales segun tipo (ej: Split solo pide ratio, Dividendo no pide precio por accion)
- Campo de divisa original + tipo de cambio (auto-rellenado si existe en fx_rates, editable manualmente)
- Calculo automatico de `amount_base` = total * fx_rate
- Validaciones: no permitir vender mas de lo que se tiene, split requiere ratio > 0

### 3. Historial de operaciones mejorado (`TradeHistory.tsx`)

- Filtros por: tipo de operacion, empresa/activo, rango de fechas
- Ordenacion por columna (fecha, tipo, ticker, total)
- Badge con color diferente por tipo de operacion
- Mostrar divisa original y equivalente en moneda base
- Paginacion si hay muchas operaciones

### 4. Logica de recalculo de posiciones

Actualizar la logica en `TradeDialog.tsx` para manejar cada tipo:

- **Dividendo**: no cambia shares ni avg_cost, solo se registra
- **Comision/Retencion**: se restan del valor, no cambian posicion
- **Split**: multiplica shares por ratio, divide avg_cost por ratio
- **Cash_in/Cash_out**: operaciones de liquidez (sin company_id)
- **FX exchange**: conversion entre divisas
- **Compra/Venta**: logica existente (mantener)

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/migrations/...` | Nueva migracion con ALTER TABLE y CREATE TABLE |
| `src/components/TradeDialog.tsx` | Rediseño completo del formulario |
| `src/pages/TradeHistory.tsx` | Añadir filtros, ordenacion, nuevos badges |
| `src/types/index.ts` | Añadir tipos para los nuevos trade types |

---

## Lo que NO se toca en esta subfase

- El modulo de valoracion y subida de Excel (intacto)
- El dashboard principal (se mejora en 1C)
- La vista de cartera (se mejora en 1B)
- Graficos de exposicion (subfase 1C)

