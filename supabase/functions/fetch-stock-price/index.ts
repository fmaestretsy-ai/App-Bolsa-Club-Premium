const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StockData {
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
  sourceCurrency?: string;
  fxRate?: number;
}

interface GoogleFinanceSummary {
  currentPrice: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function toTitleCase(value: string | null): string | null {
  if (!value) return null;
  return value.trim().split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const SECTOR_MAP: Record<string, string> = {
  "interactive media": "Grandes Tecnológicas",
  "internet content & information": "Grandes Tecnológicas",
  "internet retail": "Grandes Tecnológicas",
  "consumer electronics": "Grandes Tecnológicas",
  "software - infrastructure": "Grandes Tecnológicas",
  "software—infrastructure": "Grandes Tecnológicas",
  "software - application": "Software",
  "software—application": "Software",
  "information technology services": "Software",
  "credit services": "Infraestructura Pagos",
  "financial data & stock exchanges": "Infraestructura Pagos",
  "specialty finance": "Infraestructura Pagos",
  "semiconductors": "Semiconductores",
  "semiconductor equipment & materials": "Semiconductores",
  "insurance - diversified": "Financiera",
  "insurance—diversified": "Financiera",
  "asset management": "Financiera",
  "banks - diversified": "Financiera",
  "banks—diversified": "Financiera",
  "capital markets": "Financiera",
  "financial conglomerates": "Financiera",
  "luxury goods": "Lujo",
  "apparel - luxury": "Lujo",
  "textile - apparel luxury goods": "Lujo",
  "auto manufacturers": "Lujo",
  "conglomerates": "Conglomerado",
  "insurance - property & casualty": "Conglomerado",
  "insurance—property & casualty": "Conglomerado",
  "packaged foods": "Consumo Básico",
  "discount stores": "Consumo Básico",
  "household & personal products": "Consumo Básico",
  "beverages - non-alcoholic": "Consumo Básico",
  "beverages—non-alcoholic": "Consumo Básico",
  "drug manufacturers": "Salud",
  "medical devices": "Salud",
  "healthcare plans": "Salud",
  "oil & gas integrated": "Energía",
  "oil & gas e&p": "Energía",
  "aerospace & defense": "Industrial",
  "industrial conglomerates": "Industrial",
  "telecom services": "Comunicaciones",
  "entertainment": "Entretenimiento",
};

function mapSector(rawSector: string | null): string | null {
  if (!rawSector) return null;
  return SECTOR_MAP[rawSector.toLowerCase().trim()] ?? toTitleCase(rawSector);
}

function extractInitDataBlock(html: string, key: string): unknown[] | null {
  const keyIndex = html.indexOf(`key: '${key}'`);
  if (keyIndex === -1) return null;
  const dataIndex = html.indexOf("data:", keyIndex);
  const sideChannelIndex = html.indexOf(", sideChannel:", dataIndex);
  if (dataIndex === -1 || sideChannelIndex === -1) return null;
  const rawData = html.slice(dataIndex + 5, sideChannelIndex).trim();
  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Failed to parse ${key} block:`, error);
    return null;
  }
}

function extractDs1Data(html: string): GoogleFinanceSummary {
  const ds1Data = extractInitDataBlock(html, "ds:1");
  const summary = Array.isArray(ds1Data?.[0]) && Array.isArray(ds1Data[0]?.[0])
    ? ds1Data[0][0] as unknown[]
    : null;
  if (!summary) {
    return { currentPrice: null, week52High: null, week52Low: null, sector: null };
  }
  const rawSector = typeof summary[summary.length - 1] === "string" ? summary[summary.length - 1] : null;
  return {
    currentPrice: toNumber(summary[8]),
    week52High: toNumber(summary[12]),
    week52Low: toNumber(summary[13]),
    sector: mapSector(rawSector),
  };
}

// Map exchange → currency
const EXCHANGE_CURRENCY: Record<string, string> = {
  NASDAQ: "USD", NYSE: "USD",
  TSX: "CAD", CVE: "CAD",
  LON: "GBP",
  EPA: "EUR", AMS: "EUR", BIT: "EUR", ETR: "EUR", FRA: "EUR",
  SWX: "CHF",
  TYO: "JPY", TSE: "JPY",
  STO: "SEK", OSL: "NOK", CPH: "DKK",
  ASX: "AUD", HKG: "HKD",
  KRX: "KRW", TPE: "TWD",
  NSE: "INR", BOM: "INR",
  BVMF: "BRL", BMV: "MXN",
};

const EXCHANGE_BY_CURRENCY: Record<string, string[]> = {
  USD: ["NASDAQ", "NYSE"],
  EUR: ["AMS", "EPA", "BIT", "ETR", "FRA"],
  GBP: ["LON"],
  CHF: ["SWX"],
  JPY: ["TYO", "TSE"],
  SEK: ["STO"],
  NOK: ["OSL"],
  DKK: ["CPH"],
  CAD: ["TSX", "CVE"],
  AUD: ["ASX"],
  HKD: ["HKG"],
  KRW: ["KRX"],
  TWD: ["TPE"],
  INR: ["NSE", "BOM"],
  BRL: ["BVMF"],
  MXN: ["BMV"],
};

/**
 * Fetch FX rate from Google Finance
 */
async function fetchFxRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const url = `https://www.google.com/finance/quote/${from}-${to}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/data-last-price="([^"]+)"/);
    const rate = toNumber(match?.[1]);
    console.log(`FX ${from}→${to}: ${rate}`);
    return rate;
  } catch (e) {
    console.error(`FX fetch error ${from}→${to}:`, e);
    return null;
  }
}

/**
 * Fetch stock price. 
 * - `sourceCurrency`: the currency of the exchange where the stock primarily trades (e.g. CAD for TSX)
 * - `targetCurrency`: the currency we want the result in (e.g. USD)
 * If they differ, we convert using live FX rates.
 */
async function fetchFromGoogleFinance(
  ticker: string,
  targetCurrency?: string,
  sourceCurrency?: string,
  preferredExchange?: string | null,
): Promise<StockData> {
  const defaultExchanges = ["NASDAQ", "NYSE", "EPA", "BIT", "TSE", "AMS", "SWX", "TPE"];
  const cleanTicker = ticker.includes(":") ? ticker : null;

  let exchanges: string[];
  if (cleanTicker) {
    exchanges = [];
  } else if (preferredExchange) {
    exchanges = [
      preferredExchange,
      ...defaultExchanges.filter((exchange) => exchange !== preferredExchange),
    ];
  } else if (sourceCurrency && EXCHANGE_BY_CURRENCY[sourceCurrency]) {
    // Prioritize exchanges for the SOURCE currency (where the stock actually trades)
    const sourceExchanges = EXCHANGE_BY_CURRENCY[sourceCurrency];
    exchanges = [
      ...sourceExchanges,
      ...defaultExchanges.filter((e) => !sourceExchanges.includes(e)),
    ];
  } else if (targetCurrency && targetCurrency !== "USD" && EXCHANGE_BY_CURRENCY[targetCurrency]) {
    // Fallback: try target currency exchanges first
    const targetExchanges = EXCHANGE_BY_CURRENCY[targetCurrency];
    exchanges = [
      ...targetExchanges,
      ...defaultExchanges.filter((e) => !targetExchanges.includes(e)),
    ];
  } else {
    exchanges = defaultExchanges;
  }

  const urls = cleanTicker
    ? [`https://www.google.com/finance/quote/${cleanTicker}`]
    : exchanges.map((exchange) => `https://www.google.com/finance/quote/${ticker}:${exchange}`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const exchange = cleanTicker ? null : exchanges[i];
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!res.ok) continue;

      const html = await res.text();
      const ds1 = extractDs1Data(html);
      const priceMatch = html.match(/data-last-price="([^"]+)"/);
      const price = toNumber(priceMatch?.[1]) ?? ds1.currentPrice;

