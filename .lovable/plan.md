

## Plan: Usar el símbolo de moneda de la empresa en lugar de "$" hardcodeado

### Problema
Todas las páginas (Valuation, Projection, Companies, FinancialHistory, etc.) tienen el símbolo `$` hardcodeado. Cada empresa tiene un campo `currency` en la base de datos (e.g. "EUR", "USD") que debería usarse para mostrar el símbolo correcto (€, $, £, etc.).

### Cambios

**1. Crear helper de moneda** (`src/lib/currency.ts`)
- Función `getCurrencySymbol(currency: string)` que mapea códigos ISO a símbolos: USD→$, EUR→€, GBP→£, JPY→¥, etc.
- Función `fmtCurrency(value, currency)` reutilizable para formatear precios con el símbolo correcto.

**2. Actualizar `Valuation.tsx`**
- Leer `company.currency` y usar el símbolo correcto en `fmtPrice`, precio actual, precios objetivo, tooltips de gráficos y eje Y.
- ~15 puntos donde se reemplaza `$` por el símbolo dinámico.

**3. Actualizar `Projection.tsx`**
- Mismo patrón: usar `company.currency` en la función `fmt`, cards de precio, tabla y gráfico.

**4. Actualizar `Companies.tsx`**
- En la columna de precio, usar `c.currency` en lugar de `$`.

**5. Actualizar `CompanyDetail.tsx`**
- Precio actual con símbolo dinámico.

**6. Actualizar `FinancialHistory.tsx`** y `FinancialModel.tsx`
- Formatear valores monetarios con el símbolo de la empresa seleccionada.

### Detalle técnico
```typescript
// src/lib/currency.ts
const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF", SEK: "kr",
};
export const getCurrencySymbol = (c?: string) => SYMBOLS[c?.toUpperCase() ?? "USD"] ?? c ?? "$";
```

Cada página ya tiene acceso al objeto `company`, que incluye `currency`. Solo se necesita pasar ese valor a las funciones de formateo.

