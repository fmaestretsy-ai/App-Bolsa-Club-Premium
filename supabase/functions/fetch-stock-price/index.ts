const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StockData {
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
}

function extractDs1Data(html: string): { week52High: number | null; week52Low: number | null; sector: string | null } {
  // ds:1 contains company info including 52-week high/low and sector
  // Format: ...price,low52w,high52w,low_day,high_day,...,"sector_name"]]]
  const ds1Match = html.match(/key:\s*'ds:1'[^<]+data:(\[\[\[.+?\]\]\]),\s*sideChannel/);
  if (!ds1Match) return { week52High: null, week52Low: null, sector: null };
  
  try {
    const raw = ds1Match[1];
    
    // Extract sector: last quoted string before ]]]
    let sector: string | null = null;
    const sectorMatch = raw.match(/"([A-Z][^"]{2,50})"\]\]\]/);
    if (sectorMatch) sector = sectorMatch[1];
    
    // Extract 52-week high and low from the numeric sequence
    // Pattern in ds:1: ...,currentPrice,?,52wHigh,52wLow,yearHigh,yearLow,...
    // Actually from the data: 297.39,290.69,298.08,289.45,349,140.53
    // That's: lastPrice, ?, dayHigh, dayLow, 52wHigh, 52wLow
    const numPattern = raw.match(/,([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+),(\d+),"USD"/);
    if (numPattern) {
      const vals = numPattern.slice(1, 7).map(Number);
      // vals[4] = 52w high, vals[5] = 52w low (the bigger range values)
      const allVals = vals.filter(v => !isNaN(v));
      const maxVal = Math.max(...allVals);
      const minVal = Math.min(...allVals.filter(v => v > 0));
      if (maxVal > 0 && minVal > 0 && maxVal > minVal * 1.1) {
        return { week52High: maxVal, week52Low: minVal, sector };
      }
    }
    
    return { week52High: null, week52Low: null, sector };
  } catch {
    return { week52High: null, week52Low: null, sector: null };
  }
}

async function fetchFromGoogleFinance(ticker: string): Promise<StockData> {
  const exchanges = ['NASDAQ', 'NYSE', 'EPA', 'BIT', 'TSE', 'AMS', 'SWX', 'TPE'];
  const cleanTicker = ticker.includes(':') ? ticker : null;

  const urls = cleanTicker
    ? [`https://www.google.com/finance/quote/${cleanTicker}`]
    : exchanges.map(ex => `https://www.google.com/finance/quote/${ticker}:${ex}`);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract current price
      const priceMatch = html.match(/data-last-price="([^"]+)"/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;
      if (!price) continue;

      // Extract from ds:1 structured data (most reliable)
      const ds1 = extractDs1Data(html);
      
      let { week52High, week52Low, sector } = ds1;

      // Fallback: data attributes for 52-week range
      if (!week52High || !week52Low) {
        const highMatch = html.match(/data-52-week-high="([^"]+)"/);
        const lowMatch = html.match(/data-52-week-low="([^"]+)"/);
        if (highMatch) week52High = parseFloat(highMatch[1]);
        if (lowMatch) week52Low = parseFloat(lowMatch[1]);
      }

      console.log(`${ticker}: price=${price}, 52wH=${week52High}, 52wL=${week52Low}, sector=${sector}`);
      return { price, week52High, week52Low, sector };
    } catch (e) {
      console.error(`Error fetching ${url}:`, e);
      continue;
    }
  }
  return { price: null, week52High: null, week52Low: null, sector: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ticker is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching price for:', ticker);
    const data = await fetchFromGoogleFinance(ticker);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