      if (!price) continue;

      const exchangeCurrency = exchange ? (EXCHANGE_CURRENCY[exchange] || "USD") : "USD";

      console.log(`${ticker}@${exchange || "direct"}: price=${price} ${exchangeCurrency}, 52wH=${ds1.week52High}, 52wL=${ds1.week52Low}, sector=${ds1.sector}`);

      // Convert if target currency differs from the exchange currency
      if (targetCurrency && targetCurrency !== exchangeCurrency) {
        const fxRate = await fetchFxRate(exchangeCurrency, targetCurrency);
        if (fxRate) {
          console.log(`Converting ${exchangeCurrency}→${targetCurrency} @${fxRate}: ${price} → ${(price * fxRate).toFixed(2)}`);
          return {
            price: Math.round(price * fxRate * 100) / 100,
            week52High: ds1.week52High ? Math.round(ds1.week52High * fxRate * 100) / 100 : null,
            week52Low: ds1.week52Low ? Math.round(ds1.week52Low * fxRate * 100) / 100 : null,
            sector: ds1.sector,
            sourceCurrency: exchangeCurrency,
            fxRate,
          };
        }
        console.warn(`Could not get FX rate ${exchangeCurrency}→${targetCurrency}, returning raw price`);
      }

      return {
        price,
        week52High: ds1.week52High,
        week52Low: ds1.week52Low,
        sector: ds1.sector,
        sourceCurrency: exchangeCurrency,
      };
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  }

  return { price: null, week52High: null, week52Low: null, sector: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker, currency, sourceCurrency, exchange } = await req.json();

    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: "Ticker is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Fetching price for:", ticker, currency ? `(target: ${currency})` : "", sourceCurrency ? `(source: ${sourceCurrency})` : "", exchange ? `(exchange: ${exchange})` : "");
    const data = await fetchFromGoogleFinance(ticker, currency, sourceCurrency, exchange);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
