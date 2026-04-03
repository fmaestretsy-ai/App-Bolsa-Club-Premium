

## Plan: Detectar automáticamente la moneda del Excel y guardarla en la empresa

### Problema
Actualmente la moneda de cada empresa está hardcodeada como "USD" por defecto. Las acciones europeas (y de otros mercados) usan EUR, GBP, etc. Los archivos TIKR contienen típicamente un texto como "Amounts in EUR Millions" o "Currency: EUR" en las primeras filas de las hojas de datos.

### Cambios

**1. Detectar moneda en `src/lib/tikrExtractor.ts`**
- Añadir función `detectCurrency(wb)` que escanee las primeras filas de las hojas TIKR (7.TIKR_IS, 8.TIKR_BS, etc.) buscando patrones como:
  - "Amounts in XXX" / "Values in XXX"
  - "Currency: XXX" / "Moneda: XXX"  
  - "EUR Millions" / "USD Thousands"
  - Formato de celdas numéricas (cell format strings contienen "€", "£", etc.)
- Devuelve el código ISO detectado (EUR, USD, GBP...) o null si no se detecta.
- Exportar desde `TikrRawData` un nuevo campo `currency: string | null`.

**2. Propagar moneda en `src/lib/excelParser.ts`**
- Añadir `currency: string | null` a `ParsedFinancialData`.
- En `parseExcelFile`, también buscar en las hojas de resumen (1-4) el mismo patrón de moneda.
- Combinar: prioridad TIKR sheets > summary sheets > null.

**3. Guardar moneda en `ExcelUpload.tsx`**
- Al crear/actualizar la empresa, incluir `currency: parsed.currency ?? 'USD'` en el insert/update de `companies`.
- Así cada empresa tendrá su moneda correcta automáticamente tras el upload.

### Detalle técnico

```typescript
// En tikrExtractor.ts
function detectCurrency(wb: XLSX.WorkBook): string | null {
  const CURRENCY_PATTERN = /(?:amounts?|values?|currency|moneda)\s+(?:in\s+)?(USD|EUR|GBP|JPY|CHF|SEK|NOK|DKK|CAD|AUD|CNY|KRW|INR|HKD|SGD|TWD|MXN|BRL|PLN|ZAR|TRY|CLP|COP|PEN|ARS)/i;
  const UNIT_PATTERN = /(USD|EUR|GBP|JPY|CHF|SEK|NOK|DKK|CAD|AUD|CNY|KRW|INR|HKD|SGD|TWD)\s*(millions?|thousands?|billions?)/i;
  
  // Scan first 5 rows of TIKR sheets
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    for (let r = 0; r < Math.min(5, data.length); r++) {
      for (const cell of data[r]) {
        const s = String(cell ?? "");
        const m = s.match(CURRENCY_PATTERN) || s.match(UNIT_PATTERN);
        if (m) return m[1].toUpperCase();
      }
    }
  }
  return null;
}
```

### Resultado
- Al subir un Excel TIKR de una empresa europea, se detectará "EUR" automáticamente
- La empresa se creará/actualizará con `currency: "EUR"`
- Todas las páginas (Valuation, Projection, etc.) ya usan `getCurrencySymbol(company.currency)` del cambio anterior, así que mostrarán € automáticamente

