const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StockData {
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
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

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

  return {
    currentPrice: toNumber(summary[8]),
    week52High: toNumber(summary[12]),
    week52Low: toNumber(summary[13]),
    sector: toTitleCase(typeof summary[summary.length - 1] === "string" ? summary[summary.length - 1] : null),
  };
}

async function fetchFromGoogleFinance(ticker: string): Promise<StockData> {
  const exchanges = ["NASDAQ", "NYSE", "EPA", "BIT", "TSE", "AMS", "SWX", "TPE"];
  const cleanTicker = ticker.includes(":") ? ticker : null;

  const urls = cleanTicker
    ? [`https://www.google.com/finance/quote/${cleanTicker}`]
    : exchanges.map((exchange) => `https://www.google.com/finance/quote/${ticker}:${exchange}`);

  for (const url of urls) {
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

      console.log(`${ticker}: price=${price}, 52wH=${ds1.week52High}, 52wL=${ds1.week52Low}, sector=${ds1.sector}`);

      return {
        price,
        week52High: ds1.week52High,
        week52Low: ds1.week52Low,
        sector: ds1.sector,
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
    const { ticker } = await req.json();

    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: "Ticker is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Fetching price for:", ticker);
    const data = await fetchFromGoogleFinance(ticker);

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