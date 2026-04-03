const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF ",
  SEK: "kr ",
  NOK: "kr ",
  DKK: "kr ",
  CAD: "C$",
  AUD: "A$",
  MXN: "MX$",
  BRL: "R$",
  CNY: "¥",
  KRW: "₩",
  INR: "₹",
  HKD: "HK$",
  SGD: "S$",
  TWD: "NT$",
  PLN: "zł ",
  ZAR: "R ",
  TRY: "₺",
  RUB: "₽",
  ILS: "₪",
  CLP: "CL$",
  COP: "COL$",
  PEN: "S/",
  ARS: "AR$",
};

export const getCurrencySymbol = (currency?: string | null): string =>
  SYMBOLS[currency?.toUpperCase() ?? "USD"] ?? (currency ? `${currency} ` : "$");

export const fmtCurrency = (
  value: number | null | undefined,
  currency?: string | null,
  decimals = 2,
): string => {
  if (value == null) return "—";
  const sym = getCurrencySymbol(currency);
  return `${sym}${value.toFixed(decimals)}`;
};

export const fmtCurrencyCompact = (
  value: number | null | undefined,
  currency?: string | null,
): string => {
  if (value == null) return "—";
  const sym = getCurrencySymbol(currency);
  const n = Number(value);
  if (Math.abs(n) >= 1e6) return `${sym}${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
  return `${sym}${n.toFixed(2)}`;
};
